"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Beef,
  CalendarDays,
  Edit3,
  Factory,
  MapPin,
  Milk,
  Save,
  ShieldAlert,
  Stethoscope,
  UserRoundCog,
  Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Pagination } from "@/components/common/Pagination";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { can, roleDisplayName, type Capability } from "@/lib/role-capabilities";
import type { Animal, Employee, EmployeeRol, Lactation, Machinery, Treatment, UserRole, Zone } from "@/lib/types";
import { displayZoneName, visualZoneOptions } from "@/lib/visual-zones";
import { useAppStore } from "@/store/app-store";

const MGMT_LIST_PAGE_SIZE = 20;

type SectionId = "animals" | "zones" | "lactations" | "treatments" | "employees" | "machinery";

type AnimalForm = {
  crotal_oficial: string;
  nombre: string;
  sexo: string;
  fecha_nacimiento: string;
  raza: string;
  estado: Animal["estado"];
  estado_reproductivo: string;
  fecha_entrada: string;
  notas: string;
};

type ZoneForm = {
  nombre: string;
  codigo: string;
  descripcion: string;
  tipo: string;
  tiene_pantalla_tv: boolean;
  tiene_tablet: boolean;
  activa: boolean;
};

type LactationForm = {
  animal_id: string;
  numero_lactacion: string;
  fecha_inicio: string;
  fecha_fin: string;
  produccion_promedio: string;
  produccion_total: string;
  grasa_promedio: string;
  proteina_promedio: string;
  rcs_promedio: string;
  activa: boolean;
};

type TreatmentForm = {
  animal_id: string;
  medicamento: string;
  dosis: string;
  via_administracion: string;
  fecha_inicio: string;
  fecha_fin: string;
  periodo_retirada_dias: string;
  fecha_fin_retirada: string;
  activo: boolean;
  motivo: string;
  veterinario: string;
  observaciones: string;
};

type EmployeeForm = {
  nombre: string;
  apellidos: string;
  role: EmployeeRol;
  activo: boolean;
};

type MachineryForm = {
  nombre: string;
  tipo: string;
  zona_id: string;
  estado: string;
  proxima_revision: string;
  observaciones: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const numberOrUndefined = (value: string) => (value.trim() === "" ? undefined : Number(value));
const emptyToUndefined = (value: string) => (value.trim() === "" ? undefined : value.trim());

const blankAnimal = (): AnimalForm => ({
  crotal_oficial: "",
  nombre: "",
  sexo: "hembra",
  fecha_nacimiento: today(),
  raza: "Frisona",
  estado: "recria",
  estado_reproductivo: "",
  fecha_entrada: today(),
  notas: "",
});

const blankZone = (): ZoneForm => ({
  nombre: "",
  codigo: "",
  descripcion: "",
  tipo: "operativa",
  tiene_pantalla_tv: true,
  tiene_tablet: true,
  activa: true,
});

const blankLactation = (): LactationForm => ({
  animal_id: "",
  numero_lactacion: "1",
  fecha_inicio: today(),
  fecha_fin: "",
  produccion_promedio: "",
  produccion_total: "",
  grasa_promedio: "",
  proteina_promedio: "",
  rcs_promedio: "",
  activa: true,
});

const blankTreatment = (): TreatmentForm => ({
  animal_id: "",
  medicamento: "",
  dosis: "",
  via_administracion: "intramamaria",
  fecha_inicio: today(),
  fecha_fin: "",
  periodo_retirada_dias: "",
  fecha_fin_retirada: "",
  activo: true,
  motivo: "",
  veterinario: "",
  observaciones: "",
});

const blankEmployee = (): EmployeeForm => ({
  nombre: "",
  apellidos: "",
  role: "auxiliar",
  activo: true,
});

const blankMachinery = (): MachineryForm => ({
  nombre: "",
  tipo: "ordeno",
  zona_id: "",
  estado: "operativa",
  proxima_revision: "",
  observaciones: "",
});

const sections: {
  id: SectionId;
  label: string;
  permission: Capability;
  Icon: typeof Beef;
}[] = [
  { id: "animals", label: "Animales", permission: "manage_animals", Icon: Beef },
  { id: "zones", label: "Zonas", permission: "manage_zones", Icon: MapPin },
  { id: "lactations", label: "Lactaciones", permission: "manage_lactations", Icon: Milk },
  { id: "treatments", label: "Tratamientos", permission: "manage_treatments", Icon: Stethoscope },
  { id: "employees", label: "Empleados", permission: "manage_employees", Icon: UserRoundCog },
  { id: "machinery", label: "Maquinaria", permission: "manage_machinery", Icon: Factory },
];

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.14em] text-app-dim">
        {label}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-[10px] border border-app-border bg-white px-3 text-sm font-semibold text-app-text outline-none transition placeholder:text-app-dim focus:border-brand disabled:opacity-50"
      />
    </label>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.14em] text-app-dim">
        {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-11 w-full rounded-[10px] border border-app-border bg-white px-3 text-sm font-semibold text-app-text outline-none transition focus:border-brand disabled:opacity-50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex h-11 items-center justify-between rounded-[10px] border px-3 text-sm font-bold transition disabled:opacity-50 ${
        checked
          ? "border-brand/25 bg-brand/10 text-brand"
          : "border-app-border bg-white text-app-dim"
      }`}
    >
      <span>{label}</span>
      <span className={`h-3 w-3 rounded-full ${checked ? "bg-brand" : "bg-app-dim"}`} />
    </button>
  );
}

function PermissionNotice({ role, permission }: { role: UserRole | undefined; permission: Capability }) {
  if (can(role, permission)) return null;
  return (
    <div className="flex items-start gap-2 rounded-[10px] border border-state-atencion/30 bg-state-atencion/10 px-3 py-3 text-sm font-semibold text-state-atencion">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <span>Tu rol actual ({roleDisplayName(role)}) puede consultar estos datos, pero no modificarlos.</span>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  count,
  editingItem,
  onClearEdit,
  children,
}: {
  title: string;
  subtitle: string;
  count?: number | null;
  editingItem?: boolean;
  onClearEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[10px] border border-app-border bg-white shadow-card">
      <div className="border-b border-app-border px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-base font-bold text-app-text">{title}</h2>
              {count != null && (
                <span className="rounded-full bg-app-surface2 px-2 py-0.5 text-[11px] font-bold text-app-dim">
                  {count} registros
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-app-dim">{subtitle}</p>
          </div>
          {editingItem && onClearEdit && (
            <button
              type="button"
              onClick={onClearEdit}
              className="text-xs font-semibold text-app-dim hover:text-app-text"
            >
              + Nuevo
            </button>
          )}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function SaveButton({ isPending, editing }: { isPending: boolean; editing: boolean }) {
  return (
    <button
      type="submit"
      disabled={isPending}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-brand px-5 text-sm font-bold text-white shadow-brand transition hover:bg-[#135532] disabled:opacity-50"
    >
      <Save className="h-4 w-4" />
      {isPending ? "Guardando..." : editing ? "Guardar cambios" : "Crear registro"}
    </button>
  );
}

function EditButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-app-bg text-app-dim transition hover:text-brand disabled:opacity-40"
      title="Editar"
    >
      <Edit3 className="h-3.5 w-3.5" />
    </button>
  );
}

export default function ManagementPage() {
  const queryClient = useQueryClient();
  const role = useAppStore((state) => state.user?.role);
  const toast = useToast();
  const [section, setSection] = useState<SectionId>("animals");
  const [listPage, setListPage] = useState(1);

  // Resetear paginación al cambiar de sección
  const handleSectionChange = (id: SectionId) => {
    setSection(id);
    setListPage(1);
  };

  const [animalForm, setAnimalForm] = useState<AnimalForm>(() => blankAnimal());
  const [editingAnimal, setEditingAnimal] = useState<Animal | null>(null);
  const [zoneForm, setZoneForm] = useState<ZoneForm>(() => blankZone());
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [lactationForm, setLactationForm] = useState<LactationForm>(() => blankLactation());
  const [editingLactation, setEditingLactation] = useState<Lactation | null>(null);
  const [treatmentForm, setTreatmentForm] = useState<TreatmentForm>(() => blankTreatment());
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);
  const [employeeForm, setEmployeeForm] = useState<EmployeeForm>(() => blankEmployee());
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [machineryForm, setMachineryForm] = useState<MachineryForm>(() => blankMachinery());
  const [editingMachinery, setEditingMachinery] = useState<Machinery | null>(null);

  const animalsQuery = useQuery({
    queryKey: ["management-animals"],
    queryFn: () => api.animals({ limit: 500 }),
    staleTime: 30_000,
  });
  const zonesQuery = useQuery({ queryKey: ["management-zones"], queryFn: api.zones, staleTime: 60_000 });
  const lactationsQuery = useQuery({
    queryKey: ["management-lactations"],
    queryFn: () => api.lactations({ limit: 500 }),
    staleTime: 30_000,
  });
  const treatmentsQuery = useQuery({
    queryKey: ["management-treatments"],
    queryFn: () => api.treatments({ limit: 500 }),
    staleTime: 30_000,
  });
  const employeesQuery = useQuery({
    queryKey: ["management-employees"],
    queryFn: () => api.employees(),
    staleTime: 30_000,
  });
  const machineryQuery = useQuery({
    queryKey: ["management-machinery"],
    queryFn: () => api.machinery({ limit: 500 }),
    staleTime: 30_000,
  });

  const animals = useMemo(() => animalsQuery.data ?? [], [animalsQuery.data]);
  const zones = useMemo(() => zonesQuery.data ?? [], [zonesQuery.data]);
  const visibleZoneOptions = useMemo(() => visualZoneOptions(zones), [zones]);

  const animalOptions = useMemo(
    () => animals.map((animal) => ({ value: animal.id, label: `${animal.crotal_oficial} - ${animal.nombre ?? "Sin nombre"}` })),
    [animals],
  );
  const zoneOptions = useMemo(
    () => [
      { value: "", label: "Sin zona asignada" },
      ...visibleZoneOptions.map((zone) => ({ value: zone.id, label: zone.nombre })),
    ],
    [visibleZoneOptions],
  );

  const animalMutation = useMutation({
    mutationFn: () => {
      const payload: Partial<Animal> = {
        ...animalForm,
        nombre: emptyToUndefined(animalForm.nombre),
        raza: emptyToUndefined(animalForm.raza),
        estado_reproductivo: emptyToUndefined(animalForm.estado_reproductivo),
        notas: emptyToUndefined(animalForm.notas),
      };
      return editingAnimal ? api.updateAnimal(editingAnimal.id, payload) : api.createAnimal(payload);
    },
    onSuccess: () => {
      toast.success(editingAnimal ? "Animal actualizado" : "Animal creado");
      setAnimalForm(blankAnimal());
      setEditingAnimal(null);
      queryClient.invalidateQueries({ queryKey: ["management-animals"] });
      queryClient.invalidateQueries({ queryKey: ["animals"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (err: Error) => toast.error(err.message || "Error al guardar el animal"),
  });

  const zoneMutation = useMutation({
    mutationFn: () => {
      const payload: Partial<Zone> = {
        ...zoneForm,
        descripcion: emptyToUndefined(zoneForm.descripcion),
        tipo: emptyToUndefined(zoneForm.tipo),
      };
      return editingZone ? api.updateZone(editingZone.id, payload) : api.createZone(payload);
    },
    onSuccess: () => {
      toast.success(editingZone ? "Zona actualizada" : "Zona creada");
      setZoneForm(blankZone());
      setEditingZone(null);
      queryClient.invalidateQueries({ queryKey: ["management-zones"] });
      queryClient.invalidateQueries({ queryKey: ["zones"] });
    },
    onError: (err: Error) => toast.error(err.message || "Error al guardar la zona"),
  });

  const lactationMutation = useMutation({
    mutationFn: () => {
      const payload: Partial<Lactation> = {
        animal_id: lactationForm.animal_id,
        numero_lactacion: numberOrUndefined(lactationForm.numero_lactacion),
        fecha_inicio: emptyToUndefined(lactationForm.fecha_inicio),
        fecha_fin: emptyToUndefined(lactationForm.fecha_fin),
        produccion_promedio: numberOrUndefined(lactationForm.produccion_promedio),
        produccion_total: numberOrUndefined(lactationForm.produccion_total),
        grasa_promedio: numberOrUndefined(lactationForm.grasa_promedio),
        proteina_promedio: numberOrUndefined(lactationForm.proteina_promedio),
        rcs_promedio: numberOrUndefined(lactationForm.rcs_promedio),
        activa: lactationForm.activa,
      };
      return editingLactation
        ? api.updateLactation(editingLactation.id, payload)
        : api.createLactation(payload);
    },
    onSuccess: () => {
      toast.success(editingLactation ? "Lactación actualizada" : "Lactación registrada");
      setLactationForm(blankLactation());
      setEditingLactation(null);
      queryClient.invalidateQueries({ queryKey: ["management-lactations"] });
      queryClient.invalidateQueries({ queryKey: ["animals-produccion-quality"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (err: Error) => toast.error(err.message || "Error al guardar la lactación"),
  });

  const treatmentMutation = useMutation({
    mutationFn: () => {
      const payload: Partial<Treatment> = {
        animal_id: treatmentForm.animal_id,
        medicamento: emptyToUndefined(treatmentForm.medicamento),
        dosis: emptyToUndefined(treatmentForm.dosis),
        via_administracion: emptyToUndefined(treatmentForm.via_administracion),
        fecha_inicio: treatmentForm.fecha_inicio,
        fecha_fin: emptyToUndefined(treatmentForm.fecha_fin),
        periodo_retirada_dias: numberOrUndefined(treatmentForm.periodo_retirada_dias),
        fecha_fin_retirada: emptyToUndefined(treatmentForm.fecha_fin_retirada),
        activo: treatmentForm.activo,
        motivo: emptyToUndefined(treatmentForm.motivo),
        veterinario: emptyToUndefined(treatmentForm.veterinario),
        observaciones: emptyToUndefined(treatmentForm.observaciones),
      };
      return editingTreatment
        ? api.updateTreatment(editingTreatment.id, payload)
        : api.createTreatment(payload);
    },
    onSuccess: () => {
      toast.success(editingTreatment ? "Tratamiento actualizado" : "Tratamiento registrado");
      setTreatmentForm(blankTreatment());
      setEditingTreatment(null);
      queryClient.invalidateQueries({ queryKey: ["management-treatments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (err: Error) => toast.error(err.message || "Error al guardar el tratamiento"),
  });

  const employeeMutation = useMutation({
    mutationFn: () => {
      const payload: Partial<Employee> = {
        nombre: employeeForm.nombre,
        apellidos: emptyToUndefined(employeeForm.apellidos),
        role: employeeForm.role,
        activo: employeeForm.activo,
      };
      return editingEmployee
        ? api.updateEmployee(editingEmployee.id, payload)
        : api.createEmployee(payload);
    },
    onSuccess: () => {
      toast.success(editingEmployee ? "Empleado actualizado" : "Empleado creado");
      setEmployeeForm(blankEmployee());
      setEditingEmployee(null);
      queryClient.invalidateQueries({ queryKey: ["management-employees"] });
    },
    onError: (err: Error) => toast.error(err.message || "Error al guardar el empleado"),
  });

  const machineryMutation = useMutation({
    mutationFn: () => {
      const payload: Partial<Machinery> = {
        nombre: machineryForm.nombre,
        tipo: machineryForm.tipo,
        zona_id: emptyToUndefined(machineryForm.zona_id),
        estado: machineryForm.estado,
        proxima_revision: emptyToUndefined(machineryForm.proxima_revision),
        observaciones: emptyToUndefined(machineryForm.observaciones),
      };
      return editingMachinery
        ? api.updateMachinery(editingMachinery.id, payload)
        : api.createMachinery(payload);
    },
    onSuccess: () => {
      toast.success(editingMachinery ? "Maquinaria actualizada" : "Maquinaria creada");
      setMachineryForm(blankMachinery());
      setEditingMachinery(null);
      queryClient.invalidateQueries({ queryKey: ["management-machinery"] });
    },
    onError: (err: Error) => toast.error(err.message || "Error al guardar la maquinaria"),
  });

  const active = sections.find((item) => item.id === section) ?? sections[0];
  const canEditActive = can(role, active.permission);

  // Record counts for section tabs
  const sectionCounts: Record<SectionId, number | null> = {
    animals: animalsQuery.data?.length ?? null,
    zones: visibleZoneOptions.length || null,
    lactations: lactationsQuery.data?.length ?? null,
    treatments: treatmentsQuery.data?.length ?? null,
    employees: employeesQuery.data?.length ?? null,
    machinery: machineryQuery.data?.length ?? null,
  };

  return (
    <div className="min-h-full">
      <PageHeader eyebrow="Operación de datos" title="Gestión" EyebrowIcon={Wrench}>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-app-border bg-white px-3 py-1.5 text-sm font-bold text-app-text">
            Rol: {roleDisplayName(role)}
          </span>
        </div>
      </PageHeader>

      <div className="space-y-6 px-6 py-6 lg:px-8">
        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
          {sections.map(({ id, label, Icon, permission }) => {
            const selected = section === id;
            const allowed = can(role, permission);
            const count = sectionCounts[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleSectionChange(id)}
                className={`rounded-[10px] border px-3 py-3 text-left transition ${
                  selected
                    ? "border-brand/30 bg-brand/8"
                    : "border-app-border bg-white text-app-dim hover:bg-app-bg hover:text-app-text"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <Icon className={`h-4 w-4 ${selected ? "text-brand" : allowed ? "text-app-dim" : "text-state-atencion"}`} />
                  {!allowed ? <ShieldAlert className="h-3.5 w-3.5 text-state-atencion" /> : count != null ? (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${selected ? "bg-brand/15 text-brand" : "bg-app-surface2 text-app-dim"}`}>{count}</span>
                  ) : null}
                </div>
                <div className={`mt-2 text-sm font-bold ${selected ? "text-brand" : ""}`}>{label}</div>
              </button>
            );
          })}
        </div>

        <PermissionNotice role={role} permission={active.permission} />

        {section === "animals" && (
          <Panel title="Animales" subtitle="Alta y edicion del censo activo. Requiere admin o veterinario." count={animalsQuery.data?.length} editingItem={!!editingAnimal} onClearEdit={() => { setEditingAnimal(null); setAnimalForm(blankAnimal()); }}>
            <form
              className="grid gap-3 lg:grid-cols-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (canEditActive) animalMutation.mutate();
              }}
            >
              <TextField label="Crotal oficial" value={animalForm.crotal_oficial} required disabled={!canEditActive} onChange={(value) => setAnimalForm({ ...animalForm, crotal_oficial: value })} />
              <TextField label="Nombre" value={animalForm.nombre} disabled={!canEditActive} onChange={(value) => setAnimalForm({ ...animalForm, nombre: value })} />
              <SelectField label="Estado" value={animalForm.estado} disabled={!canEditActive} onChange={(value) => setAnimalForm({ ...animalForm, estado: value })} options={[
                { value: "recria", label: "Recria" },
                { value: "crianza", label: "Crianza" },
                { value: "produccion", label: "Produccion" },
                { value: "seca", label: "Seca" },
                { value: "gestante", label: "Gestante" },
                { value: "baja", label: "Baja" },
              ]} />
              <SelectField label="Sexo" value={animalForm.sexo} disabled={!canEditActive} onChange={(value) => setAnimalForm({ ...animalForm, sexo: value })} options={[
                { value: "hembra", label: "Hembra" },
                { value: "macho", label: "Macho" },
              ]} />
              <TextField type="date" label="Nacimiento" value={animalForm.fecha_nacimiento} disabled={!canEditActive} onChange={(value) => setAnimalForm({ ...animalForm, fecha_nacimiento: value })} />
              <TextField label="Raza" value={animalForm.raza} disabled={!canEditActive} onChange={(value) => setAnimalForm({ ...animalForm, raza: value })} />
              <TextField label="Estado reproductivo" value={animalForm.estado_reproductivo} disabled={!canEditActive} onChange={(value) => setAnimalForm({ ...animalForm, estado_reproductivo: value })} />
              <TextField type="date" label="Entrada" value={animalForm.fecha_entrada} disabled={!canEditActive} onChange={(value) => setAnimalForm({ ...animalForm, fecha_entrada: value })} />
              <div className="lg:col-span-4">
                <TextField label="Notas" value={animalForm.notas} disabled={!canEditActive} onChange={(value) => setAnimalForm({ ...animalForm, notas: value })} />
              </div>
              <div className="flex flex-wrap gap-3 lg:col-span-4">
                {canEditActive && <SaveButton isPending={animalMutation.isPending} editing={Boolean(editingAnimal)} />}
                {editingAnimal && (
                  <button type="button" onClick={() => { setEditingAnimal(null); setAnimalForm(blankAnimal()); }} className="h-11 rounded-[10px] border border-app-border px-4 text-sm font-bold text-app-dim hover:text-app-text">
                    Cancelar edicion
                  </button>
                )}
              </div>
            </form>
            {animalMutation.isError && <p className="mt-3 text-sm font-semibold text-state-critica">{animalMutation.error.message}</p>}
            <div className="mt-6 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {animals.slice((listPage - 1) * MGMT_LIST_PAGE_SIZE, listPage * MGMT_LIST_PAGE_SIZE).map((animal) => (
                <div key={animal.id} className="flex items-center justify-between gap-3 rounded-[10px] bg-app-bg px-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-app-text">{animal.crotal_oficial} - {animal.nombre ?? "Sin nombre"}</p>
                    <p className="text-xs capitalize text-app-dim">{animal.estado}</p>
                  </div>
                  <EditButton disabled={!canEditActive} onClick={() => {
                    setEditingAnimal(animal);
                    setAnimalForm({
                      crotal_oficial: animal.crotal_oficial,
                      nombre: animal.nombre ?? "",
                      sexo: animal.sexo,
                      fecha_nacimiento: animal.fecha_nacimiento,
                      raza: animal.raza ?? "",
                      estado: animal.estado,
                      estado_reproductivo: animal.estado_reproductivo ?? "",
                      fecha_entrada: animal.fecha_entrada,
                      notas: animal.notas ?? "",
                    });
                  }} />
                </div>
              ))}
            </div>
            {animals.length > MGMT_LIST_PAGE_SIZE && (
              <div className="mt-4">
                <Pagination page={listPage} pageSize={MGMT_LIST_PAGE_SIZE}
                  currentCount={animals.slice((listPage - 1) * MGMT_LIST_PAGE_SIZE, listPage * MGMT_LIST_PAGE_SIZE).length}
                  totalItems={animals.length} isLoading={animalsQuery.isFetching} onPageChange={setListPage} />
              </div>
            )}
          </Panel>
        )}

        {section === "zones" && (
          <Panel title="Zonas" subtitle="Configuracion de subzonas visibles: Recria y Nave." count={visibleZoneOptions.length} editingItem={!!editingZone} onClearEdit={() => { setEditingZone(null); setZoneForm(blankZone()); }}>
            <form className="grid gap-3 lg:grid-cols-4" onSubmit={(event) => { event.preventDefault(); if (canEditActive) zoneMutation.mutate(); }}>
              <TextField label="Nombre" value={zoneForm.nombre} required disabled={!canEditActive} onChange={(value) => setZoneForm({ ...zoneForm, nombre: value })} />
              <TextField label="Codigo" value={zoneForm.codigo} required disabled={!canEditActive} onChange={(value) => setZoneForm({ ...zoneForm, codigo: value.toUpperCase() })} />
              <TextField label="Tipo" value={zoneForm.tipo} disabled={!canEditActive} onChange={(value) => setZoneForm({ ...zoneForm, tipo: value })} />
              <TextField label="Descripcion" value={zoneForm.descripcion} disabled={!canEditActive} onChange={(value) => setZoneForm({ ...zoneForm, descripcion: value })} />
              <ToggleField label="TV" checked={zoneForm.tiene_pantalla_tv} disabled={!canEditActive} onChange={(value) => setZoneForm({ ...zoneForm, tiene_pantalla_tv: value })} />
              <ToggleField label="Tablet" checked={zoneForm.tiene_tablet} disabled={!canEditActive} onChange={(value) => setZoneForm({ ...zoneForm, tiene_tablet: value })} />
              <ToggleField label="Activa" checked={zoneForm.activa} disabled={!canEditActive} onChange={(value) => setZoneForm({ ...zoneForm, activa: value })} />
              <div className="flex flex-wrap gap-3">
                {canEditActive && <SaveButton isPending={zoneMutation.isPending} editing={Boolean(editingZone)} />}
                {editingZone && <button type="button" onClick={() => { setEditingZone(null); setZoneForm(blankZone()); }} className="h-11 rounded-[10px] border border-app-border px-4 text-sm font-bold text-app-dim hover:text-app-text">Cancelar</button>}
              </div>
            </form>
            {zoneMutation.isError && <p className="mt-3 text-sm font-semibold text-state-critica">{zoneMutation.error.message}</p>}
            <div className="mt-6 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {visibleZoneOptions.map((zone) => {
                const rawZone = zones.find((item) => item.id === zone.id);
                if (!rawZone) return null;
                return (
                <div key={zone.id} className="flex items-center justify-between gap-3 rounded-[10px] bg-app-bg px-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-app-text">{displayZoneName(rawZone) ?? zone.nombre}</p>
                    <p className="text-xs text-app-dim">{rawZone.tipo ?? "operativa"}</p>
                  </div>
                  <EditButton disabled={!canEditActive} onClick={() => {
                    setEditingZone(rawZone);
                    setZoneForm({
                      nombre: displayZoneName(rawZone) ?? rawZone.nombre,
                      codigo: rawZone.codigo,
                      descripcion: rawZone.descripcion ?? "",
                      tipo: rawZone.tipo ?? "",
                      tiene_pantalla_tv: rawZone.tiene_pantalla_tv,
                      tiene_tablet: rawZone.tiene_tablet,
                      activa: rawZone.activa ?? true,
                    });
                  }} />
                </div>
              );})}
            </div>
          </Panel>
        )}

        {section === "lactations" && (
          <Panel title="Lactaciones" subtitle="Registros productivos y composicion de leche." count={lactationsQuery.data?.length} editingItem={!!editingLactation} onClearEdit={() => { setEditingLactation(null); setLactationForm(blankLactation()); }}>
            <form className="grid gap-3 lg:grid-cols-5" onSubmit={(event) => { event.preventDefault(); if (canEditActive) lactationMutation.mutate(); }}>
              <SelectField label="Animal" value={lactationForm.animal_id} disabled={!canEditActive} onChange={(value) => setLactationForm({ ...lactationForm, animal_id: value })} options={[{ value: "", label: "Seleccionar animal" }, ...animalOptions]} />
              <TextField label="Numero" value={lactationForm.numero_lactacion} type="number" disabled={!canEditActive} onChange={(value) => setLactationForm({ ...lactationForm, numero_lactacion: value })} />
              <TextField label="Inicio" value={lactationForm.fecha_inicio} type="date" disabled={!canEditActive} onChange={(value) => setLactationForm({ ...lactationForm, fecha_inicio: value })} />
              <TextField label="Fin" value={lactationForm.fecha_fin} type="date" disabled={!canEditActive} onChange={(value) => setLactationForm({ ...lactationForm, fecha_fin: value })} />
              <ToggleField label="Activa" checked={lactationForm.activa} disabled={!canEditActive} onChange={(value) => setLactationForm({ ...lactationForm, activa: value })} />
              <TextField label="Promedio L" value={lactationForm.produccion_promedio} type="number" disabled={!canEditActive} onChange={(value) => setLactationForm({ ...lactationForm, produccion_promedio: value })} />
              <TextField label="Total L" value={lactationForm.produccion_total} type="number" disabled={!canEditActive} onChange={(value) => setLactationForm({ ...lactationForm, produccion_total: value })} />
              <TextField label="Grasa %" value={lactationForm.grasa_promedio} type="number" disabled={!canEditActive} onChange={(value) => setLactationForm({ ...lactationForm, grasa_promedio: value })} />
              <TextField label="Proteina %" value={lactationForm.proteina_promedio} type="number" disabled={!canEditActive} onChange={(value) => setLactationForm({ ...lactationForm, proteina_promedio: value })} />
              <TextField label="RCS" value={lactationForm.rcs_promedio} type="number" disabled={!canEditActive} onChange={(value) => setLactationForm({ ...lactationForm, rcs_promedio: value })} />
              <div className="flex flex-wrap gap-3 lg:col-span-5">
                {canEditActive && <SaveButton isPending={lactationMutation.isPending} editing={Boolean(editingLactation)} />}
                {editingLactation && <button type="button" onClick={() => { setEditingLactation(null); setLactationForm(blankLactation()); }} className="h-11 rounded-[10px] border border-app-border px-4 text-sm font-bold text-app-dim hover:text-app-text">Cancelar</button>}
              </div>
            </form>
            {lactationMutation.isError && <p className="mt-3 text-sm font-semibold text-state-critica">{lactationMutation.error.message}</p>}
            <div className="mt-6 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {(lactationsQuery.data ?? []).slice((listPage - 1) * MGMT_LIST_PAGE_SIZE, listPage * MGMT_LIST_PAGE_SIZE).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-[10px] bg-app-bg px-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-app-text">{item.animal_id} - {item.produccion_promedio ?? 0} L</p>
                    <p className="text-xs text-app-dim">Grasa {item.grasa_promedio ?? "-"} / RCS {item.rcs_promedio ?? "-"}</p>
                  </div>
                  <EditButton disabled={!canEditActive} onClick={() => {
                    setEditingLactation(item);
                    setLactationForm({
                      animal_id: item.animal_id,
                      numero_lactacion: String(item.numero_lactacion ?? ""),
                      fecha_inicio: item.fecha_inicio ?? "",
                      fecha_fin: item.fecha_fin ?? "",
                      produccion_promedio: String(item.produccion_promedio ?? ""),
                      produccion_total: String(item.produccion_total ?? ""),
                      grasa_promedio: String(item.grasa_promedio ?? ""),
                      proteina_promedio: String(item.proteina_promedio ?? ""),
                      rcs_promedio: String(item.rcs_promedio ?? ""),
                      activa: item.activa ?? true,
                    });
                  }} />
                </div>
              ))}
            </div>
            {(lactationsQuery.data?.length ?? 0) > MGMT_LIST_PAGE_SIZE && (
              <div className="mt-4">
                <Pagination page={listPage} pageSize={MGMT_LIST_PAGE_SIZE}
                  currentCount={(lactationsQuery.data ?? []).slice((listPage - 1) * MGMT_LIST_PAGE_SIZE, listPage * MGMT_LIST_PAGE_SIZE).length}
                  totalItems={lactationsQuery.data?.length} isLoading={lactationsQuery.isFetching} onPageChange={setListPage} />
              </div>
            )}
          </Panel>
        )}

        {section === "treatments" && (
          <Panel title="Tratamientos" subtitle="Alta y edicion sanitaria. Requiere admin o veterinario." count={treatmentsQuery.data?.length} editingItem={!!editingTreatment} onClearEdit={() => { setEditingTreatment(null); setTreatmentForm(blankTreatment()); }}>
            <form className="grid gap-3 lg:grid-cols-4" onSubmit={(event) => { event.preventDefault(); if (canEditActive) treatmentMutation.mutate(); }}>
              <SelectField label="Animal" value={treatmentForm.animal_id} disabled={!canEditActive} onChange={(value) => setTreatmentForm({ ...treatmentForm, animal_id: value })} options={[{ value: "", label: "Seleccionar animal" }, ...animalOptions]} />
              <TextField label="Medicamento" value={treatmentForm.medicamento} required disabled={!canEditActive} onChange={(value) => setTreatmentForm({ ...treatmentForm, medicamento: value })} />
              <TextField label="Dosis" value={treatmentForm.dosis} disabled={!canEditActive} onChange={(value) => setTreatmentForm({ ...treatmentForm, dosis: value })} />
              <TextField label="Via" value={treatmentForm.via_administracion} disabled={!canEditActive} onChange={(value) => setTreatmentForm({ ...treatmentForm, via_administracion: value })} />
              <TextField label="Inicio" value={treatmentForm.fecha_inicio} type="date" disabled={!canEditActive} onChange={(value) => setTreatmentForm({ ...treatmentForm, fecha_inicio: value })} />
              <TextField label="Fin" value={treatmentForm.fecha_fin} type="date" disabled={!canEditActive} onChange={(value) => setTreatmentForm({ ...treatmentForm, fecha_fin: value })} />
              <TextField label="Retirada dias" value={treatmentForm.periodo_retirada_dias} type="number" disabled={!canEditActive} onChange={(value) => setTreatmentForm({ ...treatmentForm, periodo_retirada_dias: value })} />
              <TextField label="Fin retirada" value={treatmentForm.fecha_fin_retirada} type="date" disabled={!canEditActive} onChange={(value) => setTreatmentForm({ ...treatmentForm, fecha_fin_retirada: value })} />
              <TextField label="Motivo" value={treatmentForm.motivo} disabled={!canEditActive} onChange={(value) => setTreatmentForm({ ...treatmentForm, motivo: value })} />
              <TextField label="Veterinario" value={treatmentForm.veterinario} disabled={!canEditActive} onChange={(value) => setTreatmentForm({ ...treatmentForm, veterinario: value })} />
              <TextField label="Observaciones" value={treatmentForm.observaciones} disabled={!canEditActive} onChange={(value) => setTreatmentForm({ ...treatmentForm, observaciones: value })} />
              <ToggleField label="Activo" checked={treatmentForm.activo} disabled={!canEditActive} onChange={(value) => setTreatmentForm({ ...treatmentForm, activo: value })} />
              <div className="flex flex-wrap gap-3 lg:col-span-4">
                {canEditActive && <SaveButton isPending={treatmentMutation.isPending} editing={Boolean(editingTreatment)} />}
                {editingTreatment && <button type="button" onClick={() => { setEditingTreatment(null); setTreatmentForm(blankTreatment()); }} className="h-11 rounded-[10px] border border-app-border px-4 text-sm font-bold text-app-dim hover:text-app-text">Cancelar</button>}
              </div>
            </form>
            {treatmentMutation.isError && <p className="mt-3 text-sm font-semibold text-state-critica">{treatmentMutation.error.message}</p>}
            <div className="mt-6 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {(treatmentsQuery.data ?? []).slice((listPage - 1) * MGMT_LIST_PAGE_SIZE, listPage * MGMT_LIST_PAGE_SIZE).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-[10px] bg-app-bg px-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-app-text">{item.medicamento ?? "Tratamiento"} - {item.animal_id}</p>
                    <p className="text-xs text-app-dim">{item.activo ? "Activo" : "Cerrado"}</p>
                  </div>
                  <EditButton disabled={!canEditActive} onClick={() => {
                    setEditingTreatment(item);
                    setTreatmentForm({
                      animal_id: item.animal_id,
                      medicamento: item.medicamento ?? "",
                      dosis: item.dosis ?? "",
                      via_administracion: item.via_administracion ?? "",
                      fecha_inicio: item.fecha_inicio,
                      fecha_fin: item.fecha_fin ?? "",
                      periodo_retirada_dias: String(item.periodo_retirada_dias ?? ""),
                      fecha_fin_retirada: item.fecha_fin_retirada ?? "",
                      activo: item.activo ?? true,
                      motivo: item.motivo ?? "",
                      veterinario: item.veterinario ?? "",
                      observaciones: item.observaciones ?? "",
                    });
                  }} />
                </div>
              ))}
            </div>
            {(treatmentsQuery.data?.length ?? 0) > MGMT_LIST_PAGE_SIZE && (
              <div className="mt-4">
                <Pagination page={listPage} pageSize={MGMT_LIST_PAGE_SIZE}
                  currentCount={(treatmentsQuery.data ?? []).slice((listPage - 1) * MGMT_LIST_PAGE_SIZE, listPage * MGMT_LIST_PAGE_SIZE).length}
                  totalItems={treatmentsQuery.data?.length} isLoading={treatmentsQuery.isFetching} onPageChange={setListPage} />
              </div>
            )}
          </Panel>
        )}

        {section === "employees" && (
          <Panel title="Empleados" subtitle="Alta y edicion de empleados. Requiere admin." count={employeesQuery.data?.length} editingItem={!!editingEmployee} onClearEdit={() => { setEditingEmployee(null); setEmployeeForm(blankEmployee()); }}>
            <form className="grid gap-3 lg:grid-cols-4" onSubmit={(event) => { event.preventDefault(); if (canEditActive) employeeMutation.mutate(); }}>
              <TextField label="Nombre" value={employeeForm.nombre} required disabled={!canEditActive} onChange={(value) => setEmployeeForm({ ...employeeForm, nombre: value })} />
              <TextField label="Apellidos" value={employeeForm.apellidos} disabled={!canEditActive} onChange={(value) => setEmployeeForm({ ...employeeForm, apellidos: value })} />
              <SelectField label="Rol" value={employeeForm.role} disabled={!canEditActive} onChange={(value) => setEmployeeForm({ ...employeeForm, role: value })} options={[
                { value: "encargado", label: "Encargado" },
                { value: "auxiliar", label: "Auxiliar" },
                { value: "veterinario", label: "Veterinario" },
                { value: "mecanico", label: "Mecanico" },
              ]} />
              <ToggleField label="Activo" checked={employeeForm.activo} disabled={!canEditActive} onChange={(value) => setEmployeeForm({ ...employeeForm, activo: value })} />
              <div className="flex flex-wrap gap-3 lg:col-span-4">
                {canEditActive && <SaveButton isPending={employeeMutation.isPending} editing={Boolean(editingEmployee)} />}
                {editingEmployee && <button type="button" onClick={() => { setEditingEmployee(null); setEmployeeForm(blankEmployee()); }} className="h-11 rounded-[10px] border border-app-border px-4 text-sm font-bold text-app-dim hover:text-app-text">Cancelar</button>}
              </div>
            </form>
            {employeeMutation.isError && <p className="mt-3 text-sm font-semibold text-state-critica">{employeeMutation.error.message}</p>}
            <div className="mt-6 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {(employeesQuery.data ?? []).slice((listPage - 1) * MGMT_LIST_PAGE_SIZE, listPage * MGMT_LIST_PAGE_SIZE).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-[10px] bg-app-bg px-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-app-text">{item.nombre} {item.apellidos ?? ""}</p>
                    <p className="text-xs capitalize text-app-dim">{item.role ?? "sin rol"}</p>
                  </div>
                  <EditButton disabled={!canEditActive} onClick={() => {
                    setEditingEmployee(item);
                    setEmployeeForm({
                      nombre: item.nombre,
                      apellidos: item.apellidos ?? "",
                      role: (item.role as EmployeeRol | null) ?? "auxiliar",
                      activo: item.activo ?? true,
                    });
                  }} />
                </div>
              ))}
            </div>
            {(employeesQuery.data?.length ?? 0) > MGMT_LIST_PAGE_SIZE && (
              <div className="mt-4">
                <Pagination page={listPage} pageSize={MGMT_LIST_PAGE_SIZE}
                  currentCount={(employeesQuery.data ?? []).slice((listPage - 1) * MGMT_LIST_PAGE_SIZE, listPage * MGMT_LIST_PAGE_SIZE).length}
                  totalItems={employeesQuery.data?.length} isLoading={employeesQuery.isFetching} onPageChange={setListPage} />
              </div>
            )}
          </Panel>
        )}

        {section === "machinery" && (
          <Panel title="Maquinaria" subtitle="Alta y edicion de equipos por zona. Requiere admin, operario o alimentacion." count={machineryQuery.data?.length} editingItem={!!editingMachinery} onClearEdit={() => { setEditingMachinery(null); setMachineryForm(blankMachinery()); }}>
            <form className="grid gap-3 lg:grid-cols-4" onSubmit={(event) => { event.preventDefault(); if (canEditActive) machineryMutation.mutate(); }}>
              <TextField label="Nombre" value={machineryForm.nombre} required disabled={!canEditActive} onChange={(value) => setMachineryForm({ ...machineryForm, nombre: value })} />
              <TextField label="Tipo" value={machineryForm.tipo} disabled={!canEditActive} onChange={(value) => setMachineryForm({ ...machineryForm, tipo: value })} />
              <SelectField label="Zona" value={machineryForm.zona_id} disabled={!canEditActive} onChange={(value) => setMachineryForm({ ...machineryForm, zona_id: value })} options={zoneOptions} />
              <SelectField label="Estado" value={machineryForm.estado} disabled={!canEditActive} onChange={(value) => setMachineryForm({ ...machineryForm, estado: value })} options={[
                { value: "operativa", label: "Operativa" },
                { value: "revision", label: "Revision" },
                { value: "averiada", label: "Averiada" },
                { value: "inactiva", label: "Inactiva" },
              ]} />
              <TextField label="Proxima revision" value={machineryForm.proxima_revision} type="date" disabled={!canEditActive} onChange={(value) => setMachineryForm({ ...machineryForm, proxima_revision: value })} />
              <div className="lg:col-span-3">
                <TextField label="Observaciones" value={machineryForm.observaciones} disabled={!canEditActive} onChange={(value) => setMachineryForm({ ...machineryForm, observaciones: value })} />
              </div>
              <div className="flex flex-wrap gap-3 lg:col-span-4">
                {canEditActive && <SaveButton isPending={machineryMutation.isPending} editing={Boolean(editingMachinery)} />}
                {editingMachinery && <button type="button" onClick={() => { setEditingMachinery(null); setMachineryForm(blankMachinery()); }} className="h-11 rounded-[10px] border border-app-border px-4 text-sm font-bold text-app-dim hover:text-app-text">Cancelar</button>}
              </div>
            </form>
            {machineryMutation.isError && <p className="mt-3 text-sm font-semibold text-state-critica">{machineryMutation.error.message}</p>}
            <div className="mt-6 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {(machineryQuery.data ?? []).slice((listPage - 1) * MGMT_LIST_PAGE_SIZE, listPage * MGMT_LIST_PAGE_SIZE).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-[10px] bg-app-bg px-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-app-text">{item.nombre}</p>
                    <p className="text-xs capitalize text-app-dim">{item.tipo} - {item.estado}</p>
                  </div>
                  <EditButton disabled={!canEditActive} onClick={() => {
                    setEditingMachinery(item);
                    setMachineryForm({
                      nombre: item.nombre,
                      tipo: item.tipo,
                      zona_id: item.zona_id ?? "",
                      estado: item.estado,
                      proxima_revision: item.proxima_revision ?? "",
                      observaciones: item.observaciones ?? "",
                    });
                  }} />
                </div>
              ))}
            </div>
            {(machineryQuery.data?.length ?? 0) > MGMT_LIST_PAGE_SIZE && (
              <div className="mt-4">
                <Pagination page={listPage} pageSize={MGMT_LIST_PAGE_SIZE}
                  currentCount={(machineryQuery.data ?? []).slice((listPage - 1) * MGMT_LIST_PAGE_SIZE, listPage * MGMT_LIST_PAGE_SIZE).length}
                  totalItems={machineryQuery.data?.length} isLoading={machineryQuery.isFetching} onPageChange={setListPage} />
              </div>
            )}
          </Panel>
        )}

        {(animalsQuery.isError || zonesQuery.isError || lactationsQuery.isError || treatmentsQuery.isError || employeesQuery.isError || machineryQuery.isError) && (
          <div className="rounded-[10px] border border-state-critica/30 bg-state-critica/10 px-4 py-3 text-sm font-semibold text-state-critica">
            Alguna lista no se ha podido cargar. Revisa la sesion o permisos del backend.
          </div>
        )}

        <div className="flex items-center gap-2 rounded-[10px] border border-app-border bg-white px-4 py-3 text-xs font-semibold text-app-dim">
          <CalendarDays className="h-4 w-4" />
          Los cambios se guardan en la API y se refrescan en las pantallas operativas.
        </div>
      </div>
    </div>
  );
}
