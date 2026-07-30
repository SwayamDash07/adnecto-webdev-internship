"use client";

import { useEffect, useRef, useState } from "react";
import {
  getNewMessagesAction,
  editMessageAction,
  deleteMessageAction,
  getReadStatusAction,
  markConversationReadAction,
} from "@/app/(app)/chat/[conversationId]/actions";
import { SingleTickIcon, DoubleTickIcon } from "@/components/ui/icons";

type ChatMessage = {
  id: string;
  sender: string;
  senderName?: string;
  text: string;
  imageUrl?: string | null;
  deliveredAt: string;
  deleted: boolean;
  editedAt: string | null;
  createdAt: string;
};

export default function LiveMessageList({
  conversationId,
  currentUserId,
  initialMessages,
  previousLastReadAt,
}: {
  conversationId: string;
  currentUserId: string;
  initialMessages: ChatMessage[];
  previousLastReadAt: string | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [otherReadAt, setOtherReadAt] = useState<string | null>(null);
  const [otherHasOpened, setOtherHasOpened] = useState(false);
  const [openReceiptId, setOpenReceiptId] = useState<string | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const knownIds = useRef(new Set(initialMessages.map((m) => m.id)));
  const latestMessageRef = useRef<ChatMessage | null>(initialMessages[initialMessages.length - 1] ?? null);

  useEffect(() => {
    setMessages(initialMessages);
    knownIds.current = new Set(initialMessages.map((m) => m.id));
    latestMessageRef.current = initialMessages[initialMessages.length - 1] ?? null;
    setOpenReceiptId(null);
  }, [conversationId, initialMessages]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const latest = latestMessageRef.current;
        const after = latest ? latest.createdAt : null;
        const fresh = await getNewMessagesAction(conversationId, after);

        const unseen = fresh.filter((message) => !knownIds.current.has(message.id));
        if (unseen.length > 0) {
          unseen.forEach((message) => knownIds.current.add(message.id));
          latestMessageRef.current = unseen[unseen.length - 1];
          setMessages((prev) => [...prev, ...unseen]);

          if (unseen.some((message) => message.sender !== currentUserId)) {
            await markConversationReadAction(conversationId);
          }
        }

        const status = await getReadStatusAction(conversationId);
        setOtherReadAt(status.lastReadAt);
        setOtherHasOpened(status.hasOpenedConversation);
      } catch (error) {
        console.error("Unable to refresh chat receipts", error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [conversationId, currentUserId]);

  useEffect(() => {
    let cancelled = false;

    async function loadReceiptStatus() {
      try {
        await markConversationReadAction(conversationId);
        const status = await getReadStatusAction(conversationId);
        if (!cancelled) {
          setOtherReadAt(status.lastReadAt);
          setOtherHasOpened(status.hasOpenedConversation);
        }
      } catch (error) {
        console.error("Unable to load chat receipts", error);
      }
    }

    loadReceiptStatus();

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    const frame = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [conversationId]);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el || !stickToBottomRef.current) return;
    const frame = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [messages]);

  function startEdit(message: ChatMessage) {
    setEditingId(message.id);
    setEditValue(message.text);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValue("");
  }

  async function saveEdit(messageId: string) {
    const trimmed = editValue.trim();
    if (!trimmed) return;

    await editMessageAction(messageId, trimmed);
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, text: trimmed, editedAt: new Date().toISOString() } : m))
    );
    setEditingId(null);
    setEditValue("");
  }

  async function handleDelete(messageId: string) {
    const confirmed = window.confirm("Delete this message?");
    if (!confirmed) return;

    await deleteMessageAction(messageId);
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, deleted: true, text: "", imageUrl: null } : m))
    );
  }

  function tickStatus(message: ChatMessage): "sent" | "delivered" | "read" {
    if (!otherHasOpened) return "sent";
    if (otherReadAt && new Date(otherReadAt) >= new Date(message.createdAt)) return "read";
    return "delivered";
  }

  function formatTime(value: string | null) {
    if (!value) return "Not yet";
    return new Date(value).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  }

  function readAtFor(message: ChatMessage) {
    if (!otherReadAt || new Date(otherReadAt) < new Date(message.createdAt)) return null;
    return otherReadAt;
  }

  function deliveredAtFor(message: ChatMessage) {
    if (!otherHasOpened) return null;
    return message.deliveredAt || message.createdAt;
  }

  function receiptTitle(message: ChatMessage) {
    const deliveredAt = deliveredAtFor(message);
    const readAt = readAtFor(message);
    return [
      `Sent: ${formatTime(message.createdAt)}`,
      `Delivered: ${formatTime(deliveredAt)}`,
      `Read: ${formatTime(readAt)}`,
    ].join("\n");
  }

  const firstUnreadIndex = messages.findIndex(
    (m) =>
      m.sender !== currentUserId &&
      !m.deleted &&
      (previousLastReadAt === null || new Date(m.createdAt) > new Date(previousLastReadAt))
  );

  return (
    <div
      ref={messagesRef}
      className="chat-messages"
      onScroll={() => {
        const el = messagesRef.current;
        if (!el) return;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        stickToBottomRef.current = distanceFromBottom < 140;
      }}
    >
      {messages.map((message, index) => {
        const mine = message.sender === currentUserId;
        const isEditing = editingId === message.id;
        const status = mine ? tickStatus(message) : null;
        const deliveredAt = mine ? deliveredAtFor(message) : null;
        const readAt = mine ? readAtFor(message) : null;

        return (
          <div key={message.id} className="message-row">
            {index === firstUnreadIndex && (
              <div className="unread-divider">
                <span>Unread messages</span>
              </div>
            )}

            {message.deleted ? (
              <div className={mine ? "message-bubble mine" : "message-bubble theirs"}>
                {!mine && message.senderName && <div className="group-message-sender">{message.senderName}</div>}
                <div className="message-deleted">This message was deleted</div>
                <span className="message-time">
                  {new Date(message.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}
                </span>
              </div>
            ) : (
              <div className={mine ? "message-bubble mine" : "message-bubble theirs"}>
                {!mine && message.senderName && <div className="group-message-sender">{message.senderName}</div>}
                {mine && !isEditing && (
                  <div className="message-actions">
                    {!message.imageUrl && (
                      <button type="button" onClick={() => startEdit(message)} aria-label="Edit message">
                        ✏️
                      </button>
                    )}
                    <button type="button" onClick={() => handleDelete(message.id)} aria-label="Delete message">
                      🗑️
                    </button>
                  </div>
                )}

                {message.imageUrl && (
                  <img src={message.imageUrl} alt="Shared photo" className="message-image" />
                )}

                {isEditing ? (
                  <div className="message-edit-row">
                    <input
                      type="text"
                      className="text-input"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      maxLength={2000}
                      autoFocus
                    />
                    <button type="button" className="edit-save-button" onClick={() => saveEdit(message.id)}>
                      Save
                    </button>
                    <button type="button" className="edit-cancel-button" onClick={cancelEdit}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  message.text && <div>{message.text}</div>
                )}

                <span className="message-time">
                  {new Date(message.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}
                  {message.editedAt && !isEditing ? " · edited" : ""}
                  {status && (
                    <button
                      type="button"
                      className={status === "read" ? "message-tick read" : "message-tick"}
                      title={receiptTitle(message)}
                      aria-label="Show message receipt details"
                      onClick={() => setOpenReceiptId((id) => (id === message.id ? null : message.id))}
                    >
                      {status === "sent" ? <SingleTickIcon /> : <DoubleTickIcon />}
                    </button>
                  )}
                </span>
                {mine && openReceiptId === message.id && (
                  <div className="message-receipt-popover">
                    <div><span>Sent</span><strong>{formatTime(message.createdAt)}</strong></div>
                    <div><span>Delivered</span><strong>{formatTime(deliveredAt)}</strong></div>
                    <div><span>Read</span><strong>{formatTime(readAt)}</strong></div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
