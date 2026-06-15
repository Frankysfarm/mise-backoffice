/**
 * lib/delivery/mov-ab-test.ts
 *
 * Smart Minimum-Order-Value A/B-Test Engine — Phase 194
 *
 * Testet unterschiedliche Mindestbestellwert-Schwellen je Zone (A/B/C/D)
 * und Tageszeit. Kunden werden deterministisch (phone/email-Hash) einer
 * Variante zugewiesen. Konversionen (Bestellung abgeschlossen vs. abgebrochen)
 * werden getrackt.
 *
 * Funktionen:
 *   createTest()           — Neuen A/B-Test anlegen
 *   listTests()            — Tests einer Location
 *   getTest()              — Einzelnen Test abrufen
 *   updateTestStatus()     — Status ändern (activate/pause/complete)
 *   deleteTest()           — Entwurf löschen
 *   getOrAssignVariant()   — Variante für Kunden bestimmen/zuweisen
 *   recordEvent()          — Konversions-Event aufzeichnen
 *   getTestMetrics()       — Varianten-Metriken für Dashboard
 *   getActiveMovForCustomer() — Effektiven MOV für einen Kunden abrufen
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import type { ZoneName } from './zones';

// ── Typen ─────────────────────────────────────────────────────────────────────

export type MovTestStatus = 'draft' | 'active' | 'paused' | 'completed';

export interface MovVariant {
  id: string;
  testId: string;
  name: string;
  isControl: boolean;
  movZoneAEur: number | null;
  movZoneBEur: number | null;
  movZoneCEur: number | null;
  movZoneDEur: number | null;
  allocationPct: number;
  createdAt: string;
}

export interface MovAbTest {
  id: string;
  locationId: string;
  name: string;
  description: string | null;
  status: MovTestStatus;
  zoneFilter: ZoneName[] | null;
  hourFrom: number | null;
  hourTo: number | null;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
  variants: MovVariant[];
}

export interface MovAbMetrics {
  testId: string;
  testName: string;
  status: MovTestStatus;
  variantId: string;
  variantName: string;
  isControl: boolean;
  allocationPct: number;
  assignedCustomers: number;
  totalEvents: number;
  conversions: number;
  conversionRatePct: number;
  revenueEur: number;
  avgOrderValueEur: number;
  liftVsControl: number | null;
}

export interface CreateMovTestInput {
  locationId: string;
  name: string;
  description?: string;
  zoneFilter?: ZoneName[];
  hourFrom?: number;
  hourTo?: number;
  startAt?: string;
  endAt?: string;
  variants: Array<{
    name: string;
    isControl?: boolean;
    movZoneAEur?: number;
    movZoneBEur?: number;
    movZoneCEur?: number;
    movZoneDEur?: number;
    allocationPct: number;
  }>;
}

export interface RecordMovEventInput {
  testId: string;
  variantId: string;
  locationId: string;
  customerHash: string;
  zone: ZoneName;
  orderTotalEur: number;
  movAppliedEur: number;
  converted: boolean;
  orderId?: string;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

/** Stabiler deterministischer Bucket 0–99 für (testId, customerHash). */
function assignBucket(testId: string, customerHash: string): number {
  const str = `${testId}:${customerHash}`;
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h = h >>> 0;
  }
  return h % 100;
}

function mapVariant(r: Record<string, unknown>): MovVariant {
  return {
    id:             r.id as string,
    testId:         r.test_id as string,
    name:           r.name as string,
    isControl:      r.is_control as boolean,
    movZoneAEur:    r.mov_zone_a_eur != null ? Number(r.mov_zone_a_eur) : null,
    movZoneBEur:    r.mov_zone_b_eur != null ? Number(r.mov_zone_b_eur) : null,
    movZoneCEur:    r.mov_zone_c_eur != null ? Number(r.mov_zone_c_eur) : null,
    movZoneDEur:    r.mov_zone_d_eur != null ? Number(r.mov_zone_d_eur) : null,
    allocationPct:  Number(r.allocation_pct),
    createdAt:      r.created_at as string,
  };
}

function mapTest(t: Record<string, unknown>, variants: MovVariant[]): MovAbTest {
  return {
    id:          t.id as string,
    locationId:  t.location_id as string,
    name:        t.name as string,
    description: t.description as string | null,
    status:      t.status as MovTestStatus,
    zoneFilter:  t.zone_filter as ZoneName[] | null,
    hourFrom:    t.hour_from != null ? Number(t.hour_from) : null,
    hourTo:      t.hour_to != null ? Number(t.hour_to) : null,
    startAt:     t.start_at as string | null,
    endAt:       t.end_at as string | null,
    createdAt:   t.created_at as string,
    updatedAt:   t.updated_at as string,
    variants,
  };
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function createTest(input: CreateMovTestInput): Promise<MovAbTest> {
  const sb = createServiceClient();
  const totalAlloc = input.variants.reduce((s, v) => s + v.allocationPct, 0);
  if (totalAlloc !== 100) throw new Error('Varianten-Allokation muss 100% ergeben');

  const { data: test, error: te } = await sb
    .from('mov_ab_tests')
    .insert({
      location_id:  input.locationId,
      name:         input.name,
      description:  input.description ?? null,
      zone_filter:  input.zoneFilter?.length ? input.zoneFilter : null,
      hour_from:    input.hourFrom ?? null,
      hour_to:      input.hourTo ?? null,
      start_at:     input.startAt ?? null,
      end_at:       input.endAt ?? null,
    })
    .select()
    .single();
  if (te) throw te;

  const variantRows = input.variants.map((v) => ({
    test_id:        test.id,
    name:           v.name,
    is_control:     v.isControl ?? false,
    mov_zone_a_eur: v.movZoneAEur ?? null,
    mov_zone_b_eur: v.movZoneBEur ?? null,
    mov_zone_c_eur: v.movZoneCEur ?? null,
    mov_zone_d_eur: v.movZoneDEur ?? null,
    allocation_pct: v.allocationPct,
  }));
  const { data: variants, error: ve } = await sb
    .from('mov_ab_variants')
    .insert(variantRows)
    .select();
  if (ve) throw ve;

  return mapTest(test as Record<string, unknown>, (variants ?? []).map((v) => mapVariant(v as Record<string, unknown>)));
}

export async function listTests(locationId: string): Promise<MovAbTest[]> {
  const sb = createServiceClient();
  const { data: tests, error: te } = await sb
    .from('mov_ab_tests')
    .select('*')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false });
  if (te) throw te;
  if (!tests?.length) return [];

  const testIds = tests.map((t) => t.id as string);
  const { data: variants } = await sb
    .from('mov_ab_variants')
    .select('*')
    .in('test_id', testIds)
    .order('allocation_pct', { ascending: false });

  return tests.map((t) => {
    const tv = (variants ?? [])
      .filter((v) => v.test_id === t.id)
      .map((v) => mapVariant(v as Record<string, unknown>));
    return mapTest(t as Record<string, unknown>, tv);
  });
}

export async function getTest(testId: string): Promise<MovAbTest | null> {
  const sb = createServiceClient();
  const { data: test } = await sb
    .from('mov_ab_tests')
    .select('*')
    .eq('id', testId)
    .maybeSingle();
  if (!test) return null;

  const { data: variants } = await sb
    .from('mov_ab_variants')
    .select('*')
    .eq('test_id', testId)
    .order('allocation_pct', { ascending: false });

  return mapTest(
    test as Record<string, unknown>,
    (variants ?? []).map((v) => mapVariant(v as Record<string, unknown>)),
  );
}

export async function updateTestStatus(
  testId: string,
  status: MovTestStatus,
): Promise<void> {
  const sb = createServiceClient();
  const update: Record<string, unknown> = { status };
  if (status === 'active') update.start_at = new Date().toISOString();
  if (status === 'completed') update.end_at = new Date().toISOString();
  const { error } = await sb.from('mov_ab_tests').update(update).eq('id', testId);
  if (error) throw error;
}

export async function deleteTest(testId: string): Promise<void> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('mov_ab_tests')
    .select('status')
    .eq('id', testId)
    .maybeSingle();
  if (data?.status !== 'draft') throw new Error('Nur Entwürfe können gelöscht werden');
  const { error } = await sb.from('mov_ab_tests').delete().eq('id', testId);
  if (error) throw error;
}

// ── Varianten-Zuweisung ───────────────────────────────────────────────────────

/**
 * Weist einem Kunden deterministisch eine Variante zu (oder gibt bestehende zurück).
 * Returns null wenn kein aktiver Test für zone/hour passt.
 */
export async function getOrAssignVariant(
  locationId: string,
  customerHash: string,
  zone: ZoneName,
): Promise<{ variant: MovVariant; test: MovAbTest } | null> {
  const sb = createServiceClient();
  const hour = new Date().getUTCHours();

  // Aktive Tests für diese Location
  const { data: tests } = await sb
    .from('mov_ab_tests')
    .select('*')
    .eq('location_id', locationId)
    .eq('status', 'active');

  if (!tests?.length) return null;

  // Test mit passendem Zonen- und Zeitfilter finden
  const now = new Date().toISOString();
  const matching = tests.filter((t) => {
    if (t.start_at && t.start_at > now) return false;
    if (t.end_at && t.end_at < now) return false;
    if (t.zone_filter && !(t.zone_filter as string[]).includes(zone)) return false;
    if (t.hour_from != null && t.hour_to != null) {
      const from = Number(t.hour_from);
      const to = Number(t.hour_to);
      if (from <= to) {
        if (hour < from || hour > to) return false;
      } else {
        // Nacht-Wrap (z.B. 22–06)
        if (hour < from && hour > to) return false;
      }
    }
    return true;
  });

  if (!matching.length) return null;

  // Ersten passenden Test verwenden
  const testRow = matching[0];

  // Bestehende Zuweisung prüfen
  const { data: existing } = await sb
    .from('mov_ab_assignments')
    .select('variant_id')
    .eq('test_id', testRow.id)
    .eq('customer_hash', customerHash)
    .maybeSingle();

  let variantId: string;
  if (existing) {
    variantId = existing.variant_id as string;
  } else {
    // Varianten laden und Bucket zuweisen
    const { data: variants } = await sb
      .from('mov_ab_variants')
      .select('*')
      .eq('test_id', testRow.id)
      .order('allocation_pct', { ascending: false });

    if (!variants?.length) return null;
    const bucket = assignBucket(testRow.id as string, customerHash);
    let cumulative = 0;
    let picked = variants[0];
    for (const v of variants) {
      cumulative += Number(v.allocation_pct);
      if (bucket < cumulative) { picked = v; break; }
    }
    variantId = picked.id as string;

    await sb.from('mov_ab_assignments').upsert({
      test_id:       testRow.id,
      variant_id:    variantId,
      customer_hash: customerHash,
      zone,
    }, { onConflict: 'test_id,customer_hash' });
  }

  // Variant + Test zurückgeben
  const { data: variantRow } = await sb
    .from('mov_ab_variants')
    .select('*')
    .eq('id', variantId)
    .maybeSingle();
  if (!variantRow) return null;

  const { data: variantList } = await sb
    .from('mov_ab_variants')
    .select('*')
    .eq('test_id', testRow.id);

  const fullTest = mapTest(
    testRow as Record<string, unknown>,
    (variantList ?? []).map((v) => mapVariant(v as Record<string, unknown>)),
  );
  return { variant: mapVariant(variantRow as Record<string, unknown>), test: fullTest };
}

// ── Event-Aufzeichnung ────────────────────────────────────────────────────────

export async function recordMovEvent(input: RecordMovEventInput): Promise<void> {
  const sb = createServiceClient();
  await sb.from('mov_ab_events').insert({
    test_id:         input.testId,
    variant_id:      input.variantId,
    location_id:     input.locationId,
    customer_hash:   input.customerHash,
    zone:            input.zone,
    hour_of_day:     new Date().getUTCHours(),
    order_total_eur: input.orderTotalEur,
    mov_applied_eur: input.movAppliedEur,
    converted:       input.converted,
    order_id:        input.orderId ?? null,
  });
}

// ── Metriken ─────────────────────────────────────────────────────────────────

export async function getTestMetrics(
  locationId: string,
  testId?: string,
): Promise<MovAbMetrics[]> {
  const sb = createServiceClient();
  let query = sb
    .from('v_mov_ab_metrics')
    .select('*')
    .eq('location_id', locationId);
  if (testId) query = query.eq('test_id', testId);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as Array<Record<string, unknown>>;

  // Kontroll-Gruppe Conversion-Rate für Lift-Berechnung
  const controlByTest = new Map<string, number>();
  rows.forEach((r) => {
    if (r.is_control) controlByTest.set(r.test_id as string, Number(r.conversion_rate_pct));
  });

  return rows.map((r) => {
    const cvr = Number(r.conversion_rate_pct);
    const ctrl = controlByTest.get(r.test_id as string);
    const lift = ctrl != null && !r.is_control && ctrl > 0
      ? Math.round((cvr - ctrl) / ctrl * 1000) / 10
      : null;
    return {
      testId:              r.test_id as string,
      testName:            r.test_name as string,
      status:              r.status as MovTestStatus,
      variantId:           r.variant_id as string,
      variantName:         r.variant_name as string,
      isControl:           r.is_control as boolean,
      allocationPct:       Number(r.allocation_pct),
      assignedCustomers:   Number(r.assigned_customers),
      totalEvents:         Number(r.total_events),
      conversions:         Number(r.conversions),
      conversionRatePct:   cvr,
      revenueEur:          Number(r.revenue_eur),
      avgOrderValueEur:    Number(r.avg_order_value_eur),
      liftVsControl:       lift,
    };
  });
}

// ── Effektiven MOV für Checkout-Storefront abrufen ────────────────────────────

export interface MovForCustomer {
  movEur: number;           // zu verwendender MOV
  isTestVariant: boolean;
  variantName: string | null;
  testId: string | null;
  variantId: string | null;
}

/**
 * Gibt den effektiven MOV für einen Kunden zurück.
 * Fallback auf zone.min_order_eur wenn kein aktiver Test greift.
 */
export async function getActiveMovForCustomer(
  locationId: string,
  customerHash: string,
  zone: ZoneName,
  fallbackMovEur: number,
): Promise<MovForCustomer> {
  try {
    const assignment = await getOrAssignVariant(locationId, customerHash, zone);
    if (!assignment) {
      return { movEur: fallbackMovEur, isTestVariant: false, variantName: null, testId: null, variantId: null };
    }
    const { variant, test } = assignment;
    const movByZone: Record<ZoneName, number | null> = {
      A: variant.movZoneAEur,
      B: variant.movZoneBEur,
      C: variant.movZoneCEur,
      D: variant.movZoneDEur,
    };
    const movEur = movByZone[zone] ?? fallbackMovEur;
    return {
      movEur,
      isTestVariant: !variant.isControl,
      variantName:   variant.name,
      testId:        test.id,
      variantId:     variant.id,
    };
  } catch {
    return { movEur: fallbackMovEur, isTestVariant: false, variantName: null, testId: null, variantId: null };
  }
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface MovAbDashboard {
  activeTests:    number;
  totalTests:     number;
  totalEvents:    number;
  totalRevenue:   number;
  tests:          MovAbTest[];
  metrics:        MovAbMetrics[];
}

export async function getMovAbDashboard(locationId: string): Promise<MovAbDashboard> {
  const [tests, metrics] = await Promise.all([
    listTests(locationId),
    getTestMetrics(locationId),
  ]);

  const totalEvents  = metrics.reduce((s, m) => s + m.totalEvents, 0);
  const totalRevenue = metrics.reduce((s, m) => s + m.revenueEur, 0);

  return {
    activeTests:  tests.filter((t) => t.status === 'active').length,
    totalTests:   tests.length,
    totalEvents,
    totalRevenue,
    tests,
    metrics,
  };
}
