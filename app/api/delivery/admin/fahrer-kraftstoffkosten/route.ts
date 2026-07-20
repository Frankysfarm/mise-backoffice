/**
 * GET /api/delivery/admin/fahrer-kraftstoffkosten?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2661 — Fahrer-Kraftstoffkosten-API
 * Geschätzte Kraftstoffkosten je Fahrer heute (gesamt_km × FUEL_RATE);
 * Ampel grün(≤5€)/gelb(6–10€)/rot(>10€); Alert >10€; Trend vs. gestern; Multi-Tenant; Supabase+Mock.
 *
 * Response: { location_id, fahrer: FahrerKraftstoffkosten[], team_avg_kosten, alert_count, generiert_am }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type Ampel = 'gruen' | 'gelb' | 'rot';
export type Trend = 'steigend' | 'fallend' | 'stabil';

/** Kraftstoffkosten-Rate €/km (Benzin ~8L/100km × 1.50€/L) */
const FUEL_RATE = 0.12;

export interface FahrerKraftstoffkosten {
  fahrer_id: string;
  fahrer_name: string;
  gesamt_km: number;
  touren_heute: number;
  kosten_heute: number;
  avg_kosten_tour: number;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  rang: number;
}

export interface FahrerKraftstoffkostenAntwort {
  location_id: string;
  fahrer: FahrerKraftstoffkosten[];
  team_avg_kosten: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(kosten: number): Ampel {
  if (kosten <= 5)  return 'gruen';
  if (kosten <= 10) return 'gelb';
  return 'rot';
}

function trendVon(heute: number, gestern: number): { trend: Trend; delta: number } {
  const delta = Math.round((heute - gestern) * 100) / 100;
  if (delta > 0.5)  return { trend: 'steigend', delta };
  if (delta < -0.5) return { trend: 'fallend',  delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER: Omit<FahrerKraftstoffkosten, 'rang'>[] = [
  {
    fahrer_id:     'mock-f1',
    fahrer_name:   'Max Müller',
    gesamt_km:     67.4,
    touren_heute:  8,
    kosten_heute:  Math.round(67.4 * FUEL_RATE * 100) / 100,
    avg_kosten_tour: Math.round((67.4 * FUEL_RATE / 8) * 100) / 100,
    trend:         'stabil',
    trend_delta:   0.12,
    ampel:         'gelb',
  },
  {
    fahrer_id:     'mock-f2',
    fahrer_name:   'Sara Koch',
    gesamt_km:     95.2,
    touren_heute:  11,
    kosten_heute:  Math.round(95.2 * FUEL_RATE * 100) / 100,
    avg_kosten_tour: Math.round((95.2 * FUEL_RATE / 11) * 100) / 100,
    trend:         'steigend',
    trend_delta:   1.44,
    ampel:         'rot',
  },
  {
    fahrer_id:     'mock-f3',
    fahrer_name:   'Tim Becker',
    gesamt_km:     134.8,
    touren_heute:  14,
    kosten_heute:  Math.round(134.8 * FUEL_RATE * 100) / 100,
    avg_kosten_tour: Math.round((134.8 * FUEL_RATE / 14) * 100) / 100,
    trend:         'steigend',
    trend_delta:   2.22,
    ampel:         'rot',
  },
  {
    fahrer_id:     'mock-f4',
    fahrer_name:   'Lisa Fuchs',
    gesamt_km:     38.5,
    touren_heute:  5,
    kosten_heute:  Math.round(38.5 * FUEL_RATE * 100) / 100,
    avg_kosten_tour: Math.round((38.5 * FUEL_RATE / 5) * 100) / 100,
    trend:         'fallend',
    trend_delta:   -0.74,
    ampel:         'gruen',
  },
  {
    fahrer_id:     'mock-f5',
    fahrer_name:   'Jonas Weber',
    gesamt_km:     113.7,
    touren_heute:  13,
    kosten_heute:  Math.round(113.7 * FUEL_RATE * 100) / 100,
    avg_kosten_tour: Math.round((113.7 * FUEL_RATE / 13) * 100) / 100,
    trend:         'stabil',
    trend_delta:   0.25,
    ampel:         'rot',
  },
];

function mockResponse(locationId: string): FahrerKraftstoffkostenAntwort {
  const sorted  = [...MOCK_FAHRER].sort((a, b) => b.kosten_heute - a.kosten_heute);
  const fahrer  = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
  const team_avg_kosten = fahrer.length > 0
    ? Math.round((fahrer.reduce((s, f) => s + f.kosten_heute, 0) / fahrer.length) * 100) / 100
    : 0;
  const alert_count = fahrer.filter(f => f.ampel === 'rot').length;
  return { location_id: locationId, fahrer, team_avg_kosten, alert_count, generiert_am: new Date().toISOString() };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const locationId = req.nextUrl.searchParams.get('location_id') ?? '';
  const driverId   = req.nextUrl.searchParams.get('driver_id');

  try {
    const sb    = await createClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayIso = yesterday.toISOString();

    let driversQuery = sb
      .from('employees')
      .select('id, vorname, nachname')
      .eq('location_id', locationId)
      .eq('kann_ausliefern', true)
      .eq('aktiv', true);
    if (driverId) driversQuery = driversQuery.eq('id', driverId);

    const { data: drivers } = await driversQuery;
    if (!drivers || drivers.length === 0) return NextResponse.json(mockResponse(locationId));

    let batchQuery = sb
      .from('delivery_batches')
      .select('fahrer_id, distanz_km, created_at')
      .eq('location_id', locationId)
      .gte('created_at', todayIso)
      .not('fahrer_id', 'is', null);
    if (driverId) batchQuery = batchQuery.eq('fahrer_id', driverId);

    const { data: batches } = await batchQuery;
    if (!batches || batches.length === 0) return NextResponse.json(mockResponse(locationId));

    let batchGesternQuery = sb
      .from('delivery_batches')
      .select('fahrer_id, distanz_km')
      .eq('location_id', locationId)
      .gte('created_at', yesterdayIso)
      .lt('created_at', todayIso)
      .not('fahrer_id', 'is', null);
    if (driverId) batchGesternQuery = batchGesternQuery.eq('fahrer_id', driverId);

    const { data: batchesGestern } = await batchGesternQuery;

    const todayMap = new Map<string, { km: number; tours: number }>();
    for (const b of batches) {
      if (!b.fahrer_id) continue;
      const e = todayMap.get(b.fahrer_id) ?? { km: 0, tours: 0 };
      e.km    += b.distanz_km ?? 0;
      e.tours += 1;
      todayMap.set(b.fahrer_id, e);
    }

    const gesternMap = new Map<string, number>();
    for (const b of (batchesGestern ?? [])) {
      if (!b.fahrer_id) continue;
      gesternMap.set(b.fahrer_id, (gesternMap.get(b.fahrer_id) ?? 0) + (b.distanz_km ?? 0));
    }

    const driverList: Omit<FahrerKraftstoffkosten, 'rang'>[] = drivers
      .filter(d => todayMap.has(d.id))
      .map(d => {
        const { km, tours }  = todayMap.get(d.id)!;
        const kmGestern      = gesternMap.get(d.id) ?? 0;
        const kostenHeute    = Math.round(km * FUEL_RATE * 100) / 100;
        const kostenGestern  = Math.round(kmGestern * FUEL_RATE * 100) / 100;
        const { trend, delta } = trendVon(kostenHeute, kostenGestern);
        return {
          fahrer_id:       d.id,
          fahrer_name:     `${d.vorname} ${d.nachname[0]}.`,
          gesamt_km:       Math.round(km * 10) / 10,
          touren_heute:    tours,
          kosten_heute:    kostenHeute,
          avg_kosten_tour: tours > 0 ? Math.round((kostenHeute / tours) * 100) / 100 : 0,
          trend,
          trend_delta:     delta,
          ampel:           ampelVon(kostenHeute),
        };
      });

    if (driverList.length === 0) return NextResponse.json(mockResponse(locationId));

    const sorted = driverList.sort((a, b) => b.kosten_heute - a.kosten_heute);
    const fahrer = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
    const team_avg_kosten = fahrer.length > 0
      ? Math.round((fahrer.reduce((s, f) => s + f.kosten_heute, 0) / fahrer.length) * 100) / 100
      : 0;
    const alert_count = fahrer.filter(f => f.ampel === 'rot').length;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_avg_kosten,
      alert_count,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerKraftstoffkostenAntwort);
  } catch {
    return NextResponse.json(mockResponse(locationId));
  }
}
