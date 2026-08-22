/**
 * GET  /api/delivery/admin/fee-config  — alle Zonen mit Gebühren laden
 * POST /api/delivery/admin/fee-config  — Zone-Gebühr aktualisieren
 *
 * Anforderungen:
 *   - Eingeloggter Mitarbeiter (employees.auth_user_id)
 *
 * POST-Body:
 *   {
 *     location_id: string,
 *     zone: 'A' | 'B' | 'C' | 'D',
 *     surcharge_eur?: number,
 *     min_order_eur?: number,
 *     free_delivery_above_eur?: number | null,   // null = deaktivieren
 *     eta_base_min?: number
 *   }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAllZoneFees } from '@/lib/delivery/delivery-fee';
import { upsertZone, getZoneConfig, invalidateZoneCache } from '@/lib/delivery/zones';
import type { ZoneName } from '@/lib/delivery/zones';
import { getDeliveryAdminActor, isDeliveryAdminLocation } from '@/lib/delivery/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const actor = await getDeliveryAdminActor();
  if (!actor) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  const locationId = new URL(req.url).searchParams.get('location_id')
    ?? actor.location_id;
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  if (!await isDeliveryAdminLocation(actor, locationId)) {
    return NextResponse.json({ error: 'Standort nicht autorisiert' }, { status: 403 });
  }

  try {
    const zones = await getAllZoneFees(locationId);
    return NextResponse.json({ zones });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const actor = await getDeliveryAdminActor();
  if (!actor) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  const body = await req.json() as {
    location_id?: string;
    zone?: string;
    surcharge_eur?: number;
    min_order_eur?: number;
    free_delivery_above_eur?: number | null;
    eta_base_min?: number;
  };

  const locationId = body.location_id ?? actor.location_id;
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  if (!await isDeliveryAdminLocation(actor, locationId)) {
    return NextResponse.json({ error: 'Standort nicht autorisiert' }, { status: 403 });
  }

  const VALID_ZONES: ZoneName[] = ['A', 'B', 'C', 'D'];
  if (!body.zone || !VALID_ZONES.includes(body.zone as ZoneName)) {
    return NextResponse.json({ error: 'zone muss A, B, C oder D sein' }, { status: 400 });
  }

  if (body.surcharge_eur != null && (isNaN(Number(body.surcharge_eur)) || Number(body.surcharge_eur) < 0)) {
    return NextResponse.json({ error: 'surcharge_eur muss >= 0 sein' }, { status: 400 });
  }
  if (body.min_order_eur != null && (isNaN(Number(body.min_order_eur)) || Number(body.min_order_eur) < 0)) {
    return NextResponse.json({ error: 'min_order_eur muss >= 0 sein' }, { status: 400 });
  }
  if (body.free_delivery_above_eur != null && Number(body.free_delivery_above_eur) <= 0) {
    return NextResponse.json({ error: 'free_delivery_above_eur muss > 0 oder null sein' }, { status: 400 });
  }

  try {
    // Bestehende Zone laden, um fehlende Felder zu erhalten
    const zones = await getZoneConfig(locationId);
    const existing = zones.find((z) => z.name === body.zone);
    if (!existing) return NextResponse.json({ error: `Zone ${body.zone} nicht gefunden` }, { status: 404 });

    const updated = await upsertZone(locationId, {
      name:                    existing.name,
      label:                   existing.label,
      min_km:                  existing.min_km,
      max_km:                  existing.max_km,
      surcharge_eur:           body.surcharge_eur ?? existing.surcharge_eur,
      min_order_eur:           body.min_order_eur ?? existing.min_order_eur,
      free_delivery_above_eur: 'free_delivery_above_eur' in body
        ? (body.free_delivery_above_eur ?? null)
        : existing.free_delivery_above_eur,
      eta_base_min:            body.eta_base_min ?? existing.eta_base_min,
      color:                   existing.color,
    });

    invalidateZoneCache(locationId);
    return NextResponse.json({ ok: true, zone: updated });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
