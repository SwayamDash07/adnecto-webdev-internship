"use client";

import { useMemo, useState } from "react";

type User = { _id: string; name: string; username: string };

export default function GroupAddMemberPicker({ users }: { users: User[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const visible = useMemo(() => { const value = query.trim().toLowerCase(); return users.filter((user) => !value || user.name.toLowerCase().includes(value) || user.username.toLowerCase().includes(value)); }, [query, users]);
  return <><input className="text-input group-member-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people to add" />{selected.map((id) => <input key={id} type="hidden" name="memberId" value={id} />)}<div className="group-member-list group-add-list">{visible.map((user) => <button type="button" key={user._id} className={`group-member-option${selected.includes(user._id) ? " selected" : ""}`} onClick={() => setSelected((current) => current.includes(user._id) ? current.filter((id) => id !== user._id) : [...current, user._id])}><div className="avatar">{user.name.charAt(0).toUpperCase()}</div><div className="group-member-copy"><strong>{user.name}</strong><span>@{user.username}</span></div><span className="group-check">{selected.includes(user._id) ? "✓" : ""}</span></button>)}</div></>;
}
