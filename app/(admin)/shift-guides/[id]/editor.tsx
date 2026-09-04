"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StepMediaEditor } from "./step-media-editor";
import {
  emptyStep,
  normalizeProcedureContent,
  procedureContentSchema,
  reorder,
  type ProcedureCategory,
  type ProcedureContent,
  type ProcedureStep,
} from "@/lib/ablaeufe/schema";

export const TYPES = [
  ["opening", "Öffnung"],
  ["closing", "Schließung"],
  ["cleaning", "Reinigung"],
  ["control", "Kontrolle"],
  ["production", "Produktion"],
  ["handover", "Übergabe"],
  ["hygiene_temperature", "Hygiene / Temperatur"],
  ["other", "Sonstiges"],
] as const;
const EVIDENCE = [
  ["none", "Kein Nachweis"],
  ["photo", "Foto"],
  ["confirmation", "Bestätigung"],
  ["value", "Messwert"],
] as const;

export const ROLE_LABELS = [
  ["manager", "Filialleiter"],
  ["teamleiter", "Teamleiter"],
  ["mitarbeiter", "Mitarbeiter"],
  ["backoffice", "Backoffice"],
  ["admin", "Admin"],
  ["server", "Service"],
  ["bartender", "Bar"],
  ["cook", "Küche"],
  ["dishwasher", "Spüle"],
] as const;
const ASSIGNMENT_KINDS = [
  ["schicht", "An Schichten (Bereich/Position)"],
  ["rolle", "An eine Rolle (z. B. alle Filialleiter)"],
  ["bereich", "An einen Bereich (z. B. ganze Küche)"],
  ["mitarbeiter", "An bestimmte Mitarbeiter"],
] as const;
const WEEKDAYS = [
  [1, "Mo"], [2, "Di"], [3, "Mi"], [4, "Do"], [5, "Fr"], [6, "Sa"], [7, "So"],
] as const;

const newCategory = (): ProcedureCategory => ({
  id: globalThis.crypto?.randomUUID?.() ?? `category-${Date.now()}`,
  title: "Neuer Abschnitt",
  steps: [],
});

type GuideEditorProps = {
  guide: any;
  departments: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  employees?: { id: string; vorname: string; nachname: string | null; rolle: string }[];
  initialAssigneeIds?: string[];
  basePath: string;
};

export function GuideEditor({
  guide,
  departments,
  locations,
  employees = [],
  initialAssigneeIds = [],
  basePath,
}: GuideEditorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const initial = useMemo(
    () => normalizeProcedureContent(guide.inhalt),
    [guide.inhalt],
  );
  const [form, setForm] = useState({
    title: guide.titel ?? "",
    type:
      guide.ablauf_typ ?? (guide.phase === "closing" ? "closing" : "opening"),
    position: guide.position_typ ?? "",
    departmentId: guide.department_id ?? "",
    locationId: guide.location_id ?? "",
    shiftHint: guide.shift_hint ?? "",
    active: guide.aktiv !== false,
    content: initial,
    assignmentKind: (guide.assignment_kind ?? "schicht") as "schicht" | "rolle" | "mitarbeiter" | "bereich",
    assignedRole: (guide.assigned_role ?? "") as string,
    assignedDepartmentId: (guide.assigned_department_id ?? "") as string,
    assigneeIds: initialAssigneeIds,
    scheduleWeekdays: (guide.schedule_weekdays ?? []) as number[],
    dueTime: (guide.due_time ? String(guide.due_time).slice(0, 5) : "") as string,
  });

  const updateContent = (content: ProcedureContent) =>
    setForm((current) => ({ ...current, content }));
  const updateCategory = (categoryIndex: number, next: ProcedureCategory) =>
    updateContent({
      ...form.content,
      categories: form.content.categories.map((category, index) =>
        index === categoryIndex ? next : category,
      ),
    });
  const updateSteps = (categoryIndex: number, steps: ProcedureStep[]) =>
    updateCategory(categoryIndex, {
      ...form.content.categories[categoryIndex],
      steps,
    });

  async function save(action: "save" | "duplicate") {
    setMessage("");
    if (form.title.trim().length < 2) {
      setMessage("Bitte einen Namen mit mindestens zwei Zeichen eingeben.");
      return;
    }
    const validation = procedureContentSchema.safeParse(form.content);
    const stepCount = form.content.categories.reduce(
      (sum, category) => sum + category.steps.length,
      0,
    );
    if (!validation.success || !stepCount) {
      setMessage(
        validation.error?.issues[0]?.message ??
          "Bitte mindestens einen Schritt anlegen.",
      );
      return;
    }
    startTransition(async () => {
      const response = await fetch(`/api/ablaeufe/guides/${guide.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          departmentId: form.departmentId || null,
          locationId: form.locationId || null,
          assignedRole: form.assignmentKind === "rolle" ? form.assignedRole || null : null,
          assignedDepartmentId: form.assignmentKind === "bereich" ? form.assignedDepartmentId || null : null,
          assigneeIds: form.assignmentKind === "mitarbeiter" ? form.assigneeIds : [],
          scheduleWeekdays: form.scheduleWeekdays,
          dueTime: form.dueTime || null,
          action,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      setMessage(
        action === "duplicate"
          ? "Kopie wurde angelegt."
          : "Ablauf wurde gespeichert.",
      );
      if (action === "duplicate") router.push(`${basePath}/${result.id}`);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-3">
          <Field label="Name des Ablaufs">
            <Input
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
              placeholder="z. B. Barista – Öffnung"
            />
          </Field>
          <Field label="Art">
            <Select
              value={form.type}
              onChange={(value) => setForm({ ...form, type: value })}
              options={TYPES}
            />
          </Field>
          <Field label="Standort">
            <Select
              value={form.locationId}
              onChange={(value) => setForm({ ...form, locationId: value })}
              options={locations.map(
                (location) => [location.id, location.name] as const,
              )}
              empty="Standort wählen"
            />
          </Field>
          <Field label="Bereich">
            <Select
              value={form.departmentId}
              onChange={(value) => setForm({ ...form, departmentId: value })}
              options={departments.map(
                (department) => [department.id, department.name] as const,
              )}
              empty="Standortweit"
            />
          </Field>
          <Field label="Rolle / Position">
            <Input
              value={form.position}
              onChange={(event) =>
                setForm({ ...form, position: event.target.value })
              }
              placeholder="z. B. Barista"
            />
          </Field>
          <Field label="Schicht">
            <Input
              value={form.shiftHint}
              onChange={(event) =>
                setForm({ ...form, shiftHint: event.target.value })
              }
              placeholder="z. B. Frühschicht"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) =>
                setForm({ ...form, active: event.target.checked })
              }
            />{" "}
            Aktiv und für das Team sichtbar
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div>
            <h2 className="text-base font-semibold">Zuordnung</h2>
            <p className="text-sm text-muted-foreground">
              An Schichten gekoppelte Listen erscheinen automatisch zur Schicht.
              Rollen- oder Mitarbeiter-Listen werden jeden Tag als Pflichtaufgabe
              zugeteilt und bei Nichterledigung an die Leitung eskaliert.
            </p>
          </div>
          <Field label="Diese Liste gilt">
            <Select
              value={form.assignmentKind}
              onChange={(value) =>
                setForm({
                  ...form,
                  assignmentKind: value as typeof form.assignmentKind,
                })
              }
              options={ASSIGNMENT_KINDS}
            />
          </Field>
          {form.assignmentKind === "rolle" && (
            <Field label="Rolle">
              <Select
                value={form.assignedRole}
                onChange={(value) => setForm({ ...form, assignedRole: value })}
                options={ROLE_LABELS}
                empty="Rolle wählen"
              />
            </Field>
          )}
          {form.assignmentKind === "bereich" && (
            <Field label="Bereich">
              <Select
                value={form.assignedDepartmentId}
                onChange={(value) =>
                  setForm({ ...form, assignedDepartmentId: value })
                }
                options={departments.map(
                  (department) => [department.id, department.name] as const,
                )}
                empty="Bereich wählen"
              />
            </Field>
          )}
          {form.assignmentKind === "mitarbeiter" && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                Mitarbeiter ({form.assigneeIds.length} ausgewählt)
              </legend>
              <div className="grid max-h-64 gap-1 overflow-y-auto rounded-lg border p-3 sm:grid-cols-2">
                {employees.map((employee) => (
                  <label
                    key={employee.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={form.assigneeIds.includes(employee.id)}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          assigneeIds: event.target.checked
                            ? [...form.assigneeIds, employee.id]
                            : form.assigneeIds.filter(
                                (entry) => entry !== employee.id,
                              ),
                        })
                      }
                    />
                    {employee.vorname} {employee.nachname ?? ""}
                    <span className="text-xs text-muted-foreground">
                      {ROLE_LABELS.find(([value]) => value === employee.rolle)?.[1] ??
                        employee.rolle}
                    </span>
                  </label>
                ))}
                {!employees.length && (
                  <p className="text-sm text-muted-foreground">
                    Keine aktiven Mitarbeiter gefunden.
                  </p>
                )}
              </div>
            </fieldset>
          )}
          {form.assignmentKind !== "schicht" && (
            <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
              <div>
                <span className="text-sm font-semibold">Zeitplan</span>
                <p className="text-sm text-muted-foreground">
                  An welchen Tagen wird die Liste zugeteilt und bis wann muss
                  sie erledigt sein? Ohne Auswahl gilt: jeden Tag bis 18:00.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map(([value, label]) => {
                  const activeDay =
                    !form.scheduleWeekdays.length ||
                    form.scheduleWeekdays.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={activeDay}
                      onClick={() =>
                        setForm({
                          ...form,
                          scheduleWeekdays: (form.scheduleWeekdays.length
                            ? form.scheduleWeekdays.includes(value)
                              ? form.scheduleWeekdays.filter(
                                  (day) => day !== value,
                                )
                              : [...form.scheduleWeekdays, value]
                            : WEEKDAYS.map(([day]) => day).filter(
                                (day) => day !== value,
                              )
                          ).sort((a, b) => a - b),
                        })
                      }
                      className={`h-9 w-11 rounded-lg border text-sm font-semibold transition ${
                        activeDay
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <Field label="Fällig bis (Uhrzeit)">
                <Input
                  className="max-w-40"
                  type="time"
                  value={form.dueTime}
                  onChange={(event) =>
                    setForm({ ...form, dueTime: event.target.value })
                  }
                  placeholder="18:00"
                />
              </Field>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            Abschnitte und Arbeitsschritte
          </h2>
          <p className="text-sm text-muted-foreground">
            Alle Abschnitte bleiben in ihrer Reihenfolge erhalten.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            updateContent({
              ...form.content,
              categories: [...form.content.categories, newCategory()],
            })
          }
        >
          <Plus size={16} /> Abschnitt hinzufügen
        </Button>
      </div>

      {form.content.categories.map((category, categoryIndex) => (
        <CategoryEditor
          key={category.id}
          guideId={guide.id}
          category={category}
          categoryIndex={categoryIndex}
          categoryCount={form.content.categories.length}
          onChange={(next) => updateCategory(categoryIndex, next)}
          onDelete={() =>
            updateContent({
              ...form.content,
              categories: form.content.categories.filter(
                (_, index) => index !== categoryIndex,
              ),
            })
          }
          onMove={(to) =>
            updateContent({
              ...form.content,
              categories: reorder(form.content.categories, categoryIndex, to),
            })
          }
          onStepsChange={(steps) => updateSteps(categoryIndex, steps)}
        />
      ))}

      <div className="sticky bottom-3 flex flex-wrap items-center gap-3 rounded-xl border bg-background/95 p-3 shadow-lg">
        <Button disabled={pending} onClick={() => save("save")}>
          {pending ? "Speichert …" : "Ablauf speichern"}
        </Button>
        <Button
          disabled={pending}
          variant="outline"
          onClick={() => save("duplicate")}
        >
          <Copy size={16} /> Ablauf kopieren
        </Button>
        {message && (
          <span className="text-sm" role="status">
            {message}
          </span>
        )}
      </div>
    </div>
  );
}

type CategoryEditorProps = {
  /** Ohne guideId (z. B. Checkup-Editor) gibt es keine Anleitungs-Medien. */
  guideId?: string;
  category: ProcedureCategory;
  categoryIndex: number;
  categoryCount: number;
  onChange: (category: ProcedureCategory) => void;
  onDelete: () => void;
  onMove: (to: number) => void;
  onStepsChange: (steps: ProcedureStep[]) => void;
};

export function CategoryEditor({
  guideId,
  category,
  categoryIndex,
  categoryCount,
  onChange,
  onDelete,
  onMove,
  onStepsChange,
}: CategoryEditorProps) {
  const patchStep = (index: number, patch: Partial<ProcedureStep>) =>
    onStepsChange(
      category.steps.map((step, stepIndex) =>
        stepIndex === index ? { ...step, ...patch } : step,
      ),
    );
  return (
    <section className="space-y-3 rounded-2xl border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="min-w-56 flex-1 text-base font-semibold"
          aria-label={`Name von Abschnitt ${categoryIndex + 1}`}
          value={category.title}
          onChange={(event) =>
            onChange({ ...category, title: event.target.value })
          }
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Abschnitt nach oben"
          disabled={!categoryIndex}
          onClick={() => onMove(categoryIndex - 1)}
        >
          <ArrowUp size={16} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Abschnitt nach unten"
          disabled={categoryIndex === categoryCount - 1}
          onClick={() => onMove(categoryIndex + 1)}
        >
          <ArrowDown size={16} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Abschnitt löschen"
          disabled={categoryCount === 1}
          onClick={onDelete}
        >
          <Trash2 size={16} />
        </Button>
        <Button
          type="button"
          onClick={() => onStepsChange([...category.steps, emptyStep()])}
        >
          <Plus size={16} /> Schritt hinzufügen
        </Button>
      </div>
      {category.steps.map((step, index) => (
        <Card
          key={step.id}
          draggable
          onDragStart={(event) =>
            event.dataTransfer.setData("text/plain", String(index))
          }
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) =>
            onStepsChange(
              reorder(
                category.steps,
                Number(event.dataTransfer.getData("text/plain")),
                index,
              ),
            )
          }
        >
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <GripVertical
                className="cursor-grab text-muted-foreground"
                size={18}
              />
              <strong className="flex-1">Schritt {index + 1}</strong>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Nach oben"
                disabled={!index}
                onClick={() =>
                  onStepsChange(reorder(category.steps, index, index - 1))
                }
              >
                <ArrowUp size={16} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Nach unten"
                disabled={index === category.steps.length - 1}
                onClick={() =>
                  onStepsChange(reorder(category.steps, index, index + 1))
                }
              >
                <ArrowDown size={16} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Schritt löschen"
                onClick={() =>
                  onStepsChange(
                    category.steps.filter(
                      (_, stepIndex) => stepIndex !== index,
                    ),
                  )
                }
              >
                <Trash2 size={16} />
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Titel">
                <Input
                  value={step.title}
                  onChange={(event) =>
                    patchStep(index, { title: event.target.value })
                  }
                  placeholder="Was ist zu tun?"
                />
              </Field>
              <Field label="Hinweis (optional)">
                <Textarea
                  value={step.description}
                  onChange={(event) =>
                    patchStep(index, { description: event.target.value })
                  }
                  placeholder="So gelingt dieser Schritt …"
                />
              </Field>
              <Field label="Nachweis">
                <Select
                  value={step.evidence}
                  onChange={(value) =>
                    patchStep(index, {
                      evidence: value as ProcedureStep["evidence"],
                    })
                  }
                  options={EVIDENCE}
                />
              </Field>
              <Field label="Zuständigkeits-Hinweis">
                <Input
                  value={step.assigneeHint}
                  onChange={(event) =>
                    patchStep(index, { assigneeHint: event.target.value })
                  }
                  placeholder="z. B. Schichtleitung / Bar"
                />
              </Field>
            </div>
            {guideId && (
              <StepMediaEditor
                guideId={guideId}
                media={step.media ?? []}
                onChange={(media) => patchStep(index, { media })}
              />
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={step.required}
                onChange={(event) =>
                  patchStep(index, { required: event.target.checked })
                }
              />{" "}
              Pflichtschritt – Abschluss erst nach Erledigung
            </label>
            {step.evidence === "confirmation" && (
              <Field label="Bestätigungssatz">
                <Input
                  value={step.confirmationText}
                  onChange={(event) =>
                    patchStep(index, { confirmationText: event.target.value })
                  }
                  placeholder="Ich habe den Bereich geprüft."
                />
              </Field>
            )}
            {step.evidence === "value" && (
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Einheit">
                  <Input
                    value={step.unit}
                    onChange={(event) =>
                      patchStep(index, { unit: event.target.value })
                    }
                    placeholder="°C"
                  />
                </Field>
                <Field label="Minimum (optional)">
                  <Input
                    type="number"
                    value={step.min ?? ""}
                    onChange={(event) =>
                      patchStep(index, {
                        min:
                          event.target.value === ""
                            ? undefined
                            : Number(event.target.value),
                      })
                    }
                  />
                </Field>
                <Field label="Maximum (optional)">
                  <Input
                    type="number"
                    value={step.max ?? ""}
                    onChange={(event) =>
                      patchStep(index, {
                        max:
                          event.target.value === ""
                            ? undefined
                            : Number(event.target.value),
                      })
                    }
                  />
                </Field>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      {!category.steps.length && (
        <div className="rounded-xl border border-dashed p-7 text-center text-sm text-muted-foreground">
          Dieser Abschnitt hat noch keine Schritte.
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
  empty,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
  empty?: string;
}) {
  return (
    <select
      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {empty && <option value="">{empty}</option>}
      {options.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );
}
