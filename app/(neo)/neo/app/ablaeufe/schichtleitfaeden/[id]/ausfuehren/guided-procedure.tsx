"use client";

import { useState } from "react";
import { Camera, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  canCompleteProcedure,
  valueRangeState,
  type ProcedureContent,
  type ProcedureStep,
} from "@/lib/ablaeufe/schema";
import { StepMediaGallery } from "./step-media";

type RunStep = ProcedureStep & { categoryTitle: string };

export function GuidedProcedure({
  guideId,
  title,
  content,
  initialTaskId,
  mediaUrls = {},
}: {
  guideId: string;
  title: string;
  content: ProcedureContent;
  /** Pflicht-Checkliste aus der Schicht: vorhandene Aufgabe wird übernommen. */
  initialTaskId?: string;
  /** Server-seitig signierte URLs für Anleitungs-Medien (Pfad → URL). */
  mediaUrls?: Record<string, string>;
}) {
  const steps: RunStep[] = content.categories.flatMap((category) =>
    category.steps.map((step) => ({ ...step, categoryTitle: category.title })),
  );
  const [taskId, setTaskId] = useState("");
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
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
  const isLast = current === steps.length - 1;

  function go(target: number, into: "forward" | "back") {
    setDirection(into);
    setCurrent(target);
    setMessage("");
  }

  async function start() {
    setBusy(true);
    const response = await fetch("/api/ablaeufe/executions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "start", guideId, ...(initialTaskId ? { taskId: initialTaskId } : {}) }),
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

  async function finish(finalCompleted: Record<string, boolean>) {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/ablaeufe/executions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "finish",
        taskId,
        completed: finalCompleted,
        evidence,
        values,
      }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) setMessage(result.error);
    else setDone({ at: result.submittedAt, by: result.submittedBy });
  }

  /** Der eine Daumen-Knopf: erledigt markieren und weitergleiten (bzw. am Ende einreichen). */
  function completeAndAdvance() {
    const next = { ...completed, [step.id]: true };
    setCompleted(next);
    if (!isLast) go(current + 1, "forward");
    else if (canCompleteProcedure(steps, next, evidence)) void finish(next);
  }

  if (done) {
    const photos = steps.filter(
      (item) => item.evidence === "photo" && evidence[item.id],
    ).length;
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="gp-pop p-8 text-center">
          <svg
            aria-hidden
            className="mx-auto mb-4"
            fill="none"
            height="72"
            viewBox="0 0 72 72"
            width="72"
          >
            <circle
              className="gp-draw-circle"
              cx="36"
              cy="36"
              r="32"
              stroke="rgb(5 150 105)"
              strokeWidth="4"
            />
            <path
              className="gp-draw-check"
              d="M22 37.5 32 47 51 27"
              stroke="rgb(5 150 105)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="5"
            />
          </svg>
          <h1 className="text-2xl font-semibold">Geschafft!</h1>
          <p className="mt-2 text-muted-foreground">
            {steps.length} Schritte
            {photos ? ` · ${photos} Foto-Nachweise` : ""} · zur Prüfung
            eingereicht
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            {done.by} · {new Date(done.at).toLocaleString("de-DE")} — die
            verantwortliche Leitung prüft die Nachweise und schließt den Ablauf
            ab.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!taskId)
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="p-7">
          <p className="text-sm font-medium text-primary">
            Geführte Checkliste
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
          <p className="my-5 text-muted-foreground">
            {steps.length} verständliche Schritte, einer nach dem anderen. Dein
            Fortschritt und die Einreichung werden mit Name und Zeitpunkt
            dokumentiert.
          </p>
          <Button
            className="h-12 w-full text-base sm:w-auto"
            disabled={busy || !steps.length}
            onClick={start}
          >
            {busy ? "Startet …" : "Los geht's"}
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
  const blocker =
    step.evidence === "photo" && !evidence[step.id]
      ? "Erst Foto aufnehmen"
      : step.evidence === "value" && !evidence[step.id]
        ? "Erst Messwert eintragen"
        : step.evidence === "confirmation" && !evidence[step.id]
          ? "Erst oben bestätigen"
          : null;
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-xl flex-col pb-6">
      <header className="mb-4">
        <div className="flex items-center gap-3">
          <button
            aria-label="Vorheriger Schritt"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border text-muted-foreground disabled:opacity-30"
            disabled={!current}
            type="button"
            onClick={() => go(current - 1, "back")}
          >
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex justify-between text-xs font-medium text-muted-foreground">
              <span className="truncate">{title}</span>
              <span className="shrink-0 pl-2">
                {current + 1} / {steps.length}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                style={{
                  width: `${Math.max((count / steps.length) * 100, 4)}%`,
                }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* key erzwingt Neu-Mount pro Schritt → Slide-Animation in Blickrichtung */}
      <Card
        key={step.id}
        className={`gp-anim flex-1 ${direction === "forward" ? "gp-slide-forward" : "gp-slide-back"}`}
      >
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
            <span className="truncate">{step.categoryTitle}</span>
            {step.required ? (
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5">
                Pflicht
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                Optional
              </span>
            )}
          </div>
          <h2 className="text-2xl font-semibold leading-snug">{step.title}</h2>
          <StepMediaGallery media={step.media ?? []} urls={mediaUrls} />
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
            <label
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-sm font-medium ${evidence[step.id] ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200" : ""}`}
            >
              <Camera size={20} />
              {evidence[step.id]
                ? "Foto gespeichert – nochmal aufnehmen?"
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
        </CardContent>
      </Card>

      <div className="sticky bottom-3 mt-4 space-y-2">
        {message && (
          <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {message}
          </p>
        )}
        <Button
          className="h-14 w-full rounded-xl text-base font-semibold shadow-lg"
          disabled={
            busy ||
            !satisfied ||
            (isLast &&
              !canCompleteProcedure(
                steps,
                { ...completed, [step.id]: true },
                evidence,
              ))
          }
          onClick={completeAndAdvance}
        >
          {busy
            ? "Speichert …"
            : (blocker ??
              (isLast ? "✓ Fertig – zur Prüfung einreichen" : "✓ Erledigt"))}
        </Button>
        {!step.required && !isLast && (
          <button
            className="w-full py-1 text-center text-sm text-muted-foreground underline-offset-2 hover:underline"
            type="button"
            onClick={() => go(current + 1, "forward")}
          >
            Überspringen
          </button>
        )}
        {!step.required &&
          isLast &&
          !satisfied &&
          canCompleteProcedure(steps, completed, evidence) && (
            <button
              className="w-full py-1 text-center text-sm text-muted-foreground underline-offset-2 hover:underline"
              disabled={busy}
              type="button"
              onClick={() => void finish(completed)}
            >
              Ohne diesen optionalen Schritt einreichen
            </button>
          )}
        {isLast &&
          !canCompleteProcedure(
            steps,
            { ...completed, [step.id]: true },
            evidence,
          ) &&
          satisfied && (
            <p className="text-center text-sm text-muted-foreground">
              Es fehlen noch Pflichtschritte – mit dem Pfeil oben links
              zurückblättern.
            </p>
          )}
      </div>
    </main>
  );
}
