/**
 * GET /api/delivery/admin/zonen-umsatz-prognose?location_id=<uuid>
 *
 * Phase 1883 — Zonen-Umsatz-Prognose
 *
 * Prognostizierter Umsatz je Zone A/B/C/D für die nächsten 2h.
 * Berechnung: Ø Umsatz der letzten 7 Tage in diesem Stunden-Fenster
 *             × Trend-Faktor (heute vs. Vorwoche gleiche Stunde).
 *
 * Response:
 * {
 *   zonen: [
 *     { zone: 'A', aktuell_eur: 120.50, prognose_eur: 145.00, ziel_eur: 130.00,
 *       trend: 'steigend' | 'stabil' | 'fallend', abweichung_pct: 11.5, bestellungen_prognose: 8 },
 *     ...
 *   ],
 *   generiert_um: ISO-string
 * }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ZONEN = ['A', 'B', 'C', 'D'] as const;
type Zone = (typeof ZONEN)[number];

const ZIEL_EUR: Record<Zone, number> = { A: 130, B: 100, C: 70, D: 40 };
const MOCK_AKTUELL: Record<Zone, number> = { A: 112, B: 87, C: 53, D: 21 };
const MOCK_PROGNOSE: Record<Zone, number> = { A: 148, B: 102, C: 61, D: 18 };
const MOCK_BESTELLUNGEN: Record<Zone, number> = { A: 9, B: 6, C: 4, D: 1 };

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const qp = req.nextUrl.searchParams.get('location_id');
  if (qp) return qp;
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
  todayStart.setHours(0, 0, 0, 0);

  // Umsatz heute je Zone
  const { data: todayOrders } = await sb
    .from('orders')
    .select('delivery_zone, total, status, created_at')
    .eq('location_id', locationId)
    .gte('created_at', todayStart.toISOString())
    .in('status', ['delivered', 'delivering', 'confirmed', 'preparing', 'ready', 'pending']);

  // Gleiche Stunden letzte Woche für Trend
  const lastWeekSameWindow = new Date(now);
  lastWeekSameWindow.setDate(lastWeekSameWindow.getDate() - 7);
  const lastWeekWindowStart = new Date(lastWeekSameWindow);
  lastWeekWindowStart.setHours(0, 0, 0, 0);
  const lastWeekWindowEnd = new Date(lastWeekSameWindow);
  lastWeekWindowEnd.setHours(now.getHours(), 59, 59, 999);

  const { data: lastWeekOrders } = await sb
    .from('orders')
    .select('delivery_zone, total')
    .eq('location_id', locationId)
    .gte('created_at', lastWeekWindowStart.toISOString())
    .lte('created_at', lastWeekWindowEnd.toISOString())
    .in('status', ['delivered', 'delivering']);

  const useMock = !todayOrders || todayOrders.length === 0;

  const zonen = ZONEN.map((zone) => {
    if (useMock) {
      const prog = MOCK_PROGNOSE[zone];
      const akt = MOCK_AKTUELL[zone];
      const ziel = ZIEL_EUR[zone];
      const abweichung = ((prog - ziel) / ziel) * 100;
      return {
        zone,
        aktuell_eur: akt,
        prognose_eur: prog,
        ziel_eur: ziel,
        trend: prog > akt * 1.05 ? 'steigend' : prog < akt * 0.95 ? 'fallend' : 'stabil',
        abweichung_pct: Math.round(abweichung * 10) / 10,
        bestellungen_prognose: MOCK_BESTELLUNGEN[zone],
        mock: true,
      };
    }

    const zoneOrders = (todayOrders ?? []).filter(
      (o) => (o.delivery_zone ?? 'A').toUpperCase() === zone,
    );
    const zoneLastWeek = (lastWeekOrders ?? []).filter(
      (o) => (o.delivery_zone ?? 'A').toUpperCase() === zone,
    );

    const aktuell = zoneOrders.reduce((s, o) => s + (o.total ?? 0) / 100, 0);
    const lastWeekAmt = zoneLastWeek.reduce((s, o) => s + (o.total ?? 0) / 100, 0);

    // Trend-Faktor: heute/vergangeneWoche; fehlender Vergleich → 1.0
    const trendFaktor = lastWeekAmt > 0 ? Math.min(2, aktuell / lastWeekAmt) : 1.0;

    // Prognose: aktuelle Rate × Restzeit-Hochrechnung auf 2h
    const stunden = Math.max(0.5, now.getHours() - todayStart.getHours());
    const rateProStunde = aktuell / stunden;
    const prognose = aktuell + rateProStunde * 2 * trendFaktor;

    const ziel = ZIEL_EUR[zone];
    const abweichung = ((prognose - ziel) / ziel) * 100;

    return {
      zone,
      aktuell_eur: Math.round(aktuell * 100) / 100,
      prognose_eur: Math.round(prognose * 100) / 100,
      ziel_eur: ziel,
      trend: trendFaktor > 1.05 ? 'steigend' : trendFaktor < 0.95 ? 'fallend' : 'stabil',
      abweichung_pct: Math.round(abweichung * 10) / 10,
      bestellungen_prognose: Math.round(zoneOrders.length * (1 + 2 / Math.max(1, stunden)) * trendFaktor),
      mock: false,
    };
  });

  return NextResponse.json({ zonen, generiert_um: now.toISOString() });
}
