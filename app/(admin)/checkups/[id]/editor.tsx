"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CategoryEditor } from "../../shift-guides/[id]/editor";
import {
  normalizeProcedureContent,
  procedureContentSchema,
  reorder,
  type ProcedureContent,
} from "@/lib/ablaeufe/schema";

function normalizeQuestions(value: unknown): ProcedureContent {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  if (Array.isArray(record.categories))
    return normalizeProcedureContent(record);
  const tasks = Array.isArray(record.tasks) ? record.tasks : [];
  return normalizeProcedureContent({
    categories: [
      {
        id: "control",
        title: "Kontrollschritte",
        steps: tasks.map((task, index) => {
          const item: Record<string, unknown> =
            task && typeof task === "object"
              ? (task as Record<string, unknown>)
              : { title: task };
          return {
            ...item,
            id: item.id ?? `control-${index + 1}`,
            title: item.title ?? `Kontrollschritt ${index + 1}`,
            description: item.description ?? "",
            required: true,
            evidence: item.requiresPhoto ? "photo" : "none",
          };
        }),
      },
    ],
  });
}

export function TemplateEditor({
  tpl,
  departments,
}: {
  tpl: any;
  departments: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    title: tpl.titel ?? "",
    phase: tpl.phase === "middle" ? "midday" : (tpl.phase ?? ""),
    position: tpl.position_typ ?? "",
    departmentId: tpl.department_id ?? "",
    active: tpl.aktiv !== false,
    interval: tpl.intervall ?? "täglich",
    reminderMinutes: tpl.auto_reminder_minutes ?? 15,
    escalationMinutes: tpl.eskalation_minutes ?? 30,
    content: normalizeQuestions(tpl.fragen),
  });

  function updateContent(content: ProcedureContent) {
    setForm((current) => ({ ...current, content }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    const parsed = procedureContentSchema.safeParse(form.content);
    if (!parsed.success || form.title.trim().length < 2) {
      setMessage(
        parsed.error?.issues[0]?.message ??
          "Bitte einen verständlichen Titel eingeben.",
      );
      return;
    }
    startTransition(async () => {
      const response = await fetch(`/api/ablaeufe/checkups/${tpl.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          departmentId: form.departmentId || null,
        }),
      });
      const result = await response.json();
      setMessage(
        response.ok
          ? "Kontrollliste wurde gespeichert."
          : (result.error ?? "Speichern fehlgeschlagen."),
      );
      if (response.ok) router.refresh();
    });
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <Card>
        <CardContent className="grid gap-4 p-6 md:grid-cols-3">
          <Field label="Titel">
            <Input
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
              required
            />
          </Field>
          <Field label="Tageszeit">
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.phase}
              onChange={(event) =>
                setForm({ ...form, phase: event.target.value })
              }
            >
              <option value="">Nicht festgelegt</option>
              <option value="opening">Morgens</option>
              <option value="midday">Tagsüber</option>
              <option value="closing">Abends</option>
            </select>
          </Field>
          <Field label="Position">
            <Input
              value={form.position}
              onChange={(event) =>
                setForm({ ...form, position: event.target.value })
              }
            />
          </Field>
          <Field label="Bereich">
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.departmentId}
              onChange={(event) =>
                setForm({ ...form, departmentId: event.target.value })
              }
            >
              <option value="">Standortweit</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Wiederholung">
            <Input
              value={form.interval}
              onChange={(event) =>
                setForm({ ...form, interval: event.target.value })
              }
            />
          </Field>
          <Field label="Erinnerung nach Minuten">
            <Input
              type="number"
              min="0"
              value={form.reminderMinutes}
              onChange={(event) =>
                setForm({
                  ...form,
                  reminderMinutes: Number(event.target.value),
                })
              }
            />
          </Field>
          <Field label="Eskalation nach Minuten">
            <Input
              type="number"
              min="0"
              value={form.escalationMinutes}
              onChange={(event) =>
                setForm({
                  ...form,
                  escalationMinutes: Number(event.target.value),
                })
              }
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) =>
                setForm({ ...form, active: event.target.checked })
              }
            />{" "}
            Aktiv
          </label>
        </CardContent>
      </Card>
      {form.content.categories.map((category, categoryIndex) => (
        <CategoryEditor
          key={category.id}
          category={category}
          categoryIndex={categoryIndex}
          categoryCount={form.content.categories.length}
          onChange={(next) =>
            updateContent({
              ...form.content,
              categories: form.content.categories.map((item, index) =>
                index === categoryIndex ? next : item,
              ),
            })
          }
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
          onStepsChange={(steps) =>
            updateContent({
              ...form.content,
              categories: form.content.categories.map((item, index) =>
                index === categoryIndex ? { ...item, steps } : item,
              ),
            })
          }
        />
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          updateContent({
            ...form.content,
            categories: [
              ...form.content.categories,
              {
                id: `control-${Date.now()}`,
                title: "Neuer Abschnitt",
                steps: [],
              },
            ],
          })
        }
      >
        <Plus size={16} /> Abschnitt hinzufügen
      </Button>
      <div className="sticky bottom-3 flex items-center gap-3 rounded-xl border bg-background/95 p-3 shadow-lg">
        <Button type="submit" disabled={pending}>
          {pending ? "Speichert …" : "Kontrollliste speichern"}
        </Button>
        {message && (
          <span className="text-sm" role="status">
            {message}
          </span>
        )}
      </div>
    </form>
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
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
