"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  Package,
  Plus,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { Pagination } from "@/components/common/Pagination";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";
import { DEFAULT_PAGE_SIZE, getSkip } from "@/lib/pagination";
import type { CreateOrderPayload, Order, OrderStatus } from "@/lib/types";

// â"€â"€ Constants â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

const STATUS_SEQUENCE: OrderStatus[] = [
  "solicitado",
  "aprobado",
  "en_transito",
  "recibido",
  "cancelado",
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  solicitado: "Solicitado",
  aprobado: "Aprobado",
  en_transito: "En transito",
  recibido: "Recibido",
  cancelado: "Cancelado",
};

const STATUS_STYLES: Record<OrderStatus, string> = {
  solicitado: "bg-state-info/15 text-state-info border-state-info/30",
  aprobado: "bg-state-ok/15 text-state-ok border-state-ok/30",
  en_transito: "bg-state-atencion/15 text-state-atencion border-state-atencion/30",
  recibido: "bg-brand/12 text-brand border-brand/20",
  cancelado: "bg-state-neutral/10 text-state-neutral border-state-neutral/20",
};

// Estado â†’ prÃ³ximos estados vÃ¡lidos
const NEXT_STATES: Partial<Record<OrderStatus, OrderStatus[]>> = {
  solicitado: ["aprobado", "cancelado"],
  aprobado: ["en_transito", "cancelado"],
  en_transito: ["recibido", "cancelado"],
};

const NEXT_BTN_STYLE: Partial<Record<OrderStatus, string>> = {
  aprobado: "bg-state-ok/15 text-state-ok hover:bg-state-ok/25",
  en_transito: "bg-state-atencion/15 text-state-atencion hover:bg-state-atencion/25",
  recibido: "bg-brand/12 text-brand hover:bg-brand/15",
  cancelado: "bg-state-neutral/10 text-state-neutral hover:bg-state-neutral/20",
};

// â"€â"€ Helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function formatDate(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(value?: number | null) {
  if (value == null) return "-";
  return value.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

// â"€â"€ Sub-components â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function StatusBadge({ estado }: { estado: OrderStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold uppercase ${STATUS_STYLES[estado]}`}>
      {STATUS_LABELS[estado]}
    </span>
  );
}

function StatusWorkflow({ estado }: { estado: OrderStatus }) {
  const active = STATUS_SEQUENCE.indexOf(estado);
  const isCancelled = estado === "cancelado";
  const steps = STATUS_SEQUENCE.filter((s) => s !== "cancelado");

  if (isCancelled) {
    return (
      <div className="flex items-center gap-1 text-xs text-state-neutral">
        <span className="rounded-full bg-state-neutral/10 px-2 py-0.5 font-bold">Cancelado</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, index) => {
        const stepIndex = STATUS_SEQUENCE.indexOf(step);
        const isDone = stepIndex < active;
        const isCurrent = stepIndex === active;
        return (
          <div key={step} className="flex items-center gap-1">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                isCurrent
                  ? STATUS_STYLES[step].replace("border-", "").replace(/border-\S+/g, "")
                  : isDone
                    ? "bg-state-ok/10 text-state-ok"
                    : "bg-app-bg text-app-dim"
              }`}
            >
              {STATUS_LABELS[step]}
            </span>
            {index < steps.length - 1 && (
              <ArrowRight className={`h-3 w-3 ${isDone ? "text-state-ok" : "text-app-dim"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-[10px] border border-app-border bg-white shadow-card p-4">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-app-dim">{label}</p>
      <p className={`mt-2 font-heading text-4xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

// â"€â"€ Create order modal â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function CreateOrderModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [insumo, setInsumo] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [unidad, setUnidad] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [costeEstimado, setCosteEstimado] = useState("");
  const [notas, setNotas] = useState("");

  const mutation = useMutation({
    mutationFn: (payload: CreateOrderPayload) => api.createOrder(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Pedido creado");
      onClose();
    },
  });

  const canSubmit = insumo.trim() && cantidad.trim() && !Number.isNaN(Number(cantidad));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="w-full max-w-lg rounded-t-[20px] border border-app-border bg-white shadow-panel sm:rounded-[14px]">
        <div className="flex items-center justify-between border-b border-app-border px-6 py-4">
          <h2 className="font-heading text-lg font-bold text-app-text">Nuevo pedido</h2>
          <button type="button" onClick={onClose} className="text-app-dim hover:text-app-text">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.14em] text-app-dim">
                Insumo *
              </span>
              <input
                type="text"
                value={insumo}
                onChange={(e) => setInsumo(e.target.value)}
                placeholder="Ej: Pienso vacas lactantes"
                className="h-11 w-full rounded-[10px] border border-app-border bg-white px-3 text-sm text-app-text outline-none placeholder:text-app-dim focus:border-brand"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.14em] text-app-dim">
                Cantidad *
              </span>
              <input
                type="number"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                placeholder="0"
                className="h-11 w-full rounded-[10px] border border-app-border bg-white px-3 text-sm text-app-text outline-none placeholder:text-app-dim focus:border-brand"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.14em] text-app-dim">
                Unidad
              </span>
              <input
                type="text"
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
                placeholder="kg, L, sacos..."
                className="h-11 w-full rounded-[10px] border border-app-border bg-white px-3 text-sm text-app-text outline-none placeholder:text-app-dim focus:border-brand"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.14em] text-app-dim">
                Proveedor
              </span>
              <input
                type="text"
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
                className="h-11 w-full rounded-[10px] border border-app-border bg-white px-3 text-sm text-app-text outline-none placeholder:text-app-dim focus:border-brand"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.14em] text-app-dim">
                Coste estimado (â‚¬)
              </span>
              <input
                type="number"
                value={costeEstimado}
                onChange={(e) => setCosteEstimado(e.target.value)}
                placeholder="0.00"
                className="h-11 w-full rounded-[10px] border border-app-border bg-white px-3 text-sm text-app-text outline-none placeholder:text-app-dim focus:border-brand"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.14em] text-app-dim">
                Descripcion / Notas
              </span>
              <textarea
                rows={2}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                className="w-full resize-none rounded-[10px] border border-app-border bg-white px-3 py-2.5 text-sm text-app-text outline-none placeholder:text-app-dim focus:border-brand"
              />
            </label>
          </div>

          {mutation.isError && (
            <p className="rounded-[10px] bg-state-critica/10 px-3 py-2 text-sm text-state-critica">
              {mutation.error.message}
            </p>
          )}

          <button
            type="button"
            disabled={!canSubmit || mutation.isPending}
            onClick={() =>
              mutation.mutate({
                insumo: insumo.trim(),
                cantidad: Number(cantidad),
                unidad: unidad.trim() || undefined,
                proveedor: proveedor.trim() || undefined,
                coste_estimado: costeEstimado ? Number(costeEstimado) : undefined,
                notas: notas.trim() || undefined,
              })
            }
            className="w-full rounded-[10px] bg-brand py-3.5 font-heading text-base font-bold text-white shadow-brand transition hover:bg-[#135532] disabled:opacity-50"
          >
            {mutation.isPending ? "Creando pedido..." : "Crear pedido"}
          </button>
        </div>
      </div>
    </div>
  );
}

// â"€â"€ Order card â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function OrderCard({
  order,
  onStatusChange,
  updatingId,
}: {
  order: Order;
  onStatusChange: (id: string, estado: OrderStatus) => void;
  updatingId: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const isUpdating = updatingId === order.id;
  const nextStates = NEXT_STATES[order.estado] ?? [];

  return (
    <div className="rounded-[10px] border border-app-border bg-white">
      <button
        type="button"
        className="w-full px-4 py-4 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge estado={order.estado} />
              {order.unidad && (
                <span className="text-xs text-app-dim">{order.cantidad} {order.unidad}</span>
              )}
            </div>
            <h2 className="mt-2 font-heading text-base font-bold text-app-text">
              {order.insumo}
            </h2>
            <div className="mt-1.5">
              <StatusWorkflow estado={order.estado} />
            </div>
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-app-dim">
              <span>Solicitado: {formatDate(order.ts_solicitud)}</span>
              {order.coste_estimado != null && (
                <span>Estimado: <span className="text-app-text">{formatCurrency(order.coste_estimado)}</span></span>
              )}
              {order.proveedor && <span>Proveedor: <span className="text-app-text">{order.proveedor}</span></span>}
            </div>
          </div>
          {expanded ? (
            <ChevronUp className="mt-1 h-4 w-4 shrink-0 text-app-dim" />
          ) : (
            <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-app-dim" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-app-border px-4 py-4">
          <div className="grid gap-3 text-xs sm:grid-cols-2">
            {order.descripcion && (
              <div className="sm:col-span-2">
                <span className="block text-app-dim">Descripcion</span>
                <span className="text-app-text">{order.descripcion}</span>
              </div>
            )}
            {order.ts_aprobacion && (
              <div>
                <span className="block text-app-dim">Aprobado</span>
                <span className="text-app-text">{formatDate(order.ts_aprobacion)}</span>
              </div>
            )}
            {order.ts_recepcion && (
              <div>
                <span className="block text-app-dim">Recibido</span>
                <span className="text-app-text">{formatDate(order.ts_recepcion)}</span>
              </div>
            )}
            {order.coste_real != null && (
              <div>
                <span className="block text-app-dim">Coste real</span>
                <span className="text-app-text">{formatCurrency(order.coste_real)}</span>
              </div>
            )}
            {order.notas && (
              <div className="sm:col-span-2">
                <span className="block text-app-dim">Notas</span>
                <span className="text-app-text">{order.notas}</span>
              </div>
            )}
          </div>

          {nextStates.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {nextStates.map((next) => (
                <button
                  key={next}
                  type="button"
                  disabled={isUpdating}
                  onClick={() => onStatusChange(order.id, next)}
                  className={`inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-xs font-bold transition disabled:opacity-50 ${NEXT_BTN_STYLE[next] ?? ""}`}
                >
                  {isUpdating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArrowRight className="h-3.5 w-3.5" />
                  )}
                  {STATUS_LABELS[next]}
                </button>
              ))}
            </div>
          )}

          {order.estado === "recibido" && (
            <div className="rounded-[10px] bg-brand/8 px-3 py-2 text-xs font-bold text-brand">
              Pedido recibido
            </div>
          )}
          {order.estado === "cancelado" && (
            <div className="rounded-[10px] bg-state-neutral/10 px-3 py-2 text-xs font-bold text-state-neutral">
              Pedido cancelado
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// â"€â"€ Main page â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

type FilterStatus = OrderStatus | "todas";

export default function OrdersPage() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("todas");
  const [page, setPage] = useState(1);
  // Auto-open creation modal when ?new=1 is in the URL
  const [showCreate, setShowCreate] = useState(() => searchParams.get("new") === "1");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const pageSize = DEFAULT_PAGE_SIZE;

  const ordersQuery = useQuery({
    queryKey: ["orders", statusFilter, page],
    queryFn: () =>
      api.orders({
        skip: getSkip(page, pageSize),
        limit: pageSize + 1,
        ...(statusFilter !== "todas" ? { estado: statusFilter } : {}),
      }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  // Load all orders for KPI stats (cached separately)
  const allOrdersQuery = useQuery({
    queryKey: ["orders-all"],
    queryFn: () => api.orders({ limit: 500 }),
    staleTime: 30_000,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: OrderStatus }) =>
      api.updateOrderStatus(id, estado),
    onMutate: ({ id }) => setUpdatingId(id),
    onSuccess: (_, { estado }) => {
      toast.success(`Pedido marcado como ${STATUS_LABELS[estado].toLowerCase()}`);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al cambiar el estado del pedido");
    },
    onSettled: () => {
      setUpdatingId(null);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders-all"] });
    },
  });

  const pageData = ordersQuery.data?.pedidos ?? [];
  const hasNext = pageData.length > pageSize;
  const pageItems = pageData.slice(0, pageSize);
  const allItems = useMemo(() => allOrdersQuery.data?.pedidos ?? [], [allOrdersQuery.data]);

  const stats = useMemo(() => {
    const count = (s: OrderStatus) => allItems.filter((o) => o.estado === s).length;
    return {
      total: allItems.length,
      solicitado: count("solicitado"),
      aprobado: count("aprobado"),
      en_transito: count("en_transito"),
      recibido: count("recibido"),
      cancelado: count("cancelado"),
    };
  }, [allItems]);

  const statusTabs: { key: FilterStatus; label: string; count: number }[] = [
    { key: "todas", label: "Todas", count: stats.total },
    { key: "solicitado", label: "Solicitados", count: stats.solicitado },
    { key: "aprobado", label: "Aprobados", count: stats.aprobado },
    { key: "en_transito", label: "En transito", count: stats.en_transito },
    { key: "recibido", label: "Recibidos", count: stats.recibido },
    { key: "cancelado", label: "Cancelados", count: stats.cancelado },
  ];

  return (
    <div className="min-h-full">
      {showCreate && <CreateOrderModal onClose={() => setShowCreate(false)} />}

      <PageHeader eyebrow="Suministros y aprovisionamiento" title="Pedidos" EyebrowIcon={Package}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-[10px] bg-brand px-4 py-2 text-sm font-bold text-white shadow-brand transition hover:bg-[#135532]"
          >
            <Plus className="h-4 w-4" />
            Nuevo pedido
          </button>
        </div>
      </PageHeader>

      <div className="space-y-5 px-6 py-6 lg:px-8">
        {/* KPIs */}
        {allOrdersQuery.isSuccess && (
          <div className="grid grid-cols-3 gap-3 xl:grid-cols-6">
            <KpiCard label="Total" value={stats.total} tone="text-app-text" />
            <KpiCard label="Solicitados" value={stats.solicitado} tone="text-state-info" />
            <KpiCard label="Aprobados" value={stats.aprobado} tone="text-state-ok" />
            <KpiCard label="En transito" value={stats.en_transito} tone="text-state-atencion" />
            <KpiCard label="Recibidos" value={stats.recibido} tone="text-brand" />
            <KpiCard label="Cancelados" value={stats.cancelado} tone="text-state-neutral" />
          </div>
        )}

        {/* Status filter tabs */}
        <div className="flex flex-wrap gap-2">
          {statusTabs.map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => { setStatusFilter(key); setPage(1); }}
              className={`inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-sm font-semibold transition ${
                statusFilter === key
                  ? "bg-app-bg text-brand"
                  : "bg-white text-app-dim hover:bg-app-bg"
              }`}
            >
              {label}
              <span className="rounded-full bg-app-bg/60 px-1.5 text-[11px] font-bold">{count}</span>
            </button>
          ))}
        </div>

        {/* Loading */}
        {ordersQuery.isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-[10px] bg-app-bg" />
            ))}
          </div>
        )}

        {/* Error */}
        {ordersQuery.isError && (
          <div className="rounded-[10px] border border-state-critica/30 bg-state-critica/10 px-4 py-3 text-sm font-semibold text-state-critica">
            Error al cargar pedidos: {ordersQuery.error.message}
          </div>
        )}

        {/* Empty */}
        {ordersQuery.isSuccess && pageItems.length === 0 && (
          <div className="rounded-[10px] border border-app-border bg-white py-16 text-center">
            <Package className="mx-auto h-12 w-12 text-app-dim" strokeWidth={1.5} />
            <p className="mt-3 font-heading text-lg font-bold text-app-text">Sin pedidos</p>
            <p className="mt-1 text-sm text-app-dim">
              {statusFilter !== "todas" ? "No hay pedidos con este estado" : "Crea el primer pedido"}
            </p>
          </div>
        )}

        {/* List */}
        <div className="space-y-3">
          {pageItems.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onStatusChange={(id, estado) => statusMutation.mutate({ id, estado })}
              updatingId={updatingId}
            />
          ))}
        </div>

        {/* Pagination */}
        {!ordersQuery.isLoading && pageItems.length > 0 && (
          <Pagination
            page={page}
            pageSize={pageSize}
            currentCount={pageItems.length}
            hasNext={hasNext}
            isLoading={ordersQuery.isFetching}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
}
