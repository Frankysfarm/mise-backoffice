/**
 * GET /api/delivery/admin/fahrer-pausenzeit?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2393 — Fahrer-Pausenzeit-API
 * Ø Pausenzeit je Fahrer heute (Zeit zwischen Tour-Ende und nächstem Tour-Start in Min);
 * Alert >30min (zu langer Leerlauf) oder <5min (keine Pause);
 * Ampel grün(5–20min)/gelb(20–30min)/rot(>30min oder <5min);
 * Trend vs. Vorwoche; fahrer_single-Modus für Fahrer-App; Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type Ampel = 'gruen' | 'gelb' | 'rot';
export type Trend = 'steigend' | 'fallend' | 'stabil';

export interface FahrerPausenzeit {
  fahrer_id: string;
  fahrer_name: string;
  avg_pause_min: number;
  avg_pause_min_vw: number;
  pausen_anzahl: number;
  touren_heute: number;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert_lang: boolean;
  alert_kurz: boolean;
  rang: number;
}

export interface FahrerPausenzeitAntwort {
  location_id: string;
  fahrer: FahrerPausenzeit[];
  team_avg_pause_min: number;
  team_avg_pause_min_vw: number;
  alert_count: number;
  generiert_am: string;
  fahrer_single?: FahrerPausenzeit;
}

function ampelVon(min: number): Ampel {
  if (min < 5 || min > 30) return 'rot';
  if (min > 20) return 'gelb';
  return 'gruen';
}

function trendVon(heute: number, vorwoche: number): { trend: Trend; delta: number } {
  const delta = Math.round((heute - vorwoche) * 10) / 10;
  if (delta > 3) return { trend: 'steigend', delta };
  if (delta < -3) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER: Omit<FahrerPausenzeit, 'rang'>[] = [
  {
    fahrer_id: 'mock-f1',
    fahrer_name: 'Max Müller',
    avg_pause_min: 12.5,
    avg_pause_min_vw: 11.0,
    pausen_anzahl: 7,
    touren_heute: 8,
    trend: 'stabil',
    trend_delta: 1.5,
    ampel: 'gruen',
    alert_lang: false,
    alert_kurz: false,
  },
  {
    fahrer_id: 'mock-f2',
    fahrer_name: 'Sara Koch',
    avg_pause_min: 24.3,
    avg_pause_min_vw: 18.7,
    pausen_anzahl: 10,
    touren_heute: 11,
    trend: 'steigend',
    trend_delta: 5.6,
    ampel: 'gelb',
    alert_lang: false,
    alert_kurz: false,
  },
  {
    fahrer_id: 'mock-f3',
    fahrer_name: 'Tim Becker',
    avg_pause_min: 38.1,
    avg_pause_min_vw: 29.4,
    pausen_anzahl: 13,
    touren_heute: 14,
    trend: 'steigend',
    trend_delta: 8.7,
    ampel: 'rot',
    alert_lang: true,
    alert_kurz: false,
  },
  {
    fahrer_id: 'mock-f4',
    fahrer_name: 'Lisa Fuchs',
    avg_pause_min: 3.2,
    avg_pause_min_vw: 7.1,
    pausen_anzahl: 5,
    touren_heute: 6,
    trend: 'fallend',
    trend_delta: -3.9,
    ampel: 'rot',
    alert_lang: false,
    alert_kurz: true,
  },
  {
    fahrer_id: 'mock-f5',
    fahrer_name: 'Jonas Weber',
    avg_pause_min: 17.8,
    avg_pause_min_vw: 19.2,
    pausen_anzahl: 12,
    touren_heute: 13,
    trend: 'stabil',
    trend_delta: -1.4,
    ampel: 'gruen',
    alert_lang: false,
    alert_kurz: false,
  },
];

function mockResponse(locationId: string, driverId?: string | null): FahrerPausenzeitAntwort {
  const sorted = [...MOCK_FAHRER].sort((a, b) => b.avg_pause_min - a.avg_pause_min);
  const fahrer: FahrerPausenzeit[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
  const team_avg_pause_min =
    Math.round((fahrer.reduce((s, f) => s + f.avg_pause_min, 0) / fahrer.length) * 10) / 10;
  const team_avg_pause_min_vw =
    Math.round((fahrer.reduce((s, f) => s + f.avg_pause_min_vw, 0) / fahrer.length) * 10) / 10;
  const alert_count = fahrer.filter(f => f.alert_lang || f.alert_kurz).length;
  const base: FahrerPausenzeitAntwort = {
    location_id: locationId,
    fahrer,
    team_avg_pause_min,
    team_avg_pause_min_vw,
    alert_count,
    generiert_am: new Date().toISOString(),
  };
  if (driverId) {
    const single = fahrer.find(f => f.fahrer_id === driverId) ?? fahrer[0];
    return { ...base, fahrer_single: single };
  }
  return base;
}

type BatchRow = { fahrer_id: string; created_at: string; abgeschlossen_at: string | null };

function calcAvgPause(batches: BatchRow[]) {
  const byDriver = new Map<string, BatchRow[]>();
  for (const b of batches) {
    if (!b.fahrer_id) continue;
    const arr = byDriver.get(b.fahrer_id) ?? [];
    arr.push(b);
    byDriver.set(b.fahrer_id, arr);
  }
  const result = new Map<string, { avg: number; count: number; touren: number }>();
  for (const [fid, tours] of byDriver) {
    const s = [...tours].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const pauses: number[] = [];
    for (let i = 1; i < s.length; i++) {
      const prev = s[i - 1];
      if (!prev.abgeschlossen_at) continue;
      const ms = new Date(s[i].created_at).getTime() - new Date(prev.abgeschlossen_at).getTime();
      const min = ms / 60000;
      if (min > 0 && min < 120) pauses.push(min);
    }
    const avg =
      pauses.length > 0
        ? Math.round((pauses.reduce((a, p) => a + p, 0) / pauses.length) * 10) / 10
        : 0;
    result.set(fid, { avg, count: pauses.length, touren: s.length });
  }
  return result;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const locationId = req.nextUrl.searchParams.get('location_id') ?? '';
  const driverId = req.nextUrl.searchParams.get('driver_id') ?? null;

  try {
    const sb = await createClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastWeekEnd = new Date(lastWeek);
    lastWeekEnd.setDate(lastWeekEnd.getDate() + 1);

    const { data: drivers } = await sb
      .from('employees')
      .select('id, vorname, nachname')
      .eq('location_id', locationId)
      .eq('kann_ausliefern', true)
      .eq('aktiv', true);

    if (!drivers || drivers.length === 0) {
      return NextResponse.json(mockResponse(locationId, driverId));
    }

    const driverIds = driverId ? [driverId] : drivers.map(d => d.id);

    const { data: batchesToday } = await sb
      .from('delivery_batches')
      .select('fahrer_id, created_at, abgeschlossen_at')
      .eq('location_id', locationId)
      .gte('created_at', todayIso)
      .in('fahrer_id', driverIds)
      .order('fahrer_id')
      .order('created_at');

    if (!batchesToday || batchesToday.length === 0) {
      return NextResponse.json(mockResponse(locationId, driverId));
    }

    const { data: batchesVw } = await sb
      .from('delivery_batches')
      .select('fahrer_id, created_at, abgeschlossen_at')
      .eq('location_id', locationId)
      .gte('created_at', lastWeek.toISOString())
      .lt('created_at', lastWeekEnd.toISOString())
      .in('fahrer_id', driverIds)
      .order('fahrer_id')
      .order('created_at');

    const todayMap = calcAvgPause(batchesToday as BatchRow[]);
    const vwMap = calcAvgPause((batchesVw ?? []) as BatchRow[]);

    const driverList: Omit<FahrerPausenzeit, 'rang'>[] = drivers
      .filter(d => todayMap.has(d.id) && todayMap.get(d.id)!.count > 0)
      .map(d => {
        const { avg, count, touren } = todayMap.get(d.id)!;
        const vw = vwMap.get(d.id)?.avg ?? avg;
        const { trend, delta } = trendVon(avg, vw);
        return {
          fahrer_id: d.id,
          fahrer_name: `${d.vorname} ${d.nachname[0]}.`,
          avg_pause_min: avg,
          avg_pause_min_vw: vw,
          pausen_anzahl: count,
          touren_heute: touren,
          trend,
          trend_delta: delta,
          ampel: ampelVon(avg),
          alert_lang: avg > 30,
          alert_kurz: avg < 5 && avg > 0,
        };
      });

    if (driverList.length === 0) {
      return NextResponse.json(mockResponse(locationId, driverId));
    }

    const sorted = driverList.sort((a, b) => b.avg_pause_min - a.avg_pause_min);
    const fahrer: FahrerPausenzeit[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
    const team_avg_pause_min =
      Math.round((fahrer.reduce((s, f) => s + f.avg_pause_min, 0) / fahrer.length) * 10) / 10;
    const team_avg_pause_min_vw =
      Math.round((fahrer.reduce((s, f) => s + f.avg_pause_min_vw, 0) / fahrer.length) * 10) / 10;
    const alert_count = fahrer.filter(f => f.alert_lang || f.alert_kurz).length;

    const base: FahrerPausenzeitAntwort = {
      location_id: locationId,
      fahrer,
      team_avg_pause_min,
      team_avg_pause_min_vw,
      alert_count,
      generiert_am: new Date().toISOString(),
    };

    if (driverId) {
      const single = fahrer.find(f => f.fahrer_id === driverId) ?? fahrer[0];
      return NextResponse.json({ ...base, fahrer_single: single } satisfies FahrerPausenzeitAntwort);
    }

    return NextResponse.json(base satisfies FahrerPausenzeitAntwort);
  } catch {
    return NextResponse.json(mockResponse(locationId, driverId));
  }
}
