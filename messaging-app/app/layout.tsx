import { cookies, headers } from "next/headers";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth-guard";
import { connectDB } from "@/lib/db";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import Notification from "@/models/Notification";
import Navbar from "@/components/layout/Navbar";
import { UnreadProvider } from "@/components/unread/UnreadProvider";
import { isConversationUnread } from "@/lib/read-receipts";

export const metadata = {
  title: "Threadline",
  description: "A quiet place to find people and talk to them",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const isAdminRequest = requestHeaders.get("x-threadline-admin") === "1";

  if (isAdminRequest) {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    );
  }

  const cookieStore = await cookies();
  const theme = cookieStore.get("threadline_theme")?.value === "light" ? "light" : "dark";
  const currentUser = await getCurrentUser();

  let unreadConversationIds: string[] = [];
  let notificationBadgeCount = 0;

  if (currentUser) {
    await connectDB();

    const conversations: any[] = await Conversation.find({ participants: currentUser._id })
      .select("_id participants lastMessageAt")
      .lean();

    const conversationIds = conversations.map((c: any) => c._id);

    const lastMessages: any[] = await Message.aggregate([
      { $match: { conversation: { $in: conversationIds }, hiddenFrom: { $ne: currentUser._id } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$conversation",
          sender: { $first: "$sender" },
          createdAt: { $first: "$createdAt" },
        },
      },
    ]);
    const lastMessageByConversation = new Map(lastMessages.map((m: any) => [String(m._id), m]));

    unreadConversationIds = conversations
      .filter((conversation: any) => {
        const lastMessage = lastMessageByConversation.get(String(conversation._id));
        return isConversationUnread(
          String(conversation._id),
          lastMessage ? { sender: String(lastMessage.sender), createdAt: lastMessage.createdAt.toISOString() } : null,
          String(currentUser._id),
          currentUser.readReceipts || []
        );
      })
      .map((conversation: any) => String(conversation._id));

    const unreadNotificationCount = await Notification.countDocuments({
      recipient: currentUser._id,
      read: false,
    });

    notificationBadgeCount = unreadNotificationCount;
  }

  return (
    <html lang="en" data-theme={theme}>
      <body className="app-shell">
        {currentUser ? (
          <UnreadProvider
            initialUnreadConversationIds={unreadConversationIds}
            initialNotificationCount={notificationBadgeCount}
          >
            <Navbar userName={currentUser.name} />
            <div className="app-body">{children}</div>
          </UnreadProvider>
        ) : (
          <div className="app-body">{children}</div>
        )}
      </body>
    </html>
  );
}
