export type UserRole = "admin" | "veterinario" | "operario" | "alimentacion";

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  empleado_id?: string | null;
  activo: boolean;
  ultimo_login?: string | null;
  role?: UserRole;
};

export type AuthResponse = {
  user: AuthUser;
  token: {
    access_token: string;
    token_type: "bearer";
    expires_in: number;
  };
};

export type LoginPayload = {
  username: string;
  password: string;
};

export type VisualZoneKey = "recria" | "nave";

export type Zone = {
  id: string;
  nombre: string;
  codigo: string;
  descripcion?: string | null;
  tipo?: string | null;
  tiene_pantalla_tv: boolean;
  tiene_tablet: boolean;
  activa?: boolean;
};

export type AlertState = "pendiente" | "revisada" | "resuelta" | "falsa_alarma";
export type AlertSeverity = "baja" | "media" | "alta" | "critica";

export type Alert = {
  id: string;
  animal_id: string;
  tipo_alerta: string;
  severidad: AlertSeverity;
  descripcion: string;
  recomendacion?: string | null;
  estado: AlertState;
  confianza_prediccion?: number | null;
  requiere_escalacion?: boolean;
  fecha_creacion?: string;
  fecha_revision?: string | null;
  revisada?: boolean;
  notas_operario?: string | null;
  accion_tomada?: string | null;
  veterinario_responsable?: string | null;
};

export type AlertsResponse = {
  animal_id?: string;
  total: number;
  alertas: Alert[];
  skip?: number;
  limit?: number;
  estadisticas?: null | {
    total_alertas: number;
    alertas_ultimos_30_dias: number;
    pendientes: number;
    tasa_resolucion_pct: number;
    severidad_promedio: string;
  };
};

export type TaskStatus = "programada" | "ejecutada" | "retrasada" | "cancelada" | "pausada";

export type TareaCatalogo = {
  id: string;
  nombre: string;
  categoria: string;
  frecuencia: string;
  zona_aplicable?: string | null;
};

export type Task = {
  id: string;
  tarea_catalogo_id: string;
  tarea_catalogo?: TareaCatalogo | null;
  zona_id?: string | null;
  empleado_id?: string | null;
  fecha_programada: string;
  fecha_ejecucion?: string | null;
  estado: TaskStatus;
  ejecutado_por?: string | null;
  tiempo_ejecucion_minutos?: string | null;
  resultado?: string | null;
  observaciones?: string | null;
  problemas_encontrados?: string | null;
  acciones_correctivas?: string | null;
  checklist_completado: string;
  checklist_datos?: string | null;
  es_urgente: boolean;
  motivo_retraso?: string | null;
  requiere_seguimiento: boolean;
  fecha_seguimiento?: string | null;
};

export type Animal = {
  id: string;
  crotal_oficial: string;
  nombre?: string | null;
  sexo: string;
  fecha_nacimiento: string;
  raza?: string | null;
  estado: "recria" | "crianza" | "produccion" | "seca" | "gestante" | "baja";
  estado_reproductivo?: string | null;
  fecha_entrada: string;
  fecha_baja?: string | null;
  motivo_baja?: string | null;
  notas?: string | null;
  lactaciones?: Lactation[];
};

export type Lactation = {
  id: string;
  animal_id: string;
  numero_lactacion?: number | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  dias_transcurridos?: number | null;
  produccion_promedio?: number | null;
  produccion_total?: number | null;
  grasa_promedio?: number | null;
  proteina_promedio?: number | null;
  rcs_promedio?: number | null;
  activa?: boolean;
};

export type Treatment = {
  id: string;
  animal_id: string;
  medicamento?: string | null;
  dosis?: string | null;
  via_administracion?: string | null;
  fecha_inicio: string;
  fecha_fin?: string | null;
  periodo_retirada_dias?: number | null;
  fecha_fin_retirada?: string | null;
  activo?: boolean;
  motivo?: string | null;
  veterinario?: string | null;
  observaciones?: string | null;
};

export type BoxRecria = {
  id: string;
  box_numero: number;
  ternero_id?: string | null;
  fecha_entrada?: string | null;
  fecha_salida?: string | null;
  activo: boolean;
  alertas_box: unknown[];
  notas?: string | null;
};

export type IncidentPriority = "baja" | "media" | "alta" | "critica";
export type IncidentStatus = "abierta" | "en_gestion" | "resuelta" | "cerrada";

// Roles reales del modelo Empleado en base de datos (distinto de UserRole del sistema)
export type EmployeeRol = "encargado" | "auxiliar" | "veterinario" | "mecanico";

export type Incident = {
  id: string;
  tipo: string;
  zona_id?: string | null;
  animal_id?: string | null;
  descripcion: string;
  prioridad: IncidentPriority;
  estado: IncidentStatus;
  fecha_creacion?: string;
  fecha_resolucion?: string | null;
  resolucion?: string | null;
  reportado_por?: string | null;
};

export type CreateIncidentPayload = {
  tipo: string;
  zona_id?: string | null;
  animal_id?: string | null;
  maquinaria_id?: string | null;
  descripcion: string;
  prioridad: IncidentPriority;
};

// ── Orders (Pedidos) ────────────────────────────────────────────────────────

export type OrderStatus = "solicitado" | "aprobado" | "en_transito" | "recibido" | "cancelado";

export type Order = {
  id: string;
  insumo: string;
  descripcion?: string | null;
  cantidad: number;
  unidad?: string | null;
  estado: OrderStatus;
  solicitante_id?: string | null;
  ts_solicitud?: string | null;
  ts_aprobacion?: string | null;
  ts_recepcion?: string | null;
  proveedor?: string | null;
  coste_estimado?: number | null;
  coste_real?: number | null;
  notas?: string | null;
};

export type OrdersResponse = {
  total: number;
  pedidos: Order[];
};

// ── Task catalog ─────────────────────────────────────────────────────────────

export type TaskCatalogItem = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  cualificacion_requerida?: string | null;
  duracion_estimada_min?: number | null;
  activa: boolean;
};

// ── Orders ───────────────────────────────────────────────────────────────────

export type CreateOrderPayload = {
  insumo: string;
  cantidad: number;
  descripcion?: string | null;
  unidad?: string | null;
  proveedor?: string | null;
  coste_estimado?: number | null;
  notas?: string | null;
};

// ── Shifts (Turnos) ─────────────────────────────────────────────────────────

export type ShiftType = "manana" | "tarde";

export type Shift = {
  id: string;
  fecha?: string | null;
  tipo_turno: ShiftType;
  hora_inicio?: string | null;
  hora_fin?: string | null;
  notas?: string | null;
};

export type ShiftsResponse = {
  total: number;
  turnos: Shift[];
};

export type ShiftAssignment = {
  id: string;
  turno_id: string;
  empleado_id: string;
  zona_id?: string | null;
  rol?: string | null;
};

export type ShiftAssignmentsResponse = {
  total: number;
  asignaciones: ShiftAssignment[];
};

export type CreateShiftPayload = {
  fecha: string;
  tipo_turno: ShiftType;
  hora_inicio: string;
  hora_fin: string;
  notas?: string | null;
};

export type CreateShiftAssignmentPayload = {
  turno_id: string;
  empleado_id: string;
  zona_id?: string | null;
  rol?: string | null;
};

// ── Handovers (Resúmenes de relevo) ─────────────────────────────────────────

export type ShiftHandover = {
  id: string;
  turno_saliente_id: string;
  turno_entrante_id: string;
  ts_generacion?: string | null;
  incidencias_abiertas: unknown[];
  tareas_pendientes: unknown[];
  alertas_pendientes: unknown[];
  notas_saliente?: string | null;
  confirmado_por?: string | null;
  ts_confirmacion?: string | null;
};

export type ShiftHandoversResponse = {
  total: number;
  resumenes: ShiftHandover[];
};

// ── Audit Log ────────────────────────────────────────────────────────────────

export type AuditOperation = "INSERT" | "UPDATE" | "DELETE";

export type AuditLogEntry = {
  id: number;
  ts: string | null;
  tabla_afectada: string;
  operacion: AuditOperation;
  registro_id: string | null;
  datos_anteriores: Record<string, unknown> | null;
  datos_nuevos: Record<string, unknown> | null;
  usuario_bd: string;
  hash_sha256: string;
};

export type AuditLogResponse = {
  total: number;
  limit: number;
  registros: AuditLogEntry[];
};

export type PredictionTrend = "aumento" | "descenso" | "estable";
export type RiskLevel = "bajo" | "medio" | "alto" | "critico";

export type ProductionPrediction = {
  tendencia: PredictionTrend;
  produccion_promedio_predicha: number;
  produccion_minima_predicha?: number | null;
  produccion_maxima_predicha?: number | null;
  dias_prediccion?: number | null;
  confidence: number;
  series_diaria?: number[] | null;
};

export type CompositionPrediction = {
  grasa: { prediccion: number; tendencia?: string };
  proteina: { prediccion: number; tendencia?: string };
  lactosa?: { prediccion: number; tendencia?: string } | null;
  anomalia_detectada?: boolean;
  confidence: number;
};

export type HealthRiskPrediction = {
  riesgo_promedio: RiskLevel;
  riesgos_especificos?: Record<string, { probabilidad: number; nivel: RiskLevel }>;
  factores_riesgo?: string[];
  confidence: number;
  dias_prediccion?: number | null;
};

export type AnimalPrediction = {
  animal_id: string;
  timestamp: string;
  produccion?: ProductionPrediction | null;
  composicion?: CompositionPrediction | null;
  riesgo_sanitario?: HealthRiskPrediction | null;
  confianza_integrada?: number;
  _mock?: boolean;
};

export type DashboardSummary = {
  alertas: {
    total_pendientes: number;
    criticas: number;
    altas: number;
  };
  tareas: {
    programadas: number;
    ejecutadas: number;
    retrasadas: number;
  };
  animales: {
    activos: number;
    por_zona?: { zona_id: string; nombre: string; total: number }[];
  };
  tratamientos: {
    activos: number;
  };
};

export type QualitySummary = {
  lactaciones_activas: number;
  produccion_promedio?: number | null;
  grasa_promedio?: number | null;
  proteina_promedio?: number | null;
  rcs_promedio?: number | null;
  animales_en_control: number;
};

export type Employee = {
  id: string;
  nombre: string;
  apellidos?: string | null;
  role?: string | null;
  zona_principal_id?: string | null;
  activo?: boolean;
};

export type Machinery = {
  id: string;
  nombre: string;
  tipo: string;
  zona_id?: string | null;
  estado: string;
  proxima_revision?: string | null;
  observaciones?: string | null;
};

export type WeatherData = {
  temperatura_actual?: number | null;
  temperatura?: number | null;
  humedad?: number | null;
  precipitacion_mm?: number | null;
  prob_precipitacion_pct?: number | null;
  descripcion?: string | null;
  impacto_productivo?: string | null;
  fecha?: string | null;
  ubicacion?: string | null;
};

export type WeatherForecastDay = {
  fecha: string | null;
  temperatura_media: number | null;
  temperatura_maxima: number | null;
  temperatura_minima: number | null;
  humedad: number | null;
  precipitacion: number | null;
  prob_precipitacion_pct: number | null;
  viento: number | null;
  descripcion: string | null;
  fuente: string;
};

export type WeatherForecast = {
  ubicacion: string;
  dias: WeatherForecastDay[];
};

export type ApiErrorPayload = {
  detail?: string | { msg?: string }[];
  status_code?: number;
};

export type HealthResponse = {
  status: "ok" | "error";
  database: "ok" | "error";
  environment: string;
};

// ── Unified Incidents+Alerts view type ──────────────────────────────────────

export type UnifiedIncidentOrigen = "incidencia" | "alerta";
export type UnifiedSeverity = "baja" | "media" | "alta" | "critica";
export type UnifiedEstado = "abierta" | "en_gestion" | "resuelta" | "cerrada";

export type UnifiedIncident = {
  id: string;
  rawId: string;
  origen: UnifiedIncidentOrigen;
  titulo: string;
  descripcion: string;
  severidad: UnifiedSeverity;
  estado: UnifiedEstado;
  fecha_creacion: string;
  fecha_resolucion?: string | null;
  zona_id?: string | null;
  animal_id?: string | null;
  reportado_por?: string | null;
  recomendacion?: string | null;
  alertaEstado?: AlertState;
};
