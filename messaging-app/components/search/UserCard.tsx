import Link from "next/link";
import { startConversationAction } from "@/app/(app)/chat/actions";
import FriendActionButton from "@/components/friends/FriendActionButton";
import type { FriendStatus } from "@/lib/relationships";

type UserResult = {
  username: string;
  name: string;
  location?: string;
  hobbies?: string[];
  interests?: string[];
  musicTaste?: string;
  movieTaste?: string;
};

export default function UserCard({
  user,
  friendStatus,
}: {
  user: UserResult;
  friendStatus?: FriendStatus;
}) {
  const tags = [...(user.hobbies || []), ...(user.interests || [])].slice(0, 4);
  const details = [user.location, user.musicTaste, user.movieTaste].filter(Boolean);

  return (
    <div className="user-card">
      <div className="avatar">{user.name.charAt(0).toUpperCase()}</div>
      <Link href={`/profile/${user.username}`} className="user-card-name">
        {user.name}
      </Link>
      <div className="user-card-meta">{details.join(" · ") || "No details yet"}</div>
      {tags.length > 0 && (
        <div>
          {tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
        <form action={startConversationAction}>
          <input type="hidden" name="targetUsername" value={user.username} />
          <button type="submit" className="submit-button secondary" style={{ width: "auto", padding: "8px 14px" }}>
            Message
          </button>
        </form>
        {friendStatus && (
          <FriendActionButton
            status={friendStatus.status}
            requestId={friendStatus.requestId}
            targetUsername={user.username}
          />
        )}
      </div>
    </div>
  );
}
