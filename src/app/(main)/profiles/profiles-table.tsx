"use client";

import { useMemo, useState } from "react";

const FILTER_FIELDS = [
  { value: "company", label: "Company" },
  { value: "role", label: "Role" },
  { value: "staff_type", label: "Staff Type" },
  { value: "customer_tier", label: "Customer Tier" },
] as const;

type FilterField = (typeof FILTER_FIELDS)[number]["value"];

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  role: string;
  staff_type: string | null;
  customer_tier: string | null;
  created_at: string;
  is_active?: boolean | null;
};

interface ProfilesTableProps {
  profiles: Profile[];
}

export function ProfilesTable({ profiles }: ProfilesTableProps) {
  const [search, setSearch] = useState("");
  const [filterField, setFilterField] = useState<FilterField | "">("");
  const [filterValue, setFilterValue] = useState<string | "">("");
  const [sortKey, setSortKey] = useState<keyof Profile | "created_at">("full_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [includeInactive, setIncludeInactive] = useState(false);

  const filterOptions = useMemo(() => {
    if (!filterField) return [] as string[];
    const values = profiles
      .map((p) => (p[filterField] as string | null) ?? "")
      .filter((v) => v && v.trim().length > 0);
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [profiles, filterField]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    let rows = profiles.slice();

    // By default show only active users; include inactive when toggled
    if (!includeInactive) {
      rows = rows.filter((p) => p.is_active !== false);
    }

    if (term) {
      rows = rows.filter((p) => {
        const haystack = `${p.full_name ?? ""} ${p.company ?? ""} ${p.email}`.toLowerCase();
        return haystack.includes(term);
      });
    }

    if (filterField && filterValue) {
      rows = rows.filter((p) => ((p[filterField] as string | null) ?? "") === filterValue);
    }

    rows.sort((a, b) => {
      // Special-case Status (is_active is boolean/null)
      if (sortKey === "is_active") {
        const aNum = a.is_active === false ? 0 : 1; // inactive first
        const bNum = b.is_active === false ? 0 : 1;
        const cmpNum = aNum - bNum;
        return sortDir === "asc" ? cmpNum : -cmpNum;
      }

      const aRaw = a[sortKey];
      const bRaw = b[sortKey];

      const aVal = (aRaw ?? "") as string;
      const bVal = (bRaw ?? "") as string;
      const cmp = aVal.localeCompare(bVal);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [profiles, search, filterField, filterValue, sortKey, sortDir, includeInactive]);

  return (
    <>
      <div className="flex flex-col gap-3 pb-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
          <div className="flex flex-col gap-1 text-sm">
            <label htmlFor="profiles-search" className="font-medium">
              Search
            </label>
            <input
              id="profiles-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, company, or email"
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-64"
            />
          </div>

          <div className="flex flex-col gap-1 text-sm md:flex-row md:items-center md:gap-2">
            <span className="font-medium">Filter</span>
            <select
              value={filterField}
              onChange={(e) => {
                setFilterField(e.target.value as FilterField | "");
                setFilterValue("");
              }}
              className="rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Field…</option>
              {FILTER_FIELDS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <select
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              disabled={!filterField || filterOptions.length === 0}
              className="rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-48 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">Value…</option>
              {filterOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1 text-sm md:flex-row md:items-center md:gap-4">
          <div className="flex items-center gap-2">
            <input
              id="include-inactive"
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="h-3 w-3 rounded border border-input text-primary focus-visible:ring-2 focus-visible:ring-ring"
            />
            <label htmlFor="include-inactive" className="text-xs">
              Include inactive
            </label>
          </div>

          <span className="font-medium">Sort by</span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as keyof Profile)}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="full_name">Name</option>
            <option value="company">Company</option>
            <option value="email">Email</option>
            <option value="role">Role</option>
            <option value="staff_type">Staff Type</option>
            <option value="customer_tier">Customer Tier</option>
            <option value="is_active">Status</option>
          </select>
          <select
            value={sortDir}
            onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="border-b px-3 py-2 text-left font-medium">Name</th>
              <th className="border-b px-3 py-2 text-left font-medium">Company</th>
              <th className="border-b px-3 py-2 text-left font-medium">Email</th>
              <th className="border-b px-3 py-2 text-left font-medium">Role</th>
              <th className="border-b px-3 py-2 text-left font-medium">Staff Type</th>
              <th className="border-b px-3 py-2 text-left font-medium">Customer Tier</th>
              <th className="border-b px-3 py-2 text-left font-medium">Status</th>
              <th className="border-b px-3 py-2 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="align-top">
                <td className="border-b px-3 py-2 text-xs">{p.full_name ?? ""}</td>
                <td className="border-b px-3 py-2 text-xs">{p.company ?? ""}</td>
                <td className="border-b px-3 py-2 text-xs">{p.email}</td>
                <td className="border-b px-3 py-2 font-mono text-xs">{p.role}</td>
                <td className="border-b px-3 py-2 text-xs">{p.staff_type}</td>
                <td className="border-b px-3 py-2 text-xs">{p.customer_tier}</td>
                <td className="border-b px-3 py-2 text-xs">
                  {p.is_active === false ? (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      Inactive
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-700">
                      Active
                    </span>
                  )}
                </td>
                <td className="border-b px-3 py-2 text-xs">
                  <a
                    href={`/profiles/${p.id}/edit`}
                    className="text-primary hover:underline"
                  >
                    Edit
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
