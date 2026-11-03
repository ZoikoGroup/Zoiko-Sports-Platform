"use client";

import { Ban, CheckCircle2, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { SearchInput, Segmented, StatusBadge } from "@/components/ui/Controls";
import { USERS, type UserStatus } from "@/lib/data";

type Filter = "all" | UserStatus;

export function UsersView() {
  const [users, setUsers] = useState(USERS);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const rows = users.filter(
    (u) => (filter === "all" || u.status === filter) && `${u.name} ${u.email}`.toLowerCase().includes(query.toLowerCase()),
  );

  const setStatus = (id: string, status: UserStatus) =>
    setUsers((list) => list.map((u) => (u.id === id ? { ...u, status } : u)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <SearchInput value={query} onChange={setQuery} placeholder="Search name or email…" />
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { id: "all", label: `All (${users.length})` },
            { id: "active", label: "Active" },
            { id: "pending", label: "Pending" },
            { id: "suspended", label: "Suspended" },
          ]}
        />
      </div>

      <div className="neu animate-rise overflow-x-auto rounded-3xl p-2">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-muted">
              <th className="px-4 py-3 font-semibold">User</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Joined</th>
              <th className="px-4 py-3 text-right font-semibold">Tips</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="group border-t border-line transition-colors hover:bg-primary/5">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={u.name} size="sm" online={u.status === "active"} className="transition-transform group-hover:scale-110" />
                    <div>
                      <div className="font-semibold">{u.name}</div>
                      <div className="text-xs text-muted">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted">{u.role}</td>
                <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                <td className="px-4 py-3 text-muted">{u.joined}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{u.tips}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {u.status === "pending" && (
                      <ActionBtn onClick={() => setStatus(u.id, "active")} className="text-success" label="Approve">
                        <CheckCircle2 className="size-4" />
                      </ActionBtn>
                    )}
                    {u.status === "suspended" ? (
                      <ActionBtn onClick={() => setStatus(u.id, "active")} className="text-primary" label="Restore">
                        <RotateCcw className="size-4" />
                      </ActionBtn>
                    ) : (
                      <ActionBtn onClick={() => setStatus(u.id, "suspended")} className="text-danger" label="Suspend">
                        <Ban className="size-4" />
                      </ActionBtn>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActionBtn({ onClick, label, className, children }: { onClick: () => void; label: string; className: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className={`neu-btn flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold ${className}`}>
      {children}
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}
