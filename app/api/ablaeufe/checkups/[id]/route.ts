import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentEmployee } from "@/lib/auth/getCurrentEmployee";
import { procedureContentSchema, procedureTasks } from "@/lib/ablaeufe/schema";
import { createServiceClient } from "@/lib/supabase/server";

const schema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Bitte einen Titel mit mindestens zwei Zeichen eingeben.")
    .max(180, "Der Titel ist zu lang."),
  phase: z.enum(["opening", "midday", "closing", ""]).default(""),
  position: z.string().trim().max(100, "Die Position ist zu lang."),
  departmentId: z.string().uuid("Der Bereich ist ungültig.").nullable(),
  active: z.boolean(),
  interval: z
    .string()
    .trim()
    .min(1, "Bitte eine Wiederholung angeben.")
    .max(100),
  reminderMinutes: z.number().int().min(0).max(10080),
  escalationMinutes: z.number().int().min(0).max(10080),
  content: procedureContentSchema,
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getCurrentEmployee();
  if (!actor?.tenant_id)
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  if (!["manager", "backoffice", "admin"].includes(actor.rolle))
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Bitte Eingaben prüfen." },
      { status: 400 },
    );
  const { id } = await params;
  const service = createServiceClient();
  const { data: existing } = await service
    .from("checkup_templates")
    .select("id,tenant_id,location_id,department_id")
    .eq("id", id)
    .eq("tenant_id", actor.tenant_id)
    .maybeSingle();
  if (!existing)
    return NextResponse.json(
      { error: "Kontrollliste nicht gefunden." },
      { status: 404 },
    );
  if (
    !existing.location_id ||
    (actor.rolle === "manager" && existing.location_id !== actor.location_id)
  ) {
    return NextResponse.json(
      { error: "Standort nicht freigegeben." },
      { status: 403 },
    );
  }
  if (parsed.data.departmentId) {
    const { data: department } = await service
      .from("departments")
      .select("id")
      .eq("id", parsed.data.departmentId)
      .eq("tenant_id", actor.tenant_id)
      .eq("location_id", existing.location_id)
      .maybeSingle();
    if (!department)
      return NextResponse.json(
        { error: "Bereich nicht freigegeben." },
        { status: 403 },
      );
  }
  const input = parsed.data;
  const questions = {
    ...input.content,
    tasks: procedureTasks(input.content),
  };
  const { data: updated, error } = await service
    .from("checkup_templates")
    .update({
      titel: input.title,
      phase: input.phase || null,
      position_typ: input.position || null,
      department_id: input.departmentId,
      aktiv: input.active,
      intervall: input.interval,
      auto_reminder_minutes: input.reminderMinutes,
      eskalation_minutes: input.escalationMinutes,
      fragen: questions,
    })
    .eq("id", id)
    .eq("tenant_id", actor.tenant_id)
    .select("id")
    .maybeSingle();
  if (error || !updated)
    return NextResponse.json(
      { error: "Kontrollliste konnte nicht gespeichert werden." },
      { status: 500 },
    );
  return NextResponse.json({ id });
}
