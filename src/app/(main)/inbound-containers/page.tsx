"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface InboundContainerRow {
  container_id: string;
  container_number: string | null;
  bol_number: string | null;
  status: string | null;
  shipment_status?: string | null;
  eta: string | null;
  total_cartons: number | null;
  total_units: number | null;
  sku_count: number | null;
  items_detail?: {
    sku: string;
    product_name: string;
    po_number: string;
    cartons: number;
    units: number;
  }[];
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const datePart = value.split("T")[0];
  const [yearStr, monthStr, dayStr] = datePart.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) return "-";
  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString();
}

export default function InboundContainersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<InboundContainerRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [search, setSearch] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [etaSortOrder, setEtaSortOrder] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const fetchStatusOptions = async () => {
      try {
        const res = await fetch("/api/inbound-containers/list");
        const data = await res.json();
        if (!res.ok) {
          console.error("Error loading inbound container statuses", data);
          return;
        }
        const containers: InboundContainerRow[] = data.containers || [];
        const unique = Array.from(
          new Set(
            containers
              .map((c) => (c.status || "").trim())
              .filter((s) => s.length > 0),
          ),
        );
        setStatusOptions(unique);
      } catch (err) {
        console.error("Unexpected error loading inbound container statuses", err);
      }
    };

    fetchStatusOptions();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (statusFilter) params.set("status", statusFilter);
        if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());

        const res = await fetch(`/api/inbound-containers/list?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) {
          console.error("Error loading inbound containers", data);
          setRows([]);
          return;
        }
        setRows(data.containers || []);
      } catch (err) {
        console.error("Unexpected error loading inbound containers", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [statusFilter, debouncedSearch]);

  return (
    <div style={{ background: "#f9fafb", minHeight: "100vh", padding: 20, fontSize: 12 }}>
      <h2 style={{ fontWeight: 600, fontSize: 18, marginBottom: 16 }}>Inbound Containers</h2>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <label style={{ fontSize: 12, color: "#555", marginRight: 4 }}>Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: "4px 6px", fontSize: 12 }}
          >
            <option value="all">All</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 2 }}>
            Search
          </label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Container # or BOL"
            style={{ padding: 4, fontSize: 12, width: "100%" }}
          />
        </div>
      </div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          padding: 16,
          background: "#ffffff",
          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #e5e7eb" }}>
                Container #
              </th>
              <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #e5e7eb" }}>
                BOL
              </th>
              <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #e5e7eb" }}>
                Status
              </th>
              <th
                style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #e5e7eb", cursor: "pointer" }}
                onClick={() =>
                  setEtaSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
                }
              >
                ETA {etaSortOrder === "asc" ? "↑" : "↓"}
              </th>
              <th style={{ textAlign: "right", padding: "6px 8px", borderBottom: "1px solid #e5e7eb" }}>
                Cartons
              </th>
              <th style={{ textAlign: "right", padding: "6px 8px", borderBottom: "1px solid #e5e7eb" }}>
                Units
              </th>
              <th style={{ textAlign: "right", padding: "6px 8px", borderBottom: "1px solid #e5e7eb" }}>
                SKUs
              </th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} style={{ padding: "6px 8px", fontStyle: "italic", color: "#777" }}>
                  Loading...
                </td>
              </tr>
            )}
            {!loading &&
              [...rows]
                .sort((a, b) => {
                  // Handle null or invalid ETA values: send them to the bottom
                  if (!a.eta && !b.eta) return 0;
                  if (!a.eta) return 1;
                  if (!b.eta) return -1;

                  const dateA = new Date(a.eta as string).getTime();
                  const dateB = new Date(b.eta as string).getTime();

                  if (Number.isNaN(dateA) && Number.isNaN(dateB)) return 0;
                  if (Number.isNaN(dateA)) return 1;
                  if (Number.isNaN(dateB)) return -1;

                  return etaSortOrder === "asc" ? dateA - dateB : dateB - dateA;
                })
                .map((c) => {
                const items =
                  typeof c.items_detail === "string"
                    ? JSON.parse(c.items_detail)
                    : c.items_detail || [];

                console.log("items_detail:", c.items_detail);

                const isExpanded = expandedId === c.container_id;

                return (
                  <React.Fragment key={c.container_id}>
                    <tr
                      onClick={() => toggleExpand(c.container_id)}
                      className="cursor-pointer hover:bg-slate-50"
                    >
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f4f6" }}>
                        <span className="mr-2 text-slate-400">
                          {isExpanded ? "▼" : "▶"}
                        </span>
                        {c.container_number || "-"}
                      </td>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f4f6" }}>
                        {c.bol_number || "\u2014"}
                      </td>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f4f6" }}>
                        {(() => {
                          const shipmentStatus = (c.shipment_status || "").trim();
                          const displayStatus = ["Draft", "Booked", "In Transit"].includes(shipmentStatus)
                            ? shipmentStatus
                            : c.status || "Draft";
                          return displayStatus;
                        })()}
                      </td>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f4f6" }}>
                        {formatDate(c.eta)}
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          borderBottom: "1px solid #f3f4f6",
                          textAlign: "right",
                        }}
                      >
                        {c.total_cartons ?? 0}
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          borderBottom: "1px solid #f3f4f6",
                          textAlign: "right",
                        }}
                      >
                        {c.total_units ?? 0}
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          borderBottom: "1px solid #f3f4f6",
                          textAlign: "right",
                        }}
                      >
                        {c.sku_count ?? 0}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/inbound-containers/${c.container_id}`);
                          }}
                          className="rounded-md border px-2 py-1 text-xs hover:bg-slate-100"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                    {expandedId === c.container_id && (
                      <tr>
                        <td colSpan={8} className="bg-slate-50 px-3 py-2">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-slate-500">
                                <th className="px-2 py-1">SKU</th>
                                <th className="px-2 py-1">PO</th>
                                <th className="px-2 py-1 text-right">Cartons</th>
                                <th className="px-2 py-1 text-right">Units</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item: any, idx: number) => (
                                <tr key={idx}>
                                  <td className="px-2 py-1">
                                    <div className="font-medium">{item.sku}</div>
                                    <div className="text-slate-500 text-[11px]">
                                      {item.product_name}
                                    </div>
                                  </td>
                                  <td className="px-2 py-1">{item.po_number}</td>
                                  <td className="px-2 py-1 text-right">{item.cartons}</td>
                                  <td className="px-2 py-1 text-right">{item.units}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: "6px 8px", fontStyle: "italic", color: "#777" }}>
                  No containers found \u2014 try adjusting filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
