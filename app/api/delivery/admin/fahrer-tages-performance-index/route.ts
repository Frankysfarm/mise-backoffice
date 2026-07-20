/**
 * GET /api/delivery/admin/fahrer-tages-performance-index?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2771 — Fahrer-Tages-Performance-Index Backend
 *
 * Composite 0–100 Score je Fahrer heute aus:
 *   – Touren-Anzahl     (30 Pkt: ≥8→30, ≥5→20, ≥2→10, <2→0)
 *   – Pünktlichkeitsrate (30 Pkt: ≥90%→30, ≥75%→20, ≥50%→10, <50%→0)
 *   – Fehlerquote        (20 Pkt: <5%→20, <15%→10, <25%→5, ≥25%→0)
 *   – Abschlussrate      (20 Pkt: ≥95%→20, ≥80%→13, ≥60%→7, <60%→0)
 *
 * Ampel: grün(≥80) / gelb(60–79) / rot(<60).
 * Alert <60: "Tagesleistung zu niedrig!"
 * Trend vs. gestern. driver_id-Modus. Multi-Tenant. Supabase + Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend  = 'steigend' | 'fallend' | 'stabil';

interface Teilscores {
  touren:       number; // 0–30
  puenktlichkeit: number; // 0–30
  fehlerquote:  number; // 0–20
  abschluss:    number; // 0–20
}

interface FahrerIndex {
  fahrer_id:       string;
  fahrer_name:     string;
  score:           number; // 0–100
  score_gestern:   number | null;
  trend:           Trend;
  trend_delta:     number;
  teilscores:      Teilscores;
  touren_heute:    number;
  ampel:           Ampel;
  alert:           string | null;
  rang:            number;
}

interface ResponseData {
  location_id:    string;
  fahrer:         FahrerIndex[];
  team_avg_score: number;
  alert_count:    number;
  generiert_am:   string;
}

const MOCK: ResponseData = {
  location_id: 'mock',
  fahrer: [
    {
      fahrer_id: 'f1', fahrer_name: 'Max M.',   score: 88, score_gestern: 82, trend: 'steigend', trend_delta:  6,
      teilscores: { touren: 30, puenktlichkeit: 28, fehlerquote: 18, abschluss: 12 }, touren_heute: 9,
      ampel: 'gruen', alert: null, rang: 1,
    },
    {
      fahrer_id: 'f2', fahrer_name: 'Sara K.',  score: 74, score_gestern: 76, trend: 'fallend',  trend_delta: -2,
      teilscores: { touren: 20, puenktlichkeit: 24, fehlerquote: 18, abschluss: 12 }, touren_heute: 6,
      ampel: 'gelb',  alert: null, rang: 2,
    },
    {
      fahrer_id: 'f3', fahrer_name: 'Tim B.',   score: 61, score_gestern: 63, trend: 'fallend',  trend_delta: -2,
      teilscores: { touren: 10, puenktlichkeit: 20, fehlerquote: 18, abschluss: 13 }, touren_heute: 4,
      ampel: 'gelb',  alert: null, rang: 3,
    },
    {
      fahrer_id: 'f4', fahrer_name: 'Julia F.', score: 45, score_gestern: 50, trend: 'fallend',  trend_delta: -5,
      teilscores: { touren: 10, puenktlichkeit: 10, fehlerquote:  5, abschluss:  20 }, touren_heute: 3,
      ampel: 'rot',   alert: 'Tagesleistung zu niedrig!', rang: 4,
    },
  ],
  team_avg_score: 67,
  alert_count: 1,
  generiert_am: new Date().toISOString(),
};

function calcAmpel(s: number): Ampel {
  if (s >= 80) return 'gruen';
  if (s >= 60) return 'gelb';
  return 'rot';
}

function calcTrend(heute: number, gestern: number | null): { trend: Trend; delta: number } {
  if (gestern === null) return { trend: 'stabil', delta: 0 };
  const delta = heute - gestern;
  if (delta >  2) return { trend: 'steigend', delta };
  if (delta < -2) return { trend: 'fallend',  delta };
  return { trend: 'stabil', delta: 0 };
}

function tourScore(n: number): number {
  if (n >= 8) return 30;
  if (n >= 5) return 20;
  if (n >= 2) return 10;
  return 0;
}

function puenktScore(rate: number): number {
  if (rate >= 90) return 30;
  if (rate >= 75) return 20;
  if (rate >= 50) return 10;
  return 0;
}

function fehlerScore(pct: number): number {
  if (pct < 5)  return 20;
  if (pct < 15) return 10;
  if (pct < 25) return 5;
  return 0;
}

function abschlussScore(rate: number): number {
  if (rate >= 95) return 20;
  if (rate >= 80) return 13;
  if (rate >= 60) return 7;
  return 0;
}

type BatchRow = {
  driver_id: string;
  status: string;
  completed_at: string | null;
  promised_at:  string | null;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId   = searchParams.get('driver_id');

  if (!locationId) return NextResponse.json(MOCK);

  try {
    const sb      = createServiceClient();
    const now     = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const yStr     = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);

    const buildQ = (dateStr: string) => {
      const q = sb
        .from('delivery_batches')
        .select('driver_id, status, completed_at, promised_at')
        .eq('location_id', locationId)
        .gte('created_at', `${dateStr}T00:00:00Z`)
        .lt('created_at',  `${dateStr}T23:59:59Z`);
      if (driverId) q.eq('driver_id', driverId);
      return q;
    };

    const { data: todayBatches } = await buildQ(todayStr);
    const { data: yBatches      } = await buildQ(yStr);

    if (!todayBatches?.length) return NextResponse.json(MOCK);

    const calc = (rows: BatchRow[]) => {
      const map = new Map<string, { touren: number; pOnTime: number; pTotal: number; fehler: number; done: number }>();
      for (const b of rows) {
        const prev = map.get(b.driver_id) ?? { touren: 0, pOnTime: 0, pTotal: 0, fehler: 0, done: 0 };
        prev.touren++;
        if (b.status === 'completed') prev.done++;
        if (['cancelled', 'failed'].includes(b.status)) prev.fehler++;
        if (b.promised_at && b.completed_at) {
          prev.pTotal++;
          if (new Date(b.completed_at) <= new Date(b.promised_at)) prev.pOnTime++;
        }
        map.set(b.driver_id, prev);
      }
      return map;
    };

    const todayMap = calc(todayBatches as BatchRow[]);
    const yMap     = calc((yBatches ?? []) as BatchRow[]);

    if (todayMap.size === 0) return NextResponse.json(MOCK);

    const driverIds = [...todayMap.keys()];
    const { data: driversRaw } = await sb
      .from('delivery_drivers')
      .select('id, name')
      .in('id', driverIds);

    const nameMap = Object.fromEntries(
      (driversRaw ?? []).map((d: { id: string; name: string }) => [d.id, d.name])
    );

    const computeScore = (d: { touren: number; pOnTime: number; pTotal: number; fehler: number; done: number }): { score: number; ts: Teilscores } => {
      const puenktRate   = d.pTotal > 0 ? (d.pOnTime  / d.pTotal)  * 100 : 80;
      const fehlerPct    = d.touren > 0 ? (d.fehler   / d.touren)  * 100 : 0;
      const abschlRate   = d.touren > 0 ? (d.done     / d.touren)  * 100 : 100;
      const ts: Teilscores = {
        touren:        tourScore(d.touren),
        puenktlichkeit: puenktScore(puenktRate),
        fehlerquote:   fehlerScore(fehlerPct),
        abschluss:     abschlussScore(abschlRate),
      };
      return { score: ts.touren + ts.puenktlichkeit + ts.fehlerquote + ts.abschluss, ts };
    };

    const fahrer: FahrerIndex[] = driverIds.map((dId, idx) => {
      const td = todayMap.get(dId)!;
      const { score, ts } = computeScore(td);

      const yd = yMap.get(dId);
      const scoreGestern = yd ? computeScore(yd).score : null;

      const ampel           = calcAmpel(score);
      const { trend, delta } = calcTrend(score, scoreGestern);

      return {
        fahrer_id:     dId,
        fahrer_name:   nameMap[dId] ?? `Fahrer ${idx + 1}`,
        score,
        score_gestern: scoreGestern,
        trend,
        trend_delta:   delta,
        teilscores:    ts,
        touren_heute:  td.touren,
        ampel,
        alert:         ampel === 'rot' ? 'Tagesleistung zu niedrig!' : null,
        rang:          idx + 1,
      };
    });

    fahrer.sort((a, b) => b.score - a.score);
    fahrer.forEach((f, i) => { f.rang = i + 1; });

    const teamAvg = fahrer.length > 0
      ? Math.round(fahrer.reduce((s, f) => s + f.score, 0) / fahrer.length)
      : 0;

    return NextResponse.json({
      location_id:    locationId,
      fahrer,
      team_avg_score: teamAvg,
      alert_count:    fahrer.filter(f => f.alert !== null).length,
      generiert_am:   new Date().toISOString(),
    } satisfies ResponseData);
  } catch {
    return NextResponse.json(MOCK);
  }
}
