import { acceptFriendRequestAction, declineFriendRequestAction } from "@/app/(app)/friends/actions";

type PendingRequest = {
  id: string;
  name: string;
  username: string;
};

export default function PendingRequestsList({ requests }: { requests: PendingRequest[] }) {
  if (requests.length === 0) {
    return <div className="user-card-meta">No pending friend requests.</div>;
  }

  return (
    <div>
      {requests.map((request) => (
        <div key={request.id} className="friend-row">
          <div className="avatar">{request.name.charAt(0).toUpperCase()}</div>
          <div style={{ flex: 1 }}>
            <div className="user-card-name">{request.name}</div>
            <div className="user-card-meta">@{request.username}</div>
          </div>
          <form action={acceptFriendRequestAction}>
            <input type="hidden" name="requestId" value={request.id} />
            <button type="submit" className="submit-button" style={{ width: "auto", padding: "8px 14px" }}>
              Accept
            </button>
          </form>
          <form action={declineFriendRequestAction}>
            <input type="hidden" name="requestId" value={request.id} />
            <button type="submit" className="submit-button secondary" style={{ width: "auto", padding: "8px 14px" }}>
              Decline
            </button>
          </form>
        </div>
      ))}
    </div>
  );
}