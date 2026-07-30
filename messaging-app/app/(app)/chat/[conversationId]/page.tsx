import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-guard";
import { connectDB } from "@/lib/db";
import { hasBlockedUser } from "@/lib/relationships";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import ConversationList from "@/components/chat/ConversationList";
import ChatComposer from "@/components/chat/ChatComposer";
import LiveMessageList from "@/components/chat/LiveMessageList";
import { MarkConversationReadOnOpen } from "@/components/unread/UnreadProvider";
import { isConversationUnread } from "@/lib/read-receipts";

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ conversationId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const currentUser = await requireUser();
  const { conversationId } = await params;
  const query = await searchParams;
  await connectDB();

  const conversations: any[] = await Conversation.find({ participants: currentUser._id })
    .populate("participants", "name username")
    .lean();
  const conversation = conversations.find((item) => String(item._id) === conversationId);
  if (!conversation) notFound();

  const conversationIds = conversations.map((item) => item._id);
  const lastMessages: any[] = await Message.aggregate([
    { $match: { conversation: { $in: conversationIds }, hiddenFrom: { $ne: currentUser._id } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: "$conversation", sender: { $first: "$sender" }, createdAt: { $first: "$createdAt" } } },
  ]);
  const lastMessageByConversation = new Map(lastMessages.map((message) => [String(message._id), message]));
  const now = Date.now();
  const mutedByConversation = new Map(
    (currentUser.mutedConversations || [])
      .filter((mute: any) => !mute.mutedUntil || new Date(mute.mutedUntil).getTime() > now)
      .map((mute: any) => [String(mute.conversation), mute.mutedUntil ? new Date(mute.mutedUntil).toISOString() : null])
  );
  const conversationItems = conversations
    .map((item) => {
      const id = String(item._id);
      const lastMessage = lastMessageByConversation.get(id);
      return {
        _id: id,
        isGroup: item.type === "group",
        name: String(item.name || ""),
        description: String(item.description || ""),
        avatarUrl: String(item.avatarUrl || ""),
        participants: (item.participants || []).map((participant: any) => ({
          _id: String(participant._id),
          name: String(participant.name || ""),
          username: String(participant.username || ""),
        })),
        unread: isConversationUnread(
          id,
          lastMessage ? { sender: String(lastMessage.sender), createdAt: lastMessage.createdAt.toISOString() } : null,
          String(currentUser._id),
          currentUser.readReceipts || [],
        ),
        mutedUntil: mutedByConversation.get(id) as string | null | undefined,
        lastVisibleAt: lastMessage ? new Date(lastMessage.createdAt).getTime() : new Date(item.createdAt).getTime(),
      };
    })
    .sort((a, b) => b.lastVisibleAt - a.lastVisibleAt)
    .map(({ lastVisibleAt, ...item }) => item);

  const messages: any[] = await Message.find({
    conversation: conversation._id,
    hiddenFrom: { $ne: currentUser._id },
  }).populate("sender", "name username").sort({ createdAt: 1 }).lean();
  const initialMessages = messages.map((message) => ({
    id: String(message._id),
    sender: String(message.sender?._id || message.sender),
    senderName: message.sender?.name || "",
    text: message.text,
    imageUrl: message.imageUrl ?? null,
    deliveredAt: message.deliveredAt ? new Date(message.deliveredAt).toISOString() : new Date(message.createdAt).toISOString(),
    deleted: Boolean(message.deleted),
    editedAt: message.editedAt ? new Date(message.editedAt).toISOString() : null,
    createdAt: new Date(message.createdAt).toISOString(),
  }));

  const isGroup = conversation.type === "group";
  const other = conversation.participants.find((participant: any) => String(participant._id) !== String(currentUser._id));
  const displayName = isGroup ? conversation.name : other?.name || "Conversation";
  const subtitle = isGroup ? `${conversation.participants.length} members` : `@${other?.username || "unknown"}`;
  const blocked = !isGroup && other ? await hasBlockedUser(String(currentUser._id), String(other._id)) : false;
  const errorMessage = query.error === "blocked"
    ? "You blocked this person. Unblock them to send messages."
    : query.error === "restricted"
      ? "Your account is currently restricted from sending messages."
      : query.error === "invalid_file_type"
        ? "Only image files can be attached."
        : query.error === "file_too_large"
          ? "Images must be smaller than 8MB."
          : null;
  const receipt = (currentUser.readReceipts || []).find((item: any) => String(item.conversation) === conversationId);

  return (
    <div className="chat-layout">
      <div className="chat-sidebar">
        <div className="chat-sidebar-top"><strong>Chats</strong><Link href="/chat/groups/new" className="chat-create-group-link" aria-label="Create a group">＋ <span>Create group</span></Link></div>
        <ConversationList conversations={conversationItems} currentUserId={String(currentUser._id)} activeConversationId={conversationId} />
      </div>
      <div className="chat-window">
        <MarkConversationReadOnOpen conversationId={conversationId} />
        <div className="chat-header">
          <div className="chat-header-row">
          <div className="chat-header-identity">
            <div className="avatar chat-header-avatar">{isGroup ? "👥" : displayName.charAt(0).toUpperCase()}</div>
            <div><strong>{displayName}</strong><span>{subtitle}</span></div>
          </div>
          {isGroup && <Link href={`/chat/${conversationId}/group`} className="chat-group-details-button">Group details</Link>}
          </div>
        </div>
        {errorMessage && <div className="error-text group-error">{errorMessage}</div>}
        <LiveMessageList conversationId={conversationId} currentUserId={String(currentUser._id)} initialMessages={initialMessages} previousLastReadAt={receipt?.lastReadAt ? new Date(receipt.lastReadAt).toISOString() : null} />
        {blocked ? <div className="chat-blocked-notice">You blocked this person.</div> : <ChatComposer conversationId={conversationId} />}
      </div>
    </div>
  );
}
