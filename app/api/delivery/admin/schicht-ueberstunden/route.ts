/**
 * GET /api/delivery/admin/schicht-ueberstunden?location_id=<uuid>
 *
 * Phase 741 — Schicht-Überstunden-API
 * Fahrer die länger als ihre geplante Schicht (8h Standard) aktiv sind.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STANDARD_SCHICHT_H = 8;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const locationId = url.searchParams.get('location_id');

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  const sb = await createClient();

  const { data: shifts } = await sb
    .from('driver_shifts')
    .select('id, driver_id, started_at, planned_end_at, employees!inner(vorname, nachname)')
    .eq('location_id', locationId)
    .eq('status', 'active')
    .not('started_at', 'is', null);

  const now = Date.now();

  const ueberstunden = (shifts ?? []).map((s) => {
    const startMs = new Date(s.started_at as string).getTime();
    const schichtMin = Math.floor((now - startMs) / 60_000);
    const schichtH = schichtMin / 60;
    const geplanteEndeMs = s.planned_end_at
      ? new Date(s.planned_end_at as string).getTime()
      : startMs + STANDARD_SCHICHT_H * 3_600_000;
    const ueberstundenMin = Math.max(0, Math.floor((now - geplanteEndeMs) / 60_000));

    const emp = s.employees as { vorname: string; nachname: string } | null;
    const name = emp ? `${emp.vorname} ${emp.nachname}` : 'Unbekannt';

    return {
      driver_id: s.driver_id,
      name,
      schicht_min: schichtMin,
      schicht_h: Math.round(schichtH * 10) / 10,
      ueberstunden_min: ueberstundenMin,
      hat_ueberstunden: ueberstundenMin > 0,
    };
  }).filter((f) => f.hat_ueberstunden)
    .sort((a, b) => b.ueberstunden_min - a.ueberstunden_min);

  return NextResponse.json({ ueberstunden, anzahl: ueberstunden.length });
}
