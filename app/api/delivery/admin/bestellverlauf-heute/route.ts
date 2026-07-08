/**
 * GET /api/delivery/admin/bestellverlauf-heute?location_id=<uuid>
 *
 * Phase 756 — Bestellverlauf-Heute-API
 * Stündliche Bestellzahlen für heute (05:00–23:00 UTC) + SLA-Alarm-Zusammenfassung.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const locationId = url.searchParams.get('location_id');

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  const sb = await createClient();
  const now = new Date();
  const heuteStart = new Date(now);
  heuteStart.setUTCHours(5, 0, 0, 0);
  if (now.getUTCHours() < 5) heuteStart.setUTCDate(heuteStart.getUTCDate() - 1);

  const { data: orders } = await sb
    .from('orders')
    .select('id, created_at, status')
    .eq('location_id', locationId)
    .gte('created_at', heuteStart.toISOString());

  const stundenMap = new Map<number, number>();
  let verletzungen = 0;
  const SLA_MS = 45 * 60_000;

  for (const o of orders ?? []) {
    const stunde = new Date(o.created_at).getUTCHours();
    stundenMap.set(stunde, (stundenMap.get(stunde) ?? 0) + 1);

    const aktiv = !['delivered', 'completed', 'geliefert', 'cancelled', 'storniert'].includes(o.status ?? '');
    if (aktiv && Date.now() - new Date(o.created_at).getTime() > SLA_MS) {
      verletzungen++;
    }
  }

  const stunden = Array.from({ length: 19 }, (_, i) => i + 5).map((h) => ({
    stunde: h,
    bestellungen: stundenMap.get(h) ?? 0,
  }));

  const peak = stunden.reduce((m, s) => s.bestellungen > m.bestellungen ? s : m, { stunde: -1, bestellungen: 0 });

  return NextResponse.json({
    stunden,
    peak_stunde: peak.stunde,
    peak_bestellungen: peak.bestellungen,
    gesamt_heute: orders?.length ?? 0,
    sla_verletzungen: verletzungen,
  });
}
