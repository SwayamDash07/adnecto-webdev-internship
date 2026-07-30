import { connectDB } from "@/lib/db";
import User from "@/models/User";
import FriendRequest from "@/models/FriendRequest";

export async function isBlockedBetween(userIdA: string, userIdB: string) {
  await connectDB();
  const [a, b] = await Promise.all([
    User.findById(userIdA).select("blockedUsers").lean<{ blockedUsers?: any[] }>(),
    User.findById(userIdB).select("blockedUsers").lean<{ blockedUsers?: any[] }>(),
  ]);

  const aBlocksB = (a?.blockedUsers || []).some((id: any) => String(id) === userIdB);
  const bBlocksA = (b?.blockedUsers || []).some((id: any) => String(id) === userIdA);

  return aBlocksB || bBlocksA;
}

export async function hasBlockedUser(blockerId: string, blockedUserId: string) {
  await connectDB();
  const blocker = await User.findById(blockerId).select("blockedUsers").lean<{ blockedUsers?: any[] }>();
  return (blocker?.blockedUsers || []).some((id: any) => String(id) === blockedUserId);
}

export type FriendStatus = {
  status: "friends" | "pending_sent" | "pending_received" | "none";
  requestId?: string;
};

export async function getFriendStatus(currentUserId: string, otherUserId: string): Promise<FriendStatus> {
  await connectDB();

  const currentUser = await User.findById(currentUserId).select("friends").lean<{ friends?: any[] }>();
  const isFriend = (currentUser?.friends || []).some((id: any) => String(id) === otherUserId);
  if (isFriend) {
    return { status: "friends" };
  }

  const outgoing = await FriendRequest.findOne({
    from: currentUserId,
    to: otherUserId,
    status: "pending",
  }).lean<{ _id: any }>();
  if (outgoing) {
    return { status: "pending_sent" };
  }

  const incoming = await FriendRequest.findOne({
    from: otherUserId,
    to: currentUserId,
    status: "pending",
  }).lean<{ _id: any }>();
  if (incoming) {
    return { status: "pending_received", requestId: String(incoming._id) };
  }

  return { status: "none" };
}

export async function getFriendStatusMap(
  currentUserId: string,
  targetIds: string[]
): Promise<Map<string, FriendStatus>> {
  await connectDB();
  const map = new Map<string, FriendStatus>();
  if (targetIds.length === 0) return map;

  const currentUser = await User.findById(currentUserId).select("friends").lean<{ friends?: any[] }>();
  const friendIds = new Set((currentUser?.friends || []).map((id: any) => String(id)));

  const requests = await FriendRequest.find({
    status: "pending",
    $or: [
      { from: currentUserId, to: { $in: targetIds } },
      { to: currentUserId, from: { $in: targetIds } },
    ],
  }).lean<any[]>();

  for (const targetId of targetIds) {
    if (friendIds.has(targetId)) {
      map.set(targetId, { status: "friends" });
      continue;
    }

    const outgoing = requests.find(
      (r: any) => String(r.from) === currentUserId && String(r.to) === targetId
    );
    if (outgoing) {
      map.set(targetId, { status: "pending_sent" });
      continue;
    }

    const incoming = requests.find(
      (r: any) => String(r.to) === currentUserId && String(r.from) === targetId
    );
    if (incoming) {
      map.set(targetId, { status: "pending_received", requestId: String(incoming._id) });
      continue;
    }

    map.set(targetId, { status: "none" });
  }

  return map;
}
