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

export default async function ActivityPage() {
  const { data, error } = await serverSupabase
    .from("activities")
    .select("id, created_at, user_name, event_type, entity_type, entity_id, entity_label, message")
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (data as ActivityRow[] | null) || [];

  return (
    <div className="max-w-4xl space-y-4 p-6 text-xs">
      <div className="space-y-1">
        <h1 className="font-semibold text-lg tracking-tight">Activity</h1>
        <p className="text-muted-foreground text-sm">Recent user activity across the system.</p>
      </div>

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
