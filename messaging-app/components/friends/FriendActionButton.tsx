import { sendFriendRequestAction, acceptFriendRequestAction, declineFriendRequestAction } from "@/app/(app)/friends/actions";

export default function FriendActionButton({
  status,
  requestId,
  targetUsername,
}: {
  status: "friends" | "pending_sent" | "pending_received" | "none";
  requestId?: string;
  targetUsername: string;
}) {
  if (status === "friends") {
    return <span className="tag" style={{ fontSize: 13, padding: "6px 12px" }}>Friends ✓</span>;
  }

  if (status === "pending_sent") {
    return (
      <button type="button" className="submit-button secondary" style={{ width: "auto", padding: "10px 18px" }} disabled>
        Request sent
      </button>
    );
  }

  if (status === "pending_received" && requestId) {
    return (
      <div style={{ display: "flex", gap: 8 }}>
        <form action={acceptFriendRequestAction}>
          <input type="hidden" name="requestId" value={requestId} />
          <button type="submit" className="submit-button" style={{ width: "auto", padding: "10px 18px" }}>
            Accept request
          </button>
        </form>
        <form action={declineFriendRequestAction}>
          <input type="hidden" name="requestId" value={requestId} />
          <button type="submit" className="submit-button secondary" style={{ width: "auto", padding: "10px 18px" }}>
            Decline
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={sendFriendRequestAction}>
      <input type="hidden" name="targetUsername" value={targetUsername} />
      <button type="submit" className="submit-button secondary" style={{ width: "auto", padding: "10px 18px" }}>
        Add friend
      </button>
    </form>
  );
}