-- =============================================================================
-- Tools4Milk — Schema de inicialización PostgreSQL
-- Se ejecuta automáticamente al crear el volumen por primera vez.
-- Para resetear: docker-compose down -v && docker-compose up -d db
--
-- Cambios respecto al SQL original:
--   - timescaledb comentado (no disponible en PostgreSQL estándar)
--   - SELECT create_hypertable(...) comentados → tablas estándar
--   - Corregido guion huérfano en tabla alertas
--   - Corregido comentario "-Tareas recurrentes" → "-- Tareas recurrentes"
--   - Eliminado "'" huérfano al final del archivo
-- =============================================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- CREATE EXTENSION IF NOT EXISTS "timescaledb"; -- Requiere imagen timescaledb/timescaledb-ha

-- =============================================================================
-- TIPOS ENUM
-- =============================================================================

-- Dominio LeanFarming
CREATE TYPE rol_empleado      AS ENUM ('encargado', 'auxiliar', 'veterinario', 'mecanico');
CREATE TYPE tipo_maquinaria   AS ENUM ('robot_ordeno', 'carro_mezclador', 'amamantadora', 'bomba', 'otro');
CREATE TYPE estado_tarea      AS ENUM ('pendiente', 'en_curso', 'completada', 'vencida', 'cancelada');
CREATE TYPE tipo_turno        AS ENUM ('manana', 'tarde');
CREATE TYPE estado_pedido     AS ENUM ('solicitado', 'aprobado', 'en_transito', 'recibido', 'cancelado');

-- Incidencias
CREATE TYPE tipo_incidencia   AS ENUM (
    'averia_maquinaria',
    'infraestructura',
    'sanidad_animal',
    'calidad_leche',
    'alimentacion',
    'pedidos'
);
CREATE TYPE nivel_severidad   AS ENUM ('baja', 'media', 'alta');
CREATE TYPE estado_incidencia AS ENUM ('abierta', 'en_gestion', 'resuelta', 'cerrada');
CREATE TYPE nivel_alerta      AS ENUM ('baja', 'media', 'alta');

-- Dominio Zootécnico
CREATE TYPE estado_animal       AS ENUM ('produccion', 'seca', 'recria', 'gestante', 'baja');
CREATE TYPE estado_reproductivo AS ENUM ('vacia', 'en_celo', 'inseminada', 'confirmada_gestante', 'parto_reciente');
CREATE TYPE tipo_evento_repro   AS ENUM ('celo', 'inseminacion', 'diagnostico_gestacion', 'aborto', 'parto', 'secado');
CREATE TYPE tipo_patologia      AS ENUM ('mastitis', 'cojera', 'metritis', 'cetosis', 'desplazamiento_abomaso', 'neumonia', 'diarrea', 'otra');
CREATE TYPE sexo_animal         AS ENUM ('hembra', 'macho');


-- =============================================================================
-- DOMINIO 1: LeanFarming
-- =============================================================================

-- Empleados
CREATE TABLE empleados (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre          VARCHAR(100) NOT NULL,
    apellidos       VARCHAR(150) NOT NULL,
    rol             rol_empleado NOT NULL,
    cualificaciones TEXT[]       DEFAULT '{}',
    telefono        VARCHAR(20),
    email           VARCHAR(150),
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    fecha_alta      DATE         NOT NULL DEFAULT CURRENT_DATE,
    fecha_baja      DATE,
    CONSTRAINT chk_fechas_empleado CHECK (fecha_baja IS NULL OR fecha_baja >= fecha_alta)
);

COMMENT ON TABLE  empleados                IS 'Registro maestro de trabajadores.';
COMMENT ON COLUMN empleados.cualificaciones IS 'Array de cualificaciones: VMS, TMR, veterinaria…';

-- Zonas
CREATE TABLE zonas (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre            VARCHAR(100) NOT NULL UNIQUE,
    codigo            VARCHAR(30)  NOT NULL UNIQUE,
    descripcion       TEXT,
    tiene_pantalla_tv BOOLEAN NOT NULL DEFAULT FALSE,
    tiene_tablet      BOOLEAN NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE zonas IS '5 zonas con pantalla TV informativa y tablet interactiva.';

-- Datos maestros de zonas
INSERT INTO zonas (nombre, codigo, tiene_pantalla_tv, tiene_tablet, descripcion) VALUES
    ('Nave',        'sala_ordeno', TRUE,  TRUE,  'Sala de ordeño robótico VMS'),
    ('Enfermería',  'enfermeria',  TRUE,  TRUE,  'Animales enfermos y en tratamiento'),
    ('Oficina',     'oficina',     TRUE,  TRUE,  'Gestión administrativa y técnica'),
    ('General',     'general',     FALSE, FALSE, 'Área general sin pantalla asignada'),
    ('Boxes',       'boxes_terneros', TRUE, TRUE, 'Boxes de terneros'),
    ('Recría',      'zona_recria', TRUE,  TRUE,  'Zona de recría de terneras y novillas');

-- Maquinaria
CREATE TABLE maquinaria (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre            VARCHAR(100) NOT NULL,
    tipo              tipo_maquinaria NOT NULL,
    zona_id           UUID REFERENCES zonas(id) ON DELETE SET NULL,
    marca             VARCHAR(100),
    modelo            VARCHAR(100),
    numero_serie      VARCHAR(100) UNIQUE,
    fecha_instalacion DATE,
    activa            BOOLEAN NOT NULL DEFAULT TRUE,
    estado            VARCHAR(40) NOT NULL DEFAULT 'operativa',
    notas             TEXT
);

INSERT INTO maquinaria (nombre, tipo, marca, modelo) VALUES
    ('VMS 1',        'robot_ordeno',    'DeLaval', 'VMS V300'),
    ('VMS 2',        'robot_ordeno',    'DeLaval', 'VMS V300'),
    ('VMS 3',        'robot_ordeno',    'DeLaval', 'VMS V300'),
    ('Carro TMR',    'carro_mezclador', 'Trioliet', 'Solomix 2'),
    ('Amamantadora', 'amamantadora',    'Förster',  'HL 102');

-- Catálogo de tareas
CREATE TABLE tareas_catalogo (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo                  VARCHAR(60)  NOT NULL UNIQUE,
    nombre                  VARCHAR(150) NOT NULL,
    descripcion             TEXT,
    cualificacion_requerida TEXT,
    duracion_estimada_min   INTEGER,
    activa                  BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO tareas_catalogo (codigo, nombre, cualificacion_requerida, duracion_estimada_min) VALUES
    ('lavado_robot',         'Lavado de robot de ordeño',             'VMS',         45),
    ('desinfeccion_camas',   'Desinfección de camas',                  NULL,          60),
    ('limpieza_bebederos',   'Limpieza de bebederos',                  NULL,          30),
    ('preparacion_racion',   'Preparación ración unifeed (TMR)',        'TMR',         40),
    ('revision_terneros',    'Revisión diaria terneros',               NULL,          30),
    ('control_tratamientos', 'Control y administración tratamientos',  'veterinaria', 20),
    ('recogida_muestras',    'Recogida muestras de leche',             NULL,          15);

-- Tareas recurrentes
CREATE TABLE tareas_recurrentes (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    catalogo_id           UUID NOT NULL REFERENCES tareas_catalogo(id),
    zona_id               UUID REFERENCES zonas(id),
    maquinaria_id         UUID REFERENCES maquinaria(id),
    frecuencia_expr       VARCHAR(100) NOT NULL,
    descripcion_frecuencia TEXT,
    activa                BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_inicio          DATE    NOT NULL DEFAULT CURRENT_DATE,
    fecha_fin             DATE,
    notas                 TEXT,
    CONSTRAINT chk_fechas_recurrente CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

COMMENT ON COLUMN tareas_recurrentes.frecuencia_expr IS
    'Cron estándar (0 22 * * 1,4) o formato propio cada_N_dias:30.';

INSERT INTO tareas_recurrentes (catalogo_id, frecuencia_expr, descripcion_frecuencia, notas)
SELECT id, '0 22 * * 1,4', 'Lunes y jueves a las 22:00', 'Lavado robots 1-2 (lun/jue)'
FROM tareas_catalogo WHERE codigo = 'lavado_robot';

INSERT INTO tareas_recurrentes (catalogo_id, frecuencia_expr, descripcion_frecuencia, notas)
SELECT id, '0 22 * * 2,5', 'Martes y viernes a las 22:00', 'Lavado robots 3 (mar/vie)'
FROM tareas_catalogo WHERE codigo = 'lavado_robot';

INSERT INTO tareas_recurrentes (catalogo_id, frecuencia_expr, descripcion_frecuencia, notas)
SELECT id, 'cada_N_dias:30', 'Cada 30 días', 'Desinfectante camas patio lactación'
FROM tareas_catalogo WHERE codigo = 'desinfeccion_camas';

INSERT INTO tareas_recurrentes (catalogo_id, frecuencia_expr, descripcion_frecuencia, notas)
SELECT id, '0 10 * * 1,3,5', 'Lunes, miércoles y viernes a las 10:00', 'Bebederos L/X/V'
FROM tareas_catalogo WHERE codigo = 'limpieza_bebederos';

-- Definición de turnos
CREATE TABLE turnos (
    id          UUID       PRIMARY KEY DEFAULT uuid_generate_v4(),
    fecha       DATE       NOT NULL,
    tipo_turno  tipo_turno NOT NULL,
    hora_inicio TIME       NOT NULL,
    hora_fin    TIME       NOT NULL,
    notas       TEXT,
    UNIQUE (fecha, tipo_turno)
);

-- Asignaciones de turno
CREATE TABLE asignaciones_turno (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    turno_id    UUID NOT NULL REFERENCES turnos(id)    ON DELETE CASCADE,
    empleado_id UUID NOT NULL REFERENCES empleados(id),
    zona_id     UUID          REFERENCES zonas(id),
    rol         VARCHAR(80),
    UNIQUE (turno_id, empleado_id)
);

-- Ejecuciones de tareas
CREATE TABLE tareas_ejecuciones (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    catalogo_id     UUID         NOT NULL REFERENCES tareas_catalogo(id),
    recurrente_id   UUID                  REFERENCES tareas_recurrentes(id),
    empleado_id     UUID                  REFERENCES empleados(id),
    zona_id         UUID                  REFERENCES zonas(id),
    maquinaria_id   UUID                  REFERENCES maquinaria(id),
    estado          estado_tarea NOT NULL DEFAULT 'pendiente',
    ts_planificada  TIMESTAMPTZ  NOT NULL,
    ts_inicio       TIMESTAMPTZ,
    ts_fin          TIMESTAMPTZ,
    notas           TEXT,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_ts_ejecucion CHECK (ts_fin IS NULL OR ts_fin >= ts_inicio)
);

CREATE INDEX idx_ejecuciones_estado      ON tareas_ejecuciones(estado);
CREATE INDEX idx_ejecuciones_empleado    ON tareas_ejecuciones(empleado_id);
CREATE INDEX idx_ejecuciones_planificada ON tareas_ejecuciones(ts_planificada);
CREATE INDEX idx_ejecuciones_zona        ON tareas_ejecuciones(zona_id);

-- Pedidos
CREATE TABLE pedidos (
    id             UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    insumo         VARCHAR(200)  NOT NULL,
    descripcion    TEXT,
    cantidad       NUMERIC(10,2) NOT NULL CHECK (cantidad > 0),
    unidad         VARCHAR(30),
    estado         estado_pedido NOT NULL DEFAULT 'solicitado',
    solicitante_id UUID          REFERENCES empleados(id),
    ts_solicitud   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    ts_aprobacion  TIMESTAMPTZ,
    ts_recepcion   TIMESTAMPTZ,
    proveedor      VARCHAR(150),
    coste_estimado NUMERIC(10,2),
    coste_real     NUMERIC(10,2),
    notas          TEXT
);

CREATE INDEX idx_pedidos_estado ON pedidos(estado);
CREATE INDEX idx_pedidos_ts     ON pedidos(ts_solicitud DESC);

-- Incidencias
CREATE TABLE incidencias (
    id            UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo          tipo_incidencia   NOT NULL,
    subtipo       VARCHAR(80),
    severidad     nivel_severidad   NOT NULL DEFAULT 'media',
    estado        estado_incidencia NOT NULL DEFAULT 'abierta',
    titulo        VARCHAR(200)      NOT NULL,
    descripcion   TEXT,
    zona_id       UUID              REFERENCES zonas(id),
    maquinaria_id UUID              REFERENCES maquinaria(id),
    animal_id     UUID,
    reportado_por UUID              REFERENCES empleados(id),
    asignado_a    UUID              REFERENCES empleados(id),
    ts_apertura   TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    ts_cierre     TIMESTAMPTZ,
    foto_url      TEXT,
    acciones      JSONB             NOT NULL DEFAULT '[]'::JSONB,
    CONSTRAINT chk_cierre_incidencia CHECK (ts_cierre IS NULL OR ts_cierre >= ts_apertura)
);

CREATE INDEX idx_incidencias_tipo     ON incidencias(tipo);
CREATE INDEX idx_incidencias_estado   ON incidencias(estado);
CREATE INDEX idx_incidencias_zona     ON incidencias(zona_id);
CREATE INDEX idx_incidencias_animal   ON incidencias(animal_id);
CREATE INDEX idx_incidencias_apertura ON incidencias(ts_apertura DESC);
CREATE INDEX idx_incidencias_acciones ON incidencias USING GIN(acciones);


-- =============================================================================
-- DOMINIO ZOOTÉCNICO
-- =============================================================================

-- Registro de animales
CREATE TABLE animales (
    id                  UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
    crotal_oficial      VARCHAR(20)         NOT NULL UNIQUE,
    nombre              VARCHAR(80),
    sexo                sexo_animal         NOT NULL DEFAULT 'hembra',
    fecha_nacimiento    DATE                NOT NULL,
    raza                VARCHAR(80),
    estado              estado_animal       NOT NULL DEFAULT 'recria',
    estado_reproductivo estado_reproductivo,
    madre_id            UUID                REFERENCES animales(id),
    fecha_entrada       DATE                NOT NULL DEFAULT CURRENT_DATE,
    fecha_baja          DATE,
    motivo_baja         VARCHAR(200),
    notas               TEXT,
    CONSTRAINT chk_fechas_animal CHECK (fecha_baja IS NULL OR fecha_baja >= fecha_nacimiento)
);

CREATE INDEX idx_animales_estado       ON animales(estado);
CREATE INDEX idx_animales_crotal       ON animales(crotal_oficial);
CREATE INDEX idx_animales_estado_repro ON animales(estado_reproductivo);
CREATE INDEX idx_animales_madre        ON animales(madre_id);

ALTER TABLE incidencias
    ADD CONSTRAINT fk_incidencias_animal
    FOREIGN KEY (animal_id) REFERENCES animales(id) ON DELETE SET NULL;

-- Lactaciones
CREATE TABLE lactaciones (
    id                  UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    animal_id           UUID          NOT NULL REFERENCES animales(id),
    numero              SMALLINT      NOT NULL CHECK (numero >= 1),
    fecha_parto         DATE          NOT NULL,
    fecha_secado        DATE,
    produccion_total_kg NUMERIC(8,2),
    notas               TEXT,
    UNIQUE (animal_id, numero),
    CONSTRAINT chk_fechas_lactacion CHECK (fecha_secado IS NULL OR fecha_secado > fecha_parto)
);

CREATE INDEX idx_lactaciones_animal ON lactaciones(animal_id);
CREATE INDEX idx_lactaciones_parto  ON lactaciones(fecha_parto DESC);

-- Eventos reproductivos
CREATE TABLE eventos_reproductivos (
    id          UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
    animal_id   UUID               NOT NULL REFERENCES animales(id),
    tipo        tipo_evento_repro  NOT NULL,
    fecha       DATE               NOT NULL,
    hora        TIME,
    empleado_id UUID               REFERENCES empleados(id),
    detalles    JSONB              DEFAULT '{}'::JSONB,
    notas       TEXT,
    creado_en   TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ev_repro_animal ON eventos_reproductivos(animal_id);
CREATE INDEX idx_ev_repro_tipo   ON eventos_reproductivos(tipo);
CREATE INDEX idx_ev_repro_fecha  ON eventos_reproductivos(fecha DESC);
CREATE INDEX idx_ev_repro_det    ON eventos_reproductivos USING GIN(detalles);

-- Eventos sanitarios
CREATE TABLE eventos_sanitarios (
    id                     UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    animal_id              UUID           NOT NULL REFERENCES animales(id),
    tipo_patologia         tipo_patologia NOT NULL,
    fecha_inicio           DATE           NOT NULL,
    fecha_fin              DATE,
    tratamiento            TEXT,
    farmaco                VARCHAR(200),
    dosis                  VARCHAR(100),
    via_administracion     VARCHAR(80),
    periodo_retirada_hasta DATE,
    resuelto               BOOLEAN        NOT NULL DEFAULT FALSE,
    coste                  NUMERIC(8,2),
    veterinario_id         UUID           REFERENCES empleados(id),
    notas                  TEXT,
    CONSTRAINT chk_fechas_sanitario CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE INDEX idx_ev_sanitarios_animal   ON eventos_sanitarios(animal_id);
CREATE INDEX idx_ev_sanitarios_tipo     ON eventos_sanitarios(tipo_patologia);
CREATE INDEX idx_ev_sanitarios_retirada ON eventos_sanitarios(periodo_retirada_hasta)
    WHERE periodo_retirada_hasta IS NOT NULL;

-- Eventos sanitarios de terneros
CREATE TABLE eventos_sanitarios_recria (
    id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    animal_id      UUID         NOT NULL REFERENCES animales(id),
    fecha          DATE         NOT NULL,
    edad_dias      INTEGER,
    score_neumonia SMALLINT     NOT NULL DEFAULT 0 CHECK (score_neumonia BETWEEN 0 AND 3),
    score_diarrea  SMALLINT     NOT NULL DEFAULT 0 CHECK (score_diarrea  BETWEEN 0 AND 3),
    score_ombligo  SMALLINT     NOT NULL DEFAULT 0 CHECK (score_ombligo  BETWEEN 0 AND 3),
    peso_kg        NUMERIC(5,1),
    tratamiento    TEXT,
    observaciones  TEXT,
    empleado_id    UUID         REFERENCES empleados(id)
);

CREATE INDEX idx_ev_recria_animal ON eventos_sanitarios_recria(animal_id);
CREATE INDEX idx_ev_recria_fecha  ON eventos_sanitarios_recria(fecha DESC);

-- Tratamientos activos
CREATE TABLE tratamientos_activos (
    id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    animal_id           UUID         NOT NULL REFERENCES animales(id),
    evento_sanitario_id UUID                  REFERENCES eventos_sanitarios(id),
    farmaco             VARCHAR(200) NOT NULL,
    dosis               VARCHAR(100),
    via_administracion  VARCHAR(80),
    dias_tratamiento    SMALLINT     NOT NULL CHECK (dias_tratamiento > 0),
    fecha_inicio        DATE         NOT NULL,
    fecha_fin_prevista  DATE         NOT NULL,
    fecha_fin_real      DATE,
    activo              BOOLEAN      NOT NULL DEFAULT TRUE,
    checkboxes          JSONB        NOT NULL DEFAULT '[]'::JSONB,
    prescrito_por       UUID         REFERENCES empleados(id),
    notas               TEXT,
    CONSTRAINT chk_fechas_tratamiento CHECK (fecha_fin_prevista >= fecha_inicio)
);

CREATE INDEX idx_tratamientos_animal  ON tratamientos_activos(animal_id);
CREATE INDEX idx_tratamientos_activos ON tratamientos_activos(activo) WHERE activo = TRUE;

-- Análisis genéticos
CREATE TABLE genomica (
    id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    animal_id        UUID         NOT NULL REFERENCES animales(id),
    fecha_extraccion DATE         NOT NULL,
    tipo_muestra     VARCHAR(60),
    laboratorio      VARCHAR(150),
    referencia_lab   VARCHAR(100),
    fecha_resultado  DATE,
    resultados_ref   TEXT,
    notas            TEXT
);

CREATE INDEX idx_genomica_animal ON genomica(animal_id);

-- Establos de recría
CREATE TABLE boxes_recria (
    id            UUID     PRIMARY KEY DEFAULT uuid_generate_v4(),
    box_numero    SMALLINT NOT NULL UNIQUE CHECK (box_numero > 0),
    ternero_id    UUID              REFERENCES animales(id),
    fecha_entrada DATE,
    fecha_salida  DATE,
    activo        BOOLEAN  NOT NULL DEFAULT TRUE,
    alertas_box   JSONB    NOT NULL DEFAULT '[]'::JSONB,
    notas         TEXT,
    CONSTRAINT chk_fechas_box CHECK (fecha_salida IS NULL OR fecha_salida >= fecha_entrada)
);

CREATE INDEX idx_boxes_ternero ON boxes_recria(ternero_id) WHERE ternero_id IS NOT NULL;
CREATE INDEX idx_boxes_alertas ON boxes_recria USING GIN(alertas_box);


-- =============================================================================
-- DOMINIO 3: Series temporales
-- (create_hypertable comentado: usar PostgreSQL estándar para MVP)
-- =============================================================================

-- Lecturas robot de ordeño
CREATE TABLE lecturas_robot_ordeno (
    ts                TIMESTAMPTZ   NOT NULL,
    robot_id          UUID          NOT NULL REFERENCES maquinaria(id),
    animal_id         UUID          NOT NULL REFERENCES animales(id),
    lactacion_id      UUID                   REFERENCES lactaciones(id),
    produccion_kg     NUMERIC(5,2),
    conductividad     NUMERIC(5,2),
    flujo_max         NUMERIC(4,2),
    scc               INTEGER,
    duracion_min      NUMERIC(5,1),
    intentos_fallidos SMALLINT      DEFAULT 0,
    alerta_robot      BOOLEAN       DEFAULT FALSE,
    PRIMARY KEY (ts, robot_id)
);
-- SELECT create_hypertable('lecturas_robot_ordeno', 'ts', chunk_time_interval => INTERVAL '7 days');

CREATE INDEX idx_robot_ordeno_animal ON lecturas_robot_ordeno(animal_id, ts DESC);
CREATE INDEX idx_robot_ordeno_robot  ON lecturas_robot_ordeno(robot_id,  ts DESC);

-- Datos meteorológicos
CREATE TABLE lecturas_meteorologia (
    ts                    TIMESTAMPTZ   NOT NULL,
    estacion_id           VARCHAR(20)   NOT NULL,
    temperatura_c         NUMERIC(4,1),
    humedad_relativa      NUMERIC(4,1),
    precipitacion_mm      NUMERIC(5,1),
    prob_precipitacion_pct NUMERIC(5,1),
    viento_km_h           NUMERIC(5,1),
    direccion_viento      SMALLINT,
    radiacion_wm2         NUMERIC(6,1),
    indice_thermo_humedad NUMERIC(5,2) GENERATED ALWAYS AS (
        ROUND(
            (0.8 * temperatura_c
             + (humedad_relativa / 100.0) * (temperatura_c - 14.4)
             + 46.4)::NUMERIC,
        2)
    ) STORED,
    PRIMARY KEY (ts, estacion_id)
);
-- SELECT create_hypertable('lecturas_meteorologia', 'ts', chunk_time_interval => INTERVAL '1 month');

-- Carro mezclador
CREATE TABLE lecturas_carro_mezclador (
    ts             TIMESTAMPTZ   NOT NULL,
    mezcla_id      UUID          NOT NULL,
    ingrediente    VARCHAR(100)  NOT NULL,
    peso_objetivo  NUMERIC(7,2)  NOT NULL,
    peso_real      NUMERIC(7,2),
    desviacion_pct NUMERIC(5,2) GENERATED ALWAYS AS (
        ROUND(
            ((peso_real - peso_objetivo) / NULLIF(peso_objetivo, 0) * 100)::NUMERIC,
        2)
    ) STORED,
    operario_id    UUID          REFERENCES empleados(id),
    PRIMARY KEY (ts, mezcla_id, ingrediente)
);
-- SELECT create_hypertable('lecturas_carro_mezclador', 'ts', chunk_time_interval => INTERVAL '1 month');

CREATE INDEX idx_carro_mezcla ON lecturas_carro_mezclador(mezcla_id, ts DESC);


-- =============================================================================
-- DOMINIO 4: Alertas, relevo y comprobaciones
-- =============================================================================

-- Umbrales de alerta
CREATE TABLE alertas_umbrales (
    id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo          VARCHAR(80)   NOT NULL UNIQUE,
    descripcion     TEXT          NOT NULL,
    metrica         VARCHAR(100)  NOT NULL,
    operador        VARCHAR(10)   NOT NULL CHECK (operador IN ('>', '<', '>=', '<=', '=')),
    valor_umbral    NUMERIC(12,4) NOT NULL,
    unidad          VARCHAR(30),
    nivel_alerta    nivel_alerta  NOT NULL,
    push_whatsapp   BOOLEAN       NOT NULL DEFAULT FALSE,
    pantalla_tv     BOOLEAN       NOT NULL DEFAULT TRUE,
    tablet          BOOLEAN       NOT NULL,
    activo          BOOLEAN       NOT NULL DEFAULT TRUE,
    notas           TEXT
);

INSERT INTO alertas_umbrales
    (codigo, descripcion, metrica, operador, valor_umbral, unidad, nivel_alerta, push_whatsapp, pantalla_tv, tablet)
VALUES
    ('scc_alto',
     'SCC estimado supera umbral de calidad',
     'scc', '>', 250000, 'cel/ml',
     'alta', TRUE, TRUE, TRUE),

    ('tarea_vencida',
     'Tarea no completada transcurridas más de 2 horas de su hora planificada',
     'minutos_retraso_tarea', '>', 120, 'min',
     'alta', TRUE, TRUE, TRUE),

    ('tratamiento_no_dado',
     'Administración de tratamiento activo no registrada en el día',
     'checkboxes_pendientes', '>', 0, 'und',
     'alta', TRUE, TRUE, TRUE),

    ('retraso_ordeno',
     'Retraso en el inicio del ordeño respecto a hora planificada',
     'minutos_retraso_ordeno', '>', 0, 'min',
     'media', FALSE, TRUE, TRUE),

    ('desviacion_tmr',
     'Desviación de la ración TMR superior al 5%',
     'desviacion_pct_tmr', '>', 5, '%',
     'media', FALSE, TRUE, TRUE),

    ('recordatorio_protocolo',
     'Recordatorio de protocolo periódico',
     'protocolo_pendiente', '>', 0, 'und',
     'baja', FALSE, TRUE, FALSE),

    ('estado_meteo',
     'Información de estado meteorológico para pantalla TV',
     'info_meteo', '=', 1, NULL,
     'baja', FALSE, TRUE, FALSE);

-- Sistema de alertas
CREATE TABLE alertas (
    id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    umbral_id      UUID                  REFERENCES alertas_umbrales(id),
    nivel          nivel_alerta NOT NULL,
    titulo         VARCHAR(200) NOT NULL,
    mensaje        TEXT,
    origen_tabla   VARCHAR(100),
    origen_id      UUID,
    animal_id      UUID         REFERENCES animales(id),
    zona_id        UUID         REFERENCES zonas(id),
    push_whatsapp  BOOLEAN      NOT NULL DEFAULT FALSE,
    pantalla_tv    BOOLEAN      NOT NULL DEFAULT TRUE,
    tablet         BOOLEAN      NOT NULL DEFAULT TRUE,
    activa         BOOLEAN      NOT NULL DEFAULT TRUE,
    ts_generacion  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    ts_resolucion  TIMESTAMPTZ,
    resuelta_por   UUID         REFERENCES empleados(id)
);

CREATE INDEX idx_alertas_nivel   ON alertas(nivel);
CREATE INDEX idx_alertas_activas ON alertas(activa, ts_generacion DESC) WHERE activa = TRUE;
CREATE INDEX idx_alertas_animal  ON alertas(animal_id) WHERE animal_id IS NOT NULL;

-- Resumen para cambio de turno
CREATE TABLE resumenes_relevo (
    id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    turno_saliente_id    UUID        NOT NULL REFERENCES turnos(id),
    turno_entrante_id    UUID        NOT NULL REFERENCES turnos(id),
    ts_generacion        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    incidencias_abiertas JSONB       NOT NULL DEFAULT '[]'::JSONB,
    tareas_pendientes    JSONB       NOT NULL DEFAULT '[]'::JSONB,
    alertas_pendientes   JSONB       NOT NULL DEFAULT '[]'::JSONB,
    notas_saliente       TEXT,
    confirmado_por       UUID        REFERENCES empleados(id),
    ts_confirmacion      TIMESTAMPTZ,
    CONSTRAINT chk_turnos_distintos CHECK (turno_saliente_id <> turno_entrante_id)
);


-- =============================================================================
-- AUDIT LOG
-- =============================================================================

CREATE TABLE audit_log (
    id               BIGSERIAL    PRIMARY KEY,
    ts               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tabla_afectada   VARCHAR(100) NOT NULL,
    operacion        CHAR(6)      NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
    registro_id      UUID         NOT NULL,
    datos_anteriores JSONB,
    datos_nuevos     JSONB,
    usuario_bd       VARCHAR(100) NOT NULL DEFAULT CURRENT_USER,
    hash_sha256      TEXT         NOT NULL
);

CREATE INDEX idx_audit_tabla    ON audit_log(tabla_afectada, ts DESC);
CREATE INDEX idx_audit_registro ON audit_log(registro_id);
CREATE INDEX idx_audit_ts       ON audit_log(ts DESC);


-- =============================================================================
-- TRIGGERS DE AUDITORÍA
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_registro_id UUID;
    v_datos_ant   JSONB;
    v_datos_new   JSONB;
    v_hash_input  TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_registro_id := NEW.id;
        v_datos_ant   := NULL;
        v_datos_new   := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_registro_id := NEW.id;
        v_datos_ant   := to_jsonb(OLD);
        v_datos_new   := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        v_registro_id := OLD.id;
        v_datos_ant   := to_jsonb(OLD);
        v_datos_new   := NULL;
    END IF;

    v_hash_input := TG_TABLE_NAME || TG_OP || v_registro_id::TEXT
                    || COALESCE(v_datos_new::TEXT, v_datos_ant::TEXT);

    INSERT INTO audit_log (
        tabla_afectada, operacion, registro_id,
        datos_anteriores, datos_nuevos, hash_sha256
    ) VALUES (
        TG_TABLE_NAME, TG_OP, v_registro_id,
        v_datos_ant, v_datos_new,
        encode(digest(v_hash_input, 'sha256'), 'hex')
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers sobre tablas críticas
CREATE TRIGGER trg_audit_animales
    AFTER INSERT OR UPDATE OR DELETE ON animales
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER trg_audit_eventos_sanitarios
    AFTER INSERT OR UPDATE OR DELETE ON eventos_sanitarios
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER trg_audit_tratamientos_activos
    AFTER INSERT OR UPDATE OR DELETE ON tratamientos_activos
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER trg_audit_incidencias
    AFTER INSERT OR UPDATE OR DELETE ON incidencias
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER trg_audit_pedidos
    AFTER INSERT OR UPDATE OR DELETE ON pedidos
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- =============================================================================
-- VISTAS
-- =============================================================================

CREATE VIEW v_produccion_diaria AS
SELECT
    DATE_TRUNC('day', r.ts)                          AS dia,
    a.crotal_oficial,
    a.id                                             AS animal_id,
    l.numero                                         AS num_lactacion,
    l.fecha_parto,
    (CURRENT_DATE - l.fecha_parto)                   AS dias_en_leche,
    COUNT(r.ts)                                      AS num_ordenos,
    ROUND(SUM(r.produccion_kg)::NUMERIC, 2)          AS produccion_total_kg,
    ROUND(AVG(r.conductividad)::NUMERIC, 2)          AS conductividad_media,
    MAX(r.scc)                                       AS scc_max
FROM lecturas_robot_ordeno r
JOIN animales   a ON r.animal_id   = a.id
LEFT JOIN lactaciones l ON r.lactacion_id = l.id
GROUP BY 1, 2, 3, 4, 5, 6;

CREATE VIEW v_vacas_en_retirada AS
SELECT
    a.crotal_oficial,
    a.nombre,
    es.tipo_patologia,
    es.farmaco,
    es.periodo_retirada_hasta,
    (es.periodo_retirada_hasta - CURRENT_DATE) AS dias_restantes
FROM eventos_sanitarios es
JOIN animales a ON es.animal_id = a.id
WHERE es.periodo_retirada_hasta >= CURRENT_DATE
ORDER BY es.periodo_retirada_hasta;

CREATE VIEW v_tratamientos_pendientes AS
SELECT
    a.crotal_oficial,
    a.nombre,
    ta.farmaco,
    ta.fecha_fin_prevista,
    ta.checkboxes,
    ta.id AS tratamiento_id
FROM tratamientos_activos ta
JOIN animales a ON ta.animal_id = a.id
WHERE ta.activo = TRUE
ORDER BY ta.fecha_fin_prevista;
