import { connectDB } from "@/lib/db";
import User from "@/models/User";

export async function markConversationRead(userId: string, conversationId: string) {
  await connectDB();
  const lastReadAt = new Date();

  const result = await User.updateOne(
    { _id: userId, "readReceipts.conversation": conversationId },
    { $set: { "readReceipts.$.lastReadAt": lastReadAt } }
  );

  if (result.matchedCount === 0) {
    await User.updateOne(
      { _id: userId },
      { $push: { readReceipts: { conversation: conversationId, lastReadAt } } }
    );
  }

  return lastReadAt;
}

export function isConversationUnread(
  conversationId: string,
  lastMessage: { sender: string; createdAt: string } | null,
  currentUserId: string,
  readReceipts: { conversation: any; lastReadAt: any }[]
) {
  if (!lastMessage) return false;
  if (String(lastMessage.sender) === currentUserId) return false;

  const receipt = readReceipts.find((r) => String(r.conversation) === conversationId);
  if (!receipt) return true;

  return new Date(lastMessage.createdAt) > new Date(receipt.lastReadAt);
}
