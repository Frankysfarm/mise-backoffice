/**
 * GET /api/delivery/kitchen/queue-forecast?location_id=...
 *
 * Liefert Küchen-Queue-Prognose für 15/30/45-Minuten-Horizonte.
 * Berechnet aus aktueller Queue-Tiefe + historischem Bestellrhythmus.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface HorizonResult {
  label: string;
  minutes: number;
  predicted: number;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = new URL(req.url).searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  try {
    const sbService = createServiceClient();
    const now = new Date();

    // Aktuelle UTC-Stunde
    const hourStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()),
    ).toISOString();
    const minutesPastHour = now.getUTCMinutes();

    // Bestellungen der laufenden Stunde zählen
    const [ordersThisHour, nextHourPattern] = await Promise.all([
      sbService
        .from('customer_orders')
        .select('id, created_at', { count: 'exact' })
        .eq('location_id', locationId)
        .in('status', ['neu', 'bestätigt', 'in_zubereitung', 'bereit'])
        .gte('created_at', hourStart),
      // Historisches Muster der nächsten vollen Stunde (gleicher Wochentag)
      sbService
        .from('v_hourly_demand_pattern')
        .select('avg_orders')
        .eq('location_id', locationId)
        .eq('weekday', now.getDay())
        .eq('hour_of_day', (now.getUTCHours() + 1) % 24)
        .maybeSingle(),
    ]);

    const currentQueueCount = ordersThisHour.count ?? 0;

    // Geschätzte Bestellrate dieser Stunde (Orders / Minuten vergangen)
    const ratePerMinute = minutesPastHour > 5
      ? currentQueueCount / minutesPastHour
      : 0.15; // Fallback: 9 Orders/h

    // Für Horizonte über den Stunden-Wechsel: nächste Stunde historisch schätzen
    const nextHourAvg = Number(
      (nextHourPattern.data as Record<string, unknown> | null)?.avg_orders ?? 0,
    );
    const nextRatePerMinute = nextHourAvg > 0 ? nextHourAvg / 60 : ratePerMinute;

    const horizons: HorizonResult[] = [15, 30, 45].map((minutes) => {
      const remainingInHour = 60 - minutesPastHour;

      let predicted: number;
      if (minutes <= remainingInHour) {
        // Vollständig in aktueller Stunde
        predicted = Math.round(ratePerMinute * minutes);
      } else {
        // Anteil der aktuellen + Anteil der nächsten Stunde
        const inCurrentHour = Math.round(ratePerMinute * remainingInHour);
        const inNextHour = Math.round(nextRatePerMinute * (minutes - remainingInHour));
        predicted = inCurrentHour + inNextHour;
      }

      return {
        label: `${minutes} Min`,
        minutes,
        predicted: Math.max(0, predicted),
      };
    });

    return NextResponse.json({
      horizons,
      currentQueue: currentQueueCount,
      ratePerMinute: Math.round(ratePerMinute * 100) / 100,
      generatedAt: now.toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
