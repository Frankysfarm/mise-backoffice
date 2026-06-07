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
import { createClient } from '@/lib/supabase/server';
import { getAllZoneFees } from '@/lib/delivery/delivery-fee';
import { upsertZone, getZoneConfig, invalidateZoneCache } from '@/lib/delivery/zones';
import type { ZoneName } from '@/lib/delivery/zones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { data } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  return data?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = new URL(req.url).searchParams.get('location_id')
    ?? await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  try {
    const zones = await getAllZoneFees(locationId);
    return NextResponse.json({ zones });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const body = await req.json() as {
    location_id?: string;
    zone?: string;
    surcharge_eur?: number;
    min_order_eur?: number;
    free_delivery_above_eur?: number | null;
    eta_base_min?: number;
  };

  const locationId = body.location_id ?? await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

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
