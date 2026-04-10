"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

interface ForwarderPaymentRow {
  id: string;
  forwarder: string | null;
  payment_date: string | null;
  total_amount: number | null;
  ach_code: string | null;
  notes: string | null;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

export default function ContainerPaymentsPage() {
  const [rows, setRows] = useState<ForwarderPaymentRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [forwarderShowAll, setForwarderShowAll] = useState(false);
  const [forwarderSortOrder, setForwarderSortOrder] = useState<
    "asc" | "desc"
  >("desc");
  const [forwarderSearch, setForwarderSearch] = useState("");
  const [forwarderSelectedForwarder, setForwarderSelectedForwarder] =
    useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<"forwarder" | "delivery">(
    "forwarder",
  );
  const [forwarderContainers, setForwarderContainers] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<
    Record<string, { amount: number; invoice_number: string }>
  >({});
  const [deliveryContainers, setDeliveryContainers] = useState<any[]>([]);
  const [deliveryAllocations, setDeliveryAllocations] = useState<
    Record<string, { id?: string; amount: number; invoice_number: string }>
  >({});
  const [deliveryNotes, setDeliveryNotes] = useState<string>("");
  const [truckers, setTruckers] = useState<any[]>([]);
  const [deliveryEditRows, setDeliveryEditRows] = useState<any[]>([]);
  const [isDeliveryEditMode, setIsDeliveryEditMode] = useState(false);
  const [editingDeliveryPayment, setEditingDeliveryPayment] = useState<any | null>(
    null,
  );
  const [selectedTruckerId, setSelectedTruckerId] = useState<string>("");
  const [derivedForwarder, setDerivedForwarder] = useState<string | null>(null);
  const [createPaymentForm, setCreatePaymentForm] = useState({
    payment_date: "",
    total_amount: "",
    ach_code: "",
    notes: "",
  });
  const [allocationsByPayment, setAllocationsByPayment] = useState<
    Record<
      string,
      { amount_allocated: number | null; containers_v2: { id: string; container_number: string | null; temp_code: string | null } | null }[]
    >
  >({});
  const [deliveryPayments, setDeliveryPayments] = useState<any[]>([]);
  const [expandedDeliveryId, setExpandedDeliveryId] = useState<string | null>(
    null,
  );
  const [deliveryShowAll, setDeliveryShowAll] = useState(false);
  const [deliverySortOrder, setDeliverySortOrder] = useState<"asc" | "desc">(
    "desc",
  );
  const [deliverySearchTerm, setDeliverySearchTerm] = useState("");
  const [deliverySelectedTrucker, setDeliverySelectedTrucker] = useState("");

  console.log("DELIVERY DATA FULL", deliveryPayments);

  // Forwarder cost totals
  const fetchForwarderTotals = async (): Promise<Record<string, number>> => {
    try {
      const { data, error } = await supabase
        .from("container_forwarder_costs")
        .select("container_id, amount");

      if (error) {
        console.error("Error loading forwarder costs", error);
        return {};
      }

      const totals: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        const key = String(row.container_id);
        if (!totals[key]) totals[key] = 0;
        totals[key] += Number(row.amount || 0);
      });
      return totals;
    } catch (err) {
      console.error("Unexpected error loading forwarder costs", err);
      return {};
    }
  };

  // Allocation totals
  const fetchAllocationTotals = async (): Promise<Record<string, number>> => {
    try {
      const { data, error } = await supabase
        .from("forwarder_payment_allocations")
        .select("container_id, amount_allocated");

      if (error) {
        console.error("Error loading allocation totals", error);
        return {};
      }

      const totals: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        const key = String(row.container_id);
        if (!totals[key]) totals[key] = 0;
        totals[key] += Number(row.amount_allocated || 0);
      });
      return totals;
    } catch (err) {
      console.error("Unexpected error loading allocation totals", err);
      return {};
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        let query = supabase
          .from("forwarder_payments")
          .select("id, forwarder, payment_date, total_amount, ach_code, notes")
          .order("payment_date", {
            ascending: forwarderSortOrder === "asc",
          });

        if (!forwarderShowAll) {
          query = query.limit(10);
        }

        const { data, error } = await query;

        if (error) {
          console.error("Error loading forwarder_payments", error);
          setError("Failed to load payments");
          setRows([]);
          return;
        }

        setRows((data as ForwarderPaymentRow[]) || []);
      } catch (err) {
        console.error("Unexpected error loading forwarder_payments", err);
        setError("Failed to load payments");
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    load();
    loadTruckers();
  }, [forwarderShowAll, forwarderSortOrder]);

  const fetchDeliveryPayments = async () => {
    let query = supabase
      .from("delivery_payments")
      .select(
        `
        id,
        payment_date,
        ach_code,
        total_amount,
        notes,
        truckers ( name ),
        delivery_payment_allocations (
          id,
          container_id,
          amount,
          invoice_number
        )
      `,
      )
      .order("payment_date", { ascending: deliverySortOrder === "asc" });

    if (!deliveryShowAll) {
      query = query.limit(10);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error loading delivery payments", error);
      return;
    }

    console.log("RAW DELIVERY DATA", data);

    // STEP 1: collect container IDs
    const containerIds = (data || []).flatMap((p: any) =>
      (p.delivery_payment_allocations || []).map(
        (a: any) => a.container_id,
      ),
    );

    // STEP 2: fetch container numbers
    const { data: containers } = await supabase
      .from("containers_v2")
      .select("id, container_number, temp_code")
      .in("id", containerIds as string[]);

    console.log("CONTAINERS MAP DATA", containers);

    // STEP 3: build lookup
    const containerMap: Record<string, string | null> = {};
    (containers || []).forEach((c: any) => {
      containerMap[c.id] = c.container_number || c.temp_code;
    });

    // STEP 4: enrich
    const enriched = (data || []).map((payment: any) => ({
      ...payment,
      delivery_payment_allocations: (payment.delivery_payment_allocations || []).map(
        (a: any) => ({
          ...a,
          container_number: containerMap[a.container_id] || a.container_id,
        }),
      ),
    }));

    console.log("ENRICHED DELIVERY DATA", enriched);

    // STEP 5: SET FINAL DATA
    setDeliveryPayments(enriched);
  };

  useEffect(() => {
    const deriveForwarder = () => {
      const selectedContainers = forwarderContainers.filter((c: any) => {
        const entry = allocations[String(c.container_id)];
        return entry && entry.amount > 0;
      });

      if (selectedContainers.length === 0) {
        setDerivedForwarder(null);
        return;
      }

      const uniqueForwarders = Array.from(
        new Set(
          selectedContainers
            .map((c: any) => c.forwarder)
            .filter((f: any) => !!f),
        ),
      ) as string[];

      if (uniqueForwarders.length === 1) {
        setDerivedForwarder(uniqueForwarders[0]);
      } else {
        setDerivedForwarder("Unknown");
      }
    };

    deriveForwarder();
  }, [allocations, forwarderContainers]);

  const loadForwarderContainers = async () => {
    try {
      const { data: containers, error } = await supabase
        .from("inbound_containers_list")
        .select("container_id, container_number, status, forwarder")
        .order("container_number");

      if (error) {
        console.error("Error loading containers for payments", error);
        setForwarderContainers([]);
        return;
      }

      const costTotals = await fetchForwarderTotals();
      const allocationTotals = await fetchAllocationTotals();

      const enriched = (containers || []).map((c: any) => {
        const key = String(c.container_id);
        const totalCost = Number(costTotals[key] || 0);
        const totalAllocated = Number(allocationTotals[key] || 0);
        const remaining = totalCost - totalAllocated;
        return {
          ...c,
          totalCost,
          totalAllocated,
          remaining,
        };
      });

      console.log("FINAL enriched containers:", enriched);
      enriched.forEach((c: any) => {
        console.log("CHECK:", {
          container: c.container_number,
          status: c.status,
          remaining: c.remaining,
          totalCost: c.totalCost,
          totalAllocated: c.totalAllocated,
        });
      });

      const payableContainers = enriched.filter(
        (c: any) =>
          (c.remaining || 0) > 0 && String(c.status).toLowerCase() === "unloaded",
      );

      setForwarderContainers(payableContainers);
    } catch (err) {
      console.error("Unexpected error loading containers for payments", err);
      setForwarderContainers([]);
    }
  };

  const savePayment = async () => {
    const computedTotal = Object.values(allocations).reduce(
      (sum, entry) => sum + (entry?.amount || 0),
      0,
    );

    const totalAllocated = computedTotal;

    const finalPaymentDate =
      createPaymentForm.payment_date || new Date().toISOString().slice(0, 10);

    // Basic validation
    const selectedContainerIds = Object.keys(allocations).filter(
      (id) => allocations[id]?.amount > 0,
    );

    if (selectedContainerIds.length === 0) {
      alert("Select at least one container and enter a positive amount.");
      return;
    }

    for (const [containerId, data] of Object.entries(allocations)) {
      if (!data || data.amount <= 0) continue;
      if (!data.invoice_number || data.invoice_number.trim() === "") {
        alert(
          `Invoice # is required for container ${containerId} when an amount is allocated.`,
        );
        return;
      }
    }

    try {
      const { data: payment, error } = await supabase
        .from("forwarder_payments")
        .insert({
          forwarder: derivedForwarder || "Unknown",
          payment_date: finalPaymentDate,
          total_amount: computedTotal,
          ach_code: createPaymentForm.ach_code || null,
          notes: createPaymentForm.notes || null,
        })
        .select()
        .single();

      if (error || !payment) {
        console.error("Failed to create payment", error);
        return;
      }

      for (const [containerId, alloc] of Object.entries(allocations)) {
        if (!alloc || alloc.amount <= 0) continue;
        const { error: allocError } = await supabase
          .from("forwarder_payment_allocations")
          .insert({
            payment_id: payment.id,
            container_id: containerId,
            amount_allocated: alloc.amount,
            invoice_number: alloc.invoice_number || null,
          });

        if (allocError) {
          console.error(
            "Failed to create allocation for container",
            containerId,
            allocError,
          );
          return;
        }
      }

      // Refresh payment list
      setShowCreate(false);
      setAllocations({});
      setCreatePaymentForm({
        payment_date: "",
        total_amount: "",
        ach_code: "",
        notes: "",
      });

      // Reload payments
      try {
        setLoading(true);
        const { data, error: loadError } = await supabase
          .from("forwarder_payments")
          .select("id, forwarder, payment_date, total_amount, ach_code, notes")
          .order("payment_date", { ascending: false });

        if (loadError) {
          console.error("Error reloading payments", loadError);
          setError("Failed to load payments");
          setRows([]);
        } else {
          setRows((data as ForwarderPaymentRow[]) || []);
        }
      } catch (reloadErr) {
        console.error("Unexpected error reloading payments", reloadErr);
        setError("Failed to load payments");
      } finally {
        setLoading(false);
      }
    } catch (err) {
      console.error("Unexpected error creating payment", err);
    }
  };

  const loadTruckers = async () => {
    try {
      const { data, error } = await supabase
        .from("truckers")
        .select("id, name")
        .order("name");

      if (error) {
        console.error("Error loading truckers", error);
        setTruckers([]);
      } else {
        setTruckers(data || []);
        console.log("Loaded truckers", data);
      }
    } catch (err) {
      console.error("Unexpected error loading truckers", err);
      setTruckers([]);
    }
  };

  const loadDeliveryContainers = async () => {
    try {
      // Base containers: Unloaded
      const { data: containers, error } = await supabase
        .from("containers_v2")
        .select("id, container_number, temp_code, status")
        .eq("status", "Unloaded");

      if (error) {
        console.error("Error loading delivery containers", error);
        setDeliveryContainers([]);
        return;
      }

      const base = containers || [];
      const containerIds = base.map((c: any) => c.id);

      // Delivery payment status (only unpaid), joined in JS
      const { data: statusRows, error: statusError } = await supabase
        .from("container_delivery_status")
        .select("container_id, delivery_payment_status")
        .in("container_id", containerIds);

      if (statusError) {
        console.error(
          "Error loading container_delivery_status for Delivery tab",
          statusError,
        );
      }

      const unpaidSet = new Set(
        (statusRows || [])
          .filter((row: any) => row.delivery_payment_status === "Unpaid")
          .map((row: any) => String(row.container_id)),
      );

      const unpaidContainers = base.filter((c: any) =>
        unpaidSet.has(String(c.id)),
      );

      // Existing delivery allocations (exclude already allocated)
      const { data: existing, error: existingError } = await supabase
        .from("delivery_payment_allocations")
        .select("container_id");

      if (existingError) {
        console.error(
          "Error loading existing delivery allocations",
          existingError,
        );
        // Even if allocations fail, still show unpaid/unloaded containers
        setDeliveryContainers(
          unpaidContainers.map((c: any) => ({
            container_id: c.id,
            container_number: c.container_number || c.temp_code,
            status: c.status,
          })),
        );
        return;
      }

      const excluded = new Set(
        (existing || []).map((row: any) => String(row.container_id)),
      );

      const filtered = unpaidContainers.filter(
        (c: any) => !excluded.has(String(c.id)),
      );

      setDeliveryContainers(
        filtered.map((c: any) => ({
          container_id: c.id,
          container_number: c.container_number || c.temp_code,
          status: c.status,
        })),
      );
    } catch (err) {
      console.error("Unexpected error loading delivery containers", err);
      setDeliveryContainers([]);
    }
  };

  const saveDeliveryPayment = async () => {
    const selectedEntries = Object.entries(deliveryAllocations).filter(
      ([_, v]) => v && v.amount > 0,
    );

    if (!selectedTruckerId) {
      alert("Please select a trucker before saving.");
      return;
    }

    if (selectedEntries.length === 0) {
      alert("Select at least one container and enter a positive amount.");
      return;
    }

    for (const [containerId, data] of selectedEntries) {
      if (!data.amount || data.amount <= 0) {
        alert(`Amount is required for container ${containerId}.`);
        return;
      }
      if (!data.invoice_number || data.invoice_number.trim() === "") {
        alert(
          `Invoice # is required for container ${containerId} when an amount is allocated.`,
        );
        return;
      }
    }

    const totalAmount = selectedEntries.reduce(
      (sum, [_, v]) => sum + (v.amount || 0),
      0,
    );

    const paymentDate = new Date().toISOString().slice(0, 10);

    try {
      if (isDeliveryEditMode && editingDeliveryPayment?.id) {
        // UPDATE existing delivery payment (no inserts)
        const { error: updateError } = await supabase
          .from("delivery_payments")
          .update({
            trucker_id: selectedTruckerId,
            notes: deliveryNotes || null,
          })
          .eq("id", editingDeliveryPayment.id);

        if (updateError) {
          console.error("Failed to update delivery payment", updateError);
          alert("Failed to save delivery payment.");
          return;
        }

        // Update existing allocations (no inserts/deletes)
        for (const row of deliveryEditRows) {
          if (!row.id) continue;
          const key = String(row.container_id);
          const entry = deliveryAllocations[key];
          const newAmount = entry?.amount ?? row.amount;
          const newInvoice = entry?.invoice_number ?? row.invoice_number;

          const { error: allocUpdateError } = await supabase
            .from("delivery_payment_allocations")
            .update({
              amount: newAmount,
              invoice_number: newInvoice,
            })
            .eq("id", row.id);

          if (allocUpdateError) {
            console.error(
              "Failed to update delivery allocation",
              row.id,
              allocUpdateError,
            );
            alert("Failed to save some delivery allocations.");
            return;
          }
        }
      } else {
        // CREATE new delivery payment
        const { data: payment, error } = await supabase
          .from("delivery_payments")
          .insert({
            payment_date: paymentDate,
            trucker_id: selectedTruckerId,
            total_amount: totalAmount,
            ach_code: null,
            notes: deliveryNotes || null,
          })
          .select()
          .single();

        if (error || !payment) {
          console.error("Failed to create delivery payment", error);
          alert("Failed to save delivery payment.");
          return;
        }

        for (const [containerId, data] of selectedEntries) {
          const { error: allocError } = await supabase
            .from("delivery_payment_allocations")
            .insert({
              payment_id: payment.id,
              container_id: containerId,
              amount: data.amount,
              invoice_number: data.invoice_number,
            });

          if (allocError) {
            console.error(
              "Failed to create delivery allocation for container",
              containerId,
              allocError,
            );
            alert("Failed to save some delivery allocations.");
            return;
          }
        }
      }

      // Reset Delivery form and reload containers
      setDeliveryAllocations({});
      setDeliveryNotes("");
      setSelectedTruckerId("");
      setIsDeliveryEditMode(false);
      setEditingDeliveryPayment(null);
      setShowCreate(false);
      await Promise.all([loadDeliveryContainers(), fetchDeliveryPayments()]);
      alert("Delivery payment saved.");
    } catch (err) {
      console.error("Unexpected error saving delivery payment", err);
      alert("Unexpected error saving delivery payment.");
    }
  };

  const handleEditDelivery = (payment: any) => {
    console.log("Edit delivery payment", payment);
    setEditingDeliveryPayment(payment);
    setIsDeliveryEditMode(true);
    setShowCreate(true);

    // Prefill trucker, notes
    if (payment.trucker_id) {
      setSelectedTruckerId(String(payment.trucker_id));
    }
    setDeliveryNotes(payment.notes || "");

    // Prefill allocations from delivery_payment_allocations
    const allocs = payment.delivery_payment_allocations || [];
    const mapped: Record<string, { id?: string; amount: number; invoice_number: string }> = {};
    const existingRows: any[] = [];
    allocs.forEach((row: any) => {
      const key = String(row.container_id);
      mapped[key] = {
        id: row.id,
        amount: row.amount != null ? Number(row.amount) : 0,
        invoice_number: row.invoice_number || "",
      };
      existingRows.push({
        id: row.id,
        container_id: row.container_id,
        container_number: row.container_number || row.container_id,
        amount: row.amount,
        invoice_number: row.invoice_number,
      });
    });
    setDeliveryAllocations(mapped);
    setDeliveryEditRows(existingRows);
  };

  const toggleExpand = async (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));

    if (!allocationsByPayment[id]) {
      try {
        const { data, error } = await supabase
          .from("forwarder_payment_allocations")
          .select(
            "amount_allocated, invoice_number, containers_v2 ( id, container_number, temp_code )",
          )
          .eq("payment_id", id);

        if (error) {
          console.error("Error loading allocations for payment", id, error);
          return;
        }

        setAllocationsByPayment((prev) => ({
          ...prev,
          [id]: (data as any[]) || [],
        }));
      } catch (err) {
        console.error("Unexpected error loading allocations for payment", id, err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-5 py-6 text-xs md:text-sm">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Container Payments</h2>
          <button
            type="button"
            onClick={async () => {
              setShowCreate(true);
              if (activeTab === "forwarder") {
                setAllocations({});
                await loadForwarderContainers();
              } else {
                setDeliveryAllocations({});
                await Promise.all([loadDeliveryContainers(), loadTruckers()]);
              }
            }}
            className="rounded-md bg-slate-900 px-3 py-1 text-sm text-white"
          >
            + Create Payment
          </button>
        </div>

        <div className="flex gap-2 text-[11px]">
          <button
            type="button"
            onClick={() => {
              setActiveTab("forwarder");
              setShowCreate(false);
            }}
            className={`rounded-full px-3 py-1 border text-xs ${
              activeTab === "forwarder"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Forwarder
          </button>
          <button
            type="button"
            onClick={async () => {
              setActiveTab("delivery");
              setShowCreate(false);
              setDeliveryAllocations({});
              await Promise.all([
                loadDeliveryContainers(),
                loadTruckers(),
                fetchDeliveryPayments(),
              ]);
            }}
            className={`rounded-full px-3 py-1 border text-xs ${
              activeTab === "delivery"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Delivery
          </button>
        </div>

        {activeTab === "forwarder" && showCreate && (
          <div className="mt-4 rounded-lg border bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Create Payment</h2>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-xs text-slate-500"
              >
                Close
              </button>
            </div>

            <div className="mb-4 grid gap-3 md:grid-cols-2 text-[11px]">
              {/* Containers allocation table */}
              <div className="flex flex-col gap-2">
                <div className="text-sm text-slate-600">
                  Forwarder: {derivedForwarder || "—"}
                </div>
                <div className="text-xs text-slate-600">
                  Select containers and allocation amounts:
                </div>
                {forwarderContainers.length === 0 ? (
                  <div className="text-[11px] text-slate-500">
                    No containers available.
                  </div>
                ) : (
                  <table className="w-full border-separate border-spacing-y-1 text-[11px]">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="px-1 py-0.5">Select</th>
                        <th className="px-1 py-0.5">Container #</th>
                        <th className="px-1 py-0.5 text-right">Quote Rate</th>
                        <th className="px-1 py-0.5 text-right">Invoiced</th>
                        <th className="px-1 py-0.5">Invoice #</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forwarderContainers.map((row: any) => {
                        const key = row.container_id as string;
                        const entry = allocations[key] || { amount: 0, invoice_number: "" };
                        const quoteRate = row.totalCost ?? 0;
                        return (
                          <tr key={key} className="rounded bg-slate-50">
                            <td className="px-1 py-0.5 align-top">
                              <input
                                type="checkbox"
                                checked={entry.amount > 0}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setAllocations((prev) => ({
                                    ...prev,
                                    [key]: {
                                      amount: checked
                                        ? entry.amount > 0
                                          ? entry.amount
                                          : quoteRate
                                        : 0,
                                      invoice_number: entry.invoice_number || "",
                                    },
                                  }));
                                }}
                              />
                            </td>
                            <td className="px-1 py-0.5 align-top">
                              {row.container_number || key}
                            </td>
                            <td className="px-1 py-0.5 text-right align-top">
                              {quoteRate > 0 ? quoteRate.toFixed(2) : "0.00"}
                            </td>
                            <td className="px-1 py-0.5 text-right align-top">
                              <input
                                type="number"
                                className="w-full rounded border border-slate-300 px-1 py-0.5 text-right"
                                value={entry.amount === 0 ? "" : String(entry.amount)}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const num = raw === "" ? 0 : Number(raw);
                                  setAllocations((prev) => ({
                                    ...prev,
                                    [key]: {
                                      amount: Number.isNaN(num) ? 0 : num,
                                      invoice_number: entry.invoice_number || "",
                                    },
                                  }));
                                }}
                              />
                            </td>
                            <td className="px-1 py-0.5 align-top">
                              <input
                                type="text"
                                className="w-full rounded border border-slate-300 px-1 py-0.5"
                                value={entry.invoice_number || ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setAllocations((prev) => ({
                                    ...prev,
                                    [key]: {
                                      amount: entry.amount || 0,
                                      invoice_number: value,
                                    },
                                  }));
                                }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Payment fields */}
              <div className="space-y-2">
                <div>
                  <label className="mb-1 block font-medium text-slate-700">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={createPaymentForm.payment_date}
                    onChange={(e) =>
                      setCreatePaymentForm((prev) => ({
                        ...prev,
                        payment_date: e.target.value,
                      }))
                    }
                    className="w-full rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-slate-700">
                    Total Amount
                  </label>
                  <input
                    type="number"
                    value={Object.values(allocations).reduce(
                      (sum, row) => sum + Number(row.amount || 0),
                      0,
                    )}
                    readOnly
                    className="w-full rounded border border-slate-300 bg-slate-100 px-2 py-1 text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-slate-700">
                    ACH Code
                  </label>
                  <input
                    type="text"
                    value={createPaymentForm.ach_code}
                    onChange={(e) =>
                      setCreatePaymentForm((prev) => ({
                        ...prev,
                        ach_code: e.target.value,
                      }))
                    }
                    className="w-full rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-slate-700">
                    Notes
                  </label>
                  <textarea
                    value={createPaymentForm.notes}
                    onChange={(e) =>
                      setCreatePaymentForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    className="h-20 w-full rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-2 flex justify-end gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={savePayment}
                className="rounded bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-700"
              >
                Save Payment
              </button>
            </div>
          </div>
        )}

        {activeTab === "delivery" && showCreate && (
          <div className="mt-4 rounded-lg border bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {isDeliveryEditMode ? "Edit Delivery Payment" : "Create Delivery Payment"}
              </h2>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-xs text-slate-500"
              >
                Close
              </button>
            </div>

            <div className="mb-4 grid gap-3 md:grid-cols-2 text-[11px]">
              {/* Trucker + Notes + containers allocation table */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">Trucker:</span>
                  <select
                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                    value={selectedTruckerId}
                    onChange={(e) => setSelectedTruckerId(e.target.value)}
                  >
                    <option value="">Select trucker…</option>
                    {truckers.map((t: any) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-700">
                    Notes
                  </label>
                  <textarea
                    className="w-full rounded border border-slate-300 px-2 py-1 text-[11px] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    rows={2}
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder="Optional notes..."
                  />
                </div>

                <div className="text-xs text-slate-600">
                  Select containers and delivery payment amounts:
                </div>
                {isDeliveryEditMode && editingDeliveryPayment ? (
                  deliveryEditRows.length === 0 ? (
                    <div className="text-[11px] text-slate-500">
                      No containers for this delivery payment.
                    </div>
                  ) : (
                    <>
                      <table className="w-full border-separate border-spacing-y-1 text-[11px]">
                        <thead>
                          <tr className="text-left text-slate-500">
                            <th className="px-1 py-0.5">Container #</th>
                            <th className="px-1 py-0.5 text-right">Amount</th>
                            <th className="px-1 py-0.5">Invoice #</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deliveryEditRows.map((row: any) => {
                            const key = String(row.container_id);
                            const entry =
                              deliveryAllocations[key] || {
                                amount: 0,
                                invoice_number: "",
                              };

                            return (
                              <tr key={key} className="rounded bg-slate-50">
                                {/* Container # */}
                                <td className="px-1 py-0.5 align-top">
                                  {row.container_number || key}
                                </td>

                                {/* Amount (numeric input) */}
                                <td className="px-1 py-0.5 text-right align-top">
                                  <input
                                    type="number"
                                    className="w-full rounded border border-slate-300 px-1 py-0.5 text-right"
                                    value={entry.amount === 0 ? "" : String(entry.amount)}
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      const num = raw === "" ? 0 : Number(raw);
                                      setDeliveryAllocations((prev) => ({
                                        ...prev,
                                        [key]: {
                                          ...prev[key],
                                          amount: Number.isNaN(num) ? 0 : num,
                                          invoice_number: entry.invoice_number || "",
                                        },
                                      }));
                                    }}
                                  />
                                </td>

                                {/* Invoice # (text input) */}
                                <td className="px-1 py-0.5 align-top">
                                  <input
                                    type="text"
                                    className="w-full rounded border border-slate-300 px-1 py-0.5"
                                    value={entry.invoice_number || ""}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setDeliveryAllocations((prev) => ({
                                        ...prev,
                                        [key]: {
                                          ...prev[key],
                                          amount: entry.amount || 0,
                                          invoice_number: value,
                                        },
                                      }));
                                    }}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </>
                  )
                ) : deliveryContainers.length === 0 ? (
                  <div className="text-[11px] text-slate-500">
                    No eligible containers for delivery payments.
                  </div>
                ) : (
                  <>
                    <table className="w-full border-separate border-spacing-y-1 text-[11px]">
                      <thead>
                        <tr className="text-left text-slate-500">
                          <th className="px-1 py-0.5">Select</th>
                          <th className="px-1 py-0.5">Container #</th>
                          <th className="px-1 py-0.5 text-right">Amount</th>
                          <th className="px-1 py-0.5">Invoice #</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deliveryContainers.map((row: any) => {
                          const key = String(row.container_id);
                          const entry =
                            deliveryAllocations[key] || {
                              amount: 0,
                              invoice_number: "",
                            };

                          return (
                            <tr key={key} className="rounded bg-slate-50">
                              {/* Select */}
                              <td className="px-1 py-0.5 align-top">
                                <input
                                  type="checkbox"
                                  checked={!!deliveryAllocations[key]}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setDeliveryAllocations((prev) => {
                                      if (!checked) {
                                        const copy = { ...prev };
                                        delete copy[key];
                                        return copy;
                                      }
                                      return {
                                        ...prev,
                                        [key]:
                                          prev[key] || {
                                            amount: 0,
                                            invoice_number: "",
                                          },
                                      };
                                    });
                                  }}
                                />
                              </td>

                              {/* Container # */}
                              <td className="px-1 py-0.5 align-top">
                                {row.container_number || key}
                              </td>

                              {/* Amount (numeric input) */}
                              <td className="px-1 py-0.5 text-right align-top">
                                <input
                                  type="number"
                                  className="w-full rounded border border-slate-300 px-1 py-0.5 text-right"
                                  value={entry.amount === 0 ? "" : String(entry.amount)}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const num = raw === "" ? 0 : Number(raw);
                                    setDeliveryAllocations((prev) => ({
                                      ...prev,
                                      [key]: {
                                        amount: Number.isNaN(num) ? 0 : num,
                                        invoice_number: entry.invoice_number || "",
                                      },
                                    }));
                                  }}
                                />
                              </td>

                              {/* Invoice # (text input) */}
                              <td className="px-1 py-0.5 align-top">
                                <input
                                  type="text"
                                  className="w-full rounded border border-slate-300 px-1 py-0.5"
                                  value={entry.invoice_number || ""}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setDeliveryAllocations((prev) => ({
                                      ...prev,
                                      [key]: {
                                        amount: entry.amount || 0,
                                        invoice_number: value,
                                      },
                                    }));
                                  }}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-700">
                      <div />
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Total Payment:</span>
                        <span className="font-semibold">
                          {new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: "USD",
                          }).format(
                            Object.values(deliveryAllocations).reduce(
                              (sum, row) => sum + (row.amount || 0),
                              0,
                            ),
                          )}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Notes/extra fields placeholder for future */}
              <div className="space-y-2">
                <div className="text-[11px] text-slate-500">
                  Delivery payments do not currently capture ACH or notes.
                </div>
              </div>
            </div>

            <div className="mt-2 flex justify-end gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveDeliveryPayment}
                className="rounded bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-700"
              >
                Save Delivery Payment
              </button>
            </div>
          </div>
        )}

        {activeTab === "forwarder" && (
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-[13px] font-semibold text-slate-900">
                  Forwarder Payments
                </h3>
                <select
                  className="rounded border border-slate-300 px-2 py-0.5 text-[10px] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  value={forwarderSelectedForwarder}
                  onChange={(e) => setForwarderSelectedForwarder(e.target.value)}
                >
                  <option value="">All Forwarders</option>
                  {Array.from(
                    new Set(
                      rows
                        .map((p) => p.forwarder)
                        .filter((name) => !!name),
                    ),
                  ).map((name) => (
                    <option key={name as string} value={name as string}>
                      {name as string}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Search by container or forwarder"
                  value={forwarderSearch}
                  onChange={(e) => setForwarderSearch(e.target.value)}
                  className="w-48 rounded border border-slate-300 px-2 py-0.5 text-[10px] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
                <button
                  type="button"
                  onClick={() =>
                    setForwarderSortOrder((prev) =>
                      prev === "desc" ? "asc" : "desc",
                    )
                  }
                  className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] text-slate-700 hover:bg-slate-50"
                >
                  Sort: {forwarderSortOrder === "desc" ? "Newest" : "Oldest"}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setForwarderShowAll((prev) => !prev)}
                className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] text-slate-700 hover:bg-slate-50"
              >
                {forwarderShowAll ? "Show Recent" : "View All"}
              </button>
            </div>
            {loading ? (
            <div className="text-[11px] text-slate-500">Loading payments…</div>
          ) : error ? (
            <div className="text-[11px] text-red-600">{error}</div>
          ) : rows.length === 0 ? (
            <div className="text-[11px] text-slate-500">No payments found.</div>
          ) : (
            <table className="w-full border-separate border-spacing-y-1 text-[11px]">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-2 py-1">Date</th>
                  <th className="px-2 py-1">Forwarder</th>
                  <th className="px-2 py-1">ACH Code</th>
                  <th className="px-2 py-1 text-right">Total Amount</th>
                  <th className="px-2 py-1">Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((p: any) => {
                    const text = forwarderSearch.trim().toLowerCase();
                    if (!text) return true;
                    const forwarderName = p.forwarder?.toLowerCase() || "";
                    // Container-based search would require additional joins; for now, search by forwarder only
                    return forwarderName.includes(text);
                  })
                  .filter(
                    (p: any) =>
                      !forwarderSelectedForwarder ||
                      p.forwarder === forwarderSelectedForwarder,
                  )
                  .map((p) => {
                  const isExpanded = expandedId === p.id;
                  const allocations = allocationsByPayment[p.id] || [];

                  return (
                    <React.Fragment key={p.id}>
                      <tr
                        className="cursor-pointer rounded bg-slate-50 hover:bg-slate-100"
                        onClick={() => toggleExpand(p.id)}
                      >
                        <td className="px-2 py-1 align-top">
                          {formatDate(p.payment_date)}
                        </td>
                        <td className="px-2 py-1 align-top">
                          {p.forwarder || "—"}
                        </td>
                        <td className="px-2 py-1 align-top">
                          {p.ach_code || "—"}
                        </td>
                        <td className="px-2 py-1 text-right align-top">
                          {p.total_amount != null
                            ? p.total_amount.toFixed(2)
                            : "0.00"}
                        </td>
                        <td
                          className="px-2 py-1 align-top max-w-xs truncate"
                          title={p.notes || undefined}
                        >
                          {p.notes || ""}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={5} className="bg-slate-50 px-3 py-2">
                            {allocations.length === 0 ? (
                              <div className="text-[11px] text-slate-500">
                                No allocations for this payment.
                              </div>
                            ) : (
                              <table className="w-full text-[11px]">
                                <thead>
                                  <tr className="text-left text-slate-500">
                                    <th className="px-2 py-1">Container #</th>
                                    <th className="px-2 py-1 text-right">
                                      Allocated Amount
                                    </th>
                                    <th className="px-2 py-1">Invoice #</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {allocations.map((a, idx) => {
                                    const c = a.containers_v2;
                                    const label =
                                      (c &&
                                        (c.container_number || c.temp_code ||
                                          c.id)) || "—";
                                    return (
                                      <tr key={idx}>
                                        <td className="px-2 py-1 align-top">
                                          {c ? (
                                            <Link
                                              href={`/inbound-containers/${c.id}`}
                                              className="text-sky-600 hover:underline"
                                            >
                                              {label}
                                            </Link>
                                          ) : (
                                            label
                                          )}
                                        </td>
                                        <td className="px-2 py-1 text-right align-top">
                                          {a.amount_allocated != null
                                            ? Number(a.amount_allocated).toFixed(2)
                                            : "0.00"}
                                        </td>
                                        <td className="px-2 py-1 align-top">
                                          {a.invoice_number || "—"}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        )}

        {activeTab === "delivery" && (
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-[13px] font-semibold text-slate-900">
                  Delivery Payments
                </h3>
                <select
                  className="rounded border border-slate-300 px-2 py-0.5 text-[10px] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  value={deliverySelectedTrucker}
                  onChange={(e) => setDeliverySelectedTrucker(e.target.value)}
                >
                  <option value="">All Truckers</option>
                  {truckers.map((t: any) => (
                    <option key={t.id} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Search by container, invoice, or trucker"
                  value={deliverySearchTerm}
                  onChange={(e) => setDeliverySearchTerm(e.target.value)}
                  className="w-48 rounded border border-slate-300 px-2 py-0.5 text-[10px] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
                <button
                  type="button"
                  onClick={async () => {
                    setDeliverySortOrder((prev) =>
                      prev === "desc" ? "asc" : "desc",
                    );
                    await fetchDeliveryPayments();
                  }}
                  className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] text-slate-700 hover:bg-slate-50"
                >
                  Sort: {deliverySortOrder === "desc" ? "Newest" : "Oldest"}
                </button>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setDeliveryShowAll((prev) => !prev);
                  await fetchDeliveryPayments();
                }}
                className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] text-slate-700 hover:bg-slate-50"
              >
                {deliveryShowAll ? "Show Recent" : "View All"}
              </button>
            </div>

            {deliveryPayments.length === 0 ? (
              <div className="text-[11px] text-slate-500">
                No delivery payments recorded.
              </div>
            ) : (
              <table className="w-full border-separate border-spacing-y-1 text-[11px]">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="px-2 py-1">Date</th>
                    <th className="px-2 py-1">Trucker</th>
                    <th className="px-2 py-1">ACH</th>
                    <th className="px-2 py-1 text-right">Total</th>
                    <th className="px-2 py-1">Notes</th>
                    <th className="px-2 py-1 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryPayments
                    .filter((p: any) => {
                      const text = deliverySearchTerm.trim().toLowerCase();
                      if (!text) return true;
                      const trucker =
                        p.truckers?.name?.toLowerCase() || "";
                      const hasInvoiceMatch = (p.delivery_payment_allocations || []).some(
                        (a: any) =>
                          (a.invoice_number || "")
                            .toLowerCase()
                            .includes(text),
                      );
                      return trucker.includes(text) || hasInvoiceMatch;
                    })
                    .filter((p: any) =>
                      !deliverySelectedTrucker ||
                      p.truckers?.name === deliverySelectedTrucker,
                    )
                    .map((p: any) => {
                    const isExpanded = expandedDeliveryId === p.id;
                    const truckerName = p.truckers?.name || "";
                    const allocations = p.delivery_payment_allocations || [];

                    return (
                      <React.Fragment key={p.id}>
                        <tr
                          className="cursor-pointer rounded bg-slate-50 hover:bg-slate-100"
                          onClick={() =>
                            setExpandedDeliveryId((prev) =>
                              prev === p.id ? null : p.id,
                            )
                          }
                        >
                          <td className="px-2 py-1 align-top">
                            {formatDate(p.payment_date)}
                          </td>
                          <td className="px-2 py-1 align-top">{truckerName}</td>
                          <td className="px-2 py-1 align-top">
                            {p.ach_code || "—"}
                          </td>
                          <td className="px-2 py-1 text-right align-top">
                            {p.total_amount != null
                              ? Number(p.total_amount).toFixed(2)
                              : "0.00"}
                          </td>
                          <td
                            className="px-2 py-1 align-top max-w-xs truncate"
                            title={p.notes || undefined}
                          >
                            {p.notes || "—"}
                          </td>
                          <td className="px-2 py-1 text-right align-top">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditDelivery(p);
                              }}
                              className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] text-slate-700 hover:bg-slate-50"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td
                              colSpan={4}
                              className="bg-slate-50 px-3 py-2"
                            >
                              {allocations.length === 0 ? (
                                <div className="text-[11px] text-slate-500">
                                  No allocations for this delivery payment.
                                </div>
                              ) : (
                                <table className="w-full text-[11px]">
                                  <thead>
                                    <tr className="text-left text-slate-500">
                                      <th className="px-2 py-1">Container #</th>
                                      <th className="px-2 py-1 text-right">
                                        Amount
                                      </th>
                                      <th className="px-2 py-1">Invoice #</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {p.delivery_payment_allocations?.map(
                                      (row: any, idx: number) => {
                                        console.log("ROW DATA", row);
                                        return (
                                          <tr key={idx} className="rounded bg-slate-50">
                                            <td className="px-2 py-1 align-top">
                                              {row.container_number || row.container_id ? (
                                                <Link
                                                  href={`/inbound-containers/${row.container_id}`}
                                                  className="text-sky-600 hover:underline"
                                                >
                                                  {row.container_number || row.container_id}
                                                </Link>
                                              ) : (
                                                row.container_id
                                              )}
                                            </td>
                                            <td className="px-2 py-1 text-right align-top">
                                              {row.amount != null
                                                ? Number(row.amount).toFixed(2)
                                                : "0.00"}
                                            </td>
                                            <td className="px-2 py-1 align-top">
                                              {row.invoice_number || "—"}
                                            </td>
                                          </tr>
                                        );
                                      },
                                    )}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
