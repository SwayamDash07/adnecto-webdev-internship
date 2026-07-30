"use client";

import { useMemo, useState } from "react";

type User = { _id: string; name: string; username: string; avatarUrl?: string };

export default function GroupMemberPicker({ users }: { users: User[]; currentUserId: string }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const visibleUsers = useMemo(() => {
    const value = search.trim().toLowerCase();
    return users.filter((user) => !value || user.name.toLowerCase().includes(value) || user.username.toLowerCase().includes(value));
  }, [search, users]);
  function toggle(id: string) { setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  return <div className="group-member-picker"><div className="group-picker-heading"><div><label className="field-label">Add members</label><p className="user-card-meta">{selected.length ? `${selected.length} selected` : "Choose who can join this group"}</p></div>{selected.length > 0 && <span className="group-selected-count">{selected.length}</span>}</div><input className="text-input group-member-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people" aria-label="Search people to add" /><div className="group-member-list">{visibleUsers.length === 0 ? <div className="empty-state group-empty">No people found.</div> : visibleUsers.map((user) => <label key={user._id} className={`group-member-option${selected.includes(user._id) ? " selected" : ""}`}><input type="checkbox" name="memberId" value={user._id} checked={selected.includes(user._id)} onChange={() => toggle(user._id)} /><div className="avatar">{user.name.charAt(0).toUpperCase()}</div><div className="group-member-copy"><strong>{user.name}</strong><span>@{user.username}</span></div><span className="group-check">{selected.includes(user._id) ? "✓" : ""}</span></label>)}</div></div>;
}
