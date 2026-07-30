import Link from "next/link";
import { requireUser } from "@/lib/auth-guard";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import FriendRequest from "@/models/FriendRequest";
import { cancelFriendRequestAction } from "./actions";
import PendingRequestsList from "@/components/friends/PendingRequestsList";

export default async function FriendsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const currentUser = await requireUser();
  const query = await searchParams;
  await connectDB();

  const userWithFriends = await User.findById(currentUser._id)
    .populate("friends", "name username location")
    .lean<any>();

  const incomingRequests = await FriendRequest.find({ to: currentUser._id, status: "pending" })
    .populate("from", "name username")
    .sort({ createdAt: -1 })
    .lean<any[]>();

  const outgoingRequests = await FriendRequest.find({ from: currentUser._id, status: "pending" })
    .populate("to", "name username")
    .sort({ createdAt: -1 })
    .lean<any[]>();

  const friends = userWithFriends?.friends || [];

  const incomingRequestItems = incomingRequests.map((request: any) => ({
    id: String(request._id),
    name: request.from.name,
    username: request.from.username,
  }));

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <Link href={`/profile/${currentUser.username}`} className="page-back-link">
        Back to profile
      </Link>
      <div className="brand" style={{ marginBottom: 20 }}>Friends</div>
      {query.error === "restricted" && (
        <div className="error-text">Your account is currently restricted from accepting friend requests.</div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="profile-section-title" style={{ marginBottom: 12 }}>Friend requests</div>
        <PendingRequestsList requests={incomingRequestItems} />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="profile-section-title" style={{ marginBottom: 12 }}>
          Your friends {friends.length > 0 ? `(${friends.length})` : ""}
        </div>
        {friends.length === 0 && (
          <div className="user-card-meta">
            No friends yet. Visit someone's profile from Search to send a request.
          </div>
        )}
        {friends.map((friend: any) => (
          <Link key={friend._id} href={`/profile/${friend.username}`} className="friend-row">
            <div className="avatar">{friend.name.charAt(0).toUpperCase()}</div>
            <div style={{ flex: 1 }}>
              <div className="user-card-name">{friend.name}</div>
              <div className="user-card-meta">
                {friend.location || `@${friend.username}`}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {outgoingRequests.length > 0 && (
        <div className="card">
          <div className="profile-section-title" style={{ marginBottom: 12 }}>Sent requests</div>
          {outgoingRequests.map((request: any) => (
            <div key={request._id} className="friend-row">
              <div className="avatar">{request.to.name.charAt(0).toUpperCase()}</div>
              <div style={{ flex: 1 }}>
                <div className="user-card-name">{request.to.name}</div>
                <div className="user-card-meta">@{request.to.username}</div>
              </div>
              <form action={cancelFriendRequestAction}>
                <input type="hidden" name="requestId" value={String(request._id)} />
                <button type="submit" className="submit-button secondary" style={{ width: "auto", padding: "8px 14px" }}>
                  Cancel
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
