"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUnread } from "@/components/unread/UnreadProvider";
import { muteConversationAction } from "@/app/(app)/chat/actions";

type Participant = { _id: string; name: string; username: string };
type ConversationItem = {
  _id: string;
  participants: Participant[];
  unread?: boolean;
  isGroup?: boolean;
  name?: string;
  description?: string;
  avatarUrl?: string;
  mutedUntil?: string | null;
};

export default function ConversationList({
  conversations,
  currentUserId,
  activeConversationId,
}: {
  conversations: ConversationItem[];
  currentUserId: string;
  activeConversationId: string | null;
}) {
  const { isUnread } = useUnread();
  const [menu, setMenu] = useState<{ conversationId: string; x: number; y: number } | null>(null);
  const [localMuted, setLocalMuted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const closeMenu = () => setMenu(null);
    window.addEventListener("click", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, []);

  return (
    <>
      <Link href="/ai-chat" prefetch={false} className="chat-nova-item">
        <div className="chat-nova-icon">✦</div>
        <div><strong>Nova</strong><span>Your AI assistant</span></div>
      </Link>
      <div className="chat-conversation-list">
      {conversations.length === 0 && <div className="empty-state">No conversations yet. Search for someone to message.</div>}
      {conversations.map((conversation) => {
        const other = conversation.participants.find((p) => String(p._id) !== currentUserId);
        if (!conversation.isGroup && !other) return null;

        const unread = isUnread(conversation._id);
        const isMuted = localMuted[conversation._id] ?? (conversation.mutedUntil !== undefined);

        return (
          <div key={conversation._id} className="chat-list-item-wrap" onContextMenu={(event) => { event.preventDefault(); setMenu({ conversationId: conversation._id, x: Math.min(event.clientX, window.innerWidth - 210), y: Math.min(event.clientY, window.innerHeight - 250) }); }}>
          <Link href={`/chat/${conversation._id}`} prefetch={false} className={`${activeConversationId === conversation._id ? "chat-list-item active" : "chat-list-item"}${isMuted ? " muted" : ""}`}>
            <div className="avatar">{conversation.isGroup && conversation.avatarUrl ? <img src={conversation.avatarUrl} alt="" className="chat-avatar-image" /> : conversation.isGroup ? "👥" : other?.name.charAt(0).toUpperCase()}</div>
            <div style={{ overflow: "hidden", flex: 1 }}>
              <div
                className="user-card-name"
                style={{
                  fontWeight: unread ? 600 : 400,
                  color: unread ? "var(--text)" : undefined,
                }}
              >
                {conversation.isGroup ? conversation.name : other?.name}
              </div>
              <div className="user-card-meta">{conversation.isGroup ? `${conversation.participants.length} members` : `@${other?.username}`}</div>
            </div>
            {isMuted && <span className="chat-muted-indicator" title="Muted" aria-label="Muted">Muted</span>}
            {unread && !isMuted && <span className="unread-dot" />}
          </Link>
          </div>
        );
      })}
      </div>
      {menu && (
        <div className="chat-mute-menu" style={{ left: menu.x, top: menu.y }} onClick={(event) => event.stopPropagation()}>
          {(() => {
            const selectedConversation = conversations.find((conversation) => conversation._id === menu.conversationId);
            const isMuted = localMuted[menu.conversationId] ?? (selectedConversation?.mutedUntil !== undefined);
            return <>
              <strong>{isMuted ? "Muted chat" : "Mute chat"}</strong>
              <form action={muteConversationAction} onSubmit={(event) => {
                const duration = new FormData(event.currentTarget).get("duration");
                setLocalMuted((current) => ({ ...current, [menu.conversationId]: duration !== "off" }));
                setMenu(null);
              }}>
                <input type="hidden" name="conversationId" value={menu.conversationId} />
                {isMuted ? <button type="submit" className="chat-mute-action chat-unmute-button" name="duration" value="off" onClick={() => setLocalMuted((current) => ({ ...current, [menu.conversationId]: false }))}>Unmute</button> : <>
                  <button type="submit" className="chat-mute-action" name="duration" value="1h" onClick={() => setLocalMuted((current) => ({ ...current, [menu.conversationId]: true }))}>1 hour</button>
                  <button type="submit" className="chat-mute-action" name="duration" value="8h" onClick={() => setLocalMuted((current) => ({ ...current, [menu.conversationId]: true }))}>8 hours</button>
                  <button type="submit" className="chat-mute-action" name="duration" value="forever" onClick={() => setLocalMuted((current) => ({ ...current, [menu.conversationId]: true }))}>Until I turn it off</button>
                </>}
              </form>
            </>;
          })()}
        </div>
      )}
    </>
  );
}
