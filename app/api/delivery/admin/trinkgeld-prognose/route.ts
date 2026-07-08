/**
 * GET /api/delivery/admin/trinkgeld-prognose?location_id=<uuid>&tage=7
 *
 * Phase 736 — Kunden-Trinkgeld-Prognose-API
 * Ø-Trinkgeld pro Zone und Tagesstunde auf Basis der letzten N Tage.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const locationId = url.searchParams.get('location_id');
  const tage = Math.min(30, Math.max(1, parseInt(url.searchParams.get('tage') ?? '7', 10)));

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  const sb = await createClient();
  const seit = new Date(Date.now() - tage * 86_400_000).toISOString();

  const { data: tipps } = await sb
    .from('driver_tips')
    .select('amount_eur, created_at, zone_name')
    .eq('location_id', locationId)
    .gte('created_at', seit)
    .not('amount_eur', 'is', null);

  const alleItems = tipps ?? [];

  // Aggregation nach Zone
  const zonenMap = new Map<string, { summe: number; anzahl: number }>();
  // Aggregation nach Stunde
  const stundenMap = new Map<number, { summe: number; anzahl: number }>();

  for (const t of alleItems) {
    const zone = (t.zone_name as string | null) ?? 'Unbekannt';
    const stunde = new Date(t.created_at).getUTCHours();
    const betrag = Number(t.amount_eur ?? 0);

    const z = zonenMap.get(zone) ?? { summe: 0, anzahl: 0 };
    z.summe += betrag;
    z.anzahl += 1;
    zonenMap.set(zone, z);

    const s = stundenMap.get(stunde) ?? { summe: 0, anzahl: 0 };
    s.summe += betrag;
    s.anzahl += 1;
    stundenMap.set(stunde, s);
  }

  const zonen = Array.from(zonenMap.entries()).map(([zone, { summe, anzahl }]) => ({
    zone,
    avg_trinkgeld_eur: Math.round((summe / anzahl) * 100) / 100,
    anzahl,
  })).sort((a, b) => b.avg_trinkgeld_eur - a.avg_trinkgeld_eur);

  const stunden = Array.from(stundenMap.entries()).map(([stunde, { summe, anzahl }]) => ({
    stunde,
    avg_trinkgeld_eur: Math.round((summe / anzahl) * 100) / 100,
    anzahl,
  })).sort((a, b) => a.stunde - b.stunde);

  return NextResponse.json({ zonen, stunden, tage, gesamt_tipps: alleItems.length });
}
