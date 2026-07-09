/**
 * GET /api/delivery/admin/fahrer-bonus-berechnung?location_id=<uuid>
 *
 * Phase 911 — Fahrer-Bonus-Berechnung-API
 * Automatische Bonus-Ermittlung je Fahrer für die aktuelle Schicht.
 * Faktoren: Pünktlichkeit, Touren-Anzahl, Ø-Bewertung.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface BonusEintrag {
  driver_id: string;
  fahrer_name: string;
  touren: number;
  puenktlichkeit_pct: number;
  bewertung_avg: number;
  bonus_eur: number;
  bonus_gruende: string[];
}

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const fromQuery = new URL(req.url).searchParams.get('location_id');
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

  const sb = await createClient();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  // Aktive Schichten heute
  const { data: schichten } = await sb
    .from('driver_shifts')
    .select('id, driver_id, employee:employees(id, first_name, last_name)')
    .eq('location_id', locationId)
    .gte('started_at', todayStart.toISOString())
    .not('driver_id', 'is', null);

  if (!schichten || schichten.length === 0) {
    return NextResponse.json({ fahrer: [], generatedAt: now.toISOString() });
  }

  const driverIds = [...new Set(schichten.map((s) => s.driver_id as string).filter(Boolean))];

  // Touren je Fahrer heute
  const { data: touren } = await sb
    .from('delivery_batches')
    .select('id, driver_id, status, created_at')
    .eq('location_id', locationId)
    .in('driver_id', driverIds)
    .gte('created_at', todayStart.toISOString());

  // Stopps für Pünktlichkeit
  const tourIds = (touren ?? []).map((t) => t.id);
  const { data: stopps } = tourIds.length
    ? await sb
        .from('delivery_stops')
        .select('batch_id, delivered_at, eta_at')
        .in('batch_id', tourIds)
        .not('delivered_at', 'is', null)
    : { data: [] };

  // Bewertungen je Fahrer heute
  const { data: ratings } = await sb
    .from('driver_ratings')
    .select('driver_id, rating')
    .in('driver_id', driverIds)
    .gte('created_at', todayStart.toISOString());

  const fahrer: BonusEintrag[] = driverIds.map((driverId) => {
    const schicht = schichten.find((s) => s.driver_id === driverId);
    const emp = schicht?.employee as { first_name?: string; last_name?: string } | null;
    const fahrer_name = emp
      ? `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim() || 'Fahrer'
      : 'Fahrer';

    const fahrerTouren = (touren ?? []).filter((t) => t.driver_id === driverId);
    const tourenAnzahl = fahrerTouren.length;

    const relevanteTourIds = fahrerTouren.map((t) => t.id);
    const fahrerStopps = (stopps ?? []).filter((s) => relevanteTourIds.includes(s.batch_id));
    const puenktlich = fahrerStopps.filter((s) => {
      if (!s.delivered_at || !s.eta_at) return true;
      return new Date(s.delivered_at) <= new Date(s.eta_at);
    }).length;
    const puenktlichkeitPct = fahrerStopps.length > 0
      ? Math.round((puenktlich / fahrerStopps.length) * 100)
      : 100;

    const fahrerRatings = (ratings ?? []).filter((r) => r.driver_id === driverId);
    const bewertungAvg = fahrerRatings.length > 0
      ? fahrerRatings.reduce((s, r) => s + (r.rating ?? 0), 0) / fahrerRatings.length
      : 0;

    const gruende: string[] = [];
    let bonus = 0;

    if (tourenAnzahl >= 10) { bonus += 2; gruende.push('≥10 Touren +2€'); }
    else if (tourenAnzahl >= 8) { bonus += 1; gruende.push('≥8 Touren +1€'); }

    if (puenktlichkeitPct >= 95) { bonus += 3; gruende.push('Pünktlichkeit ≥95% +3€'); }
    else if (puenktlichkeitPct >= 90) { bonus += 2; gruende.push('Pünktlichkeit ≥90% +2€'); }

    if (bewertungAvg >= 4.8) { bonus += 2; gruende.push('Bewertung ≥4.8★ +2€'); }
    else if (bewertungAvg >= 4.5) { bonus += 1; gruende.push('Bewertung ≥4.5★ +1€'); }

    return {
      driver_id: driverId,
      fahrer_name,
      touren: tourenAnzahl,
      puenktlichkeit_pct: puenktlichkeitPct,
      bewertung_avg: Math.round(bewertungAvg * 10) / 10,
      bonus_eur: bonus,
      bonus_gruende: gruende,
    };
  });

  fahrer.sort((a, b) => b.bonus_eur - a.bonus_eur);

  return NextResponse.json({ fahrer, generatedAt: now.toISOString() });
}
