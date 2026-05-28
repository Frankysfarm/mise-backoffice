/**
 * GET  /api/delivery/zones?location_id=...   — Zonen einer Location laden
 * POST /api/delivery/zones                   — Zone erstellen/aktualisieren
 */
import { NextRequest, NextResponse } from 'next/server';
import { listZones, upsertZone, seedDefaultZones, type ZoneConfig } from '@/lib/delivery/zones';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = new URL(req.url).searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const zones = await listZones(locationId);
  return NextResponse.json({ zones });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const body = await req.json() as { location_id?: string; seed?: boolean } & Partial<Omit<ZoneConfig, 'id'>>;

  if (!body.location_id) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  // Seed-Modus: Default-Zonen für neue Location anlegen
  if (body.seed) {
    await seedDefaultZones(body.location_id);
    const zones = await listZones(body.location_id);
    return NextResponse.json({ ok: true, zones });
  }

  // Einzelne Zone upserten
  const required: Array<keyof Omit<ZoneConfig, 'id'>> = ['name', 'label', 'min_km', 'max_km', 'eta_base_min'];
  for (const k of required) {
    if (body[k] == null) return NextResponse.json({ error: `${k} fehlt` }, { status: 400 });
  }

  const zone = await upsertZone(body.location_id, {
    name:          body.name!,
    label:         body.label!,
    min_km:        Number(body.min_km),
    max_km:        Number(body.max_km),
    surcharge_eur: Number(body.surcharge_eur ?? 0),
    min_order_eur: Number(body.min_order_eur ?? 0),
    eta_base_min:  Number(body.eta_base_min),
    color:         body.color ?? '#22c55e',
  });

  return NextResponse.json({ ok: true, zone });
}
