/**
 * GET /api/delivery/admin/fahrer-bonus-prognose?location_id=<uuid>
 *
 * Phase 1522 — Fahrer-Bonus-Prognose-API
 * Hochrechnung ob Fahrer Tages-Bonus erreicht (Stopps-Ziel, Pünktlichkeits-Ziel);
 * Status: erreicht / auf-kurs / nicht-erreichbar je Fahrer.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type BonusStatus = 'erreicht' | 'auf-kurs' | 'nicht-erreichbar';

export interface FahrerBonusPrognoseEintrag {
  fahrer_id: string;
  fahrer_name: string;
  stopps_heute: number;
  stopps_ziel: number;
  fehlende_stopps: number;
  puenktlichkeit_pct: number;
  puenktlichkeit_ziel_pct: number;
  puenktlichkeit_gap_pct: number;
  bonus_status: BonusStatus;
  bonus_betrag_eur: number;
  prognose_erreichbar: boolean;
}

export interface FahrerBonusPrognoseResponse {
  fahrer: FahrerBonusPrognoseEintrag[];
  bonus_betrag_eur: number;
  stopps_ziel: number;
  puenktlichkeit_ziel_pct: number;
  location_id: string;
  generiert_am: string;
}

const STOPPS_ZIEL = 15;
const PUENKTLICHKEIT_ZIEL_PCT = 80;
const BONUS_BETRAG_EUR = 25;

const MOCK_FAHRER = [
  { id: 'f1', name: 'Alex M.' },
  { id: 'f2', name: 'Ben K.' },
  { id: 'f3', name: 'Clara S.' },
  { id: 'f4', name: 'David R.' },
  { id: 'f5', name: 'Eva L.' },
];

function berechneStatus(
  stopps: number,
  stoppZiel: number,
  puenktlichkeit: number,
  puenktlichkeitZiel: number,
): BonusStatus {
  const stoppOk = stopps >= stoppZiel;
  const puenktOk = puenktlichkeit >= puenktlichkeitZiel;
  if (stoppOk && puenktOk) return 'erreicht';
  const schichtPct = Math.min(1, stopps / Math.max(stoppZiel, 1));
  if (schichtPct >= 0.5 && puenktlichkeit >= puenktlichkeitZiel - 10) return 'auf-kurs';
  return 'nicht-erreichbar';
}

function buildMock(locationId: string): FahrerBonusPrognoseResponse {
  const fahrer: FahrerBonusPrognoseEintrag[] = MOCK_FAHRER.map((f, i) => {
    const seed = (f.id.charCodeAt(1) ?? 49) % 5;
    const stopps = 10 + ((seed + i) % 8);
    const puenktlichkeit = 72 + ((seed * 3 + i * 2) % 24);
    const status = berechneStatus(stopps, STOPPS_ZIEL, puenktlichkeit, PUENKTLICHKEIT_ZIEL_PCT);
    return {
      fahrer_id: f.id,
      fahrer_name: f.name,
      stopps_heute: stopps,
      stopps_ziel: STOPPS_ZIEL,
      fehlende_stopps: Math.max(0, STOPPS_ZIEL - stopps),
      puenktlichkeit_pct: puenktlichkeit,
      puenktlichkeit_ziel_pct: PUENKTLICHKEIT_ZIEL_PCT,
      puenktlichkeit_gap_pct: Math.max(0, PUENKTLICHKEIT_ZIEL_PCT - puenktlichkeit),
      bonus_status: status,
      bonus_betrag_eur: status === 'erreicht' ? BONUS_BETRAG_EUR : 0,
      prognose_erreichbar: status !== 'nicht-erreichbar',
    };
  });

  return {
    fahrer,
    bonus_betrag_eur: BONUS_BETRAG_EUR,
    stopps_ziel: STOPPS_ZIEL,
    puenktlichkeit_ziel_pct: PUENKTLICHKEIT_ZIEL_PCT,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: batches } = await (sb as any)
      .from('mise_delivery_batches')
      .select('driver_id, status, created_at')
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString());

    const { data: stops } = await (sb as any)
      .from('mise_delivery_stops')
      .select('driver_id, geliefert_am, soll_zeit')
      .gte('created_at', todayStart.toISOString());

    const { data: driverRows } = await (sb as any)
      .from('delivery_drivers')
      .select('id, full_name')
      .eq('location_id', locationId)
      .eq('is_active', true);

    const hasBatches = Array.isArray(batches) && batches.length > 0;
    if (!hasBatches) {
      return NextResponse.json(buildMock(locationId));
    }

    type BatchRow = { driver_id?: string | null };
    type StopRow = { driver_id?: string | null; geliefert_am?: string | null; soll_zeit?: string | null };
    type DriverRow = { id: string; full_name?: string | null };

    const driverMap = new Map<string, string>();
    ((driverRows as DriverRow[]) ?? []).forEach(d => driverMap.set(d.id, d.full_name ?? d.id));

    function isPuenktlich(stop: StopRow): boolean {
      if (!stop.geliefert_am) return false;
      if (stop.soll_zeit) {
        return new Date(stop.geliefert_am).getTime() <= new Date(stop.soll_zeit).getTime() + 2 * 60_000;
      }
      return true;
    }

    const driverStops = new Map<string, StopRow[]>();
    ((stops as StopRow[]) ?? []).forEach(s => {
      if (!s.driver_id) return;
      if (!driverStops.has(s.driver_id)) driverStops.set(s.driver_id, []);
      driverStops.get(s.driver_id)!.push(s);
    });

    const allDriverIds = new Set<string>();
    ((batches as BatchRow[]) ?? []).forEach(b => { if (b.driver_id) allDriverIds.add(b.driver_id); });

    const fahrer: FahrerBonusPrognoseEintrag[] = Array.from(allDriverIds).map(driverId => {
      const myStops = driverStops.get(driverId) ?? [];
      const stoppsHeute = myStops.filter(s => !!s.geliefert_am).length;
      const puenktlichStopps = myStops.filter(isPuenktlich).length;
      const puenktlichkeitPct = myStops.length > 0
        ? Math.round((puenktlichStopps / myStops.length) * 100)
        : 0;
      const status = berechneStatus(stoppsHeute, STOPPS_ZIEL, puenktlichkeitPct, PUENKTLICHKEIT_ZIEL_PCT);

      return {
        fahrer_id: driverId,
        fahrer_name: driverMap.get(driverId) ?? driverId,
        stopps_heute: stoppsHeute,
        stopps_ziel: STOPPS_ZIEL,
        fehlende_stopps: Math.max(0, STOPPS_ZIEL - stoppsHeute),
        puenktlichkeit_pct: puenktlichkeitPct,
        puenktlichkeit_ziel_pct: PUENKTLICHKEIT_ZIEL_PCT,
        puenktlichkeit_gap_pct: Math.max(0, PUENKTLICHKEIT_ZIEL_PCT - puenktlichkeitPct),
        bonus_status: status,
        bonus_betrag_eur: status === 'erreicht' ? BONUS_BETRAG_EUR : 0,
        prognose_erreichbar: status !== 'nicht-erreichbar',
      };
    });

    return NextResponse.json({
      fahrer,
      bonus_betrag_eur: BONUS_BETRAG_EUR,
      stopps_ziel: STOPPS_ZIEL,
      puenktlichkeit_ziel_pct: PUENKTLICHKEIT_ZIEL_PCT,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerBonusPrognoseResponse);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
