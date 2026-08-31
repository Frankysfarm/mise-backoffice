import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentEmployee } from "@/lib/auth/getCurrentEmployee";
import { normalizeProcedureContent } from "@/lib/ablaeufe/schema";
import { createServiceClient } from "@/lib/supabase/server";

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), guideId: z.string().uuid() }),
  z.object({
    action: z.literal("finish"),
    taskId: z.string().uuid(),
    completed: z.record(z.boolean()),
    evidence: z.record(z.union([z.string(), z.boolean(), z.null()])),
    values: z.record(z.number().finite()).default({}),
  }),
]);

export async function POST(request: NextRequest) {
  const actor = await getCurrentEmployee();
  if (!actor?.tenant_id)
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  if (!actor.location_id)
    return NextResponse.json(
      {
        error:
          "Für dein Profil ist kein Standort hinterlegt. Bitte wende dich an die Leitung.",
      },
      { status: 409 },
    );
  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Eingaben sind ungültig." },
      { status: 400 },
    );
  const service = createServiceClient();
  const input = parsed.data;

  if (input.action === "start") {
    const { data: guide } = await service
      .from("shift_guides")
      .select("id,titel,inhalt,department_id,location_id,tenant_id")
      .eq("id", input.guideId)
      .eq("tenant_id", actor.tenant_id)
      .eq("aktiv", true)
      .maybeSingle();
    if (!guide || guide.location_id !== actor.location_id) {
      return NextResponse.json(
        { error: "Ablauf ist für diesen Standort nicht verfügbar." },
        { status: 404 },
      );
    }
    let content;
    try {
      content = normalizeProcedureContent(guide.inhalt);
    } catch {
      return NextResponse.json(
        {
          error:
            "Dieser Ablauf muss von der Leitung einmal gespeichert werden.",
        },
        { status: 409 },
      );
    }
    let reviewerId: string | null = null;
    if (guide.department_id) {
      const { data: assignments } = await service
        .from("department_responsibility_assignments")
        .select("employee_id")
        .eq("tenant_id", actor.tenant_id)
        .eq("location_id", actor.location_id)
        .eq("department_id", guide.department_id)
        .eq("responsibility_role", "hauptverantwortung")
        .eq("aktiv", true)
        .neq("employee_id", actor.id)
        .order("valid_from", { ascending: false })
        .limit(1);
      reviewerId = assignments?.[0]?.employee_id ?? null;
    }
    if (!reviewerId) {
      const { data: manager } = await service
        .from("employees")
        .select("id")
        .eq("tenant_id", actor.tenant_id)
        .eq("location_id", actor.location_id)
        .in("rolle", ["manager", "backoffice", "admin"])
        .in("status", ["aktiv", "in_training", "in_probe"])
        .neq("id", actor.id)
        .limit(1)
        .maybeSingle();
      reviewerId = manager?.id ?? null;
    }
    if (!reviewerId) {
      const { data: tenantLead } = await service
        .from("employees")
        .select("id")
        .eq("tenant_id", actor.tenant_id)
        .in("rolle", ["backoffice", "admin"])
        .in("status", ["aktiv", "in_training", "in_probe"])
        .neq("id", actor.id)
        .limit(1)
        .maybeSingle();
      reviewerId = tenantLead?.id ?? null;
    }
    const requirements = [
      ...new Set(
        content.categories
          .flatMap((category) => category.steps)
          .filter((step) => step.required)
          .map((step) =>
            step.evidence === "photo"
              ? "foto"
              : step.evidence === "value"
                ? "messwert"
                : step.evidence === "confirmation"
                  ? "unterschrift"
                  : null,
          )
          .filter(
            (value): value is "foto" | "messwert" | "unterschrift" =>
              value !== null,
          ),
      ),
    ];
    const { data: task, error } = await service
      .from("operational_tasks")
      .insert({
        tenant_id: actor.tenant_id,
        location_id: actor.location_id,
        department_id: guide.department_id,
        title: guide.titel,
        status: "in_arbeit",
        created_by: actor.id,
        assigned_to: actor.id,
        accountable_employee_id: reviewerId ?? actor.id,
        controller_employee_id: reviewerId,
        evidence_requirements: requirements,
        source_type: "shift_guide_execution",
        source_id: `${guide.id}:${actor.id}:${Date.now()}`,
        procedure_content: content,
      })
      .select("id")
      .single();
    if (error || !task)
      return NextResponse.json(
        { error: "Ablauf konnte nicht gestartet werden." },
        { status: 500 },
      );
    return NextResponse.json({ taskId: task.id }, { status: 201 });
  }

  const { data: task } = await service
    .from("operational_tasks")
    .select("id,assigned_to,status,procedure_content,controller_employee_id")
    .eq("id", input.taskId)
    .eq("tenant_id", actor.tenant_id)
    .eq("location_id", actor.location_id)
    .maybeSingle();
  if (!task || task.assigned_to !== actor.id || task.status !== "in_arbeit") {
    return NextResponse.json(
      { error: "Ausführung nicht gefunden." },
      { status: 404 },
    );
  }
  const content = normalizeProcedureContent(task.procedure_content);
  const steps = content.categories.flatMap((category) => category.steps);
  const missingCompletion = steps.find(
    (step) => step.required && !input.completed[step.id],
  );
  if (missingCompletion)
    return NextResponse.json(
      { error: `Bitte zuerst „${missingCompletion.title}“ erledigen.` },
      { status: 409 },
    );

  const requiredPhotoSteps = steps.filter(
    (step) => step.required && step.evidence === "photo",
  );
  const photoIds = requiredPhotoSteps
    .map((step) => input.evidence[step.id])
    .filter((id): id is string => typeof id === "string");
  const { data: photoEvidence } = photoIds.length
    ? await service
        .from("operational_task_evidence")
        .select("id,content")
        .eq("task_id", task.id)
        .eq("tenant_id", actor.tenant_id)
        .eq("evidence_type", "foto")
        .in("id", photoIds)
    : { data: [] as { id: string; content: unknown }[] };
  const uploadedPhotoIds = new Set(
    (photoEvidence ?? []).map((item) => item.id),
  );
  const uniquePhotoIds = new Set(photoIds);
  const missingPhoto = requiredPhotoSteps.find((step) => {
    const evidenceId = input.evidence[step.id];
    const row = (photoEvidence ?? []).find((item) => item.id === evidenceId);
    const content =
      row?.content && typeof row.content === "object"
        ? (row.content as Record<string, unknown>)
        : {};
    return (
      typeof evidenceId !== "string" ||
      !uploadedPhotoIds.has(evidenceId) ||
      content.stepId !== step.id
    );
  });
  if (missingPhoto || uniquePhotoIds.size !== requiredPhotoSteps.length) {
    return NextResponse.json(
      {
        error: `Foto für „${missingPhoto?.title ?? "jeden Pflichtschritt"}“ fehlt.`,
      },
      { status: 409 },
    );
  }

  const evidenceRows: {
    tenant_id: string;
    task_id: string;
    evidence_type: string;
    content: Record<string, unknown>;
    submitted_by: string;
  }[] = [];
  for (const step of steps.filter((item) => input.completed[item.id])) {
    if (step.evidence === "confirmation") {
      if (input.evidence[step.id] !== true)
        return NextResponse.json(
          { error: `Bestätigung für „${step.title}“ fehlt.` },
          { status: 409 },
        );
      evidenceRows.push({
        tenant_id: actor.tenant_id,
        task_id: task.id,
        evidence_type: "unterschrift",
        content: { stepId: step.id, text: step.confirmationText || step.title },
        submitted_by: actor.id,
      });
    }
    if (step.evidence === "value") {
      const value = input.values[step.id];
      if (!Number.isFinite(value))
        return NextResponse.json(
          { error: `Messwert für „${step.title}“ fehlt.` },
          { status: 409 },
        );
      evidenceRows.push({
        tenant_id: actor.tenant_id,
        task_id: task.id,
        evidence_type: "messwert",
        content: { stepId: step.id, value, unit: step.unit },
        submitted_by: actor.id,
      });
    }
  }
  if (evidenceRows.length) {
    const { error } = await service
      .from("operational_task_evidence")
      .insert(evidenceRows);
    if (error)
      return NextResponse.json(
        { error: "Nachweise konnten nicht dokumentiert werden." },
        { status: 500 },
      );
  }
  const procedureResults = {
    completed: input.completed,
    evidence: input.evidence,
    values: input.values,
    submittedBy: actor.id,
    independentReviewRequired: task.controller_employee_id !== null,
    reviewNotice:
      task.controller_employee_id === null
        ? "Ohne unabhängige prüfende Person eingereicht"
        : null,
  };
  const { error: resultError } = await service
    .from("operational_tasks")
    .update({ procedure_results: procedureResults })
    .eq("id", task.id);
  if (resultError)
    return NextResponse.json(
      { error: "Ergebnisse konnten nicht gespeichert werden." },
      { status: 500 },
    );
  const { data: updated, error } = await service.rpc(
    "update_operational_task_as_actor",
    {
      p_task_id: task.id,
      p_tenant_id: actor.tenant_id,
      p_location_id: actor.location_id,
      p_actor_id: actor.id,
      p_status: "wartet_auf_pruefung",
      p_review_note:
        task.controller_employee_id === null
          ? "Ohne unabhängige prüfende Person eingereicht"
          : null,
    },
  );
  const submitted = Array.isArray(updated) ? updated[0] : updated;
  if (error || !submitted)
    return NextResponse.json(
      { error: "Ablauf konnte nicht zur Prüfung eingereicht werden." },
      { status: 500 },
    );
  return NextResponse.json({
    submittedAt: new Date().toISOString(),
    submittedBy: `${actor.vorname} ${actor.nachname}`,
  });
}
