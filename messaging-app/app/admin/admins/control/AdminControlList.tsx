"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { adminPath } from "@/lib/admin-route";

type AdminControlRow = {
  id: string;
  username: string;
  isMainAdmin: boolean;
  flagCount: number;
  latestActivity: string | null;
};

export default function AdminControlList({ admins }: { admins: AdminControlRow[] }) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const filteredAdmins = useMemo(
    () => admins.filter((admin) => admin.username.toLowerCase().includes(normalizedSearch)),
    [admins, normalizedSearch],
  );

  return (
    <>
      <div className="admin-control-search">
        <label htmlFor="admin-control-search">Find an admin</label>
        <input
          id="admin-control-search"
          type="search"
          className="admin-input"
          placeholder="Search by username"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {filteredAdmins.length === 0 ? (
        <div className="admin-card admin-muted admin-control-empty">No admins matched your search.</div>
      ) : (
        <div className="admin-control-grid">
          {filteredAdmins.map((admin) => (
            <Link href={adminPath(`/admins/control/${admin.id}`)} className="admin-card admin-control-card admin-control-link" key={admin.id}>
              <div className="admin-section-heading">
                <div>
                  <h2>@{admin.username}</h2>
                  {admin.isMainAdmin && <p className="admin-muted">Main admin</p>}
                </div>
                <span className="admin-badge">{admin.flagCount} flags</span>
              </div>
              <div className="admin-control-card-footer">
                <span>{admin.latestActivity ? `Last activity: ${admin.latestActivity}` : "No activity recorded"}</span>
                <span className="admin-link-arrow">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
