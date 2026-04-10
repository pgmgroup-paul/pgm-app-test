"use client";

import React, { useEffect, useState } from "react";

interface ContainerRow {
  id: string;
  temp_code: string | null;
  status: string | null;
  created_at: string | null;
  contents_preview?: string | null;
  ship_date?: string | null;
  items_detail?: {
    sku: string;
    sku_var: string;
    product_name: string;
    po_number: string;
    pieces: number;
  }[];
}

export default function ShipmentPlanningPage() {
  const [availableContainers, setAvailableContainers] = useState<ContainerRow[]>([]);
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleCreateShipment = async () => {
    const containerIds = Object.keys(selectedMap).filter((id) => selectedMap[id]);
    if (containerIds.length === 0) {
      alert("Select at least one container");
      return;
    }

    try {
      const res = await fetch("/api/shipments-v2/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ container_ids: containerIds }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error("Error creating shipment", data);
        alert("Error creating shipment");
        return;
      }

      // Temporary redirect back to the same page
      window.location.href = "/shipment-planning";
    } catch (err) {
      console.error("Unexpected error creating shipment", err);
      alert("Unexpected error creating shipment");
    }
  };

  useEffect(() => {
    fetch("/api/containers-v2/available")
      .then((res) => res.json())
      .then((data) => setAvailableContainers(data.containers || []))
      .catch((err) => {
        console.error("Error loading available containers", err);
      });
  }, []);

  const handleAdd = (id: string) => {
    setSelectedMap((prev) => ({ ...prev, [id]: true }));
  };

  const handleRemove = (id: string) => {
    setSelectedMap((prev) => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
  };

  const selectedContainers = availableContainers.filter((c) => selectedMap[c.id]);
  const remainingContainers = [...availableContainers.filter((c) => !selectedMap[c.id])].sort((a, b) => {
    const aTime = a.ship_date ? new Date(a.ship_date).getTime() : Infinity;
    const bTime = b.ship_date ? new Date(b.ship_date).getTime() : Infinity;
    return aTime - bTime;
  });

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div style={{ display: "flex", gap: 20, padding: 16, fontSize: 12 }}>
      {/* LEFT */}
      <div
        style={{
          flex: 1,
          border: "1px solid #ddd",
          borderRadius: 6,
          padding: 12,
          background: "#fafafa",
        }}
      >
        <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Available Containers</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #ddd" }}>Container</th>
              <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #ddd" }}>Contents</th>
              <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #ddd" }}>Ship Date</th>
              <th style={{ padding: "4px 6px", borderBottom: "1px solid #ddd" }}></th>
            </tr>
          </thead>
          <tbody>
            {remainingContainers.map((c) => (
              <React.Fragment key={c.id}>
                <tr
                  onClick={() => toggleExpand(c.id)}
                  style={{ cursor: "pointer" }}
                >
                  <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>{c.temp_code}</td>
                <td
                  style={{
                    padding: "4px 6px",
                    borderBottom: "1px solid #f0f0f0",
                    maxWidth: 200,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {c.contents_preview || "-"}
                </td>
                <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>
                  {c.ship_date ? new Date(c.ship_date).toLocaleDateString() : "-"}
                </td>
                <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0", textAlign: "right" }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAdd(c.id);
                    }}
                    className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] hover:bg-muted"
                  >
                    Add
                  </button>
                </td>
              </tr>
              {expandedId === c.id && (
                <tr>
                  <td colSpan={4} style={{ background: "#f9f9f9", padding: 8 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #ddd" }}>
                              SKU
                            </th>
                            <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #ddd" }}>
                              PO
                            </th>
                            <th style={{ textAlign: "right", padding: "4px 6px", borderBottom: "1px solid #ddd" }}>
                              Pieces
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(c.items_detail || []).map((item, idx) => (
                            <tr key={idx}>
                              <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>
                                <div style={{ fontWeight: 600 }}>
                                  {item.sku}
                                  {item.sku_var ? `-${item.sku_var}` : ""}
                                </div>
                                <div style={{ color: "#6b7280", fontSize: 12 }}>
                                  {item.product_name}
                                </div>
                              </td>
                              <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>
                                {item.po_number}
                              </td>
                              <td
                                style={{
                                  padding: "4px 6px",
                                  borderBottom: "1px solid #f0f0f0",
                                  textAlign: "right",
                                }}
                              >
                                {item.pieces}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {remainingContainers.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "4px 6px", color: "#777", fontStyle: "italic" }}>
                  No available containers.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* RIGHT */}
      <div
        style={{
          flex: 1,
          border: "1px solid #ddd",
          borderRadius: 6,
          padding: 12,
          background: "#fafafa",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ fontWeight: 600 }}>Shipment Builder</h3>
          <button
            type="button"
            onClick={handleCreateShipment}
            style={{
              background: "black",
              color: "white",
              padding: "8px 12px",
              borderRadius: 6,
            }}
          >
            Create Shipment
          </button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #ddd" }}>Container</th>
              <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #ddd" }}>Contents</th>
              <th style={{ padding: "4px 6px", borderBottom: "1px solid #ddd" }}></th>
            </tr>
          </thead>
          <tbody>
            {selectedContainers.map((c) => (
              <tr key={c.id}>
                <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>{c.temp_code}</td>
                <td
                  style={{
                    padding: "4px 6px",
                    borderBottom: "1px solid #f0f0f0",
                    maxWidth: 200,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {c.contents_preview || "-"}
                </td>
                <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0", textAlign: "right" }}>
                  <button
                    type="button"
                    onClick={() => handleRemove(c.id)}
                    className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] hover:bg-muted"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {selectedContainers.length === 0 && (
              <tr>
                <td colSpan={2} style={{ padding: "4px 6px", color: "#777", fontStyle: "italic" }}>
                  No containers in this shipment yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
