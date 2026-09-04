import type { Task, VisualZoneKey, Zone } from "@/lib/types";

export const VISUAL_ZONE_GROUPS: Record<VisualZoneKey, {
  title: string;
  description: string;
  codes: string[];
  subzones: { key: string; label: string; codes: string[]; description?: string }[];
}> = {
  recria: {
    title: "Recria",
    description: "Boxes de terneros y zona de recria.",
    codes: ["boxes_terneros", "zona_recria", "recria"],
    subzones: [
      { key: "boxes", label: "Boxes de terneros", codes: ["boxes_terneros"], description: "Animales provisionales por numero de box." },
      { key: "zona_recria", label: "Zona de recria", codes: ["zona_recria", "recria"], description: "Terneras y novillas con ficha completa." },
    ],
  },
  nave: {
    title: "Nave",
    description: "Patio de alimentacion, enfermeria y maquinaria.",
    codes: ["patio_alimentacion", "enfermeria", "maquinaria", "robots", "sala_ordeno", "silos", "almacen", "oficina", "general"],
    subzones: [
      { key: "patio", label: "Patio de alimentacion", codes: ["patio_alimentacion", "silos", "almacen"], description: "Racion, bebederos, silos y pedidos de alimentacion." },
      { key: "enfermeria", label: "Enfermeria", codes: ["enfermeria"], description: "Tratamientos, retirada y revisiones sanitarias." },
      { key: "maquinaria", label: "Maquinaria", codes: ["maquinaria", "robots", "sala_ordeno", "general", "oficina"], description: "Averias, mantenimientos y estado de equipos." },
    ],
  },
};

export const VISUAL_ZONE_LIST = Object.entries(VISUAL_ZONE_GROUPS).map(([key, value]) => ({
  key: key as VisualZoneKey,
  ...value,
}));

export function idsForZoneCodes(zones: Zone[], codes: string[]) {
  const wanted = new Set(codes);
  return new Set(zones.filter((zone) => wanted.has(zone.codigo)).map((zone) => zone.id));
}

export function displayZoneName(zone?: Pick<Zone, "codigo" | "nombre"> | null) {
  if (!zone) return null;
  for (const visualZone of VISUAL_ZONE_LIST) {
    for (const subzone of visualZone.subzones) {
      if (subzone.codes.includes(zone.codigo)) return subzone.label;
    }
  }
  return zone.nombre;
}

export function visualZoneOptions(zones: Zone[]) {
  return VISUAL_ZONE_LIST.flatMap((visualZone) =>
    visualZone.subzones.flatMap((subzone) => {
      const zone = zones.find((candidate) => subzone.codes.includes(candidate.codigo));
      return zone ? [{ id: zone.id, nombre: subzone.label, codigo: zone.codigo }] : [];
    }),
  );
}

export function visualZoneSummaries<T extends { zona_id?: string | null }>(zones: Zone[], items: T[]) {
  return VISUAL_ZONE_LIST.map((visualZone) => {
    const ids = idsForZoneCodes(zones, visualZone.codes);
    return {
      ...visualZone,
      ids,
      items: items.filter((item) => item.zona_id && ids.has(item.zona_id)),
    };
  });
}

export function taskZoneName(task: Task, zoneLookup?: Map<string, string>) {
  if (task.zona_id && zoneLookup?.has(task.zona_id)) return zoneLookup.get(task.zona_id);
  return task.tarea_catalogo?.zona_aplicable ?? null;
}
