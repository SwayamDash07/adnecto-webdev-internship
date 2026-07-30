"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Friend = {
  id: string;
  name: string;
  username: string;
  location?: string;
};

export default function FriendsSearchList({ friends }: { friends: Friend[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(
      (friend) =>
        friend.name.toLowerCase().includes(q) || friend.username.toLowerCase().includes(q)
    );
  }, [friends, query]);

  return (
    <div>
      <div className="home-friends-search-row">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your friends"
          className="text-input"
          autoComplete="off"
        />
      </div>

      {friends.length === 0 ? (
        <div className="empty-state" style={{ padding: "20px 16px" }}>
          No friends yet. Visit someone's profile from Search to send a request.
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: "20px 16px" }}>
          No friends match "{query}".
        </div>
      ) : (
        <div className="home-friends-scroll">
          {filtered.map((friend) => (
            <Link key={friend.id} href={`/profile/${friend.username}`} className="friend-row home-friend-row">
              <div className="avatar">{friend.name.charAt(0).toUpperCase()}</div>
              <div style={{ flex: 1 }}>
                <div className="user-card-name">{friend.name}</div>
                <div className="user-card-meta">{friend.location || `@${friend.username}`}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}