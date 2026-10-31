"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "./admin-shell";
import { Can } from "@/lib/use-can";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { money } from "@/lib/formatters";
import { formatDeliverySlot } from "@/lib/delivery-slot";
import { useIstNow } from "@/hooks/use-ist-now";
import type { ReactNode } from "react";
import {
  ArrowDownWideNarrow,
  ArrowUpRight,
  Check,
  Clock3,
  Copy,
  MapPin,
  Package,
  RefreshCw,
  Search,
  QrCode,
  X,
} from "lucide-react";

export type Queue = "picker" | "delivery";
export type FulfilmentOrder = {
  order_id: number;
  customer_name: string;
  total: number | null;
  status: string;
  delivery_slot: string | null;
  delivery_slot_start: string | null;
  delivery_slot_end: string | null;
  delivered_at: string | null;
  address_line: string;
  item_count: number;
  delivery_instructions?: string | null;
  contactless_delivery?: boolean | null;
  substitute_unavailable?: boolean | null;
  delivery_speed?: string | null;
};
type SortMode = "urgent" | "oldest" | "slot";
type TaskState =
  | "all"
  | "accepted"
  | "picking"
  | "packed"
  | "out_for_delivery"
  | "delivered"
  | "returned"
  | "late";

const statusLabel: Record<string, string> = {
  accepted: "Accepted",
  picking: "Picking",
  packed: "Packed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  returned: "Failed attempt",
  placed: "Placed",
};
const statusTone: Record<string, string> = {
  accepted: "accepted",
  picking: "picking",
  packed: "packed",
  out_for_delivery: "out",
  delivered: "delivered",
  returned: "returned",
  placed: "placed",
};
const taskFilters: Record<Queue, TaskState[]> = {
  picker: ["all", "accepted", "picking", "packed"],
  delivery: ["all", "packed", "out_for_delivery", "delivered", "returned"],
};

function nextScanStatus(queue: Queue, status: string): string | null {
  if (queue === "picker") {
    if (status === "accepted") return "picking";
    if (status === "picking") return "packed";
    return null;
  }
  if (status === "packed") return "out_for_delivery";
  return status === "out_for_delivery" ? "delivered" : null;
}

function isFinalStatus(queue: Queue, status: string) {
  return queue === "picker"
    ? ["packed", "out_for_delivery", "delivered", "returned"].includes(status)
    : ["delivered", "returned"].includes(status);
}

function urgency(order: FulfilmentOrder, now: Date): "late" | "soon" | "ontime" {
  if (formatDeliverySlot(order, now).late) return "late";
  const start = order.delivery_slot_start ? Date.parse(order.delivery_slot_start) : NaN;
  if (Number.isFinite(start) && start > now.getTime() && start <= now.getTime() + 3600000) return "soon";
  return "ontime";
}
function lateBy(order: FulfilmentOrder, now: Date) {
  const minutes = Math.max(0, Math.floor((now.getTime() - Date.parse(order.delivery_slot_end ?? '')) / 60000));
  return `Late by ${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function FulfilmentQueue({ queue, initialOrders, initialError, initialFilters, extraContent }: { queue: Queue; initialOrders: FulfilmentOrder[]; initialError: string; initialFilters: { search: string; status: string; sort: string }; extraContent?: ReactNode }) {
  const now = useIstNow();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [orders, setOrders] = useState<FulfilmentOrder[]>(initialOrders);
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [highlightIds, setHighlightIds] = useState<number[]>([]);
  const [activeFilter, setActiveFilter] = useState<TaskState>((initialFilters.status || "all") as TaskState);
  const [query, setQuery] = useState(initialFilters.search);
  const [sort, setSort] = useState<SortMode>((initialFilters.sort || "urgent") as SortMode);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(
    null,
  );
  const [busyId, setBusyId] = useState<number | null>(null);
  const [failedAttempt, setFailedAttempt] = useState<FulfilmentOrder | null>(
    null,
  );
  const [failedReason, setFailedReason] = useState("Customer unavailable");
  const [failedNote, setFailedNote] = useState("");
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoFixedOrder, setDemoFixedOrder] = useState(false);
  const [demoOrderId, setDemoOrderId] = useState<number | null>(null);
  const [demoResult, setDemoResult] = useState("");
  const [demoSuccess, setDemoSuccess] = useState(false);
  const [demoSaving, setDemoSaving] = useState(false);
  const autoRefresh = useRef<ReturnType<typeof setInterval> | null>(null);
  const demoButton = useRef<HTMLButtonElement>(null);
  const demoDialog = useRef<HTMLElement>(null);
  const demoSubmitting = useRef(false);
  const orderIds = useRef<number[]>(initialOrders.map(order => order.order_id));

  const load = useCallback((quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    startTransition(() => router.refresh());
  }, [router]);

  useEffect(() => {
    const newIds = initialOrders.filter(order => !orderIds.current.includes(order.order_id)).map(order => order.order_id);
    if (orderIds.current.length && newIds.length) {
      setHighlightIds(newIds);
      window.setTimeout(() => setHighlightIds([]), 2400);
    }
    orderIds.current = initialOrders.map(order => order.order_id);
    setOrders(initialOrders);
    setError(initialError);
    setLoading(false);
    setRefreshing(false);
    setLastUpdated(new Date());
  }, [initialOrders, initialError]);

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    if (client) {
      const channel = client
        .channel(`fulfilment-${queue}-${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders" },
          () => {
            load(true);
          },
        )
        .subscribe();
      autoRefresh.current = setInterval(() => {
        load(true);
      }, 30000);
      return () => {
        void channel.unsubscribe();
        if (autoRefresh.current) clearInterval(autoRefresh.current);
      };
    }
    return () => {
      if (autoRefresh.current) clearInterval(autoRefresh.current);
    };
  }, [queue, load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const url = new URL(window.location.href);
      if (query.trim()) url.searchParams.set('search', query.trim()); else url.searchParams.delete('search');
      if (activeFilter !== 'all') url.searchParams.set('status', activeFilter); else url.searchParams.delete('status');
      if (sort !== 'urgent') url.searchParams.set('sort', sort); else url.searchParams.delete('sort');
      startTransition(() => router.replace(url.pathname + url.search, { scroll: false }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, activeFilter, sort, router]);

  const filteredOrders = useMemo(() => {
    const rows = orders.filter((order) => {
      const matchesStatus =
        activeFilter === "all" ||
        (activeFilter === "late"
          ? urgency(order, now) === "late"
          : order.status === activeFilter);
      const searchable =
        `#${order.order_id} ${order.customer_name} ${order.address_line}`.toLowerCase();
      return matchesStatus && searchable.includes(query.trim().toLowerCase());
    });
    return [...rows].sort((a, b) => {
      if (sort === "slot")
        return (a.delivery_slot_start ? Date.parse(a.delivery_slot_start) : Number.MAX_SAFE_INTEGER) - (b.delivery_slot_start ? Date.parse(b.delivery_slot_start) : Number.MAX_SAFE_INTEGER);
      if (sort === "oldest") return a.order_id - b.order_id;
      const priority = (value: FulfilmentOrder) =>
        urgency(value, now) === "late" ? 0 : urgency(value, now) === "soon" ? 1 : 2;
      return priority(a) - priority(b) || (a.delivery_slot_start ? Date.parse(a.delivery_slot_start) : Number.MAX_SAFE_INTEGER) - (b.delivery_slot_start ? Date.parse(b.delivery_slot_start) : Number.MAX_SAFE_INTEGER) || a.order_id - b.order_id;
    });
  }, [orders, activeFilter, query, sort, now]);
  const counts = useMemo(
    () =>
      Object.fromEntries(
        taskFilters[queue].map((filter) => [
          filter,
          filter === "all"
            ? orders.length
            : orders.filter((order) => order.status === filter).length,
        ]),
      ) as Partial<Record<TaskState, number>>,
    [orders, queue],
  );
  const selectedOrder =
    orders.find((order) => order.order_id === selectedId) ?? null;
  const demoOrder =
    orders.find((order) => order.order_id === demoOrderId) ??
    filteredOrders[0] ??
    null;
  const demoNextStatus = demoOrder
    ? nextScanStatus(queue, demoOrder.status)
    : null;
  const isDemo = true;

  const showToast = (text: string, isError = false) => {
    setToast({ text, error: isError });
    window.setTimeout(() => setToast(null), 3500);
  };
  async function update(orderId: number, status: string) {
    setBusyId(orderId);
    const client = createSupabaseBrowserClient();
    if (!client) {
      showToast("Supabase client is unavailable.", true);
      setBusyId(null);
      return false;
    }
    const { error: updateError } = await client.rpc(
      "admin_update_delivery_details",
      {
        p_order_id: orderId,
        p_status: status,
      },
    );
    if (updateError) {
      if (demoOpen) setDemoResult(updateError.message);
      showToast(updateError.message, true);
      setBusyId(null);
      return false;
    }
    showToast(`Order #${orderId} updated to ${statusLabel[status] ?? status}.`);
    setBusyId(null);
    await load(true);
    return true;
  }
  function openDemo(order?: FulfilmentOrder | null) {
    setDemoOrderId(order?.order_id ?? filteredOrders[0]?.order_id ?? null);
    setDemoFixedOrder(Boolean(order));
    setDemoResult("");
    setDemoSuccess(false);
    setDemoOpen(true);
  }
  async function simulateScan() {
    if (demoSubmitting.current || demoSaving || demoSuccess) return;
    if (!demoOrder) {
      setDemoResult("No order is available to scan.");
      return;
    }
    const nextStatus = nextScanStatus(queue, demoOrder.status);
    if (!nextStatus) {
      return;
    }
    demoSubmitting.current = true;
    setDemoSaving(true);
    try {
      const ok = await update(demoOrder.order_id, nextStatus);
      if (!ok) return;
      setDemoSuccess(true);
      setDemoResult(
        `Order #${demoOrder.order_id} moved to ${statusLabel[nextStatus]}.`,
      );
      window.setTimeout(() => setDemoOpen(false), 800);
    } finally {
      demoSubmitting.current = false;
      setDemoSaving(false);
    }
  }

  useEffect(() => {
    if (!demoOpen) return;
    (demoButton.current && !demoButton.current.disabled
      ? demoButton.current
      : demoDialog.current
    )?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setDemoOpen(false);
      if (event.key === "Tab") {
        const focusable = Array.from(
          document.querySelectorAll<HTMLElement>(
            ".fulfilment-qr-modal button:not(:disabled), .fulfilment-qr-modal select",
          ),
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
      if (event.key === "Enter") {
        event.preventDefault();
        void simulateScan();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [demoOpen, demoOrderId, orders]);

  const title = queue === "picker" ? "Picker queue" : "Delivery queue";
  const subtitle =
    queue === "picker"
      ? "Pick and pack orders, then hand them to delivery."
      : "Track deliveries and record delivery outcomes.";
  const stats =
    queue === "picker"
      ? [
          {
            key: "accepted" as const,
            label: "To pick",
            value: counts.accepted ?? 0,
          },
          {
            key: "picking" as const,
            label: "Picking",
            value: counts.picking ?? 0,
          },
          {
            key: "packed" as const,
            label: "Packed",
            value: counts.packed ?? 0,
          },
          {
            key: "late" as const,
            label: "Late",
            value: orders.filter((order) => urgency(order, now) === "late").length,
          },
        ]
      : [
          { key: "packed" as const, label: "Ready", value: counts.packed ?? 0 },
          {
            key: "out_for_delivery" as const,
            label: "Out for delivery",
            value: counts.out_for_delivery ?? 0,
          },
          {
            key: "delivered" as const,
            label: "Delivered today",
            value: counts.delivered ?? 0,
          },
          {
            key: "returned" as const,
            label: "Failed",
            value: counts.returned ?? 0,
          },
        ];

  return (
    <AdminShell title={title} description={subtitle}>
      <main className="fulfilment-page">
        <header className="fulfilment-heading">
          <div className="fulfilment-header-actions">
            <Can
              permission={queue === "picker" ? "picker:use" : "delivery:manage"}
            >
              <button className="secondary-button" onClick={() => openDemo()}>
                <QrCode size={15} />
                Scan QR
              </button>
            </Can>
            <span className="fulfilment-updated">
              {lastUpdated
                ? `Updated ${lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
                : "Waiting for update"}
            </span>
            <button
              className="secondary-button"
              onClick={() => void load(true)}
              disabled={refreshing}
            >
              <RefreshCw
                size={15}
                className={refreshing ? "fulfilment-spin" : ""}
              />
              Refresh
            </button>
          </div>
        </header>
        <section className="fulfilment-stats" aria-label={`${title} summary`}>
          {stats.map((stat) => (
            <button
              key={stat.key}
              className={activeFilter === stat.key ? "active" : ""}
              onClick={() => setActiveFilter(stat.key)}
            >
              <span>{stat.label}</span>
              <strong>{loading ? "—" : stat.value}</strong>
            </button>
          ))}
        </section>
        <section className="panel fulfilment-board">
          <div className="fulfilment-toolbar">
            <label className="fulfilment-search">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search order, customer or address"
                aria-label="Search orders"
              />
            </label>
            <select
              value={activeFilter}
              onChange={(event) =>
                setActiveFilter(event.target.value as TaskState)
              }
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              {(queue === "picker"
                ? ["accepted", "picking", "packed", "late"]
                : ["packed", "out_for_delivery", "delivered", "returned"]
              ).map((status) => (
                <option key={status} value={status}>
                  {statusLabel[status] ?? status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <label className="fulfilment-sort">
              <ArrowDownWideNarrow size={15} />
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortMode)}
                aria-label="Sort orders"
              >
                <option value="urgent">Most urgent</option>
                <option value="oldest">Oldest first</option>
                <option value="slot">Delivery slot</option>
              </select>
            </label>
          </div>
          <div className="fulfilment-filters" aria-label="Quick status filters">
            <button
              className={activeFilter === "all" ? "active" : ""}
              onClick={() => setActiveFilter("all")}
            >
              All <span>{orders.length}</span>
            </button>
            {taskFilters[queue]
              .filter((status) => status !== "all")
              .map((status) => (
                <button
                  key={status}
                  className={activeFilter === status ? "active" : ""}
                  onClick={() => setActiveFilter(status)}
                >
                  {statusLabel[status]} <span>{counts[status] ?? 0}</span>
                </button>
              ))}
            {(activeFilter !== "all" || query) && (
              <button
                className="fulfilment-clear"
                onClick={() => {
                  setQuery("");
                  setActiveFilter("all");
                }}
              >
                Clear filters
              </button>
            )}
          </div>
          {error ? (
            <div className="fulfilment-state">
              <strong>Couldn’t load the queue</strong>
              <p>{error}</p>
              <button className="secondary-button" onClick={() => void load()}>
                Retry
              </button>
            </div>
          ) : loading ? (
            <div className="fulfilment-grid">
              {Array.from({ length: 4 }, (_, index) => (
                <div className="fulfilment-skeleton" key={index}>
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              ))}
            </div>
          ) : filteredOrders.length ? (
            <div className="fulfilment-grid">
              {filteredOrders.map((order) => (
                <OrderTaskCard
                  key={order.order_id}
                  order={order}
                  queue={queue}
                  now={now}
                  onOpen={() => setSelectedId(order.order_id)}
                  highlight={highlightIds.includes(order.order_id)}
                  scanDisabled={isFinalStatus(queue, order.status)}
                  onScan={() => openDemo(order)}
                />
              ))}
            </div>
          ) : (
            <div className="fulfilment-state">
              <span className="fulfilment-state-icon">
                <Check size={19} />
              </span>
              <strong>
                {query || activeFilter !== "all"
                  ? "No orders match your filters"
                  : "All caught up"}
              </strong>
              <p>
                {query || activeFilter !== "all"
                  ? "Clear your search or choose another status."
                  : `There are no ${queue === "picker" ? "orders to pick" : "active deliveries"} right now.`}
              </p>
              {(query || activeFilter !== "all") && (
                <button
                  className="secondary-button"
                  onClick={() => {
                    setQuery("");
                    setActiveFilter("all");
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </section>
        {extraContent}
      </main>

      {selectedOrder && (
        <OrderDetailDrawer
          order={selectedOrder}
          queue={queue}
          now={now}
          onClose={() => setSelectedId(null)}
          busy={busyId === selectedOrder.order_id}
          isDemo={isDemo}
          onScan={() => openDemo(selectedOrder)}
          onFailed={() => setFailedAttempt(selectedOrder)}
        />
      )}
      {failedAttempt && (
        <div
          className="fulfilment-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setFailedAttempt(null);
          }}
        >
          <section
            className="fulfilment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="failed-title"
          >
            <h3 id="failed-title">
              Record failed attempt · #{failedAttempt.order_id}
            </h3>
            <p>Choose the reason the delivery could not be completed.</p>
            <label className="fulfilment-field">
              Reason
              <select
                value={failedReason}
                onChange={(event) => setFailedReason(event.target.value)}
              >
                <option>Customer unavailable</option>
                <option>Incorrect address</option>
                <option>Customer refused</option>
                <option>Other</option>
              </select>
            </label>
            <label className="fulfilment-field">
              Optional note
              <textarea
                value={failedNote}
                onChange={(event) => setFailedNote(event.target.value)}
                placeholder="Add a short note for the team"
              />
            </label>
            <div>
              <button
                className="secondary-button"
                onClick={() => setFailedAttempt(null)}
              >
                Cancel
              </button>
              <Can permission="delivery:manage">
                <button
                  className="primary-button"
                  onClick={async () => {
                    const ok = await update(failedAttempt.order_id, "returned");
                    if (ok) setFailedAttempt(null);
                  }}
                >
                  Save attempt
                </button>
              </Can>
            </div>
            <small>
              Failure reasons aren’t persisted by the current order schema/RPC.
            </small>
          </section>
        </div>
      )}
      {demoOpen && (
        <div
          className="fulfilment-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDemoOpen(false);
          }}
        >
          <section
            ref={demoDialog}
            className="fulfilment-modal fulfilment-qr-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scan-title"
            tabIndex={-1}
          >
            <button
              className="fulfilment-modal-close"
              aria-label="Close QR demo"
              onClick={() => setDemoOpen(false)}
            >
              <X size={17} />
            </button>
            <h3 id="scan-title">Scan QR (demo)</h3>
            <p className="fulfilment-demo-notice">
              This is a mock scanner. No camera is used. Press Enter to simulate
              a scan.
            </p>
            <div
              className={`fulfilment-scanner ${demoSuccess ? "success" : ""}`}
            >
              <i className="corner tl" />
              <i className="corner tr" />
              <i className="corner bl" />
              <i className="corner br" />
              <span className="scan-line" />
              {demoSuccess && <Check size={34} />}
            </div>
            {!demoFixedOrder && (
              <label className="fulfilment-field">
                Order
                <select
                  value={demoOrder?.order_id ?? ""}
                  onChange={(event) => {
                    setDemoOrderId(Number(event.target.value));
                    setDemoResult("");
                    setDemoSuccess(false);
                  }}
                >
                  {filteredOrders.map((order) => (
                    <option key={order.order_id} value={order.order_id}>
                      #{order.order_id} ·{" "}
                      {statusLabel[order.status] ?? order.status}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p className="fulfilment-demo-result">
              {demoResult ||
                (demoNextStatus && demoOrder
                  ? `Press Enter to move #${demoOrder.order_id} from ${statusLabel[demoOrder.status] ?? demoOrder.status} to ${statusLabel[demoNextStatus]}.`
                  : "No further steps for this order.")}
            </p>
            <div aria-live="polite" className="fulfilment-demo-live">
              {demoResult}
            </div>
            <div>
              <button
                className="secondary-button"
                onClick={() => setDemoOpen(false)}
              >
                Close (Esc)
              </button>
              <Can
                permission={
                  queue === "picker" ? "picker:use" : "delivery:manage"
                }
              >
                <button
                  ref={demoButton}
                  className="primary-button"
                  onClick={() => void simulateScan()}
                  disabled={!demoNextStatus || demoSaving || demoSuccess}
                >
                  Simulate scan (Enter)
                </button>
              </Can>
            </div>
          </section>
        </div>
      )}
      {toast && (
        <div
          className={`fulfilment-toast ${toast.error ? "error" : ""}`}
          role="status"
          aria-live="polite"
        >
          <span>{toast.text}</span>
          <button aria-label="Dismiss message" onClick={() => setToast(null)}>
            <X size={15} />
          </button>
        </div>
      )}
    </AdminShell>
  );
}

function OrderTaskCard({
  order,
  queue,
  now,
  onOpen,
  highlight,
  scanDisabled,
  onScan,
}: {
  order: FulfilmentOrder;
  queue: Queue;
  now: Date;
  onOpen: () => void;
  highlight: boolean;
  scanDisabled: boolean;
  onScan: () => void;
}) {
  const urgencyLevel = urgency(order, now);
  const finalOnQueue = isFinalStatus(queue, order.status);
  return (
    <article
      className={`task-card urgency-${urgencyLevel} ${highlight ? "new-order" : ""} ${finalOnQueue ? "dimmed" : ""}`}
      onClick={onOpen}
      tabIndex={0}
      onKeyDown={(event) => {
        if (
          (event.key === "Enter" || event.key === " ") &&
          event.target === event.currentTarget
        )
          onOpen();
      }}
      aria-label={`Order ${order.order_id}, ${order.customer_name}, ${statusLabel[order.status] ?? order.status}`}
    >
      <div className="task-card-top">
        <div className="task-order-heading">
          <strong>#{order.order_id}</strong>
          <span>
            {order.item_count} {order.item_count === 1 ? "item" : "items"}
          </span>
          <small>Placed</small>
        </div>
        <span
          className={`task-status ${statusTone[order.status] ?? "neutral"}`}
        >
          <i />
          {statusLabel[order.status] ?? order.status.replaceAll("_", " ")}
        </span>
      </div>
      <div className="task-card-main">
        <strong className="task-customer">{order.customer_name}</strong>
        <p className="task-address" title={order.address_line || "No address"}>
          <MapPin size={13} />
          {order.address_line || "No address provided"}
        </p>
        <div className="task-chips">
          {formatDeliverySlot(order, now).display && (
            <span>
              <Clock3 size={12} />
              {formatDeliverySlot(order, now).display}
            </span>
          )}
          {order.delivery_speed === "express" && <span className="express-order-chip">Express</span>}
          <span>
            <Package size={12} />
            {order.item_count} {order.item_count === 1 ? "item" : "items"}
          </span>
          <span className={`task-urgency ${urgencyLevel}`}>
            {urgencyLevel === "late"
              ? lateBy(order, now)
              : urgencyLevel === "soon"
                ? "Due soon"
                : "On time"}
          </span>
        </div>
      </div>
      <div className="task-card-bottom">
        <strong>
          {order.total == null ? "—" : money(Number(order.total))}
        </strong>
        <button
          className="task-primary-action"
          onClick={(event) => {
            event.stopPropagation();
            onScan();
          }}
          disabled={scanDisabled}
          title={scanDisabled ? "No further steps for this order." : undefined}
          aria-label={`Scan QR for order ${order.order_id}`}
        >
          <QrCode size={16} />
          Scan QR
        </button>
      </div>
    </article>
  );
}

function OrderDetailDrawer({
  order,
  queue,
  now,
  onClose,
  busy,
  isDemo,
  onScan,
  onFailed,
}: {
  order: FulfilmentOrder;
  queue: Queue;
  now: Date;
  onClose: () => void;
  busy: boolean;
  isDemo: boolean;
  onScan: () => void;
  onFailed: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const customerInstructions = order.delivery_instructions?.trim() ?? "";
  const customerPreferences = [
    order.contactless_delivery && "Contactless delivery requested",
  ].filter(Boolean) as string[];
  return (
    <div
      className="fulfilment-drawer-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        className="fulfilment-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fulfilment-drawer-title"
      >
        <header>
          <div>
            <small>ORDER DETAILS</small>
            <h2 id="fulfilment-drawer-title">Order #{order.order_id} {order.delivery_speed === "express" && <span className="express-order-chip">Express</span>}</h2>
          </div>
          <button
            className="task-icon-button"
            aria-label="Close order details"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        <div className="fulfilment-drawer-body">
          <div className="task-status">
            <i />
            {statusLabel[order.status] ?? order.status}
          </div>
          <section>
            <h3>Customer</h3>
            <strong>{order.customer_name}</strong>
            <p>Phone number is not included in the current fulfilment query.</p>
          </section>
          <section>
            <h3>Delivery address</h3>
            <p>{order.address_line || "No address provided"}</p>
            <div className="fulfilment-address-actions">
              <button
                className="secondary-button"
                onClick={() => {
                  void navigator.clipboard?.writeText(order.address_line);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                }}
              >
                <Copy size={14} />
                {copied ? "Copied" : "Copy address"}
              </button>
              <a
                className="secondary-button"
                href={`https://maps.google.com/?q=${encodeURIComponent(order.address_line)}`}
                target="_blank"
                rel="noreferrer"
              >
                Open in Maps <ArrowUpRight size={14} />
              </a>
            </div>
          </section>
          <section>
            <h3>Delivery slot</h3>
            <p>{formatDeliverySlot(order, now).display || "No delivery slot provided"}</p>
          </section>
          <section>
            <h3>Items summary</h3>
            <div className="fulfilment-summary">
              <span>
                {order.item_count} {order.item_count === 1 ? "item" : "items"}
              </span>
              <strong>
                {order.total == null ? "—" : money(Number(order.total))}
              </strong>
            </div>
            <p className="fulfilment-note">
              Item names, SKUs and quantities aren’t included in the current
              queue data.
            </p>
          </section>
          {queue === "delivery" && (
            <section className="fulfilment-customer-details">
              <h3>Customer delivery details</h3>
              {customerInstructions && (
                <div className="fulfilment-customer-entry">
                  <strong>Delivery instructions</strong>
                  <p>{customerInstructions}</p>
                </div>
              )}
              {customerPreferences.length > 0 && (
                <ul className="fulfilment-customer-preferences">
                  {customerPreferences.map((preference) => <li key={preference}>{preference}</li>)}
                </ul>
              )}
              {!customerInstructions && customerPreferences.length === 0 && (
                <p className="fulfilment-note">No delivery instructions or preferences were provided.</p>
              )}
            </section>
          )}
        </div>
        <footer>
          {isDemo && (
            <Can
              permission={queue === "picker" ? "picker:use" : "delivery:manage"}
            >
              <button className="secondary-button" onClick={onScan}>
                <QrCode size={15} />
                Scan QR
              </button>
            </Can>
          )}
          {queue === "delivery" && order.status === "out_for_delivery" && (
            <Can permission="delivery:manage">
              <button className="task-secondary-action" onClick={onFailed}>
                Failed attempt
              </button>
            </Can>
          )}
        </footer>
      </aside>
    </div>
  );
}

