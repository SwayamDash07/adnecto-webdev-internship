"use client";

import Link from "next/link";
import { BellIcon } from "@/components/ui/icons";
import { useUnread } from "@/components/unread/UnreadProvider";

export default function NotificationBell() {
  const { notificationCount } = useUnread();

  return (
    <Link href="/notifications" className="theme-toggle-circle" style={{ position: "relative" }} aria-label="Notifications">
      <BellIcon size={16} />
      {notificationCount > 0 && (
        <span className="nav-icon-badge">{notificationCount > 9 ? "9+" : notificationCount}</span>
      )}
    </Link>
  );
}
