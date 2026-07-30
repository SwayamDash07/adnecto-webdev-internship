import { requireUser } from "@/lib/auth-guard";
import { connectDB } from "@/lib/db";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import ConversationList from "@/components/chat/ConversationList";
import { isConversationUnread } from "@/lib/read-receipts";
import Link from "next/link";

export default async function ChatIndexPage() {
  const currentUser = await requireUser();
  await connectDB();

  const conversations: any[] = await Conversation.find({ participants: currentUser._id })
    .populate("participants", "name username")
    .lean();

  const conversationIds = conversations.map((conversation: any) => conversation._id);
  const lastMessages: any[] = await Message.aggregate([
    { $match: { conversation: { $in: conversationIds }, hiddenFrom: { $ne: currentUser._id } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: "$conversation", sender: { $first: "$sender" }, createdAt: { $first: "$createdAt" } } },
  ]);
  const lastMessageByConversation = new Map<string, any>(
    lastMessages.map((message: any) => [String(message._id), message])
  );
  const now = Date.now();
  const mutedByConversation = new Map(
    (currentUser.mutedConversations || [])
      .filter((mute: any) => !mute.mutedUntil || new Date(mute.mutedUntil).getTime() > now)
      .map((mute: any) => [String(mute.conversation), mute.mutedUntil ? new Date(mute.mutedUntil).toISOString() : null])
  );

  const conversationsWithUnread = conversations
    .map((conversation: any) => {
      const conversationId = String(conversation._id);
      const lastMessageDoc = lastMessageByConversation.get(conversationId);
      return {
        _id: conversationId,
        isGroup: conversation.type === "group",
        name: String(conversation.name || ""),
        description: String(conversation.description || ""),
        avatarUrl: String(conversation.avatarUrl || ""),
        participants: (conversation.participants || []).map((participant: any) => ({
          _id: String(participant._id),
          name: String(participant.name || ""),
          username: String(participant.username || ""),
        })),
        unread: isConversationUnread(
          conversationId,
          lastMessageDoc ? { sender: String(lastMessageDoc.sender), createdAt: lastMessageDoc.createdAt.toISOString() } : null,
          String(currentUser._id),
          currentUser.readReceipts || []
        ),
        mutedUntil: mutedByConversation.get(conversationId),
        lastVisibleAt: lastMessageDoc ? new Date(lastMessageDoc.createdAt).getTime() : new Date(conversation.createdAt).getTime(),
      };
    })
    .sort((a: any, b: any) => b.lastVisibleAt - a.lastVisibleAt)
    .map(({ lastVisibleAt, ...conversation }: any) => conversation);

  return (
    <div className="chat-layout">
      <div className="chat-sidebar">
        <div className="chat-sidebar-top"><strong>Chats</strong><Link href="/chat/groups/new" className="chat-create-group-link" aria-label="Create a group">＋ <span>Create group</span></Link></div>
        <ConversationList conversations={conversationsWithUnread} currentUserId={String(currentUser._id)} activeConversationId={null} />
      </div>
      <div className="chat-window">
        <div className="empty-state">Pick a conversation on the left, or find someone new from Search.</div>
      </div>
    </div>
  );
}
