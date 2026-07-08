/**
 * GET /api/delivery/admin/fahrer-score-verlauf?location_id=<uuid>
 *
 * Phase 800 — Fahrer-Score-Verlauf-API
 * Tages-Scores letzte 14 Tage je Fahrer:
 *   - Pünktlichkeit-Score (40%): Anteil Touren ≤ 45 Min
 *   - Bewertungs-Score (40%): Ø Kundenbewertung / 5 × 100
 *   - Storno-Score (20%): (1 - Storno-Quote) × 100
 *
 * Response: { ok, fahrer: FahrerScoreVerlauf[], generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface TagesScore {
  datum: string;
  score: number;
  puenktlichkeit: number;
  bewertung: number;
  stornos: number;
  touren: number;
}

interface FahrerScoreVerlauf {
  driver_id: string;
  name: string;
  scores: TagesScore[];
  trend: 'steigend' | 'fallend' | 'stabil';
  ø_score: number;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();

    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    // Abgeschlossene Touren der letzten 14 Tage
    const { data: batches, error: bErr } = await sb
      .from('mise_delivery_batches')
      .select('id, driver_id, started_at, completed_at, stop_count, status')
      .eq('location_id', locationId)
      .eq('status', 'completed')
      .gte('completed_at', cutoff)
      .not('driver_id', 'is', null)
      .not('started_at', 'is', null)
      .not('completed_at', 'is', null);

    if (bErr) throw bErr;

    const batchList = (batches ?? []) as {
      id: string;
      driver_id: string;
      started_at: string;
      completed_at: string;
      stop_count: number | null;
      status: string;
    }[];

    if (batchList.length === 0) {
      return NextResponse.json({ ok: true, fahrer: [], generatedAt: new Date().toISOString() });
    }

    const driverIds = [...new Set(batchList.map((b) => b.driver_id))];
    const batchIds = batchList.map((b) => b.id);

    // Fahrer-Namen
    const { data: drivers } = await sb
      .from('employees')
      .select('id, vorname, nachname')
      .in('id', driverIds);

    const driverMap = new Map<string, string>(
      (drivers ?? []).map((d: any) => [
        d.id,
        `${d.vorname ?? ''} ${d.nachname ?? ''}`.trim() || 'Fahrer',
      ]),
    );

    // Bestellungen der Touren (für Storno-Quote)
    const { data: orders } = await sb
      .from('orders')
      .select('batch_id, status')
      .in('batch_id', batchIds);

    const ordersByBatch = new Map<string, { status: string }[]>();
    for (const o of orders ?? []) {
      const arr = ordersByBatch.get((o as any).batch_id) ?? [];
      arr.push({ status: (o as any).status });
      ordersByBatch.set((o as any).batch_id, arr);
    }

    // Bewertungen (falls rating-Tabelle oder Spalte vorhanden)
    const { data: ratings } = await sb
      .from('orders')
      .select('batch_id, rating')
      .in('batch_id', batchIds)
      .not('rating', 'is', null);

    const ratingsByBatch = new Map<string, number[]>();
    for (const r of ratings ?? []) {
      if ((r as any).rating) {
        const arr = ratingsByBatch.get((r as any).batch_id) ?? [];
        arr.push((r as any).rating as number);
        ratingsByBatch.set((r as any).batch_id, arr);
      }
    }

    // Score-Berechnung je Fahrer × Tag
    const result: FahrerScoreVerlauf[] = [];

    for (const driverId of driverIds) {
      const fahrerBatches = batchList.filter((b) => b.driver_id === driverId);

      // Gruppiere nach Tag (UTC-Datum)
      const byDay = new Map<string, typeof fahrerBatches>();
      for (const b of fahrerBatches) {
        const day = b.completed_at.slice(0, 10);
        const arr = byDay.get(day) ?? [];
        arr.push(b);
        byDay.set(day, arr);
      }

      const scores: TagesScore[] = [];

      for (const [datum, dayBatches] of byDay) {
        let totalPuenktlich = 0;
        let totalTouren = dayBatches.length;
        let totalStornos = 0;
        let totalBestellungen = 0;
        const bewertungen: number[] = [];

        for (const b of dayBatches) {
          const dauerMin =
            (new Date(b.completed_at).getTime() - new Date(b.started_at).getTime()) / 60_000;
          if (dauerMin <= 45) totalPuenktlich++;

          const batchOrders = ordersByBatch.get(b.id) ?? [];
          totalBestellungen += batchOrders.length;
          totalStornos += batchOrders.filter((o) =>
            ['cancelled', 'storniert', 'abgebrochen'].includes(o.status),
          ).length;

          const batchRatings = ratingsByBatch.get(b.id) ?? [];
          bewertungen.push(...batchRatings);
        }

        const puenktlichkeitScore = totalTouren > 0 ? (totalPuenktlich / totalTouren) * 100 : 80;
        const ørBewertung = bewertungen.length > 0
          ? bewertungen.reduce((a, v) => a + v, 0) / bewertungen.length
          : 4.2;
        const bewertungsScore = Math.min(100, (ørBewertung / 5) * 100);
        const stornoQuote = totalBestellungen > 0 ? totalStornos / totalBestellungen : 0;
        const stornoScore = (1 - stornoQuote) * 100;

        const score = Math.round(
          puenktlichkeitScore * 0.4 + bewertungsScore * 0.4 + stornoScore * 0.2,
        );

        scores.push({
          datum,
          score,
          puenktlichkeit: Math.round(puenktlichkeitScore),
          bewertung: Math.round(bewertungsScore),
          stornos: totalStornos,
          touren: totalTouren,
        });
      }

      scores.sort((a, b) => a.datum.localeCompare(b.datum));

      const ø = scores.length > 0
        ? Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length)
        : 0;

      let trend: 'steigend' | 'fallend' | 'stabil' = 'stabil';
      if (scores.length >= 3) {
        const last3 = scores.slice(-3).map((s) => s.score);
        const delta = last3[2] - last3[0];
        if (delta >= 5) trend = 'steigend';
        else if (delta <= -5) trend = 'fallend';
      }

      result.push({
        driver_id: driverId,
        name: driverMap.get(driverId) ?? 'Fahrer',
        scores,
        trend,
        ø_score: ø,
      });
    }

    result.sort((a, b) => b.ø_score - a.ø_score);

    return NextResponse.json({ ok: true, fahrer: result, generatedAt: new Date().toISOString() });
  } catch (err: unknown) {
    console.error('[fahrer-score-verlauf]', err);
    return NextResponse.json({ ok: false, error: 'Serverfehler' }, { status: 500 });
  }
}
