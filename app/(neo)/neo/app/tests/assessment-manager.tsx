"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type Question = {
  id: string;
  question: string;
  options: { id: string; label: string }[];
  correctOptionIds: string[];
  points: number;
  mustPass: boolean;
};
const emptyQuestion = (): Question => ({
  id: crypto.randomUUID(),
  question: "",
  options: [
    { id: crypto.randomUUID(), label: "" },
    { id: crypto.randomUUID(), label: "" },
  ],
  correctOptionIds: [],
  points: 1,
  mustPass: false,
});
const blank = {
  id: null as string | null,
  name: "",
  description: "",
  locationId: "",
  passingThreshold: 80,
  passAction: "next_stage",
  failAction: "manual_review",
  passMessage:
    "Danke! Du hast den Test bestanden. Wir melden uns mit dem nächsten Schritt.",
  failMessage:
    "Danke für deine Teilnahme. Wir prüfen deine Bewerbung persönlich.",
  active: true,
  questions: [emptyQuestion()],
  departmentIds: [] as string[],
  positionTypes: "",
};

export function AssessmentManager({
  initialTemplates,
  departments,
  locations,
  isManager,
  managerLocationId,
}: {
  initialTemplates: any[];
  departments: any[];
  locations: any[];
  isManager: boolean;
  managerLocationId: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    ...blank,
    locationId: managerLocationId ?? "",
  });
  const [message, setMessage] = useState("");
  const setQuestion = (index: number, value: Question) =>
    setForm({
      ...form,
      questions: form.questions.map((q, i) => (i === index ? value : q)),
    });
  async function edit(id: string, duplicate = false) {
    setMessage("");
    const response = await fetch(`/api/application-assessments/${id}`);
    const data = await response.json();
    if (!response.ok) return setMessage(data.error);
    setForm({
      id: duplicate ? null : id,
      name: duplicate ? `${data.template.name} (Kopie)` : data.template.name,
      description: data.template.description ?? "",
      locationId:
        duplicate && isManager
          ? (managerLocationId ?? "")
          : (data.template.location_id ?? ""),
      passingThreshold: data.config.passingThreshold ?? 80,
      passAction: data.config.passAction ?? "next_stage",
      failAction: data.config.failAction ?? "manual_review",
      passMessage: data.config.passMessage ?? "",
      failMessage: data.config.failMessage ?? "",
      active: data.template.status === "ACTIVE",
      questions: data.questions,
      departmentIds: data.targets
        .filter((t: any) => t.target_type === "department")
        .map((t: any) => t.department_id),
      positionTypes: data.targets
        .filter((t: any) => t.target_type === "position")
        .map((t: any) => t.position_type)
        .join(", "),
    });
    setEditing(true);
  }
  function save() {
    start(async () => {
      setMessage("");
      const targets = [
        ...form.departmentIds.map((departmentId) => ({
          type: "department",
          departmentId,
        })),
        ...form.positionTypes
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
          .map((positionType) => ({ type: "position", positionType })),
      ];
      const response = await fetch("/api/application-assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          locationId: form.locationId || null,
          targets,
        }),
      });
      const data = await response.json();
      if (!response.ok) return setMessage(data.error);
      setEditing(false);
      setForm({
        ...blank,
        locationId: managerLocationId ?? "",
        questions: [emptyQuestion()],
      });
      router.refresh();
    });
  }
  function remove(id: string) {
    if (
      !confirm(
        "Test wirklich löschen? Bereits verwendete Tests werden sicher archiviert.",
      )
    )
      return;
    start(async () => {
      const response = await fetch(`/api/application-assessments/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) return setMessage(data.error);
      router.refresh();
    });
  }
  if (!editing)
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button
            onClick={() => {
              setForm({
                ...blank,
                locationId: managerLocationId ?? "",
                questions: [emptyQuestion()],
              });
              setEditing(true);
            }}
          >
            <Plus className="h-4 w-4" /> Test anlegen
          </Button>
        </div>
        {message && (
          <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {message}
          </p>
        )}
        {initialTemplates.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <h2 className="font-semibold">Noch keine Bewerbungstests</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Lege den ersten Test an und ordne ihn einem Bereich oder einer
                Stelle zu.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {initialTemplates.map((template) => (
              <Card key={template.id}>
                <CardContent className="flex items-start justify-between gap-4 p-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold">{template.name}</h2>
                      <Badge
                        variant={
                          template.status === "ACTIVE" ? "accent" : "muted"
                        }
                      >
                        {template.status === "ACTIVE"
                          ? "Aktiv"
                          : template.status === "RETIRED"
                            ? "Archiviert"
                            : "Entwurf"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {template.description || "Keine Beschreibung"}
                    </p>
                  </div>
                  <div className="flex">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Bearbeiten"
                      onClick={() => edit(template.id)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Duplizieren"
                      onClick={() => edit(template.id, true)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Löschen"
                      onClick={() => remove(template.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>
            {form.id ? "Test bearbeiten" : "Neuen Test anlegen"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Name">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="z. B. Barista-Grundlagen"
              />
            </Field>
            <Field label="Standort (optional)">
              {isManager ? (
                <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm">
                  {form.locationId
                    ? (locations.find((location) => location.id === form.locationId)
                        ?.name ?? "Eigener Standort")
                    : "Alle Standorte (unverändert)"}
                </div>
              ) : (
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.locationId}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      locationId: e.target.value,
                      departmentIds: [],
                    })
                  }
                >
                  <option value="">Alle Standorte</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <Field label="Kurze Erklärung für Bewerber">
            <Textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Bereiche">
              <div className="space-y-1 rounded-md border p-3">
                {departments
                  .filter(
                    (d) =>
                      !form.locationId || d.location_id === form.locationId,
                  )
                  .map((d) => (
                    <label key={d.id} className="flex gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.departmentIds.includes(d.id)}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            departmentIds: e.target.checked
                              ? [...form.departmentIds, d.id]
                              : form.departmentIds.filter((id) => id !== d.id),
                          })
                        }
                      />
                      {d.name}
                    </label>
                  ))}
              </div>
            </Field>
            <Field label="Stellen / Positionen (mit Komma trennen)">
              <Input
                value={form.positionTypes}
                onChange={(e) =>
                  setForm({ ...form, positionTypes: e.target.value })
                }
                placeholder="barista, service"
              />
            </Field>
          </div>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {form.questions.map((question, index) => (
          <Card key={question.id}>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2">
                <span className="font-semibold">Frage {index + 1}</span>
                <div className="ml-auto flex">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={index === 0}
                    onClick={() =>
                      setForm({
                        ...form,
                        questions: form.questions.map(
                          (_, i, arr) =>
                            arr[
                              i === index
                                ? index - 1
                                : i === index - 1
                                  ? index
                                  : i
                            ],
                        ),
                      })
                    }
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={index === form.questions.length - 1}
                    onClick={() =>
                      setForm({
                        ...form,
                        questions: form.questions.map(
                          (_, i, arr) =>
                            arr[
                              i === index
                                ? index + 1
                                : i === index + 1
                                  ? index
                                  : i
                            ],
                        ),
                      })
                    }
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={form.questions.length === 1}
                    onClick={() =>
                      setForm({
                        ...form,
                        questions: form.questions.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Input
                value={question.question}
                onChange={(e) =>
                  setQuestion(index, { ...question, question: e.target.value })
                }
                placeholder="Frage eingeben"
              />
              {question.options.map((option, optionIndex) => (
                <div key={option.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    aria-label="Richtige Antwort"
                    checked={question.correctOptionIds.includes(option.id)}
                    onChange={(e) =>
                      setQuestion(index, {
                        ...question,
                        correctOptionIds: e.target.checked
                          ? [...question.correctOptionIds, option.id]
                          : question.correctOptionIds.filter(
                              (id) => id !== option.id,
                            ),
                      })
                    }
                  />
                  <Input
                    value={option.label}
                    onChange={(e) =>
                      setQuestion(index, {
                        ...question,
                        options: question.options.map((o, i) =>
                          i === optionIndex
                            ? { ...o, label: e.target.value }
                            : o,
                        ),
                      })
                    }
                    placeholder={`Antwort ${optionIndex + 1}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={question.options.length === 2}
                    onClick={() =>
                      setQuestion(index, {
                        ...question,
                        options: question.options.filter(
                          (_, i) => i !== optionIndex,
                        ),
                        correctOptionIds: question.correctOptionIds.filter(
                          (id) => id !== option.id,
                        ),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setQuestion(index, {
                    ...question,
                    options: [
                      ...question.options,
                      { id: crypto.randomUUID(), label: "" },
                    ],
                  })
                }
              >
                Antwort hinzufügen
              </Button>
              <div className="flex flex-wrap gap-4">
                <label className="text-sm">
                  Punkte{" "}
                  <Input
                    className="ml-2 inline-flex w-20"
                    type="number"
                    min={1}
                    value={question.points}
                    onChange={(e) =>
                      setQuestion(index, {
                        ...question,
                        points: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={question.mustPass}
                    onChange={(e) =>
                      setQuestion(index, {
                        ...question,
                        mustPass: e.target.checked,
                      })
                    }
                  />
                  Muss richtig sein
                </label>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Button
        variant="secondary"
        onClick={() =>
          setForm({ ...form, questions: [...form.questions, emptyQuestion()] })
        }
      >
        <Plus className="h-4 w-4" /> Frage hinzufügen
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Auswertung & nächster Schritt</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Bestehensgrenze in %">
            <Input
              type="number"
              min={0}
              max={100}
              value={form.passingThreshold}
              onChange={(e) =>
                setForm({ ...form, passingThreshold: Number(e.target.value) })
              }
            />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Test sofort aktivieren
          </label>
          <Outcome
            label="Bei bestandenem Test"
            value={form.passAction}
            message={form.passMessage}
            onAction={(passAction) => setForm({ ...form, passAction })}
            onMessage={(passMessage) => setForm({ ...form, passMessage })}
          />
          <Outcome
            label="Bei nicht bestandenem Test"
            value={form.failAction}
            message={form.failMessage}
            onAction={(failAction) => setForm({ ...form, failAction })}
            onMessage={(failMessage) => setForm({ ...form, failMessage })}
          />
        </CardContent>
      </Card>
      {message && <p className="text-sm text-red-700">{message}</p>}
      <div className="flex gap-2">
        <Button onClick={save} disabled={pending}>
          {pending ? "Speichert…" : "Test speichern"}
        </Button>
        <Button variant="ghost" onClick={() => setEditing(false)}>
          Abbrechen
        </Button>
      </div>
    </div>
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
function Outcome({
  label,
  value,
  message,
  onAction,
  onMessage,
}: {
  label: string;
  value: string;
  message: string;
  onAction: (value: any) => void;
  onMessage: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <select
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        value={value}
        onChange={(e) => onAction(e.target.value)}
      >
        <option value="next_stage">In nächste Bewerbungsphase</option>
        <option value="manual_review">Persönlich prüfen</option>
        <option value="reject">Bewerbung freundlich abschließen</option>
      </select>
      <Textarea
        value={message}
        onChange={(e) => onMessage(e.target.value)}
        placeholder="Freundliche Nachricht an den Bewerber"
      />
    </div>
  );
}
