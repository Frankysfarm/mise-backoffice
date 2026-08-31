import { NextRequest, NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/getCurrentEmployee";
import { createServiceClient } from "@/lib/supabase/server";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function rpcMessage(message: string | undefined) {
  if (message?.includes("negative"))
    return "Der Bestand darf nicht negativ werden.";
  if (message?.includes("complete place stock"))
    return "Beim Umlagern muss der vollständige Bestand übernommen werden.";
  if (message?.includes("still in use"))
    return "Die Einrichtung enthält noch Lagerplätze oder Produkte und kann nicht gelöscht werden.";
  if (message?.includes("outside") || message?.includes("may not"))
    return "Für diesen Standort fehlt die Berechtigung.";
  if (message?.includes("not found"))
    return "Der Lagerplatz wurde nicht gefunden.";
  return "Die Änderung konnte nicht gespeichert werden. Bitte Eingaben prüfen und erneut versuchen.";
}

export async function POST(req: NextRequest) {
  const actor = await getCurrentEmployee();
  if (!actor?.tenant_id)
    return NextResponse.json(
      { error: "Bitte erneut anmelden." },
      { status: 401 },
    );
  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (
    !body ||
    typeof body.locationId !== "string" ||
    !UUID.test(body.locationId)
  )
    return NextResponse.json({ error: "Ungültige Eingabe." }, { status: 400 });
  const service = createServiceClient();
  if (body.intent === "save-place") {
    if (
      typeof body.areaId !== "string" ||
      !UUID.test(body.areaId) ||
      typeof body.name !== "string" ||
      !body.name.trim() ||
      !["unit", "place"].includes(String(body.kind)) ||
      (body.parentId != null &&
        (typeof body.parentId !== "string" || !UUID.test(body.parentId)))
    )
      return NextResponse.json(
        { error: "Bitte alle Pflichtfelder vollständig ausfüllen." },
        { status: 400 },
      );
    const { data, error } = await service.rpc(
      "save_inventory_place_as_actor" as any,
      {
        p_id: typeof body.id === "string" ? body.id : null,
        p_tenant_id: actor.tenant_id,
        p_location_id: body.locationId,
        p_actor_id: actor.id,
        p_area_id: body.areaId,
        p_parent_id: body.parentId || null,
        p_name: body.name,
        p_kind: body.kind,
        p_unit_type: body.unitType || null,
        p_description: body.description || null,
      },
    );
    if (error)
      return NextResponse.json(
        { error: rpcMessage(error.message) },
        { status: 400 },
      );
    return NextResponse.json({ ok: true, place: data?.[0] });
  }
  if (body.intent === "delete-place") {
    if (typeof body.id !== "string" || !UUID.test(body.id))
      return NextResponse.json(
        { error: "Ungültiger Lagerplatz." },
        { status: 400 },
      );
    const { error } = await service.rpc(
      "delete_inventory_place_as_actor" as any,
      {
        p_id: body.id,
        p_tenant_id: actor.tenant_id,
        p_location_id: body.locationId,
        p_actor_id: actor.id,
      },
    );
    if (error)
      return NextResponse.json(
        { error: rpcMessage(error.message) },
        { status: 400 },
      );
    return NextResponse.json({ ok: true });
  }
  if (body.intent === "stock-action") {
    const amount = typeof body.amount === "number" ? body.amount : Number.NaN;
    if (
      typeof body.placeId !== "string" ||
      !UUID.test(body.placeId) ||
      typeof body.itemId !== "string" ||
      !UUID.test(body.itemId) ||
      !["book", "withdraw", "transfer", "count"].includes(
        String(body.action),
      ) ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      (body.action !== "count" && amount === 0) ||
      (body.targetPlaceId != null &&
        (typeof body.targetPlaceId !== "string" ||
          !UUID.test(body.targetPlaceId)))
    )
      return NextResponse.json(
        { error: "Bitte eine gültige Menge und Aktion angeben." },
        { status: 400 },
      );
    const { data, error } = await service.rpc(
      "record_inventory_place_action_as_actor" as any,
      {
        p_tenant_id: actor.tenant_id,
        p_location_id: body.locationId,
        p_actor_id: actor.id,
        p_place_id: body.placeId,
        p_item_id: body.itemId,
        p_action: body.action,
        p_amount: amount,
        p_target_place_id: body.targetPlaceId || null,
      },
    );
    if (error)
      return NextResponse.json(
        { error: rpcMessage(error.message) },
        { status: 400 },
      );
    return NextResponse.json({ ok: true, stock: data });
  }
  return NextResponse.json({ error: "Unbekannte Aktion." }, { status: 400 });
}
