"use client";

import { useState } from "react";
import { Camera, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  canCompleteProcedure,
  valueRangeState,
  type ProcedureContent,
} from "@/lib/ablaeufe/schema";

export function GuidedProcedure({
  guideId,
  title,
  content,
}: {
  guideId: string;
  title: string;
  content: ProcedureContent;
}) {
  const steps = content.categories.flatMap((category) => category.steps);
  const [taskId, setTaskId] = useState("");
  const [current, setCurrent] = useState(0);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [evidence, setEvidence] = useState<
    Record<string, string | boolean | null>
  >({});
  const [values, setValues] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState<{ at: string; by: string } | null>(null);
  const step = steps[current];
  const count = Object.values(completed).filter(Boolean).length;

  async function start() {
    setBusy(true);
    const response = await fetch("/api/ablaeufe/executions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "start", guideId }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) setMessage(result.error);
    else setTaskId(result.taskId);
  }

  async function upload(file: File) {
    if (!taskId) return;
    setBusy(true);
    const body = new FormData();
    body.set("taskId", taskId);
    body.set("evidenceType", "foto");
    body.set("stepId", step.id);
    body.set("file", file);
    const response = await fetch("/api/operations/responsibility/evidence", {
      method: "POST",
      body,
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) setMessage(result.error);
    else setEvidence({ ...evidence, [step.id]: result.evidence.id });
  }

  async function finish() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/ablaeufe/executions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "finish",
        taskId,
        completed,
        evidence,
        values,
      }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) setMessage(result.error);
    else setDone({ at: result.submittedAt, by: result.submittedBy });
  }

  if (done)
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="p-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 text-emerald-600" size={48} />
          <h1 className="text-2xl font-semibold">Zur Prüfung eingereicht</h1>
          <p className="mt-2 text-muted-foreground">
            {done.by} · {new Date(done.at).toLocaleString("de-DE")}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Die verantwortliche Leitung prüft die dokumentierten Nachweise und
            schließt den Ablauf ab.
          </p>
        </CardContent>
      </Card>
    );
  if (!taskId)
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="p-7">
          <p className="text-sm font-medium text-primary">
            Geführte Checkliste
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
          <p className="my-5 text-muted-foreground">
            {steps.length} verständliche Schritte. Dein Fortschritt und die
            Einreichung werden mit Name und Zeitpunkt dokumentiert.
          </p>
          <Button disabled={busy || !steps.length} onClick={start}>
            {busy ? "Startet …" : "Ablauf starten"}
          </Button>
          {message && (
            <p className="mt-3 text-sm text-destructive">{message}</p>
          )}
        </CardContent>
      </Card>
    );

  const range =
    step.evidence === "value"
      ? valueRangeState(step, values[step.id] ?? null)
      : null;
  const satisfied = step.evidence === "none" || Boolean(evidence[step.id]);
  return (
    <main className="mx-auto max-w-xl space-y-4 pb-24">
      <header>
        <div className="flex justify-between text-sm">
          <span>{title}</span>
          <span>
            {count} von {steps.length}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{
              width: `${steps.length ? (count / steps.length) * 100 : 0}%`,
            }}
          />
        </div>
      </header>
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="text-sm font-medium text-muted-foreground">
            Schritt {current + 1} von {steps.length}
            {step.required ? " · Pflicht" : ""}
          </div>
          <h2 className="text-2xl font-semibold">{step.title}</h2>
          {step.description && (
            <p className="leading-relaxed text-muted-foreground">
              {step.description}
            </p>
          )}
          {step.assigneeHint && (
            <p className="rounded-lg bg-muted p-3 text-sm">
              Zuständig: {step.assigneeHint}
            </p>
          )}
          {step.evidence === "photo" && (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-sm font-medium">
              <Camera size={20} />
              {evidence[step.id]
                ? "Foto gespeichert"
                : "Foto aufnehmen oder auswählen"}
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={(event) =>
                  event.target.files?.[0] && upload(event.target.files[0])
                }
              />
            </label>
          )}
          {step.evidence === "confirmation" && (
            <label className="flex gap-3 rounded-lg border p-4">
              <input
                type="checkbox"
                checked={Boolean(evidence[step.id])}
                onChange={(event) =>
                  setEvidence({ ...evidence, [step.id]: event.target.checked })
                }
              />
              <span>
                {step.confirmationText ||
                  `Ich habe „${step.title}“ vollständig erledigt.`}
              </span>
            </label>
          )}
          {step.evidence === "value" && (
            <div>
              <label className="text-sm font-medium">
                Messwert ({step.unit})
                <Input
                  className="mt-2 text-lg"
                  inputMode="decimal"
                  type="number"
                  value={values[step.id] ?? ""}
                  onChange={(event) => {
                    const nextValues = { ...values };
                    if (event.target.value === "") delete nextValues[step.id];
                    else nextValues[step.id] = Number(event.target.value);
                    setValues(nextValues);
                    setEvidence({
                      ...evidence,
                      [step.id]: event.target.value === "" ? null : true,
                    });
                  }}
                />
              </label>
              {range === "out-of-range" && (
                <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  Achtung: Der Wert liegt außerhalb des vorgesehenen Bereichs
                  {step.min !== undefined || step.max !== undefined
                    ? ` (${step.min ?? "–"} bis ${step.max ?? "–"} ${step.unit})`
                    : ""}
                  . Bitte prüfen und trotzdem bewusst bestätigen.
                </p>
              )}
            </div>
          )}
          <label className="flex items-center gap-3 rounded-lg bg-muted p-4">
            <input
              type="checkbox"
              checked={Boolean(completed[step.id])}
              disabled={!satisfied}
              onChange={(event) =>
                setCompleted({ ...completed, [step.id]: event.target.checked })
              }
            />
            <span>Dieser Schritt ist erledigt</span>
          </label>
        </CardContent>
      </Card>
      <div className="flex justify-between">
        <Button
          variant="outline"
          disabled={!current}
          onClick={() => setCurrent(current - 1)}
        >
          <ChevronLeft size={16} /> Zurück
        </Button>
        {current < steps.length - 1 ? (
          <Button onClick={() => setCurrent(current + 1)}>
            Weiter <ChevronRight size={16} />
          </Button>
        ) : (
          <Button
            disabled={busy || !canCompleteProcedure(steps, completed, evidence)}
            onClick={finish}
          >
            {busy ? "Speichert …" : "Zur Prüfung einreichen"}
          </Button>
        )}
      </div>
      {message && (
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {message}
        </p>
      )}
    </main>
  );
}
