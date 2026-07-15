/**
 * GET /api/delivery/admin/bestelleingang-reaktionszeit?location_id=<uuid>
 *
 * Phase 1781 — Bestelleingang-Reaktionszeit-API (Backend)
 * Durchschnittliche Zeit von Bestelleingang bis Küchen-Bestätigung je Stunde heute;
 * Ampel grün/gelb/rot; Trend ggü. gestern; Multi-Tenant; Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type Ampel = 'gruen' | 'gelb' | 'rot';

export interface ReaktionszeitSlot {
  /** Stunden-Label, z.B. "14:00" */
  stunde: string;
  /** Anzahl Bestellungen in dieser Stunde */
  anzahl: number;
  /** Durchschnittliche Reaktionszeit in Sekunden */
  avg_reaktionszeit_sek: number;
  /** Ampel-Status */
  ampel: Ampel;
}

export interface BestelleingangReaktionszeitAntwort {
  location_id: string;
  slots: ReaktionszeitSlot[];
  /** Gesamter Tages-Durchschnitt in Sekunden */
  tages_avg_sek: number;
  /** Ampel für Gesamt-Tages-Durchschnitt */
  tages_ampel: Ampel;
  /** Trend ggü. gestern: positiv = besser (schneller) */
  trend: 'besser' | 'schlechter' | 'stabil';
  trend_delta_sek: number;
  generiert_am: string;
}

const SCHWELLE_GELB_SEK = 180; // 3 Min
const SCHWELLE_ROT_SEK = 300;  // 5 Min

function ampelFuer(sek: number): Ampel {
  if (sek <= SCHWELLE_GELB_SEK) return 'gruen';
  if (sek <= SCHWELLE_ROT_SEK) return 'gelb';
  return 'rot';
}

function buildMock(locationId: string): BestelleingangReaktionszeitAntwort {
  const now = new Date();
  const currentHour = now.getHours();
  const seed = locationId.charCodeAt(0) || 65;

  const slots: ReaktionszeitSlot[] = [];
  for (let h = Math.max(0, currentHour - 5); h <= currentHour; h++) {
    const base = 120 + ((seed * (h + 1)) % 240); // 2–6 Min variierend
    const avg_reaktionszeit_sek = Math.round(base);
    const anzahl = 2 + ((seed * h) % 8);
    slots.push({
      stunde: `${String(h).padStart(2, '0')}:00`,
      anzahl,
      avg_reaktionszeit_sek,
      ampel: ampelFuer(avg_reaktionszeit_sek),
    });
  }

  const tages_avg_sek = slots.length > 0
    ? Math.round(slots.reduce((s, x) => s + x.avg_reaktionszeit_sek, 0) / slots.length)
    : 180;

  const gestern_avg = tages_avg_sek + ((seed % 3) === 0 ? -30 : 20);
  const delta = gestern_avg - tages_avg_sek;
  const trend: BestelleingangReaktionszeitAntwort['trend'] =
    delta > 15 ? 'besser' : delta < -15 ? 'schlechter' : 'stabil';

  return {
    location_id: locationId,
    slots,
    tages_avg_sek,
    tages_ampel: ampelFuer(tages_avg_sek),
    trend,
    trend_delta_sek: delta,
    generiert_am: now.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id') ?? 'all';

  try {
    const sb = await createClient();
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

    // Bestellungen heute mit Eingangszeit und Küchen-Bestätigungszeit
    let q = (sb as any)
      .from('orders')
      .select('id, created_at, confirmed_at, status')
      .gte('created_at', todayStart.toISOString())
      .lt('created_at', now.toISOString())
      .not('confirmed_at', 'is', null);
    if (locationId !== 'all') q = q.eq('location_id', locationId);
    const { data: orders, error } = await q;

    if (error || !orders?.length) {
      return NextResponse.json(buildMock(locationId));
    }

    // Stunden-Slots aggregieren
    const byHour: Record<number, number[]> = {};
    for (const o of orders) {
      const created = new Date(o.created_at);
      const confirmed = new Date(o.confirmed_at);
      const diff = Math.max(0, (confirmed.getTime() - created.getTime()) / 1000);
      const h = created.getHours();
      if (!byHour[h]) byHour[h] = [];
      byHour[h].push(diff);
    }

    const slots: ReaktionszeitSlot[] = Object.entries(byHour)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([h, vals]) => {
        const avg = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
        return {
          stunde: `${String(h).padStart(2, '0')}:00`,
          anzahl: vals.length,
          avg_reaktionszeit_sek: avg,
          ampel: ampelFuer(avg),
        };
      });

    const allVals = orders.map((o: { created_at: string; confirmed_at: string }) =>
      Math.max(0, (new Date(o.confirmed_at).getTime() - new Date(o.created_at).getTime()) / 1000),
    );
    const tages_avg_sek = allVals.length > 0
      ? Math.round(allVals.reduce((s: number, v: number) => s + v, 0) / allVals.length)
      : 0;

    // Gestern-Vergleich
    let qGestern = (sb as any)
      .from('orders')
      .select('created_at, confirmed_at')
      .gte('created_at', yesterdayStart.toISOString())
      .lt('created_at', todayStart.toISOString())
      .not('confirmed_at', 'is', null);
    if (locationId !== 'all') qGestern = qGestern.eq('location_id', locationId);
    const { data: ordersGestern } = await qGestern;

    let gesternAvg = tages_avg_sek;
    if (ordersGestern?.length) {
      const gesternVals = ordersGestern.map((o: { created_at: string; confirmed_at: string }) =>
        Math.max(0, (new Date(o.confirmed_at).getTime() - new Date(o.created_at).getTime()) / 1000),
      );
      gesternAvg = Math.round(
        gesternVals.reduce((s: number, v: number) => s + v, 0) / gesternVals.length,
      );
    }

    const delta = gesternAvg - tages_avg_sek;
    const trend: BestelleingangReaktionszeitAntwort['trend'] =
      delta > 15 ? 'besser' : delta < -15 ? 'schlechter' : 'stabil';

    return NextResponse.json({
      location_id: locationId,
      slots,
      tages_avg_sek,
      tages_ampel: ampelFuer(tages_avg_sek),
      trend,
      trend_delta_sek: delta,
      generiert_am: now.toISOString(),
    } satisfies BestelleingangReaktionszeitAntwort);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
