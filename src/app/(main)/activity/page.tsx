import Link from "next/link";

import { serverSupabase } from "@/lib/serverSupabase";

export const dynamic = "force-dynamic";

interface ActivityRow {
  id: string;
  created_at: string;
  user_name: string | null;
  event_type: string | null;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  message: string | null;
}

function formatTime(value: string): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function resolveEntityHref(entityType: string | null, entityId: string | null): string | null {
  if (!entityType || !entityId) return null;

  switch (entityType) {
    case "sales_order":
      return `/sales-orders/${entityId}/edit`;
    case "purchase_order":
      return `/purchase-orders/${entityId}`;
    case "container":
      return `/inbound-containers/${entityId}`;
    case "product":
      return `/products/${entityId}/edit`;
    default:
      return null;
  }
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ event_type?: string; user_name?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const eventTypeFilter =
    typeof resolvedSearchParams.event_type === "string"
      ? resolvedSearchParams.event_type.trim()
      : "";
  const userNameFilter =
    typeof resolvedSearchParams.user_name === "string"
      ? resolvedSearchParams.user_name.trim()
      : "";

  console.log("ACTIVITY_FILTERS", { eventTypeFilter, userNameFilter });

  // Load distinct users that appear in activity logs
  const { data: distinctUserRows, error: distinctUserError } = await serverSupabase
    .from("activities")
    .select("user_name")
    .not("user_name", "is", null)
    .order("user_name", { ascending: true });

  const distinctUsers = Array.from(
    new Set(
      (distinctUserRows || [])
        .map((row: any) => (row.user_name as string | null) || "")
        .filter((name: string) => name.trim().length > 0),
    ),
  );

  console.log("ACTIVITY_DISTINCT_USERS", { count: distinctUsers.length, users: distinctUsers });

  let query = serverSupabase
    .from("activities")
    .select("id, created_at, user_name, event_type, entity_type, entity_id, entity_label, message")
    .order("created_at", { ascending: false })
    .limit(100);

  if (eventTypeFilter) {
    query = query.eq("event_type", eventTypeFilter);
  }

  if (userNameFilter) {
    query = query.eq("user_name", userNameFilter);
  }

  console.log("ACTIVITY_QUERY_FILTERS_APPLIED", { eventTypeFilter, userNameFilter });

  const { data, error } = await query;

  const rows = (data as ActivityRow[] | null) || [];

  return (
    <div className="max-w-4xl space-y-4 p-6 text-xs">
      <div className="space-y-1">
        <h1 className="font-semibold text-lg tracking-tight">Activity</h1>
        <p className="text-muted-foreground text-sm">Recent user activity across the system.</p>
      </div>

      {/* Filters */}
      <form
        method="GET"
        action="/activity"
        className="flex flex-col gap-2 rounded-md border bg-card px-3 py-2 text-[11px] sm:flex-row sm:items-end sm:justify-between"
      >
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end">
          <div className="space-y-1 sm:w-64">
            <label htmlFor="event_type" className="text-[11px] text-muted-foreground">
              Event type
            </label>
            <select
              id="event_type"
              name="event_type"
              defaultValue={eventTypeFilter}
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">All activity</option>
              <option value="sales_order_created">Sales order created</option>
              <option value="sales_order_ready">Sales order ready</option>
              <option value="purchase_order_created">Purchase order created</option>
              <option value="container_created">Container created</option>
              <option value="container_unloaded">Container unloaded</option>
              <option value="product_created">Product created</option>
              <option value="user_created">User created</option>
            </select>
          </div>

          <div className="space-y-1 sm:w-64">
            <label htmlFor="user_name" className="text-[11px] text-muted-foreground">
              User
            </label>
            <select
              id="user_name"
              name="user_name"
              defaultValue={userNameFilter}
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">All users</option>
              {distinctUsers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 sm:w-40">
          <button
            type="submit"
            className="inline-flex items-center rounded-md border px-3 py-1 font-medium text-[11px] hover:bg-muted"
          >
            Apply
          </button>
          <a
            href="/activity"
            className="inline-flex items-center rounded-md border px-3 py-1 font-medium text-[11px] hover:bg-muted"
          >
            Clear
          </a>
        </div>
      </form>

      {error && (
        <p className="text-destructive text-[11px]">Failed to load activity. Please try again later.</p>
      )}

      {!error && rows.length === 0 && (
        <p className="text-muted-foreground text-[11px]">No activity has been recorded yet.</p>
      )}

      {!error && rows.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-left text-[11px]">
            <thead className="border-b bg-muted text-[11px] text-muted-foreground">
              <tr>
                <th className="py-1 pr-2 pl-3">Time</th>
                <th className="px-2 py-1">User</th>
                <th className="px-2 py-1">Activity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const href = resolveEntityHref(row.entity_type, row.entity_id);
                const content = row.message || "";
                const userName = row.user_name || "Unknown";

                console.log("ACTIVITY_ROUTE_DEBUG", {
                  entityType: row.entity_type,
                  entityId: row.entity_id,
                  resolvedHref: href,
                });

                return (
                  <tr key={row.id} className="border-b last:border-none">
                    <td className="py-1 pr-2 pl-3 text-[11px] text-muted-foreground">
                      {formatTime(row.created_at)}
                    </td>
                    <td className="px-2 py-1 text-[11px]">{userName}</td>
                    <td className="px-2 py-1 text-[11px]">
                      {href ? (
                        <Link href={href} className="text-primary hover:underline">
                          {content}
                        </Link>
                      ) : (
                        <span>{content}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
