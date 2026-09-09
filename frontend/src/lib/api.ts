import { API_BASE_URL, API_V1_URL } from "@/lib/config";
// TOKEN_STORAGE_KEY ya no se usa aquí: el JWT viaja en una cookie HttpOnly que
// el navegador adjunta automáticamente. `credentials: "include"` garantiza que
// la cookie llegue al backend incluso en cross-origin (desarrollo).
import type {
  Alert,
  AlertState,
  AlertsResponse,
  Animal,
  AnimalPrediction,
  AuditLogResponse,
  AuthResponse,
  BoxRecria,
  CreateIncidentPayload,
  CreateOrderPayload,
  CreateShiftAssignmentPayload,
  CreateShiftPayload,
  DashboardSummary,
  Employee,
  HealthResponse,
  Incident,
  Lactation,
  LoginPayload,
  Machinery,
  Order,
  OrderStatus,
  OrdersResponse,
  QualitySummary,
  Shift,
  ShiftAssignment,
  ShiftAssignmentsResponse,
  ShiftHandover,
  ShiftHandoversResponse,
  UnifiedEstado,
  UnifiedIncident,
  UnifiedSeverity,
  ShiftsResponse,
  Task,
  TaskCatalogItem,
  Treatment,
  WeatherData,
  WeatherForecast,
  Zone,
} from "@/lib/types";

type QueryParams = Record<string, string | number | boolean | null | undefined>;

// Endpoints de auth que NO deben disparar el interceptor 401-refresh.
// Si los interceptáramos, un 401 en /auth/login (credenciales
// incorrectas) intentaría refrescar la sesión, que fallaría igual,
// y devolvería un error distinto al real.
const AUTH_BYPASS_PATHS = new Set(["/auth/login", "/auth/refresh", "/auth/logout"]);

// Estado compartido por todas las llamadas a ``request()`` para evitar
// que dos 401 en paralelo disparen dos /auth/refresh simultáneos.
// Mientras una rotación está en curso, las demás llamadas esperan a
// que termine (con un timeout corto) y reintentan una vez.
let refreshInFlight: Promise<void> | null = null;
const REFRESH_TIMEOUT_MS = 8000;

// Listeners a los que ``request()`` avisa cuando una rotación de
// sesión falla definitivamente. El layout (app/(app)/layout.tsx)
// se suscribe para limpiar el store y redirigir a /login.
type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

function emitSessionExpired() {
  for (const listener of sessionExpiredListeners) {
    try {
      listener();
    } catch {
      // Un listener que falla no debe impedir que los demás se enteren.
    }
  }
}

function buildUrl(path: string, params?: QueryParams): string {
  const base = path.startsWith("/api") || path === "/health" ? API_BASE_URL : API_V1_URL;
  const fullPath = `${base}${path}`;
  const entries = Object.entries(params ?? {}).filter(([, value]) => value !== null && value !== undefined && value !== "");
  if (entries.length === 0) return fullPath;
  return `${fullPath}?${new URLSearchParams(entries.map(([key, value]) => [key, String(value)])).toString()}`;
}

/**
 * Llama a ``POST /auth/refresh`` con la cookie t4m_refresh (que el
 * navegador adjunta automáticamente con ``credentials: "include"``).
 * El backend rota el par y re-emite las cookies. Si la cookie
 * está caducada o fue reusada (reuse detection), rechaza con 401.
 *
 * Coalesce llamadas concurrentes: si ya hay un refresh en vuelo,
 * devuelve la misma promesa en lugar de lanzar otra.
 */
async function refreshSession(): Promise<boolean> {
  if (refreshInFlight) {
    return refreshInFlight.then(() => true).catch(() => false);
  }

  const url = `${API_V1_URL}/auth/refresh`;
  refreshInFlight = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        // Refresh caducado, reuse detection, o sesión ya invalidada.
        // El navegador mantiene la cookie caducada hasta que el
        // backend emita Set-Cookie Max-Age=0; el siguiente /auth/me
        // verá 401 y el layout redirigirá.
        emitSessionExpired();
        throw new Error(`Refresh failed: ${response.status}`);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      // Error de red o timeout — no matamos la sesión; el siguiente
      // intento del usuario (o el timer proactivo) lo reintentará.
      throw err;
    }
  })();

  try {
    await refreshInFlight;
    return true;
  } catch {
    return false;
  } finally {
    refreshInFlight = null;
  }
}

async function request<T>(path: string, init: RequestInit = {}, params?: QueryParams): Promise<T> {
  // El token JWT vive en una cookie HttpOnly (Set-Cookie del backend).
  // El navegador la adjunta automáticamente cuando ``credentials: "include"``
  // está presente en el fetch. NO añadimos ``Authorization: *** — sería
  // redundante y expone el token en DevTools para cualquier XSS.
  const url = buildUrl(path, params);

  const doFetch = () =>
    fetch(url, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
      },
    });

  let response = await doFetch().catch(() => {
    if (process.env.NODE_ENV === "development") {
      console.error(`[api] sin conexión: ${init.method ?? "GET"} ${url}`);
    }
    throw new Error("No se puede conectar con el servidor. Verifica que el backend esté activo.");
  });

  // Interceptor 401: si la cookie de access está caducada pero el
  // refresh sigue vivo, rotamos y reintentamos UNA vez. Evita que el
  // usuario tenga que re-loguear en medio de una sesión de 8h.
  // Excluimos los endpoints de auth para no enmascarar errores reales.
  if (response.status === 401 && !AUTH_BYPASS_PATHS.has(path)) {
    const rotated = await refreshSession();
    if (rotated) {
      response = await doFetch().catch(() => {
        throw new Error("No se puede conectar con el servidor.");
      });
    }
  }

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const payload = await response.json();
      if (typeof payload.detail === "string") detail = payload.detail;
      else if (payload.detail?.message) detail = `${payload.detail.code ?? response.status}: ${payload.detail.message}`;
    } catch {
      // Keep the HTTP fallback message.
    }
    throw new Error(detail);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export { refreshSession };

export const api = {
  health() {
    return request<HealthResponse>("/health");
  },

  login(payload: LoginPayload) {
    return request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  me() {
    return request<AuthResponse["user"]>("/auth/me");
  },

  dashboardSummary() {
    return request<DashboardSummary>("/dashboard/summary");
  },

  zones() {
    return request<Zone[]>("/zones");
  },

  boxesRecria(params?: QueryParams) {
    return request<BoxRecria[]>("/boxes-recria", {}, params);
  },

  zone(zoneId: string) {
    return request<Zone>(`/zones/${zoneId}`);
  },

  createZone(body: Partial<Zone>) {
    return request<Zone>("/zones", { method: "POST", body: JSON.stringify(body) });
  },

  updateZone(zoneId: string, body: Partial<Zone>) {
    return request<Zone>(`/zones/${zoneId}`, { method: "PUT", body: JSON.stringify(body) });
  },

  alerts(params?: QueryParams) {
    return request<AlertsResponse>("/alerts", {}, params);
  },

  animalAlerts(animalId: string, params?: QueryParams) {
    return request<AlertsResponse>(`/alerts/${animalId}`, {}, params);
  },

  alertDetail(alertId: string) {
    return request<Alert>(`/alerts/detail/${alertId}`);
  },

  createAlert(body: Partial<Alert>) {
    return request<Alert>("/alerts", { method: "POST", body: JSON.stringify(body) });
  },

  reviewAlert(alertId: string, body: Partial<Alert>) {
    return request<Alert>(`/alerts/${alertId}`, { method: "PATCH", body: JSON.stringify(body) });
  },

  generateAlerts(animalId: string) {
    return request<{ generated: number; alertas: Alert[] }>(`/alerts/generate/${animalId}`, { method: "POST" });
  },

  tasks(params?: QueryParams) {
    return request<Task[]>("/tasks", {}, params);
  },

  task(taskId: string) {
    return request<Task>(`/tasks/${taskId}`);
  },

  createTask(body: Partial<Task>) {
    return request<Task>("/tasks", { method: "POST", body: JSON.stringify(body) });
  },

  completeTask(taskId: string, body?: Partial<Task>) {
    return request<Task>(`/tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify({
        estado: "ejecutada",
        fecha_ejecucion: new Date().toISOString(),
        resultado: "completada",
        ...body,
      }),
    });
  },

  updateTask(taskId: string, body: Partial<Task>) {
    return request<Task>(`/tasks/${taskId}`, { method: "PUT", body: JSON.stringify(body) });
  },

  updateTaskIdempotent(taskId: string, body: Partial<Task>, expectedVersion: number, operationId: string) {
    return request<{ operation_id: string; replayed: boolean; task: Task }>(`/tasks/${taskId}`, {
      method: "PUT",
      headers: { "X-Operation-Id": operationId },
      body: JSON.stringify({ ...body, expected_version: expectedVersion }),
    });
  },

  deleteTask(taskId: string) {
    return request<void>(`/tasks/${taskId}`, { method: "DELETE" });
  },

  animals(params?: QueryParams) {
    return request<Animal[]>("/animals", {}, params);
  },

  animal(animalId: string) {
    return request<Animal>(`/animals/${animalId}`);
  },

  createAnimal(body: Partial<Animal>) {
    return request<Animal>("/animals", { method: "POST", body: JSON.stringify(body) });
  },

  updateAnimal(animalId: string, body: Partial<Animal>) {
    return request<Animal>(`/animals/${animalId}`, { method: "PUT", body: JSON.stringify(body) });
  },

  animalByCretal(crotal: string) {
    return request<Animal>(`/animals/search/by-crotal/${crotal}`);
  },

  incidents(params?: QueryParams) {
    return request<Incident[]>("/incidents", {}, params);
  },

  incident(incidentId: string) {
    return request<Incident>(`/incidents/${incidentId}`);
  },

  createIncident(body: CreateIncidentPayload) {
    return request<Incident>("/incidents", { method: "POST", body: JSON.stringify(body) });
  },

  updateIncident(incidentId: string, body: Partial<Incident>) {
    return request<Incident>(`/incidents/${incidentId}`, { method: "PUT", body: JSON.stringify(body) });
  },

  treatments(params?: QueryParams) {
    return request<Treatment[]>("/treatments", {}, params);
  },

  treatment(treatmentId: string) {
    return request<Treatment>(`/treatments/${treatmentId}`);
  },

  createTreatment(body: Partial<Treatment>) {
    return request<Treatment>("/treatments", { method: "POST", body: JSON.stringify(body) });
  },

  updateTreatment(treatmentId: string, body: Partial<Treatment>) {
    return request<Treatment>(`/treatments/${treatmentId}`, { method: "PUT", body: JSON.stringify(body) });
  },

  employees(params?: QueryParams) {
    return request<Employee[]>("/employees", {}, params);
  },

  createEmployee(body: Partial<Employee>) {
    return request<Employee>("/employees", { method: "POST", body: JSON.stringify(body) });
  },

  updateEmployee(employeeId: string, body: Partial<Employee>) {
    return request<Employee>(`/employees/${employeeId}`, { method: "PUT", body: JSON.stringify(body) });
  },

  lactations(params?: QueryParams) {
    return request<Lactation[]>("/lactations", {}, params);
  },

  createLactation(body: Partial<Lactation>) {
    return request<Lactation>("/lactations", { method: "POST", body: JSON.stringify(body) });
  },

  updateLactation(lactationId: string, body: Partial<Lactation>) {
    return request<Lactation>(`/lactations/${lactationId}`, { method: "PUT", body: JSON.stringify(body) });
  },

  qualitySummary() {
    return request<QualitySummary>("/lactations/quality/summary");
  },

  predictions(animalId: string, params?: QueryParams) {
    return request<AnimalPrediction>(`/predictions/${animalId}`, {}, params);
  },

  productionPrediction(animalId: string, params?: QueryParams) {
    return request<AnimalPrediction["produccion"]>(`/predictions/production/${animalId}`, {}, params);
  },

  compositionPrediction(animalId: string) {
    return request<AnimalPrediction["composicion"]>(`/predictions/composition/${animalId}`);
  },

  healthRiskPrediction(animalId: string, params?: QueryParams) {
    return request<AnimalPrediction["riesgo_sanitario"]>(`/predictions/health-risk/${animalId}`, {}, params);
  },

  weather() {
    return request<WeatherData>("/weather/current");
  },

  machinery(params?: QueryParams) {
    return request<Machinery[]>("/machinery", {}, params);
  },

  createMachinery(body: Partial<Machinery>) {
    return request<Machinery>("/machinery", { method: "POST", body: JSON.stringify(body) });
  },

  updateMachinery(machineryId: string, body: Partial<Machinery>) {
    return request<Machinery>(`/machinery/${machineryId}`, { method: "PUT", body: JSON.stringify(body) });
  },

  // ── Orders (Pedidos) ──────────────────────────────────────────────────────

  orders(params?: QueryParams) {
    return request<OrdersResponse>("/pedidos", {}, params);
  },

  order(orderId: string) {
    return request<Order>(`/pedidos/${orderId}`);
  },

  createOrder(body: CreateOrderPayload) {
    return request<Order>("/pedidos", { method: "POST", body: JSON.stringify(body) });
  },

  updateOrder(orderId: string, body: Partial<Order>) {
    return request<Order>(`/pedidos/${orderId}`, { method: "PUT", body: JSON.stringify(body) });
  },

  updateOrderStatus(orderId: string, estado: OrderStatus) {
    return request<Order>(`/pedidos/${orderId}/estado`, {
      method: "PATCH",
      body: JSON.stringify({ estado }),
    });
  },

  // ── Shifts (Turnos) ───────────────────────────────────────────────────────

  shifts(params?: QueryParams) {
    return request<ShiftsResponse>("/turnos", {}, params);
  },

  createShift(body: CreateShiftPayload) {
    return request<Shift>("/turnos", { method: "POST", body: JSON.stringify(body) });
  },

  shiftAssignments(params?: QueryParams) {
    return request<ShiftAssignmentsResponse>("/asignaciones-turno", {}, params);
  },

  createShiftAssignment(body: CreateShiftAssignmentPayload) {
    return request<ShiftAssignment>("/asignaciones-turno", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  // ── Handovers (Resúmenes de relevo) ───────────────────────────────────────

  shiftHandovers(params?: QueryParams) {
    return request<ShiftHandoversResponse>("/resumenes-relevo", {}, params);
  },

  createShiftHandover(body: { turno_saliente_id: string; turno_entrante_id: string; notas_saliente?: string }) {
    return request<ShiftHandover>("/resumenes-relevo", { method: "POST", body: JSON.stringify(body) });
  },

  // ── Weather (extended) ────────────────────────────────────────────────────

  weatherForecast() {
    /** @deprecated Use weatherReadings; this route is historical, not a forecast. */
    return request<WeatherForecast>("/weather/forecast");
  },

  // ── Audit Log ─────────────────────────────────────────────────────────────

  auditLog(params?: QueryParams) {
    return request<AuditLogResponse>("/audit-log", {}, params);
  },

  // ── Task catalog ──────────────────────────────────────────────────────────

  taskCatalog(params?: QueryParams) {
    return request<TaskCatalogItem[]>("/tareas-catalogo", {}, params);
  },

  createTaskCatalog(body: Record<string, unknown>) {
    return request<TaskCatalogItem>("/tareas-catalogo", { method: "POST", body: JSON.stringify(body) });
  },

  updateTaskCatalog(catalogId: string, body: Record<string, unknown>) {
    return request<TaskCatalogItem>(`/tareas-catalogo/${catalogId}`, { method: "PUT", body: JSON.stringify(body) });
  },

  deleteTaskCatalog(catalogId: string) {
    return request<void>(`/tareas-catalogo/${catalogId}`, { method: "DELETE" });
  },

  // ── Weather readings (labelled version of sensor data) ────────────────────

  weatherReadings() {
    return request<{
      ubicacion: string;
      source: "generated" | "aemet_real";
      mode: "synthetic" | "real";
      synthetic: boolean;
      lecturas: Array<{
        fecha: string | null;
        temperatura_c: number | null;
        humedad_relativa: number | null;
        precipitacion_mm: number | null;
        prob_precipitacion_pct: number | null;
        viento_km_h: number | null;
        fuente: string;
      }>;
    }>("/weather/readings?limit=7&order=asc").then((data) => ({
      ubicacion: data.ubicacion,
      source: data.source,
      mode: data.mode,
      synthetic: data.synthetic,
      dias: data.lecturas.map((reading) => ({
        fecha: reading.fecha,
        temperatura_media: reading.temperatura_c,
        temperatura_maxima: null,
        temperatura_minima: null,
        humedad: reading.humedad_relativa,
        precipitacion: reading.precipitacion_mm,
        prob_precipitacion_pct: reading.prob_precipitacion_pct,
        viento: reading.viento_km_h,
        descripcion: null,
        fuente: reading.fuente,
      })),
    }));
  },
};

// ── Unified Incident Normalizers ────────────────────────────────────────────

function alertEstadoToUnified(estado: AlertState): UnifiedEstado {
  switch (estado) {
    case "pendiente": return "abierta";
    case "revisada": return "en_gestion";
    case "resuelta": return "resuelta";
    case "falsa_alarma": return "cerrada";
    default: return "abierta";
  }
}

export function normalizeAlert(a: Alert): UnifiedIncident {
  return {
    id: `a:${a.id}`,
    rawId: a.id,
    origen: "alerta",
    titulo: a.tipo_alerta,
    descripcion: a.descripcion,
    severidad: (a.severidad === "critica" ? "alta" : a.severidad) as UnifiedSeverity,
    estado: alertEstadoToUnified(a.estado),
    fecha_creacion: a.fecha_creacion ?? new Date(0).toISOString(),
    fecha_resolucion: a.fecha_revision ?? null,
    zona_id: null,
    animal_id: a.animal_id ?? null,
    reportado_por: null,
    recomendacion: a.recomendacion ?? null,
    alertaEstado: a.estado,
  };
}

export function normalizeIncident(i: Incident): UnifiedIncident {
  return {
    id: `i:${i.id}`,
    rawId: i.id,
    origen: "incidencia",
    titulo: i.tipo.replace(/_/g, " "),
    descripcion: i.descripcion,
    severidad: i.prioridad,
    estado: i.estado,
    fecha_creacion: i.fecha_creacion ?? new Date(0).toISOString(),
    fecha_resolucion: i.fecha_resolucion ?? null,
    zona_id: i.zona_id ?? null,
    animal_id: i.animal_id ?? null,
    reportado_por: i.reportado_por ?? null,
    recomendacion: undefined,
    alertaEstado: undefined,
  };
}
