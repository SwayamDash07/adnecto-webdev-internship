"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { markConversationReadAction } from "@/app/(app)/chat/[conversationId]/actions";

type UnreadContextValue = {
  unreadCount: number;
  notificationCount: number;
  isUnread: (conversationId: string) => boolean;
  markConversationRead: (conversationId: string) => void;
  markNotificationsRead: () => void;
};

const UnreadContext = createContext<UnreadContextValue | null>(null);

export function UnreadProvider({
  initialUnreadConversationIds,
  initialNotificationCount,
  children,
}: {
  initialUnreadConversationIds: string[];
  initialNotificationCount: number;
  children: React.ReactNode;
}) {
  const [unreadIds, setUnreadIds] = useState(() => new Set(initialUnreadConversationIds));
  const [notificationCount, setNotificationCount] = useState(initialNotificationCount);

  const markConversationRead = useCallback((conversationId: string) => {
    setUnreadIds((prev) => {
      if (!prev.has(conversationId)) return prev;
      const next = new Set(prev);
      next.delete(conversationId);
      return next;
    });
  }, []);

  const markNotificationsRead = useCallback(() => {
    setNotificationCount(0);
  }, []);

  const value = useMemo<UnreadContextValue>(
    () => ({
      unreadCount: unreadIds.size,
      notificationCount,
      isUnread: (conversationId: string) => unreadIds.has(conversationId),
      markConversationRead,
      markNotificationsRead,
    }),
    [unreadIds, notificationCount, markConversationRead, markNotificationsRead]
  );

  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

export function useUnread() {
  const context = useContext(UnreadContext);
  if (!context) {
    throw new Error("useUnread must be used within UnreadProvider");
  }
  return context;
}

export function MarkConversationReadOnOpen({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const { isUnread, markConversationRead } = useUnread();

  useLayoutEffect(() => {
    const stillUnread = isUnread(conversationId);

    if (!stillUnread) {
      router.refresh();
      markConversationReadAction(conversationId).catch((error) => {
        console.error("Unable to persist read receipt", error);
      });
      return;
    }

    markConversationRead(conversationId);
    markConversationReadAction(conversationId).catch((error) => {
      console.error("Unable to persist read receipt", error);
    });
  }, [conversationId, isUnread, markConversationRead, router]);

  return null;
}

export function MarkNotificationsReadOnOpen() {
  const { markNotificationsRead } = useUnread();

  useLayoutEffect(() => {
    markNotificationsRead();
  }, [markNotificationsRead]);

  return null;
}
