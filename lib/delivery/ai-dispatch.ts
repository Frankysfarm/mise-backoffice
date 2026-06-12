/**
 * lib/delivery/ai-dispatch.ts
 *
 * KI-Dispatch-Assistent — Phase 67
 *
 * Nutzt Claude, um den aktuellen Dispatch-Zustand einer Location
 * zu analysieren und konkrete Dispatch-Empfehlungen auf Deutsch zu streamen.
 *
 * Funktionen:
 *  - buildDispatchContext()  — Live-Zustand aus DB lesen
 *  - streamDispatchAdvice()  — Claude-Antwort als ReadableStream
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from '@/lib/supabase/server';

// ============================================================
// Typen
// ============================================================

export interface OrderContext {
  bestellnummer: string;
  zone: string | null;
  warteminuten: number;
  prioritaet: string | null;
  betrag: number;
  zahlungsart: string;
  kundeAdresse: string | null;
}

export interface DriverContext {
  name: string;
  fahrzeug: string;
  state: string;
  aktiveLieferungen: number;
  maxKapazitaet: number;
  letztePositionVorMin: number | null;
}

export interface BatchContext {
  id: string;
  zone: string | null;
  status: string;
  stopsGesamt: number;
  stopsErledigt: number;
  etaMin: number | null;
}

export interface DispatchContext {
  locationName: string;
  zeitstempel: string;
  wartendeLieferungen: OrderContext[];
  aktiveFahrer: DriverContext[];
  laufendeTouren: BatchContext[];
  kueche: {
    aktivBestellungen: number;
    auslastung: string;
  };
}

// ============================================================
// buildDispatchContext
// ============================================================

export async function buildDispatchContext(locationId: string): Promise<DispatchContext> {
  const sb = createServiceClient();
  const now = new Date();

  const [locationRes, ordersRes, driversRes, batchesRes, kitchenRes] = await Promise.all([
    // Location-Name
    sb.from('locations').select('name').eq('id', locationId).single(),

    // Wartende Lieferbestellungen (fertig / neu)
    sb
      .from('customer_orders')
      .select('bestellnummer, delivery_zone, created_at, fertig_am, bestellt_am, gesamtbetrag, zahlungsart, kunde_adresse, priority, status')
      .eq('location_id', locationId)
      .eq('typ', 'lieferung')
      .in('status', ['fertig', 'neu', 'in_zubereitung'])
      .is('fahrer_id', null)
      .order('created_at', { ascending: true })
      .limit(20),

    // Aktive Fahrer
    sb
      .from('mise_drivers')
      .select('name, vehicle, state, current_capacity, max_capacity, last_position_at')
      .eq('active', true)
      .neq('state', 'offline')
      .order('name'),

    // Laufende Touren
    sb
      .from('mise_delivery_batches')
      .select('id, state, zone, stop_count, total_eta_min, mise_delivery_batch_stops(completed_at)')
      .eq('location_id', locationId)
      .not('state', 'in', '("completed","cancelled")')
      .limit(10),

    // Küchen-Auslastung
    sb
      .from('customer_orders')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('status', 'in_zubereitung'),
  ]);

  const location = locationRes.data;
  const orders = ordersRes.data ?? [];
  const drivers = driversRes.data ?? [];
  const batches = batchesRes.data ?? [];
  const kitchenCount = kitchenRes.count ?? 0;

  const wartendeLieferungen: OrderContext[] = orders.map((o) => {
    const referenceTime = (o.fertig_am ?? o.bestellt_am ?? o.created_at) as string | null;
    const warteminuten = referenceTime
      ? Math.round((now.getTime() - new Date(referenceTime).getTime()) / 60_000)
      : 0;
    return {
      bestellnummer: (o.bestellnummer as string) ?? '?',
      zone: (o.delivery_zone as string | null) ?? null,
      warteminuten: Math.max(0, warteminuten),
      prioritaet: (o.priority as string | null) ?? null,
      betrag: (o.gesamtbetrag as number) ?? 0,
      zahlungsart: (o.zahlungsart as string) ?? 'unbekannt',
      kundeAdresse: (o.kunde_adresse as string | null) ?? null,
    };
  });

  const aktiveFahrer: DriverContext[] = drivers.map((d) => {
    const letztePositionVorMin = d.last_position_at
      ? Math.round((now.getTime() - new Date(d.last_position_at as string).getTime()) / 60_000)
      : null;
    return {
      name: (d.name as string) ?? 'Fahrer',
      fahrzeug: (d.vehicle as string) ?? 'unbekannt',
      state: (d.state as string) ?? 'idle',
      aktiveLieferungen: (d.current_capacity as number) ?? 0,
      maxKapazitaet: (d.max_capacity as number) ?? 3,
      letztePositionVorMin,
    };
  });

  type BatchRow = {
    id: string;
    state: string;
    zone: string | null;
    stop_count: number | null;
    total_eta_min: number | null;
    mise_delivery_batch_stops: { completed_at: string | null }[];
  };

  const laufendeTouren: BatchContext[] = (batches as BatchRow[]).map((b) => ({
    id: b.id,
    zone: b.zone ?? null,
    status: b.state,
    stopsGesamt: b.stop_count ?? 0,
    stopsErledigt: b.mise_delivery_batch_stops.filter((s) => s.completed_at !== null).length,
    etaMin: b.total_eta_min ?? null,
  }));

  const auslastung =
    kitchenCount === 0 ? 'leer' :
    kitchenCount <= 3  ? 'moderat' :
    kitchenCount <= 7  ? 'viel los' :
    'überlastet';

  return {
    locationName: (location?.name as string) ?? locationId,
    zeitstempel: now.toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }),
    wartendeLieferungen,
    aktiveFahrer,
    laufendeTouren,
    kueche: { aktivBestellungen: kitchenCount, auslastung },
  };
}

// ============================================================
// buildPrompt
// ============================================================

function buildPrompt(ctx: DispatchContext): string {
  const orderLines = ctx.wartendeLieferungen.length === 0
    ? '  (keine wartenden Lieferungen)'
    : ctx.wartendeLieferungen.map((o) =>
        `  • #${o.bestellnummer} | Zone: ${o.zone ?? '?'} | Wartet: ${o.warteminuten} Min` +
        (o.prioritaet && o.prioritaet !== 'normal' ? ` | ⚡ ${o.prioritaet}` : '') +
        ` | ${o.betrag.toFixed(2)} € (${o.zahlungsart})`,
      ).join('\n');

  const driverLines = ctx.aktiveFahrer.length === 0
    ? '  (kein Fahrer online)'
    : ctx.aktiveFahrer.map((d) =>
        `  • ${d.name} | ${d.fahrzeug} | Status: ${d.state}` +
        ` | Kapazität: ${d.aktiveLieferungen}/${d.maxKapazitaet}` +
        (d.letztePositionVorMin !== null ? ` | GPS vor ${d.letztePositionVorMin} Min` : ''),
      ).join('\n');

  const tourLines = ctx.laufendeTouren.length === 0
    ? '  (keine aktiven Touren)'
    : ctx.laufendeTouren.map((t) =>
        `  • Tour ${t.id.slice(0, 8)} | Zone: ${t.zone ?? '?'} | ${t.stopsErledigt}/${t.stopsGesamt} Stopps | Status: ${t.status}` +
        (t.etaMin !== null ? ` | ETA ~${t.etaMin} Min` : ''),
      ).join('\n');

  return `Du bist ein erfahrener Dispatch-Manager für einen Lieferdienst.

Aktuelle Situation (${ctx.zeitstempel}) — ${ctx.locationName}:

WARTENDE LIEFERUNGEN (${ctx.wartendeLieferungen.length}):
${orderLines}

AKTIVE FAHRER (${ctx.aktiveFahrer.length}):
${driverLines}

LAUFENDE TOUREN (${ctx.laufendeTouren.length}):
${tourLines}

KÜCHE: ${ctx.kueche.aktivBestellungen} Bestellungen in Zubereitung (${ctx.kueche.auslastung})

Gib konkrete Dispatch-Empfehlungen auf Deutsch. Strukturiere deine Antwort in:
1. **Sofortmaßnahmen** — Was jetzt sofort dispatcht werden soll (Fahrer + Bestellungen bündeln)
2. **Priorisierung** — Welche Bestellungen dringend sind (lange Wartezeit / hohe Priorität)
3. **Engpässe** — Aktuelle Probleme (fehlende Fahrer, Küchen-Rückstau etc.)
4. **Empfehlung** — Ein Satz: Was ist die wichtigste Maßnahme gerade?

Bleibe präzise, deutsch und handlungsorientiert. Nenne immer konkrete Bestellnummern und Fahrernamen.`;
}

// ============================================================
// streamDispatchAdvice
// ============================================================

export async function streamDispatchAdvice(locationId: string): Promise<ReadableStream<string>> {
  const ctx = await buildDispatchContext(locationId);
  const prompt = buildPrompt(ctx);

  const client = new Anthropic();

  const stream = await client.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
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
