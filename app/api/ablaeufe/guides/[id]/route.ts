import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentEmployee } from "@/lib/auth/getCurrentEmployee";
import { procedureContentSchema } from "@/lib/ablaeufe/schema";
import { createServiceClient } from "@/lib/supabase/server";

const schema = z.object({
  action: z.enum(["save", "duplicate"]).default("save"),
  title: z
    .string()
    .trim()
    .min(2, "Bitte einen Namen mit mindestens zwei Zeichen eingeben.")
    .max(180, "Der Name ist zu lang."),
  type: z.enum([
    "opening",
    "closing",
    "cleaning",
    "control",
    "production",
    "handover",
    "hygiene_temperature",
    "other",
  ]),
  position: z.string().trim().max(100, "Die Position ist zu lang.").optional(),
  departmentId: z
    .string()
    .uuid("Der Bereich ist ungültig.")
    .nullable()
    .optional(),
  locationId: z
    .string()
    .uuid("Der Standort ist ungültig.")
    .nullable()
    .optional(),
  shiftHint: z
    .string()
    .trim()
    .max(120, "Der Schichthinweis ist zu lang.")
    .optional(),
  active: z.boolean(),
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
  const input = parsed.data;
  const { data: existing } = await service
    .from("shift_guides")
    .select("id,tenant_id,location_id,version")
    .eq("id", id)
    .eq("tenant_id", actor.tenant_id)
    .maybeSingle();
  if (!existing)
    return NextResponse.json(
      { error: "Ablauf nicht gefunden." },
      { status: 404 },
    );
  const locationId =
    input.locationId ?? existing.location_id ?? actor.location_id;
  if (
    !locationId ||
    (actor.rolle === "manager" && actor.location_id !== locationId)
  )
    return NextResponse.json(
      { error: "Standort nicht freigegeben." },
      { status: 403 },
    );
  const { data: location } = await service
    .from("locations")
    .select("id")
    .eq("id", locationId)
    .eq("tenant_id", actor.tenant_id)
    .maybeSingle();
  if (!location)
    return NextResponse.json(
      { error: "Standort nicht freigegeben." },
      { status: 403 },
    );
  if (input.departmentId) {
    const { data: department } = await service
      .from("departments")
      .select("id")
      .eq("id", input.departmentId)
      .eq("tenant_id", actor.tenant_id)
      .eq("location_id", locationId)
      .maybeSingle();
    if (!department)
      return NextResponse.json(
        { error: "Bereich gehört nicht zu diesem Standort." },
        { status: 403 },
      );
  }
  const payload = {
    tenant_id: actor.tenant_id,
    location_id: locationId,
    titel:
      input.action === "duplicate" ? `${input.title} – Kopie` : input.title,
    phase:
      input.type === "opening"
        ? "opening"
        : input.type === "closing"
          ? "closing"
          : "midday",
    ablauf_typ: input.type,
    position_typ: input.position || null,
    department_id: input.departmentId || null,
    shift_hint: input.shiftHint || null,
    aktiv: input.active,
    inhalt: input.content,
    version: (existing.version ?? 1) + 1,
    updated_at: new Date().toISOString(),
  };
  const query =
    input.action === "duplicate"
      ? service.from("shift_guides").insert(payload)
      : service
          .from("shift_guides")
          .update(payload)
          .eq("id", id)
          .eq("tenant_id", actor.tenant_id);
  const { data, error } = await query.select("id").single();
  if (error || !data)
    return NextResponse.json(
      { error: "Ablauf konnte nicht gespeichert werden." },
      { status: 500 },
    );
  return NextResponse.json({ id: data.id });
}
