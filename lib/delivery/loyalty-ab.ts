/**
 * lib/delivery/loyalty-ab.ts
 *
 * A/B-Test Engine für Loyalty-Kampagnen (Phase 82).
 *
 * Funktionen:
 *   createTest()           — Neuen Test anlegen (mit Varianten)
 *   getTest()              — Einzelnen Test abrufen
 *   listTests()            — Alle Tests einer Location
 *   updateTestStatus()     — Status ändern (activate/pause/complete)
 *   deleteTest()           — Entwurf löschen
 *   getOrAssignVariant()   — Deterministisch Variante für Kunden bestimmen/erstellen
 *   recordEvent()          — Konversions-Ereignis aufzeichnen
 *   getTestMetrics()       — Varianten-Metriken für Dashboard
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ─────────────────────────────────────────────────────────────────────

export interface AbVariant {
  id: string;
  testId: string;
  name: string;
  description: string | null;
  pointsMultiplier: number;
  allocationPct: number;
  createdAt: string;
}

export interface AbTest {
  id: string;
  locationId: string;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'paused' | 'completed';
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
  variants: AbVariant[];
}

export interface AbMetrics {
  testId: string;
  variantId: string;
  variantName: string;
  pointsMultiplier: number;
  allocationPct: number;
  assignedCustomers: number;
  totalOrders: number;
  totalRevenue: number;
  totalPointsEarned: number;
  totalPointsRedeemed: number;
  orderConversionPct: number;
  avgOrderValue: number;
}

export interface CreateTestInput {
  locationId: string;
  name: string;
  description?: string;
  variants: Array<{
    name: string;
    description?: string;
    pointsMultiplier: number;
    allocationPct: number;
  }>;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

/** Stabiler deterministischer Hash 0–99 für (testId, email)-Paar */
function customerBucket(testId: string, email: string): number {
  const str = `${testId}:${email.trim().toLowerCase()}`;
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h = h >>> 0; // unsigned 32-bit
  }
  return h % 100;
}

/** Variante aus Bucket anhand kumulativer allocation_pct bestimmen */
function pickVariant(variants: AbVariant[], bucket: number): AbVariant | null {
  // Stabile Sortierung nach id sichert konsistente Reihenfolge
  const sorted = [...variants].sort((a, b) => a.id.localeCompare(b.id));
  let cumulative = 0;
  for (const v of sorted) {
    cumulative += v.allocationPct;
    if (bucket < cumulative) return v;
  }
  return sorted[sorted.length - 1] ?? null;
}

function mapVariant(row: Record<string, unknown>): AbVariant {
  return {
    id:               row.id as string,
    testId:           row.test_id as string,
    name:             row.name as string,
    description:      (row.description as string | null) ?? null,
    pointsMultiplier: Number(row.points_multiplier),
    allocationPct:    Number(row.allocation_pct),
    createdAt:        row.created_at as string,
  };
}

function mapTest(row: Record<string, unknown>, variants: AbVariant[]): AbTest {
  return {
    id:          row.id as string,
    locationId:  row.location_id as string,
    name:        row.name as string,
    description: (row.description as string | null) ?? null,
    status:      row.status as AbTest['status'],
    startAt:     (row.start_at as string | null) ?? null,
    endAt:       (row.end_at as string | null) ?? null,
    createdAt:   row.created_at as string,
    updatedAt:   row.updated_at as string,
    variants,
  };
}

/** Graceful-Fallback wenn Tabellen noch nicht migriert sind */
function isMissingTable(err: { message?: string } | null): boolean {
  return !!err?.message?.includes('does not exist');
}

// ── Öffentliche Funktionen ───────────────────────────────────────────────────

/**
 * Test mit Varianten anlegen.
 * Validierung: Summe der allocation_pct muss 100 ergeben; mind. 2 Varianten.
 */
export async function createTest(input: CreateTestInput): Promise<AbTest> {
  if (input.variants.length < 2) {
    throw new Error('Mindestens 2 Varianten erforderlich');
  }
  const totalPct = input.variants.reduce((s, v) => s + v.allocationPct, 0);
  if (totalPct !== 100) {
    throw new Error(`Summe der Anteile muss 100 ergeben (aktuell: ${totalPct})`);
  }
  const svc = createServiceClient();

  const { data: test, error: testErr } = await svc
    .from('loyalty_ab_tests')
    .insert({
      location_id: input.locationId,
      name:        input.name,
      description: input.description ?? null,
      status:      'draft',
    })
    .select()
    .single();

  if (testErr) throw new Error(`Test anlegen fehlgeschlagen: ${testErr.message}`);

  const variantRows = input.variants.map(v => ({
    test_id:           test.id,
    name:              v.name,
    description:       v.description ?? null,
    points_multiplier: v.pointsMultiplier,
    allocation_pct:    v.allocationPct,
  }));

  const { data: variants, error: varErr } = await svc
    .from('loyalty_ab_variants')
    .insert(variantRows)
    .select();

  if (varErr) throw new Error(`Varianten anlegen fehlgeschlagen: ${varErr.message}`);

  return mapTest(
    test as Record<string, unknown>,
    (variants as Record<string, unknown>[]).map(mapVariant),
  );
}

/** Test mit Varianten abrufen */
export async function getTest(testId: string, locationId: string): Promise<AbTest | null> {
  const svc = createServiceClient();

  const { data: test, error: testErr } = await svc
    .from('loyalty_ab_tests')
    .select('*')
    .eq('id', testId)
    .eq('location_id', locationId)
    .maybeSingle();

  if (testErr) {
    if (isMissingTable(testErr)) return null;
    throw new Error(testErr.message);
  }
  if (!test) return null;

  const { data: variants, error: varErr } = await svc
    .from('loyalty_ab_variants')
    .select('*')
    .eq('test_id', testId)
    .order('created_at');

  if (varErr) throw new Error(varErr.message);

  return mapTest(
    test as Record<string, unknown>,
    (variants ?? []).map(v => mapVariant(v as Record<string, unknown>)),
  );
}

/** Alle Tests einer Location abrufen (neueste zuerst) */
export async function listTests(locationId: string): Promise<AbTest[]> {
  const svc = createServiceClient();

  const { data: tests, error } = await svc
    .from('loyalty_ab_tests')
    .select('*')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(error.message);
  }

  if (!tests || tests.length === 0) return [];

  const testIds = tests.map(t => t.id as string);

  const { data: variants, error: varErr } = await svc
    .from('loyalty_ab_variants')
    .select('*')
    .in('test_id', testIds)
    .order('created_at');

  if (varErr) throw new Error(varErr.message);

  const variantsByTest = new Map<string, AbVariant[]>();
  for (const v of variants ?? []) {
    const r = v as Record<string, unknown>;
    const tid = r.test_id as string;
    if (!variantsByTest.has(tid)) variantsByTest.set(tid, []);
    variantsByTest.get(tid)!.push(mapVariant(r));
  }

  return tests.map(t =>
    mapTest(t as Record<string, unknown>, variantsByTest.get(t.id as string) ?? []),
  );
}

/** Status eines Tests ändern */
export async function updateTestStatus(
  testId: string,
  locationId: string,
  newStatus: 'active' | 'paused' | 'completed',
): Promise<void> {
  const svc = createServiceClient();

  const updates: Record<string, unknown> = {
    status:     newStatus,
    updated_at: new Date().toISOString(),
  };
  if (newStatus === 'active') updates.start_at = new Date().toISOString();
  if (newStatus === 'completed') updates.end_at = new Date().toISOString();

  const { error } = await svc
    .from('loyalty_ab_tests')
    .update(updates)
    .eq('id', testId)
    .eq('location_id', locationId);

  if (error) throw new Error(`Status-Update fehlgeschlagen: ${error.message}`);
}

/** Entwurf löschen (nur status='draft') */
export async function deleteTest(testId: string, locationId: string): Promise<void> {
  const svc = createServiceClient();

  const { error } = await svc
    .from('loyalty_ab_tests')
    .delete()
    .eq('id', testId)
    .eq('location_id', locationId)
    .eq('status', 'draft');

  if (error) throw new Error(`Löschen fehlgeschlagen: ${error.message}`);
}

/**
 * Variante für Kunden ermitteln oder erstellen.
 * Gibt null zurück wenn kein aktiver Test oder Tabellen fehlen.
 */
export async function getOrAssignVariant(
  testId: string,
  locationId: string,
  customerEmail: string,
): Promise<{ variant: AbVariant; assignmentId: string } | null> {
  const svc = createServiceClient();

  // Prüfen ob Test aktiv
  const { data: test, error: testErr } = await svc
    .from('loyalty_ab_tests')
    .select('id, status')
    .eq('id', testId)
    .eq('location_id', locationId)
    .eq('status', 'active')
    .maybeSingle();

  if (testErr) {
    if (isMissingTable(testErr)) return null;
    return null;
  }
  if (!test) return null;

  // Bestehende Zuweisung suchen
  const { data: existing } = await svc
    .from('loyalty_ab_assignments')
    .select('id, variant_id')
    .eq('test_id', testId)
    .eq('customer_email', customerEmail.trim().toLowerCase())
    .maybeSingle();

  if (existing) {
    const { data: varRow } = await svc
      .from('loyalty_ab_variants')
      .select('*')
      .eq('id', existing.variant_id as string)
      .single();
    if (!varRow) return null;
    return {
      variant:      mapVariant(varRow as Record<string, unknown>),
      assignmentId: existing.id as string,
    };
  }

  // Neue Zuweisung: Varianten laden und Hash-Bucket bestimmen
  const { data: variants } = await svc
    .from('loyalty_ab_variants')
    .select('*')
    .eq('test_id', testId);

  if (!variants || variants.length === 0) return null;

  const bucket    = customerBucket(testId, customerEmail);
  const variantMs = (variants as Record<string, unknown>[]).map(mapVariant);
  const chosen    = pickVariant(variantMs, bucket);
  if (!chosen) return null;

  const { data: assignment, error: assignErr } = await svc
    .from('loyalty_ab_assignments')
    .insert({
      test_id:        testId,
      variant_id:     chosen.id,
      location_id:    locationId,
      customer_email: customerEmail.trim().toLowerCase(),
    })
    .select('id')
    .single();

  if (assignErr) {
    // Race condition: andere Anfrage hat bereits zugewiesen
    const { data: retry } = await svc
      .from('loyalty_ab_assignments')
      .select('id, variant_id')
      .eq('test_id', testId)
      .eq('customer_email', customerEmail.trim().toLowerCase())
      .maybeSingle();
    if (!retry) return null;
    const { data: retryVar } = await svc
      .from('loyalty_ab_variants')
      .select('*')
      .eq('id', retry.variant_id as string)
      .single();
    if (!retryVar) return null;
    return {
      variant:      mapVariant(retryVar as Record<string, unknown>),
      assignmentId: retry.id as string,
    };
  }

  return { variant: chosen, assignmentId: assignment.id as string };
}

/**
 * Aktiven Test für eine Location abrufen (maximal einer gleichzeitig).
 * Gibt null zurück wenn keiner aktiv oder Tabellen fehlen.
 */
export async function getActiveTest(locationId: string): Promise<AbTest | null> {
  const svc = createServiceClient();

  const { data: test, error } = await svc
    .from('loyalty_ab_tests')
    .select('*')
    .eq('location_id', locationId)
    .eq('status', 'active')
    .order('start_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) return null;
    return null;
  }
  if (!test) return null;

  const { data: variants } = await svc
    .from('loyalty_ab_variants')
    .select('*')
    .eq('test_id', test.id as string)
    .order('created_at');

  return mapTest(
    test as Record<string, unknown>,
    (variants ?? []).map(v => mapVariant(v as Record<string, unknown>)),
  );
}

/** Konversions-Ereignis aufzeichnen */
export async function recordAbEvent(input: {
  assignmentId: string;
  testId: string;
  variantId: string;
  locationId: string;
  eventType: 'order_placed' | 'points_earned' | 'points_redeemed';
  orderId?: string;
  amountEur?: number;
  pointsDelta?: number;
}): Promise<void> {
  const svc = createServiceClient();
  await svc.from('loyalty_ab_events').insert({
    assignment_id: input.assignmentId,
    test_id:       input.testId,
    variant_id:    input.variantId,
    location_id:   input.locationId,
    event_type:    input.eventType,
    order_id:      input.orderId ?? null,
    amount_eur:    input.amountEur ?? null,
    points_delta:  input.pointsDelta ?? null,
  });
}

/** Metriken pro Variante für einen Test */
export async function getTestMetrics(
  testId: string,
  locationId: string,
): Promise<AbMetrics[]> {
  const svc = createServiceClient();

  const { data, error } = await svc
    .from('v_ab_test_metrics')
    .select('*')
    .eq('test_id', testId)
    .eq('location_id', locationId);

  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map(row => {
    const r = row as Record<string, unknown>;
    return {
      testId:               r.test_id as string,
      variantId:            r.variant_id as string,
      variantName:          r.variant_name as string,
      pointsMultiplier:     Number(r.points_multiplier),
      allocationPct:        Number(r.allocation_pct),
      assignedCustomers:    Number(r.assigned_customers),
      totalOrders:          Number(r.total_orders),
      totalRevenue:         Number(r.total_revenue),
      totalPointsEarned:    Number(r.total_points_earned),
      totalPointsRedeemed:  Number(r.total_points_redeemed),
      orderConversionPct:   Number(r.order_conversion_pct ?? 0),
      avgOrderValue:        Number(r.avg_order_value),
    };
  });
}
