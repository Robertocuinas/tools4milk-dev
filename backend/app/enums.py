"""
Enumeraciones para tipos específicos de PostgreSQL.
"""

from enum import Enum


class EstadoTarea(str, Enum):
    """Estados de tareas (tareas_ejecuciones.estado)."""
    PENDIENTE = "pendiente"
    EN_CURSO = "en_curso"
    COMPLETADA = "completada"
    VENCIDA = "vencida"
    CANCELADA = "cancelada"


class EstadoAnimal(str, Enum):
    """Estados de animales (animales.estado)."""
    PRODUCCION = "produccion"
    SECA = "seca"
    RECRIA = "recria"
    GESTANTE = "gestante"
    BAJA = "baja"


class EstadoPedido(str, Enum):
    """Estados de pedidos (pedidos.estado)."""
    SOLICITADO = "solicitado"
    APROBADO = "aprobado"
    EN_TRANSITO = "en_transito"
    RECIBIDO = "recibido"
    CANCELADO = "cancelado"


class EstadoIncidencia(str, Enum):
    """Estados de incidencias (incidencias.estado)."""
    ABIERTA = "abierta"
    EN_GESTION = "en_gestion"
    RESUELTA = "resuelta"
    CERRADA = "cerrada"


class TipoIncidencia(str, Enum):
    """Tipos de incidencia (incidencias.tipo)."""
    AVERIA_MAQUINARIA = "averia_maquinaria"
    INFRAESTRUCTURA = "infraestructura"
    SANIDAD_ANIMAL = "sanidad_animal"
    CALIDAD_LECHE = "calidad_leche"
    ALIMENTACION = "alimentacion"
    PEDIDOS = "pedidos"


class NivelSeveridad(str, Enum):
    """Niveles de severidad de incidencias (incidencias.severidad)."""
    BAJA = "baja"
    MEDIA = "media"
    ALTA = "alta"


class NivelAlerta(str, Enum):
    """Niveles de alerta (alertas.nivel)."""
    BAJA = "baja"
    MEDIA = "media"
    ALTA = "alta"


class TipoTurno(str, Enum):
    """Tipos de turno (turnos.tipo_turno)."""
    MANANA = "manana"
    TARDE = "tarde"


class RolEmpleado(str, Enum):
    """Roles de empleado (empleados.rol). Mapea al enum nativo
    ``rol_empleado`` de Postgres definido en la migración 0002b."""
    ENCARGADO = "encargado"
    AUXILIAR = "auxiliar"
    VETERINARIO = "veterinario"
    MECANICO = "mecanico"


class TipoMaquinaria(str, Enum):
    """Tipos de maquinaria (maquinaria.tipo). Mapea al enum nativo
    ``tipo_maquinaria`` de Postgres."""
    ROBOT_ORDENO = "robot_ordeno"
    CARRO_MEZCLADOR = "carro_mezclador"
    AMAMANTADORA = "amamantadora"
    BOMBA = "bomba"
    OTRO = "otro"


class SexoAnimal(str, Enum):
    """Sexo del animal (animales.sexo). Mapea al enum nativo
    ``sexo_animal`` de Postgres."""
    HEMBRA = "hembra"
    MACHO = "macho"


class EstadoReproductivo(str, Enum):
    """Estado reproductivo (animales.estado_reproductivo). Mapea al
    enum nativo ``estado_reproductivo`` de Postgres."""
    VACIA = "vacia"
    EN_CELO = "en_celo"
    INSEMINADA = "inseminada"
    CONFIRMADA_GESTANTE = "confirmada_gestante"
    PARTO_RECIENTE = "parto_reciente"


class TipoPatologia(str, Enum):
    """Tipos de patología (eventos_sanitarios.tipo_patologia). Mapea
    al enum nativo ``tipo_patologia`` de Postgres."""
    MASTITIS = "mastitis"
    COJERA = "cojera"
    METRITIS = "metritis"
    CETOSIS = "cetosis"
    DESPLAZAMIENTO_ABOMASO = "desplazamiento_abomaso"
    NEUMONIA = "neumonia"
    DIARREA = "diarrea"
    OTRA = "otra"


class TipoEventoRepro(str, Enum):
    """Tipos de evento reproductivo (eventos_reproductivos.tipo). Mapea
    al enum nativo ``tipo_evento_repro`` de Postgres."""
    CELO = "celo"
    INSEMINACION = "inseminacion"
    DIAGNOSTICO_GESTACION = "diagnostico_gestacion"
    ABORTO = "aborto"
    PARTO = "parto"
    SECADO = "secado"
