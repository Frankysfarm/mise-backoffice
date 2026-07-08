/**
 * GET /api/delivery/admin/schicht-bilanz?location_id=<uuid>
 *
 * Phase 701 — Schicht-Bilanz-Live-API
 * Echtzeit-Kosten/Einnahmen für die laufende Schicht (heute ab 05:00 UTC).
 *
 * Kosten-Modell:
 *   Kraftstoff:   0.18 €/km × Touren-km-Summe
 *   Schichtkosten: aktive_fahrer × vergangene_stunden × 12 € (anteilig)
 * Einnahmen:      Summe delivery_fee aller completed + assigned Batches heute
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KM_COST_EUR = 0.18;
const HOURLY_DRIVER_COST = 12;

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
  if (!locationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = await createClient();

  const todayStart = new Date();
  todayStart.setUTCHours(5, 0, 0, 0);
  if (todayStart > new Date()) {
    todayStart.setUTCDate(todayStart.getUTCDate() - 1);
  }
  const schichtStart = todayStart.toISOString();

  // Fetch delivery batches for today
  const { data: batches } = await sb
    .from('delivery_batches')
    .select('id, status, distance_km, created_at, delivery_fee, driver_id')
    .eq('location_id', locationId)
    .gte('created_at', schichtStart);

  const allBatches = batches ?? [];

  // Einnahmen: delivery_fee from completed + assigned batches
  const einnahmen = allBatches.reduce((sum, b) => {
    if (['completed', 'assigned', 'in_progress'].includes(b.status ?? '')) {
      return sum + (b.delivery_fee ?? 0);
    }
    return sum;
  }, 0);

  // Kraftstoff-Kosten
  const totalKm = allBatches.reduce((sum, b) => sum + (b.distance_km ?? 0), 0);
  const kraftstoffKosten = totalKm * KM_COST_EUR;

  // Active drivers today
  const uniqueDrivers = new Set(allBatches.map((b) => b.driver_id).filter(Boolean));
  const aktiveFahrer = uniqueDrivers.size;

  // Shift duration in hours
  const stunden = (Date.now() - new Date(schichtStart).getTime()) / 3_600_000;

  // Schicht-Kosten (anteilig pro aktivem Fahrer)
  const schichtKosten = aktiveFahrer * Math.min(stunden, 8) * HOURLY_DRIVER_COST;

  const kostenTotal = kraftstoffKosten + schichtKosten;
  const marginEur = einnahmen - kostenTotal;
  const marginPct = einnahmen > 0 ? Math.round((marginEur / einnahmen) * 100) : 0;

  const tourenAbgeschlossen = allBatches.filter((b) => b.status === 'completed').length;
  const tourenAktiv = allBatches.filter((b) =>
    ['assigned', 'in_progress'].includes(b.status ?? ''),
  ).length;

  const umsatzProStunde = stunden > 0 ? einnahmen / stunden : 0;

  return NextResponse.json({
    schicht_start: schichtStart,
    einnahmen_eur: Math.round(einnahmen * 100) / 100,
    kosten_eur: Math.round(kostenTotal * 100) / 100,
    margin_eur: Math.round(marginEur * 100) / 100,
    margin_pct: marginPct,
    touren_abgeschlossen: tourenAbgeschlossen,
    touren_aktiv: tourenAktiv,
    aktive_fahrer: aktiveFahrer,
    umsatz_pro_stunde: Math.round(umsatzProStunde * 100) / 100,
  });
}
