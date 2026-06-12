/**
 * lib/delivery/ai-forecast.ts
 *
 * KI-gestützte Nachfrage-Prognose (Phase 85).
 * Kombiniert historische Muster aus getForecast() mit Live-Daten
 * und streamt eine Claude-Analyse auf Deutsch.
 *
 * Funktionen:
 *  - buildForecastAiContext()   — Kontext aus DB + Forecast laden
 *  - streamForecastInsights()  — Claude-Antwort als ReadableStream
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from '@/lib/supabase/server';
import { getForecast } from './forecast';
import type { ForecastSlot } from './forecast';

// ── Typen ─────────────────────────────────────────────────────────────────────

export interface ForecastAiContext {
  locationName: string;
  generatedAt: string;
  slots: ForecastSlot[];
  currentQueue: number;
  onlineDrivers: number;
  recentAvgDeliveryMin: number | null;
  todayOrdersCount: number;
  yesterdayOrdersCount: number;
  weekdayName: string;
}

// ── buildForecastAiContext ────────────────────────────────────────────────────

export async function buildForecastAiContext(locationId: string): Promise<ForecastAiContext> {
  const sb = createServiceClient();
  const now = new Date();

  // Berliner Wochentag
  const berlinOffset = berlinUtcOffset(now);
  const berlinNow = new Date(now.getTime() + berlinOffset * 60_000);
  const weekdayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const weekdayName = weekdayNames[berlinNow.getDay()];

  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
  const yestStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1),
  ).toISOString();

  const [
    locationRes,
    forecast,
    queueRes,
    driversRes,
    perfRes,
    todayRes,
    yestRes,
  ] = await Promise.all([
    sb.from('locations').select('name').eq('id', locationId).single(),
    getForecast(locationId, 12),
    sb
      .from('customer_orders')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('typ', 'lieferung')
      .in('status', ['neu', 'in_zubereitung', 'fertig']),
    sb
      .from('delivery_drivers')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('is_online', true),
    sb
      .from('delivery_performance')
      .select('delivery_min')
      .eq('location_id', locationId)
      .gte('recorded_at', new Date(Date.now() - 7 * 86_400_000).toISOString())
      .not('delivery_min', 'is', null)
      .limit(200),
    sb
      .from('customer_orders')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('typ', 'lieferung')
      .gte('created_at', todayStart),
    sb
      .from('customer_orders')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('typ', 'lieferung')
      .gte('created_at', yestStart)
      .lt('created_at', todayStart),
  ]);

  const perf = perfRes.data ?? [];
  const avgDeliveryMin =
    perf.length > 0
      ? Math.round((perf.reduce((s, r) => s + (r.delivery_min as number), 0) / perf.length) * 10) / 10
      : null;

  return {
    locationName: locationRes.data?.name ?? locationId,
    generatedAt: now.toISOString(),
    slots: forecast.slots,
    currentQueue: queueRes.count ?? 0,
    onlineDrivers: driversRes.count ?? 0,
    recentAvgDeliveryMin: avgDeliveryMin,
    todayOrdersCount: todayRes.count ?? 0,
    yesterdayOrdersCount: yestRes.count ?? 0,
    weekdayName,
  };
}

// ── buildForecastPrompt ───────────────────────────────────────────────────────

function buildForecastPrompt(ctx: ForecastAiContext): string {
  const slotLines = ctx.slots
    .map(
      (s) =>
        `  ${s.hourLocal} | ~${s.expectedOrders} Bestellungen (Peak: ${s.peakOrders})` +
        ` | Fahrer: min ${s.recommendedMinDrivers} / Ziel ${s.recommendedTargetDrivers}` +
        (s.dataPoints < 3 ? ' [wenig Verlaufsdaten]' : ''),
    )
    .join('\n');

  const todayVsYest =
    ctx.yesterdayOrdersCount > 0
      ? ` (gestern: ${ctx.yesterdayOrdersCount})`
      : '';

  return `Du bist ein erfahrener Lieferdienst-Betriebsleiter und Nachfrage-Analyst.

STANDORT: ${ctx.locationName}
WOCHENTAG: ${ctx.weekdayName}
ZEITPUNKT: ${new Date(ctx.generatedAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}
AKTUELLE QUEUE: ${ctx.currentQueue} wartende Lieferungen
FAHRER ONLINE: ${ctx.onlineDrivers}
HEUTIGE BESTELLUNGEN BISHER: ${ctx.todayOrdersCount}${todayVsYest}
Ø LIEFERZEIT (7 Tage): ${ctx.recentAvgDeliveryMin !== null ? `${ctx.recentAvgDeliveryMin} Min` : 'n/a'}

NACHFRAGE-PROGNOSE (nächste 12 Stunden):
${slotLines}

Analysiere diese Daten und gib eine strukturierte Empfehlung auf Deutsch:

1. **Trendanalyse** — Wie entwickelt sich die Nachfrage heute? Abweichungen vom Erwarteten?
2. **Peak-Vorbereitung** — Wann kommen die Spitzenzeiten? Was ist zu tun?
3. **Fahrer-Empfehlung** — Wie viele Fahrer werden wann gebraucht? Konkrete Schichten?
4. **Risiken** — Drohende Engpässe oder Leerlaufzeiten?
5. **Top-Maßnahme** — Ein konkreter Satz: Die wichtigste Maßnahme für die nächsten 2 Stunden.

Bleibe präzise, deutsch und handlungsorientiert. Nenne konkrete Uhrzeiten.`;
}

// ── streamForecastInsights ────────────────────────────────────────────────────

export async function streamForecastInsights(locationId: string): Promise<ReadableStream<string>> {
  const ctx = await buildForecastAiContext(locationId);
  const prompt = buildForecastPrompt(ctx);

  const client = new Anthropic();
  const stream = await client.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 900,
    messages: [{ role: 'user', content: prompt }],
  });

  return new ReadableStream<string>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(event.delta.text);
          }
        }
      } finally {
        controller.close();
      }
    },
  });
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function berlinUtcOffset(utcDate: Date): number {
  const y = utcDate.getUTCFullYear();
  const lastSunMarch = lastSunday(y, 2);
  const lastSunOct = lastSunday(y, 9);
  const inSummerTime = utcDate >= lastSunMarch && utcDate < lastSunOct;
  return inSummerTime ? 120 : 60;
}

function lastSunday(year: number, month: number): Date {
  const lastDay = new Date(Date.UTC(year, month + 1, 0, 1, 0, 0));
  lastDay.setUTCDate(lastDay.getUTCDate() - lastDay.getUTCDay());
  return lastDay;
}
