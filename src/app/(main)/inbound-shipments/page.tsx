"use client";

import { useEffect, useState } from "react";

function formatDate(value: string | null | undefined): string {
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

interface ShipmentRow {
  id: string;
  shipment_number: string | null;
  bol_number?: string | null;
  status: string | null;
  eta?: string | null;
  created_at: string | null;
  container_count?: number;
  ship_date?: string | null;
}

export default function InboundShipmentsPage() {
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("Draft");
  const [statuses, setStatuses] = useState<string[]>([]);

  useEffect(() => {
    fetch(`/api/shipments-v2/list?status=${statusFilter}`)
      .then((res) => res.json())
      .then((data) => {
        const list = (data.shipments || []) as ShipmentRow[];
        // Sort by ship_date ascending (earliest first); nulls at bottom
        list.sort((a, b) => {
          const aTime = a.ship_date ? new Date(a.ship_date).getTime() : Infinity;
          const bTime = b.ship_date ? new Date(b.ship_date).getTime() : Infinity;
          return aTime - bTime;
        });
        setShipments(list);
        setStatuses((data.statuses || []) as string[]);
      })
      .catch((err) => {
        console.error("Error loading shipments", err);
      });
  }, [statusFilter]);

  return (
    <div style={{ padding: 16, fontSize: 12 }}>
      <h2 style={{ fontWeight: 600, fontSize: 18, marginBottom: 12 }}>Inbound Shipments</h2>
      <div style={{ marginBottom: 10 }}>
        <label style={{ marginRight: 4 }}>Status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: "2px 4px", fontSize: 12 }}
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #ddd" }}>Shipment #</th>
            <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #ddd" }}>Status</th>
            <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #ddd" }}>Containers</th>
            <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #ddd" }}>ETA</th>
            <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #ddd" }}>Ship Date</th>
            <th style={{ padding: "4px 6px", borderBottom: "1px solid #ddd" }}></th>
          </tr>
        </thead>
        <tbody>
          {shipments.map((s) => (
            <tr key={s.id}>
              <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>
                {s.bol_number ? `BOL: ${s.bol_number}` : s.shipment_number}
              </td>
              <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>{s.status}</td>
              <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>
                {s.container_count ?? 0}
              </td>
              <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>
                {formatDate(s.eta)}
              </td>
              <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>
                {formatDate(s.ship_date)}
              </td>
              <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0", textAlign: "right" }}>
                <a
                  href={`/inbound-shipments/${s.id}`}
                  style={{ color: "#2563eb", textDecoration: "underline" }}
                >
                  View
                </a>
              </td>
            </tr>
          ))}
          {shipments.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: "4px 6px", color: "#777", fontStyle: "italic" }}>
                No shipments found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
