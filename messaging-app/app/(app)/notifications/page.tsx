import Link from "next/link";
import { requireUser } from "@/lib/auth-guard";
import { connectDB } from "@/lib/db";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import Notification from "@/models/Notification";
import { isConversationUnread } from "@/lib/read-receipts";
import { MarkNotificationsReadOnOpen } from "@/components/unread/UnreadProvider";

export default async function NotificationsPage() {
  const currentUser = await requireUser();
  await connectDB();

  await Notification.updateMany(
    { recipient: currentUser._id, read: false },
    { read: true }
  );

  const notifications = await Notification.find({ recipient: currentUser._id })
    .populate("actor", "name username")
    .sort({ createdAt: -1 })
    .limit(30)
    .lean<any[]>();

  const conversations = await Conversation.find({ participants: currentUser._id })
    .populate("participants", "name username")
    .lean<any[]>();

  const conversationIds = conversations.map((c: any) => c._id);
  const lastMessages = await Message.aggregate([
    { $match: { conversation: { $in: conversationIds }, hiddenFrom: { $ne: currentUser._id } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$conversation",
        text: { $first: "$text" },
        sender: { $first: "$sender" },
        createdAt: { $first: "$createdAt" },
      },
    },
  ]);
  const lastMessageByConversation = new Map(lastMessages.map((m: any) => [String(m._id), m]));

  const unreadConversations = conversations
    .map((conversation: any) => {
      const lastMessage = lastMessageByConversation.get(String(conversation._id));
      const unread = isConversationUnread(
        String(conversation._id),
        lastMessage
          ? { sender: String(lastMessage.sender), createdAt: lastMessage.createdAt.toISOString() }
          : null,
        String(currentUser._id),
        currentUser.readReceipts || []
      );
      if (!unread) return null;

      const other = conversation.participants.find(
        (p: any) => String(p._id) !== String(currentUser._id)
      );
      return {
        conversationId: String(conversation._id),
        name: other?.name || "Someone",
      };
    })
    .filter(Boolean) as { conversationId: string; name: string }[];

  return (
    <>
    <MarkNotificationsReadOnOpen />
    <div className="container" style={{ maxWidth: 640 }}>
      <Link href="/home" className="page-back-link">
        Back to home
      </Link>
      <div className="brand" style={{ marginBottom: 20 }}>Notifications</div>

      {unreadConversations.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="profile-section-title" style={{ marginBottom: 12 }}>Unread messages</div>
          {unreadConversations.map((item) => (
            <Link key={item.conversationId} href={`/chat/${item.conversationId}`} className="notification-row">
              You have unopened messages from {item.name}
            </Link>
          ))}
        </div>
      )}

      <div className="card">
        <div className="profile-section-title" style={{ marginBottom: 12 }}>Activity</div>
        {notifications.length === 0 && unreadConversations.length === 0 && (
          <div className="user-card-meta">You're all caught up.</div>
        )}
        {notifications.map((notification: any) => (
          <div key={notification._id} className="notification-row">
            {notification.type === "friend_request" && (
              <>
                <Link href={`/profile/${notification.actor.username}`} style={{ fontWeight: 600 }}>
                  {notification.actor.name}
                </Link>{" "}
                sent you a friend request.{" "}
                <Link href="/friends" style={{ color: "var(--accent)", fontWeight: 600 }}>
                  Review
                </Link>
              </>
            )}
            {notification.type === "friend_accepted" && (
              <>
                Your friend request to{" "}
                <Link href={`/profile/${notification.actor.username}`} style={{ fontWeight: 600 }}>
                  {notification.actor.name}
                </Link>{" "}
                was accepted.
              </>
            )}
          </div>
        ))}
      </div>
    </div>
    </>
  );
}
