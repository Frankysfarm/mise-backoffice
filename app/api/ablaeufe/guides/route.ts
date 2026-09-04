import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentEmployee } from "@/lib/auth/getCurrentEmployee";
import { listTemplate } from "@/lib/ablaeufe/list-templates";
import { createServiceClient } from "@/lib/supabase/server";

const schema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Bitte einen Namen mit mindestens zwei Zeichen eingeben.")
    .max(180, "Der Name ist zu lang."),
  templateKey: z.string().min(1).max(40),
  locationId: z.string().uuid("Der Standort ist ungültig.").nullable().optional(),
});

/** Neue Liste anlegen: startet inaktiv, damit sie erst nach dem Ausbau im Editor greift. */
export async function POST(request: NextRequest) {
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
  const template = listTemplate(parsed.data.templateKey);
  if (!template)
    return NextResponse.json(
      { error: "Diese Vorlage gibt es nicht." },
      { status: 400 },
    );

  const service = createServiceClient();
  const locationId = parsed.data.locationId ?? actor.location_id;
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

  const { data, error } = await service
    .from("shift_guides")
    .insert({
      tenant_id: actor.tenant_id,
      location_id: locationId,
      titel: parsed.data.title,
      phase:
        template.type === "opening"
          ? "opening"
          : template.type === "closing"
            ? "closing"
            : "midday",
      ablauf_typ: template.type,
      aktiv: false,
      inhalt: template.content,
    })
    .select("id")
    .single();
  if (error || !data)
    return NextResponse.json(
      { error: "Die Liste konnte nicht angelegt werden." },
      { status: 500 },
    );
  return NextResponse.json({ id: data.id }, { status: 201 });
}
