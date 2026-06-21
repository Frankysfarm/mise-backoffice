/**
 * lib/delivery/schicht-live.ts — Phase 398
 *
 * Schicht-Live-Engine: Echtzeit-KPIs für die laufende Schicht.
 *
 * Liefert:
 *  - Umsatz (alle bezahlten Bestellungen ab Schichtstart)
 *  - Bestellanzahl, Lieferungen, Stornos
 *  - Aktive Fahrer (is_online=true)
 *  - Schicht-Startzeitpunkt (erste Bestellung heute)
 *  - Tagesziel aus schicht_targets (fallback: 800 €)
 *
 * Public API:
 *  getSchichtLiveKpis(locationId)          — Live-KPIs für aktuelle Schicht
 *  getSchichtTarget(locationId)             — Ziele für heute (day_of_week)
 *  setSchichtTarget(params)                 — Ziele upserten (Admin/Manager)
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export interface SchichtLiveKpis {
  locationId:        string;
  schichtStart:      string | null;   // ISO — erste Bestellung des Tages
  umsatz:            number;          // EUR, alle Bestellarten
  bestellungen:      number;          // alle Bestellungen (excl. storniert)
  lieferungen:       number;          // gelieferte Lieferbestellungen
  stornos:           number;          // stornierte Bestellungen heute
  aktiveFahrer:      number;          // is_online=true Fahrer
  umsatzZiel:        number;          // aus schicht_targets, default 800
  lieferungenZiel:   number;          // aus schicht_targets, default 40
  avgBestellwert:    number | null;   // EUR pro Bestellung
  stornoPct:         number;          // % aller Bestellungen (inkl. storno)
  zielerreichungPct: number;          // umsatz / umsatzZiel * 100
}

export interface SchichtTarget {
  locationId:       string;
  dayOfWeek:        number;
  umsatzZiel:       number;
  lieferungenZiel:  number;
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

/** Gibt UTC-Range für "heute" in Berliner Zeit (UTC+2 Approximation). */
function todayRangeUtc(): { from: string; to: string } {
  const now = new Date();
  // Berlin ≈ UTC+2; Schichtstart = 00:00 Berliner Zeit
  const offsetH = 2;
  const berlinNow = new Date(now.getTime() + offsetH * 3_600_000);
  const berlinDate = berlinNow.toISOString().slice(0, 10); // YYYY-MM-DD

  // Berliner Mitternacht → UTC
  const from = new Date(`${berlinDate}T00:00:00.000Z`);
  from.setTime(from.getTime() - offsetH * 3_600_000);

  const to = new Date(from.getTime() + 24 * 3_600_000);

  return {
    from: from.toISOString(),
    to:   to.toISOString(),
  };
}

/** Berliner Wochentag (0=Sonntag ... 6=Samstag) der aktuellen Schicht. */
function todayDayOfWeek(): number {
  const offsetH = 2;
  const berlinNow = new Date(Date.now() + offsetH * 3_600_000);
  return berlinNow.getUTCDay(); // 0=So, 1=Mo, ..., 6=Sa
}

// ── getSchichtTarget ──────────────────────────────────────────────────────────

export async function getSchichtTarget(locationId: string): Promise<SchichtTarget> {
  const svc = createServiceClient();
  const dow = todayDayOfWeek();

  const { data } = await svc
    .from('schicht_targets')
    .select('day_of_week, umsatz_ziel, lieferungen_ziel')
    .eq('location_id', locationId)
    .eq('day_of_week', dow)
    .maybeSingle();

  const row = data as { day_of_week: number; umsatz_ziel: number; lieferungen_ziel: number } | null;

  return {
    locationId,
    dayOfWeek:      dow,
    umsatzZiel:     Number(row?.umsatz_ziel ?? 800),
    lieferungenZiel: Number(row?.lieferungen_ziel ?? 40),
  };
}

// ── setSchichtTarget ──────────────────────────────────────────────────────────

export async function setSchichtTarget(params: {
  locationId:      string;
  dayOfWeek:       number;
  umsatzZiel:      number;
  lieferungenZiel: number;
}): Promise<SchichtTarget> {
  const svc = createServiceClient();

  await svc
    .from('schicht_targets')
    .upsert({
      location_id:      params.locationId,
      day_of_week:      params.dayOfWeek,
      umsatz_ziel:      params.umsatzZiel,
      lieferungen_ziel: params.lieferungenZiel,
    }, { onConflict: 'location_id,day_of_week' });

  return {
    locationId:      params.locationId,
    dayOfWeek:       params.dayOfWeek,
    umsatzZiel:      params.umsatzZiel,
    lieferungenZiel: params.lieferungenZiel,
  };
}

// ── getSchichtLiveKpis ────────────────────────────────────────────────────────

export async function getSchichtLiveKpis(locationId: string): Promise<SchichtLiveKpis> {
  const svc = createServiceClient();
  const { from, to } = todayRangeUtc();

  // Parallele Queries
  const [
    { data: orderRows },
    { data: driverRows },
    target,
  ] = await Promise.all([
    // Alle Bestellungen heute (inkl. storniert für Storno-Quote)
    svc
      .from('customer_orders')
      .select('id, status, gesamtbetrag, bestellart, bestellt_am')
      .eq('location_id', locationId)
      .gte('bestellt_am', from)
      .lt('bestellt_am', to),

    // Online-Fahrer
    svc
      .from('mise_drivers')
      .select('id')
      .eq('location_id', locationId)
      .eq('active', true)
      .eq('is_online', true),

    getSchichtTarget(locationId),
  ]);

  type OrderRow = {
    id: string;
    status: string;
    gesamtbetrag: number | null;
    bestellart: string | null;
    bestellt_am: string | null;
  };

  const orders = (orderRows ?? []) as OrderRow[];
  const aktiveFahrer = (driverRows ?? []).length;

  // Aggregationen
  const storniert  = orders.filter(o => o.status === 'storniert');
  const aktiveOrders = orders.filter(o => o.status !== 'storniert');

  const lieferungen = orders.filter(
    o => o.status === 'geliefert' || o.status === 'abgeschlossen',
  );

  const umsatz = aktiveOrders.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);

  // Schichtstart = erste Bestellung heute (älteste bestellt_am)
  const sorted = orders
    .filter(o => o.bestellt_am)
    .sort((a, b) => new Date(a.bestellt_am!).getTime() - new Date(b.bestellt_am!).getTime());
  const schichtStart = sorted[0]?.bestellt_am ?? null;

  const avgBestellwert =
    aktiveOrders.length > 0 ? Math.round((umsatz / aktiveOrders.length) * 100) / 100 : null;

  const totalInclStorno = orders.length;
  const stornoPct =
    totalInclStorno > 0
      ? Math.round((storniert.length / totalInclStorno) * 10_000) / 100
      : 0;

  const zielerreichungPct =
    target.umsatzZiel > 0
      ? Math.round((umsatz / target.umsatzZiel) * 10_000) / 100
      : 0;

  return {
    locationId,
    schichtStart,
    umsatz:            Math.round(umsatz * 100) / 100,
    bestellungen:      aktiveOrders.length,
    lieferungen:       lieferungen.length,
    stornos:           storniert.length,
    aktiveFahrer,
    umsatzZiel:        target.umsatzZiel,
    lieferungenZiel:   target.lieferungenZiel,
    avgBestellwert,
    stornoPct,
    zielerreichungPct,
  };
}
