"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type InboundContainerDetail = {
  container_id: string;
  container_number: string | null;
  bol_number: string | null;
  status: string | null;
  shipment_status?: string | null;
  eta: string | null;
  terminal: string | null;
  last_free_day: string | null;
  available_at: string | null;
  out_for_delivery_at: string | null;
  delivered_at: string | null;
  unloaded_at: string | null;
};

type ContainerItemDetail = {
  sku: string;
  product_name: string;
  po_number: string;
  cartons: number;
  units: number;
};

const statusColorMap: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700 border-gray-200",
  Booked: "bg-blue-100 text-blue-700 border-blue-200",
  "In Transit": "bg-yellow-100 text-yellow-800 border-yellow-200",
  Arrived: "bg-purple-100 text-purple-700 border-purple-200",
  Available: "bg-teal-100 text-teal-700 border-teal-200",
  "Out for Delivery": "bg-orange-100 text-orange-700 border-orange-200",
  Delivered: "bg-green-100 text-green-700 border-green-200",
  Unloaded: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

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

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 16);
}

export default function InboundContainerDetailPage() {
  const params = useParams() as { id?: string | string[] };
  const containerId = Array.isArray(params.id) ? params.id[0] : params.id;
  console.log("containerId:", containerId);

  const [detail, setDetail] = useState<InboundContainerDetail | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [snapshotItems, setSnapshotItems] = useState<any[]>([]);
  const [forwarderInfo, setForwarderInfo] = useState<{
    forwarder: string;
    quoteRate: string;
    notes: string;
  } | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [deliverySummary, setDeliverySummary] = useState<
    { trucker: string; totalPaid: number } | null
  >(null);
  const [deliveryPayments, setDeliveryPayments] = useState<any[]>([]);
  const [deliveryPaymentStatus, setDeliveryPaymentStatus] = useState<
    "Paid" | "Unpaid"
  >("Unpaid");
  const [forwarderContainers, setForwarderContainers] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [showCreatePayment, setShowCreatePayment] = useState(false);
  const [createPaymentForm, setCreatePaymentForm] = useState({
    forwarder: "",
    payment_date: "",
    total_amount: "",
    ach_code: "",
    notes: "",
    amount_allocated: "",
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditingContainer, setIsEditingContainer] = useState(false);
  const [containerNumberInput, setContainerNumberInput] = useState("");

  // Fetch delivery payments for this container
  const fetchDeliveryPayments = async (containerId: string) => {
    console.log("FETCHING DELIVERY FOR", containerId);
    const { data, error } = await supabase
      .from("delivery_payment_allocations")
      .select(
        `
        amount,
        invoice_number,
        delivery_payments (
          payment_date,
          ach_code,
          trucker_id,
          truckers ( name )
        )
      `,
      )
      .eq("container_id", containerId);

    if (error) {
      console.error("Delivery fetch error", error);
      setDeliveryPayments([]);
      setDeliverySummary(null as any);
      return;
    }

    console.log("deliveryPayments", data);
    setDeliveryPayments(data || []);

    if (!data || data.length === 0) {
      setDeliverySummary(null as any);
    } else {
      const totalPaid = (data as any[]).reduce(
        (sum, row) => sum + Number(row.amount || 0),
        0,
      );
      const truckerName =
        (data[0] as any)?.delivery_payments?.truckers?.name || "";
      setDeliverySummary({ trucker: truckerName, totalPaid });
    }
  };

  const loadForwarderContainers = async () => {
    try {
      const { data: containers, error } = await supabase
        .from("inbound_containers_list")
        .select("container_id, container_number, total_cartons, total_units")
        .order("container_number");

      if (error) {
        console.error("Error loading forwarder containers", error);
        setForwarderContainers([]);
        return;
      }

      const costTotals = await fetchForwarderTotals();
      const allocationTotals = await fetchAllocationTotals();

      const enriched = (containers || []).map((c: any) => {
        const totalCost = costTotals[c.container_id] || 0;
        const totalAllocated = allocationTotals[c.container_id] || 0;
        return {
          ...c,
          totalCost,
          totalAllocated,
          remaining: totalCost - totalAllocated,
        };
      });

      setForwarderContainers(enriched);
    } catch (err) {
      console.error("Unexpected error loading forwarder containers", err);
      setForwarderContainers([]);
    }
  };

  const fetchForwarderTotals = async (): Promise<Record<string, number>> => {
    try {
      const { data, error } = await supabase
        .from("container_forwarder_costs")
        .select("container_id, amount");

      if (error) {
        console.error("Error loading forwarder totals", error);
        return {};
      }

      const totals: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        const id = row.container_id as string;
        const amt = Number(row.amount || 0);
        if (!totals[id]) totals[id] = 0;
        totals[id] += amt;
      });

      return totals;
    } catch (err) {
      console.error("Unexpected error loading forwarder totals", err);
      return {};
    }
  };

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
        const id = row.container_id as string;
        const amt = Number(row.amount_allocated || 0);
        if (!totals[id]) totals[id] = 0;
        totals[id] += amt;
      });

      return totals;
    } catch (err) {
      console.error("Unexpected error loading allocation totals", err);
      return {};
    }
  };

  const savePayment = async () => {
    if (!containerId) return;

    const totalAmountNum =
      createPaymentForm.total_amount === ""
        ? null
        : Number(createPaymentForm.total_amount);

    const remaining = totalCost - totalAllocated;
    const totalAllocatedThisPayment = Object.values(allocations).reduce(
      (sum, amt) => sum + (amt || 0),
      0,
    );
    const containersSelected = Object.values(allocations).some(
      (amt) => amt && amt > 0,
    );

    // Basic validation
    if (!containersSelected) {
      alert("Select at least one container to allocate payment to.");
      return;
    }
    if (!totalAllocatedThisPayment || totalAllocatedThisPayment <= 0) {
      alert("Allocated amount must be greater than 0.");
      return;
    }
    if (totalAmountNum === null || totalAmountNum <= 0) {
      alert("Total payment amount must be greater than 0.");
      return;
    }
    if (totalAllocatedThisPayment > totalAmountNum) {
      alert("Sum of allocations cannot exceed total payment amount.");
      return;
    }
    if (remaining > 0 && totalAllocatedThisPayment > remaining) {
      alert("Allocated amount cannot exceed remaining balance.");
      return;
    }

    try {
      const { data: payment, error: paymentError } = await supabase
        .from("forwarder_payments")
        .insert({
          forwarder: forwarderName || null,
          payment_date: createPaymentForm.payment_date || null,
          total_amount: totalAmountNum,
          ach_code: createPaymentForm.ach_code || null,
          notes: createPaymentForm.notes || null,
        })
        .select()
        .single();

      if (paymentError || !payment) {
        console.error("Failed to create forwarder payment", paymentError);
        return;
      }

      for (const [allocContainerId, amount] of Object.entries(allocations)) {
        if (!amount || amount <= 0) continue;
        const { error: allocError } = await supabase
          .from("forwarder_payment_allocations")
          .insert({
            payment_id: payment.id,
            container_id: allocContainerId,
            amount_allocated: amount,
          });

        if (allocError) {
          console.error(
            "Failed to create payment allocation for container",
            allocContainerId,
            allocError,
          );
          return;
        }
      }

      await loadContainer();
      setShowCreatePayment(false);
      setCreatePaymentForm({
        forwarder: "",
        payment_date: "",
        total_amount: "",
        ach_code: "",
        notes: "",
        amount_allocated: "",
      });
      setAllocations({});
    } catch (err) {
      console.error("Unexpected error creating payment", err);
    }
  };

  const saveForwarder = async () => {
    if (!containerId) return;
    const forwarder = forwarderInfo?.forwarder?.trim() || null;
    const quoteRateNum = forwarderInfo?.quoteRate
      ? Number(forwarderInfo.quoteRate)
      : null;
    const notes = forwarderInfo?.notes?.trim() || null;

    console.log("Saving forwarder payload:", {
      container_id: containerId,
      forwarder,
      amount: quoteRateNum,
      notes,
    });

    try {
      const { error } = await supabase
        .from("container_forwarder_costs")
        .upsert(
          {
            container_id: containerId,
            forwarder,
            amount: quoteRateNum,
            notes,
          },
          { onConflict: "container_id" },
        );

      if (error) {
        console.error("Failed to save forwarder info", error);
      } else {
        console.log("Forwarder info saved successfully");
        await loadContainer();
      }
    } catch (err) {
      console.error("Unexpected error saving forwarder info", err);
    }
  };

  const saveContainerNumber = async () => {
    if (!containerId) return;

    const { error } = await supabase
      .from("containers_v2")
      .update({ container_number: containerNumberInput })
      .eq("id", containerId);

    if (error) {
      console.error("Failed to update container number", error);
    } else {
      setDetail((prev) =>
        prev ? { ...prev, container_number: containerNumberInput } : prev,
      );
      setIsEditingContainer(false);
    }
  };

  const loadContainer = async () => {
    if (!containerId) return;

    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("inbound_container_detail")
        .select("*")
        .eq("container_id", containerId)
        .maybeSingle();

      console.log("container detail result:", { data, error });

      if (error) {
        console.error("Error loading inbound_container_detail", error);
        setError("Failed to load container");
        setDetail(null);
        return;
      }

      if (!data) {
        setDetail(null);
        return;
      }

      setDetail(data as InboundContainerDetail);

      console.log("DETAIL STATUS:", (data as any)?.status);

      // Load contents (items_detail) from inbound_containers_list
      const { data: listData, error: listError } = await supabase
        .from("inbound_containers_list")
        .select("items_detail")
        .eq("container_id", containerId)
        .maybeSingle();

      if (listError) {
        console.error(
          "Error loading inbound_containers_list for items_detail",
          listError,
        );
        setItems([]);
      } else {
        const itemsDetail = (listData as any)?.items_detail || [];
        console.log("itemsDetail:", itemsDetail);
        setItems(itemsDetail as ContainerItemDetail[]);
      }

      // Load forwarder cost (single row)
      const { data: forwarderData } = await supabase
        .from("container_forwarder_costs")
        .select("forwarder, amount, notes")
        .eq("container_id", containerId)
        .maybeSingle();

      if (forwarderData) {
        setForwarderInfo({
          forwarder: (forwarderData as any).forwarder || "",
          quoteRate:
            (forwarderData as any).amount != null
              ? String((forwarderData as any).amount)
              : "",
          notes: (forwarderData as any).notes || "",
        });
      } else {
        setForwarderInfo({ forwarder: "", quoteRate: "", notes: "" });
      }

      // Load forwarder payments for this container
      const { data: paymentsData } = await supabase
        .from("forwarder_payment_allocations")
        .select(
          `
          amount_allocated,
          invoice_number,
          forwarder_payments (
            id,
            forwarder,
            payment_date,
            total_amount,
            ach_code,
            notes
          )
        `,
        )
        .eq("container_id", containerId);

      setPayments(paymentsData || []);

      // Load delivery payment status (from container_delivery_status)
      const {
        data: deliveryStatus,
        error: deliveryStatusError,
      } = await supabase
        .from("container_delivery_status")
        .select("delivery_payment_status")
        .eq("container_id", containerId)
        .maybeSingle();

      if (deliveryStatusError) {
        console.error(
          "Error loading container_delivery_status for container",
          deliveryStatusError,
        );
        setDeliveryPaymentStatus("Unpaid");
      } else {
        const statusValue = (deliveryStatus as any)?.delivery_payment_status;
        setDeliveryPaymentStatus(statusValue === "Paid" ? "Paid" : "Unpaid");
      }

      // Delivery payments are loaded via fetchDeliveryPayments(containerId)
    } catch (err) {
      console.error("Unexpected error loading inbound_container_detail", err);
      setError("Failed to load container");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  const normalizedStatus = (detail?.status || "").toLowerCase().trim();
  const isUnloaded = normalizedStatus === "unloaded";
  console.log("normalizedStatus:", normalizedStatus);
  console.log("FINAL isUnloaded:", isUnloaded);

  useEffect(() => {
    console.log("useEffect triggered", containerId);
    if (!containerId) return;
    loadContainer();
    fetchDeliveryPayments(containerId);
  }, [containerId]);

  useEffect(() => {
    if (!containerId) {
      console.log("Skipping snapshot: no containerId");
      return;
    }
    if (!isUnloaded) {
      console.log("Skipping snapshot: not unloaded");
      return;
    }
    if (!detail?.container_id) {
      console.log("No container_id yet, skipping snapshot");
      return;
    }

    console.log("Using container_id for snapshot:", detail?.container_id);

    const loadSnapshot = async () => {
      // Step 1: get latest receipt
      const { data: receipts, error: receiptError } = await supabase
        .from("container_receipts")
        .select("id")
        .eq("container_id", detail?.container_id)
        .order("received_at", { ascending: false })
        .limit(1);

      const receipt = (receipts as any)?.[0] || null;
      console.log("RECEIPTS:", receipts);

      if (receiptError) {
        console.error("Error loading container_receipts snapshot", receiptError);
        setSnapshotItems([]);
      } else {
        console.log("RECEIPT:", receipt);

        if (!receipt) {
          setSnapshotItems([]);
        } else {
          // Step 2: get receipt lines
          const { data: lines, error: linesError } = await supabase
            .from("container_receipt_lines")
            .select(
              `
              sku,
              product_name,
              quantity_expected_units,
              quantity_received_units,
              quantity_received_cases,
              loose_pieces_received
            `,
            )
            .eq("container_receipt_id", (receipt as any).id);

          if (linesError) {
            console.error("Error loading container_receipt_lines", linesError);
            setSnapshotItems([]);
          } else {
            console.log("RECEIPT LINES:", lines);

            // Step 3: map
            const mapped = (lines || []).map((l: any) => {
              const totalReceived =
                (l.quantity_received_units || 0) +
                (l.loose_pieces_received || 0);
              return {
                sku: l.sku,
                product_name: l.product_name,
                expected: l.quantity_expected_units,
                received: l.quantity_received_units,
                loose: l.loose_pieces_received,
                total: totalReceived,
                discrepancy:
                  totalReceived - (l.quantity_expected_units || 0),
              };
            });

            console.log("SNAPSHOT ITEMS:", mapped);
            setSnapshotItems(mapped);
          }
        }
      }
    };

    loadSnapshot();
  }, [containerId, isUnloaded]);

  const [form, setForm] = useState({
    terminal: "",
    last_free_day: "",
    available_at: "",
    out_for_delivery_at: "",
    delivered_at: "",
    unloaded_at: "",
  });

  const updateStatus = async (newStatus: string) => {
    if (!containerId) return;

    const updates: any = { status: newStatus };
    const now = new Date().toISOString();

    if (newStatus === "Available") {
      updates.available_at = now;
    }
    if (newStatus === "Out for Delivery") {
      updates.out_for_delivery_at = now;
    }
    if (newStatus === "Delivered") {
      updates.delivered_at = now;
    }
    if (newStatus === "Unloaded") {
      updates.unloaded_at = now;
    }

    const { error } = await supabase
      .from("containers_v2")
      .update(updates)
      .eq("id", containerId);

    if (error) {
      console.error("Status update failed", error);
    } else {
      console.log("Status updated", updates);
      // Refetch container detail using the same loader as page init
      await loadContainer();
    }
  };

  useEffect(() => {
    if (!detail) return;

    setForm({
      terminal: detail.terminal || "",
      last_free_day: detail.last_free_day || "",
      available_at: toLocalInput(detail.available_at),
      out_for_delivery_at: toLocalInput(detail.out_for_delivery_at),
      delivered_at: toLocalInput(detail.delivered_at),
      unloaded_at: toLocalInput(detail.unloaded_at),
    });

    // Initialize editable container number input
    setContainerNumberInput(detail.container_number || "");
  }, [detail]);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!containerId) return;

    const toISO = (val: string | null) => (val ? new Date(val).toISOString() : null);

    try {
      const { error } = await supabase
        .from("containers_v2")
        .update({
          terminal: form.terminal || null,
          last_free_day: form.last_free_day || null,
          available_at: toISO(form.available_at || null),
          out_for_delivery_at: toISO(form.out_for_delivery_at || null),
          delivered_at: toISO(form.delivered_at || null),
          unloaded_at: toISO(form.unloaded_at || null),
          eta: detail?.eta ?? null,
        })
        .eq("id", containerId);

      if (error) {
        console.error("Error saving container execution fields", error);
      } else {
        console.log("Container execution fields saved successfully");
        await loadContainer();
      }
    } catch (err) {
      console.error("Unexpected error saving container execution fields", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-5 py-6 text-xs md:text-sm">
        <div className="mx-auto max-w-4xl text-slate-600">Loading container…</div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen bg-slate-50 px-5 py-6 text-xs md:text-sm">
        <div className="mx-auto max-w-4xl text-slate-600">
          {error || "Container not found"}
        </div>
      </div>
    );
  }

  const displayStatus = ["Draft", "Booked", "In Transit"].includes(
    (detail as any).shipment_status,
  )
    ? (detail as any).shipment_status
    : detail.status || "Draft";

  const badgeClasses =
    statusColorMap[displayStatus] ?? "bg-slate-100 text-slate-700 border-slate-200";

  const deliveryStatusClass =
    deliveryPaymentStatus === "Paid"
      ? "text-emerald-600"
      : "text-slate-500";

  // Payment status based on allocated amounts vs quoted forwarder cost
  const totalAllocated = payments.reduce(
    (sum, p) => sum + (p.amount_allocated || 0),
    0,
  );
  const totalCost = forwarderInfo
    ? Number(forwarderInfo.quoteRate || 0)
    : 0;

  const forwarderName = forwarderInfo?.forwarder || "";

  const quote = totalCost;
  const paid = totalAllocated;
  const variance = paid - quote;

  let paymentStatus = "Unpaid";
  if (totalAllocated > 0 && totalAllocated < totalCost) {
    paymentStatus = "Partial";
  }
  if (totalAllocated >= totalCost && totalCost > 0) {
    paymentStatus = "Paid";
  }

  // Button visibility rules based on current status
  const showMarkAvailable = [
    "Draft",
    "Booked",
    "In Transit",
    "Arrived",
  ].includes(displayStatus);

  const showOutForDelivery = displayStatus === "Available";
  const showMarkDelivered = displayStatus === "Out for Delivery";
  const showMarkUnloaded = displayStatus === "Delivered";

  return (
    <div className="min-h-screen bg-slate-50 px-5 py-6 text-xs md:text-sm">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">
              Inbound Container
            </div>
            <div className="mt-1 flex items-center gap-2 text-lg font-semibold text-slate-900">
              {!isEditingContainer ? (
                <>
                  <span>{detail.container_number || (detail as any).temp_code || detail.container_id}</span>
                  <button
                    type="button"
                    onClick={() => setIsEditingContainer(true)}
                    className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-normal text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    value={containerNumberInput}
                    onChange={(e) => setContainerNumberInput(e.target.value)}
                    className="rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                  <button
                    type="button"
                    onClick={() => setIsEditingContainer(false)}
                    className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-normal text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveContainerNumber}
                    className="rounded bg-sky-600 px-2 py-0.5 text-[11px] font-normal text-white hover:bg-sky-700"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-slate-600">
              <span className="text-[11px]">
                <span className="font-medium">BOL:</span>{" "}
                {detail.bol_number || "—"}
              </span>
              <span className="text-[11px]">
                <span className="font-medium">ETA:</span>{" "}
                {formatDate(detail.eta)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-600">Status</span>
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${badgeClasses}`}
            >
              {displayStatus}
            </span>
          </div>
        </div>

        {/* Status actions */}
        <div className="flex flex-wrap gap-2 text-[11px]">
          {showMarkAvailable && (
            <button
              type="button"
              onClick={() => updateStatus("Available")}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:bg-slate-50"
            >
              Mark Available
            </button>
          )}

          {showOutForDelivery && (
            <button
              type="button"
              onClick={() => updateStatus("Out for Delivery")}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:bg-slate-50"
            >
              Out for Delivery
            </button>
          )}

          {showMarkDelivered && (
            <button
              type="button"
              onClick={() => updateStatus("Delivered")}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:bg-slate-50"
            >
              Mark Delivered
            </button>
          )}

          {showMarkUnloaded && (
            <button
              type="button"
              onClick={() => updateStatus("Unloaded")}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:bg-slate-50"
            >
              Mark Unloaded
            </button>
          )}
        </div>

        {/* Forwarder section */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-[13px] font-semibold text-slate-900">Forwarder</h3>
              <span className="text-[11px] text-slate-600">
                Payment Status: <span className="font-semibold">{paymentStatus}</span>
              </span>
            </div>
            <button
              type="button"
              onClick={saveForwarder}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
            >
              Save
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-y-1 text-[11px]">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-2 py-1">Forwarder</th>
                  <th className="px-2 py-1">BOL</th>
                  <th className="px-2 py-1 text-right">Quote Rate</th>
                  <th className="px-2 py-1">Notes</th>
                  <th className="px-2 py-1 text-right">Amount Paid</th>
                  <th className="px-2 py-1 text-right">Variance</th>
                </tr>
              </thead>
              <tbody>
                <tr className="rounded bg-slate-50">
                  <td className="px-2 py-1 align-top">
                    <input
                      type="text"
                      className="w-full rounded border border-slate-300 px-1 py-0.5 text-[11px]"
                      value={forwarderInfo?.forwarder || ""}
                      onChange={(e) =>
                        setForwarderInfo((prev) => ({
                          ...(prev || { forwarder: "", quoteRate: "", notes: "" }),
                          forwarder: e.target.value,
                        }))
                      }
                    />
                  </td>
                  <td className="px-2 py-1 align-top">
                    {detail.bol_number || "-"}
                  </td>
                  <td className="px-2 py-1 text-right align-top">
                    <input
                      type="number"
                      className="w-full rounded border border-slate-300 px-1 py-0.5 text-right text-[11px]"
                      value={forwarderInfo?.quoteRate || ""}
                      onChange={(e) =>
                        setForwarderInfo((prev) => ({
                          ...(prev || { forwarder: "", quoteRate: "", notes: "" }),
                          quoteRate: e.target.value,
                        }))
                      }
                    />
                  </td>
                  <td className="px-2 py-1 align-top">
                    <textarea
                      value={forwarderInfo?.notes || ""}
                      onChange={(e) =>
                        setForwarderInfo((prev) => ({
                          ...(prev || { forwarder: "", quoteRate: "", notes: "" }),
                          notes: e.target.value,
                        }))
                      }
                      className="w-full min-h-[60px] rounded-md border border-slate-300 px-2 py-1 text-sm"
                      placeholder="Notes"
                    />
                  </td>
                  <td className="px-2 py-1 text-right align-top">
                    {totalAllocated > 0 ? totalAllocated.toFixed(2) : "0.00"}
                  </td>
                  <td className="px-2 py-1 text-right align-top">
                    <span
                      className={
                        variance === 0
                          ? "text-slate-500"
                          : variance > 0
                          ? "text-red-600 font-medium"
                          : "text-orange-600 font-medium"
                      }
                    >
                      {variance > 0 ? `+${variance}` : variance}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Forwarder Payments (view only; creation handled on payments page) */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm mb-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-slate-900">
              Forwarder Payments
            </h3>
          </div>

          {false && (
            <div className="mb-4 rounded border border-slate-200 bg-slate-50 p-3 text-[11px]">
              <div className="mb-2 grid gap-2 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <div className="text-sm text-slate-600">
                    Forwarder: {forwarderName || "—"}
                  </div>

                  {forwarderContainers.length > 0 && (
                    <div className="mt-1">
                      <div className="mb-1 text-[11px] font-semibold text-slate-700">
                        Containers for this forwarder
                      </div>
                      <table className="w-full border-separate border-spacing-y-1 text-[11px]">
                        <thead>
                          <tr className="text-left text-slate-500">
                            <th className="px-1 py-0.5">Select</th>
                            <th className="px-1 py-0.5">Container #</th>
                            <th className="px-1 py-0.5 text-right">Remaining</th>
                            <th className="px-1 py-0.5 text-right">Allocate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {forwarderContainers.map((row: any) => {
                            const key = row.container_id as string;
                            const value = allocations[key] ?? 0;
                            const remainingForContainer = row.remaining ?? 0;
                            return (
                              <tr key={key} className="rounded bg-white">
                                <td className="px-1 py-0.5 align-top">
                                  <input
                                    type="checkbox"
                                    checked={value > 0}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setAllocations((prev) => ({
                                        ...prev,
                                        [key]: checked
                                          ? value > 0
                                            ? value
                                            : Math.max(remainingForContainer, 0)
                                          : 0,
                                      }));
                                    }}
                                  />
                                </td>
                                <td className="px-1 py-0.5 align-top">
                                  {row.container_number || key}
                                </td>
                                <td className="px-1 py-0.5 text-right align-top">
                                  {remainingForContainer > 0
                                    ? remainingForContainer.toFixed(2)
                                    : "0.00"}
                                </td>
                                <td className="px-1 py-0.5 text-right align-top">
                                  <input
                                    type="number"
                                    className="w-full rounded border border-slate-300 px-1 py-0.5 text-right"
                                    value={value === 0 ? "" : String(value)}
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      const num = raw === "" ? 0 : Number(raw);
                                      setAllocations((prev) => ({
                                        ...prev,
                                        [key]: Number.isNaN(num) ? 0 : num,
                                      }));
                                    }}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
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
                    value={createPaymentForm.total_amount}
                    onChange={(e) =>
                      setCreatePaymentForm((prev) => ({
                        ...prev,
                        total_amount: e.target.value,
                      }))
                    }
                    className="w-full rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
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
                    Allocated Amount (this container)
                  </label>
                  <input
                    type="number"
                    value={createPaymentForm.amount_allocated}
                    onChange={(e) =>
                      setCreatePaymentForm((prev) => ({
                        ...prev,
                        amount_allocated: e.target.value,
                      }))
                    }
                    className="w-full rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                </div>
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
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreatePayment(false)}
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

          {payments.length === 0 ? (
            <div className="text-[11px] text-slate-500">No payments recorded.</div>
          ) : (
            <table className="w-full border-separate border-spacing-y-1 text-[11px]">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-2 py-1">Payment Date</th>
                  <th className="px-2 py-1">Forwarder</th>
                  <th className="px-2 py-1">ACH Code</th>
                  <th className="px-2 py-1 text-right">Allocated Amount</th>
                  <th className="px-2 py-1">Invoice #</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, idx) => {
                  const payment = p.forwarder_payments;
                  if (!payment) return null;
                  return (
                    <tr key={payment.id ?? idx} className="rounded bg-slate-50">
                      <td className="px-2 py-1 align-top">{payment.payment_date}</td>
                      <td className="px-2 py-1 align-top">{payment.forwarder}</td>
                      <td className="px-2 py-1 align-top">{payment.ach_code}</td>
                      <td className="px-2 py-1 text-right align-top">
                        {p.amount_allocated}
                      </td>
                      <td className="px-2 py-1 align-top">
                        {p.invoice_number || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Delivery section */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm mb-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-[13px] font-semibold text-slate-900">
                Delivery
              </h3>
              <span className="text-[11px] text-slate-600">
                Payment Status:{" "}
                <span className={`font-semibold ${deliveryStatusClass}`}>
                  {deliveryPaymentStatus}
                </span>
              </span>
            </div>
          </div>

          {deliveryPayments.length === 0 ? (
            <div className="text-[11px] text-slate-500">
              No delivery payment recorded.
            </div>
          ) : (
            <table className="w-full border-separate border-spacing-y-1 text-[11px]">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-2 py-1">Payment Date</th>
                  <th className="px-2 py-1">Trucker</th>
                  <th className="px-2 py-1">ACH</th>
                  <th className="px-2 py-1 text-right">Amount</th>
                  <th className="px-2 py-1">Invoice #</th>
                </tr>
              </thead>
              <tbody>
                {deliveryPayments.map((p, idx) => (
                  <tr key={idx} className="rounded bg-slate-50">
                    <td className="px-2 py-1 align-top">
                      {p.delivery_payments?.payment_date || "—"}
                    </td>
                    <td className="px-2 py-1 align-top">
                      {p.delivery_payments?.truckers?.name || "—"}
                    </td>
                    <td className="px-2 py-1 align-top">
                      {p.delivery_payments?.ach_code || "—"}
                    </td>
                    <td className="px-2 py-1 text-right align-top">
                      {p.amount != null ? Number(p.amount).toFixed(2) : "0.00"}
                    </td>
                    <td className="px-2 py-1 align-top">
                      {p.invoice_number || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Execution fields */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-[13px] font-semibold text-slate-900">
            Execution
          </h3>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-600">
                Terminal
              </label>
              <input
                type="text"
                value={form.terminal}
                onChange={(e) => handleChange("terminal", e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs outline-none ring-0 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-600">
                Last Free Day
              </label>
              <input
                type="date"
                value={form.last_free_day}
                onChange={(e) => handleChange("last_free_day", e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs outline-none ring-0 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-600">
                Available At
              </label>
              <input
                type="datetime-local"
                value={form.available_at}
                onChange={(e) => handleChange("available_at", e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs outline-none ring-0 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-600">
                Out for Delivery At
              </label>
              <input
                type="datetime-local"
                value={form.out_for_delivery_at}
                onChange={(e) =>
                  handleChange("out_for_delivery_at", e.target.value)
                }
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs outline-none ring-0 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-600">
                Delivered At
              </label>
              <input
                type="datetime-local"
                value={form.delivered_at}
                onChange={(e) => handleChange("delivered_at", e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs outline-none ring-0 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-600">
                Unloaded At
              </label>
              <input
                type="datetime-local"
                value={form.unloaded_at}
                onChange={(e) => handleChange("unloaded_at", e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs outline-none ring-0 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          <p className="mt-3 text-[11px] text-slate-500">
            Changes are not yet saved.
          </p>

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              className="rounded-md bg-blue-600 text-white px-3 py-1 text-sm hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </div>

        {/* Contents */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-[13px] font-semibold text-slate-900">Contents</h3>

          {isUnloaded ? (
            snapshotItems.length === 0 ? (
              <div className="text-[11px] text-slate-500">
                No snapshot items found for this container.
              </div>
            ) : (
              <table className="w-full border-separate border-spacing-y-1 text-[11px]">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="px-2 py-1">SKU</th>
                    <th className="px-2 py-1">Product</th>
                    <th className="px-2 py-1 text-right">Expected</th>
                    <th className="px-2 py-1 text-right">Received</th>
                    <th className="px-2 py-1 text-right">Loose</th>
                    <th className="px-2 py-1 text-right">Total</th>
                    <th className="px-2 py-1 text-right">Discrepancy</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshotItems.map((item, idx) => (
                    <tr key={idx} className="rounded bg-slate-50">
                      <td className="px-2 py-1 align-top">{item.sku}</td>
                      <td className="px-2 py-1 align-top">{item.product_name}</td>
                      <td className="px-2 py-1 text-right align-top">{item.expected}</td>
                      <td className="px-2 py-1 text-right align-top">{item.received}</td>
                      <td className="px-2 py-1 text-right align-top">{item.loose}</td>
                      <td className="px-2 py-1 text-right align-top">{item.total}</td>
                      <td className="px-2 py-1 text-right align-top">{item.discrepancy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : items.length === 0 ? (
            <div className="text-[11px] text-slate-500">No items found for this container.</div>
          ) : (
            <table className="w-full border-separate border-spacing-y-1 text-[11px]">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-2 py-1">SKU</th>
                  <th className="px-2 py-1">PO</th>
                  <th className="px-2 py-1 text-right">Cartons</th>
                  <th className="px-2 py-1 text-right">Units</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className="rounded bg-slate-50">
                    <td className="px-2 py-1 align-top">
                      <div className="font-medium">{item.sku}</div>
                      <div className="text-slate-500 text-[11px]">
                        {item.product_name}
                      </div>
                    </td>
                    <td className="px-2 py-1 align-top">{item.po_number}</td>
                    <td className="px-2 py-1 text-right align-top">{item.cartons}</td>
                    <td className="px-2 py-1 text-right align-top">{item.units}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
