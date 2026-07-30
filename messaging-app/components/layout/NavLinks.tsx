"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUnread } from "@/components/unread/UnreadProvider";

export default function NavLinks() {
  const pathname = usePathname();
  const { unreadCount } = useUnread();

  const isHome = pathname === "/home";
  const isChat = pathname.startsWith("/chat");
  const isProfile = pathname.startsWith("/profile");
  const isAiChat = pathname.startsWith("/ai-chat");

  return (
    <div className="nav-links">
      <Link href="/home" className={isHome ? "nav-link active" : "nav-link"}>
        Home
      </Link>
      <Link href="/chat" className={isChat ? "nav-link active" : "nav-link"} style={{ position: "relative" }}>
        Chats
        {unreadCount > 0 && <span className="nav-link-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </Link>
      <Link href="/ai-chat" className={isAiChat ? "nav-link active" : "nav-link"}>
        <span className="nav-ai-icon" aria-hidden="true">✦</span> AI
      </Link>
      <Link href="/profile/me" className={isProfile ? "nav-link active" : "nav-link"}>
        Profile
      </Link>
    </div>
  );
}
