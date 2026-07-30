"use client";

import Link from "next/link";
import { useUnread } from "@/components/unread/UnreadProvider";

type RecentChatItem = {
  conversationId: string;
  otherUser: { name: string; username: string };
  lastMessage: { text: string; imageUrl: string | null; mine: boolean } | null;
  unread?: boolean;
};

export default function RecentChatsList({ chats }: { chats: RecentChatItem[] }) {
  const { isUnread } = useUnread();

  if (chats.length === 0) {
    return (
      <div className="empty-state" style={{ padding: 32 }}>
        No conversations yet. Use Search on the right to find someone to message.
      </div>
    );
  }

  return (
    <div>
      {chats.map((chat) => {
        const unread = isUnread(chat.conversationId);
        const previewText = chat.lastMessage
          ? chat.lastMessage.text || (chat.lastMessage.imageUrl ? "📷 Photo" : "")
          : "No messages yet";

        return (
          <Link key={chat.conversationId} href={`/chat/${chat.conversationId}`} prefetch={false} className="chat-list-item">
            <div className="avatar">{chat.otherUser.name.charAt(0).toUpperCase()}</div>
            <div style={{ overflow: "hidden", flex: 1 }}>
              <div className="user-card-name">{chat.otherUser.name}</div>
              <div
                className="user-card-meta"
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  fontWeight: unread ? 600 : 400,
                  color: unread ? "var(--text)" : "var(--text-muted)",
                }}
              >
                {chat.lastMessage?.mine ? "You: " : ""}
                {previewText}
              </div>
            </div>
            {unread && <span className="unread-dot" />}
          </Link>
        );
      })}
    </div>
  );
}