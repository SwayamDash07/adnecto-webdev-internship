import Link from "next/link";
import { requireUser } from "@/lib/auth-guard";
import { connectDB } from "@/lib/db";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import User from "@/models/User";
import FriendRequest from "@/models/FriendRequest";
import RecentChatsList from "@/components/chat/RecentChatsList";
import HomeSearchBar from "@/components/search/HomeSearchBar";
import FriendsSearchList from "@/components/home/FriendsSearchList";
import { UsersIcon } from "@/components/ui/icons";
import { isConversationUnread } from "@/lib/read-receipts";
import ModerationNotice from "@/models/ModerationNotice";
import ModerationNoticeCard from "@/components/home/ModerationNoticeCard";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ appeal?: string; error?: string }> }) {
  const currentUser = await requireUser();
  const query = await searchParams;
  await connectDB();

  const moderationNotices = await ModerationNotice.find({ recipient: currentUser._id, dismissed: { $ne: true } })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean<any[]>();

  const conversations: any[] = await Conversation.find({ participants: currentUser._id })
    .populate("participants", "name username")
    .lean();

  const conversationIds = conversations.map((c: any) => c._id);

  const lastMessages: any[] = await Message.aggregate([
    { $match: { conversation: { $in: conversationIds }, hiddenFrom: { $ne: currentUser._id } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$conversation",
        text: { $first: "$text" },
        imageUrl: { $first: "$imageUrl" },
        sender: { $first: "$sender" },
        createdAt: { $first: "$createdAt" },
      },
    },
  ]);

  const lastMessageByConversation = new Map<string, any>(
    lastMessages.map((m: any) => [String(m._id), m])
  );

  const chats = conversations
    .map((conversation: any) => {
    const other = conversation.participants.find(
      (p: any) => String(p._id) !== String(currentUser._id)
    );
    const lastMessageDoc = lastMessageByConversation.get(String(conversation._id));

    const unread = isConversationUnread(
      String(conversation._id),
      lastMessageDoc
        ? { sender: String(lastMessageDoc.sender), createdAt: lastMessageDoc.createdAt.toISOString() }
        : null,
      String(currentUser._id),
      currentUser.readReceipts || []
    );

    return {
      conversationId: String(conversation._id),
      otherUser: other
        ? { name: other.name, username: other.username }
        : { name: "Unknown", username: "unknown" },
      lastMessage: lastMessageDoc
        ? {
            text: lastMessageDoc.text || "",
            imageUrl: lastMessageDoc.imageUrl || null,
            mine: String(lastMessageDoc.sender) === String(currentUser._id),
          }
        : null,
      unread,
      lastVisibleAt: lastMessageDoc
        ? new Date(lastMessageDoc.createdAt).getTime()
        : new Date(conversation.createdAt).getTime(),
    };
    })
    .sort((a: any, b: any) => b.lastVisibleAt - a.lastVisibleAt)
    .slice(0, 10)
    .map(({ lastVisibleAt, ...chat }: any) => chat);

  const pendingFriendRequestCount = await FriendRequest.countDocuments({
    to: currentUser._id,
    status: "pending",
  });

  const userWithFriends = await User.findById(currentUser._id)
    .populate("friends", "name username location")
    .lean<any>();

  const friends = (userWithFriends?.friends || []).map((friend: any) => ({
    id: String(friend._id),
    name: friend.name,
    username: friend.username,
    location: friend.location,
  }));

  return (
    <div className="container">
      <div className="home-hero">
        <div className="avatar home-hero-avatar">{currentUser.name.charAt(0).toUpperCase()}</div>
        <div>
          <div className="home-hero-heading">Welcome back, {currentUser.name.split(" ")[0]}</div>
          <div className="home-hero-subtitle">Find someone new or pick up where you left off</div>
        </div>
      </div>

      {moderationNotices.length > 0 && (
        <section className="moderation-notices" aria-label="Account notices">
          <div className="moderation-notices-heading">Account notices</div>
          {query.appeal === "submitted" && <div className="moderation-notice-success">Your appeal was sent to the moderation team.</div>}
          {query.error === "appeal_exists" && <div className="moderation-notice-error">You already have an appeal for that notice.</div>}
          {moderationNotices.map((notice: any) => <ModerationNoticeCard key={String(notice._id)} notice={notice} />)}
        </section>
      )}

      <HomeSearchBar />

      <div className="home-split">
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {chats.length > 0 && (
            <div className="profile-section-title" style={{ padding: "18px 20px 8px" }}>
              Recent chats
            </div>
          )}
          <RecentChatsList chats={chats} />
        </div>

        <div className="home-sidebar">
          <Link href="/friends" className="card home-search-friends" style={{ position: "relative" }}>
            <span className="home-search-friends-icon">
              <UsersIcon size={18} />
            </span>
            <span>
              <strong>Friends</strong>
              <span>Requests and your connections</span>
            </span>
            {pendingFriendRequestCount > 0 && (
              <span className="panel-badge">
                {pendingFriendRequestCount > 9 ? "9+" : pendingFriendRequestCount}
              </span>
            )}
          </Link>

          <div className="card home-friends-card">
            <div className="profile-section-title" style={{ marginBottom: 10 }}>
              Your friends {friends.length > 0 ? `(${friends.length})` : ""}
            </div>
            <FriendsSearchList friends={friends} />
          </div>
        </div>
      </div>
    </div>
  );
}
