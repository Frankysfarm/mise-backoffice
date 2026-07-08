/**
 * GET /api/delivery/admin/zonen-rentabilitaet?location_id=<uuid>&tage=30
 *
 * Phase 711 — Zonen-Rentabilitäts-API
 * Deckungsbeitrag pro Lieferzone:
 *   Einnahmen  = Summe delivery_fee der completed Batches je Zone
 *   Kraftstoff = Summe distance_km × 0.18 €/km je Zone
 *   Zeitkosten = Summe (completed_at - created_at) in Stunden × 12 €/h je Zone
 *   DB         = Einnahmen − Kraftstoff − Zeitkosten
 *   DB-Marge   = DB / Einnahmen × 100
 *
 * Response: ZoneRentabilitaet[] sortiert nach db_eur ↓
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KM_COST = 0.18;
const HOUR_COST = 12;

interface ZoneRentabilitaet {
  zone: string;
  einnahmen_eur: number;
  kraftstoff_eur: number;
  zeitkosten_eur: number;
  db_eur: number;
  db_marge_pct: number;
  batches_count: number;
  bewertung: 'profitabel' | 'neutral' | 'verlust';
}

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get('location_id');
  if (fromQuery) return fromQuery;

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const tage = Math.min(90, Math.max(1, parseInt(url.searchParams.get('tage') ?? '30', 10)));
  const since = new Date(Date.now() - tage * 86_400_000).toISOString();

  const sb = await createClient();

  const { data: batches } = await sb
    .from('delivery_batches')
    .select('zone, delivery_fee, distance_km, created_at, completed_at')
    .eq('location_id', locationId)
    .eq('status', 'completed')
    .gte('created_at', since)
    .not('zone', 'is', null);

  const allBatches = batches ?? [];

  const zoneMap: Record<string, {
    einnahmen: number; kraftstoff: number; zeitkosten: number; count: number;
  }> = {};

  for (const b of allBatches) {
    const z = b.zone ?? 'Unbekannt';
    if (!zoneMap[z]) zoneMap[z] = { einnahmen: 0, kraftstoff: 0, zeitkosten: 0, count: 0 };

    zoneMap[z].einnahmen += b.delivery_fee ?? 0;
    zoneMap[z].kraftstoff += (b.distance_km ?? 0) * KM_COST;

    if (b.created_at && b.completed_at) {
      const stunden = (new Date(b.completed_at).getTime() - new Date(b.created_at).getTime()) / 3_600_000;
      zoneMap[z].zeitkosten += stunden * HOUR_COST;
    }

    zoneMap[z].count += 1;
  }

  const result: ZoneRentabilitaet[] = Object.entries(zoneMap).map(([zone, agg]) => {
    const db = agg.einnahmen - agg.kraftstoff - agg.zeitkosten;
    const marge = agg.einnahmen > 0 ? Math.round((db / agg.einnahmen) * 100) : 0;
    return {
      zone,
      einnahmen_eur: Math.round(agg.einnahmen * 100) / 100,
      kraftstoff_eur: Math.round(agg.kraftstoff * 100) / 100,
      zeitkosten_eur: Math.round(agg.zeitkosten * 100) / 100,
      db_eur: Math.round(db * 100) / 100,
      db_marge_pct: marge,
      batches_count: agg.count,
      bewertung: marge >= 30 ? 'profitabel' : marge >= 0 ? 'neutral' : 'verlust',
    };
  });

  result.sort((a, b) => b.db_eur - a.db_eur);

  return NextResponse.json({ zonen: result, tage });
}
