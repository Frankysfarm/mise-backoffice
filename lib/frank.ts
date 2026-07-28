/**
 * Frank — der Smart-Dispatcher.
 *
 * Phase 3 (2026-05-05): Verteilt eingehende Lieferungs-Bestellungen auf
 * Fahrer und bündelt sie zu Multi-Stop-Touren wenn das Sinn ergibt.
 *
 * Strategie (vereinfacht):
 *  - Pro Tenant: alle nicht-zugewiesenen Lieferungs-Orders sammeln
 *  - Driver-Pool: aktive Fahrer dieses Tenants, die online sind
 *  - Pro Order:
 *    1. Existiert ein Bundle bei einem Driver dass noch nicht akzeptiert wurde
 *       (state='pending_acceptance')? → anhängen wenn Detour < 1.5 km haversine
 *       und Slot frei (vehicle bike=2, car=4 dropoffs)
 *    2. Existiert ein Bundle 'assigned' für den selben Pickup (Restaurant) und
 *       Driver hat Slot frei? → anhängen
 *    3. Sonst: neuen Bundle anlegen, nearest-driver wählen, Push triggern
 *  - Bei jedem Bundle-Update: Route via Google Directions berechnen, Polyline +
 *    total_distance + total_eta speichern. Fallback auf Haversine wenn Google
 *    nicht antwortet.
 *  - Frank-Decisions werden geloggt (mise_frank_decisions) — Trigger
 *    fn_enqueue_push_on_assign feuert auf type='assign' den Push.
 */
import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { directions, geocode, haversineKm, type RouteResult } from './google-maps';
import { randomUUID } from 'node:crypto';
import {
  atomicAssignmentV2Enabled,
  atomicOfferEnabled,
  claimAtomicWriterV2,
  createAtomicAssignmentV2,
  createAtomicSingleOrderOffer,
  selectedDispatchWriter,
  type DispatchWriter,
} from './delivery/atomic-offer';
import {
  decideIntelligentDispatch,
  type IntelligentDispatchDriver,
} from './delivery/intelligent-dispatch';
import {
  canonicalShiftEligible,
  decideDeterministicDispatch,
  deterministicModePolicy,
  deterministicScanStatuses,
  executeDeterministicDecision,
  preDecisionHold,
  snapshotPageSaturated,
  type DeterministicDispatchDecision,
  type DeterministicDriverSnapshot,
} from './delivery/deterministic-dispatch';
import {
  tryT08RouteAppend,
} from './delivery/t08-frank-route';
import {
  decideLongDistanceHold,
  evaluateCorridorBundle,
  type CorridorBundleDecision,
} from './delivery/long-distance-batching';

interface DriverRow {
  id: string;
  vehicle: 'bike' | 'car';
  max_radius_km: number;
  last_lat: number | null;
  last_lng: number | null;
  state: string;
}

function intelligent20kmEnabled(useAtomicWriter: boolean): boolean {
  return process.env.P0_INTELLIGENT_20KM_ENABLED === 'true' && useAtomicWriter;
}

function smartLongDistanceBatchingEnabled(): boolean {
  return process.env.P0_SMART_LONG_DISTANCE_BATCHING_ENABLED === 'true';
}

type DeterministicDispatchMode = 'off' | 'shadow' | 'active';
function deterministicDispatchMode(): DeterministicDispatchMode {
  const mode = process.env.T07_DETERMINISTIC_DISPATCH_MODE;
  return mode === 'shadow' || mode === 'active' ? mode : 'off';
}

interface OrderRow {
  id: string;
  bestellnummer: string;
  location_id: string | null;
  kunde_lat: number | null;
  kunde_lng: number | null;
  kunde_adresse: string | null;
  kunde_plz: string | null;
  kunde_stadt: string | null;
  created_at?: string | null;
  dispatch_version?: number | null;
  eta_earliest?: string | null;
  eta_latest?: string | null;
}

interface LocationRow {
  id: string;
  tenant_id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  adresse: string | null;
  plz: string | null;
  stadt: string | null;
}

let _sb: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (_sb) return _sb;
  _sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (i, init) => fetch(i as RequestInfo, { ...init, cache: 'no-store' }) },
    },
  );
  return _sb;
}

const VEHICLE_SLOTS: Record<'bike' | 'car', number> = { bike: 2, car: 4 };
const MAX_BUNDLE_DETOUR_KM = 1.5;
const ATOMIC_V2_WRITER_INSTANCE_ID = randomUUID();

// --- Dispatch-Strategien pro Restaurant (tenants.dispatch_strategy) ---
type DispatchStrategy = 'speed' | 'balance' | 'spar';
interface StrategyPreset { detourKm: number; slotBonus: number; holdSec: number; }
const STRATEGY_PRESETS: Record<DispatchStrategy, StrategyPreset> = {
  speed:   { detourKm: 0.5, slotBonus: 0, holdSec: 0 },
  balance: { detourKm: 1.5, slotBonus: 0, holdSec: 0 },
  spar:    { detourKm: 2.5, slotBonus: 1, holdSec: 180 },
};

async function tenantStrategy(tenantId: string): Promise<StrategyPreset> {
  const { data, error } = await sb().from('tenants').select('dispatch_strategy').eq('id', tenantId).maybeSingle();
  if (error) throw new Error(`TENANT_STRATEGY_LOAD_FAILED:${error.code ?? 'unknown'}`);
  const s = ((data as { dispatch_strategy?: string } | null)?.dispatch_strategy as DispatchStrategy) ?? 'balance';
  return STRATEGY_PRESETS[s] ?? STRATEGY_PRESETS.balance;
}

export interface DispatchTickResult {
  scanned_orders: number;
  bundled: number;
  assigned: number;
  held: number;
}

/**
 * Periodisch vom Cron aufgerufen — scannt unzugewiesene Lieferungs-Orders
 * und ordnet sie zu.
 */
export async function dispatchTick(): Promise<DispatchTickResult> {
  const c = sb();
  const tickMode = deterministicDispatchMode();
  const tickPolicy = deterministicModePolicy(tickMode);
  const { data: orders, error: ordersError } = await c
    .from('customer_orders')
    .select('id, bestellnummer, location_id, kunde_lat, kunde_lng, kunde_adresse, kunde_plz, kunde_stadt, created_at, dispatch_version, eta_earliest, eta_latest')
    .eq('typ', 'lieferung')
    .is('mise_driver_id', null)
    .is('mise_batch_id', null)
    .in('status', [...tickPolicy.scanStatuses])
    .order('created_at', { ascending: true })
    .limit(50);
  if (ordersError) {
    throw new Error(`FRANK_ORDER_SNAPSHOT_FAILED:${ordersError.code ?? 'unknown'}`);
  }

  const result: DispatchTickResult = {
    scanned_orders: orders?.length ?? 0,
    bundled: 0,
    assigned: 0,
    held: 0,
  };

  for (const o of orders ?? []) {
    try {
      const outcome = await dispatchOrder(o as OrderRow);
      if (outcome === 'bundled') result.bundled++;
      else if (outcome === 'assigned') result.assigned++;
      else result.held++;
    } catch (error) {
      result.held++;
      const message = error instanceof Error ? error.message : 'UNKNOWN';
      try {
        await logDecision('hold', null, [(o as OrderRow).id], 'DISPATCH_ORDER_FAILED', {
          error_code: message.slice(0, 120),
        });
      } catch (auditError) {
        throw new AggregateError([error, auditError], 'DISPATCH_AND_AUDIT_FAILED');
      }
    }
  }
  return result;
}

type Outcome = 'bundled' | 'assigned' | 'held';

export async function dispatchOrder(o: OrderRow): Promise<Outcome> {
  const c = sb();

  // 1) Pickup-Location (Restaurant) laden
  if (!o.location_id) return 'held';
  const { data: locRaw, error: locationError } = await c
    .from('locations')
    .select('id, tenant_id, name, lat, lng, adresse, plz, stadt')
    .eq('id', o.location_id)
    .maybeSingle();
  if (locationError) {
    throw new Error(`DISPATCH_LOCATION_LOAD_FAILED:${locationError.code ?? 'unknown'}`);
  }
  if (!locRaw) return 'held';
  const loc = locRaw as LocationRow;
  let selectedWriter: DispatchWriter | null;
  try {
    selectedWriter = await selectedDispatchWriter(c, loc.tenant_id);
  } catch {
    await logDecision('hold', null, [o.id], 'DISPATCH_WRITER_GATE_READ_FAILED');
    return 'held';
  }
  if (selectedWriter === 'legacy_db' || selectedWriter === 'frank_db') {
    // This process is not the elected writer for the tenant.
    return 'held';
  }
  const useAtomicV1 = selectedWriter === 'atomic_v1' && atomicOfferEnabled();
  const useAtomicV2 =
    selectedWriter === 'atomic_v2' && atomicAssignmentV2Enabled();
  const useAtomicWriter = useAtomicV1 || useAtomicV2;
  const deterministicMode = deterministicDispatchMode();
  const deterministicPolicy = deterministicModePolicy(deterministicMode);
  if (
    (selectedWriter === 'atomic_v1' || selectedWriter === 'atomic_v2') &&
    !useAtomicWriter
  ) {
    await logDecision('hold', null, [o.id], 'ATOMIC_WRITER_KILL_SWITCH_CLOSED');
    return 'held';
  }
  const preset = await tenantStrategy(loc.tenant_id);

  // 2) Customer-Adresse geocoden falls nötig
  if (o.kunde_lat == null || o.kunde_lng == null) {
    const addr = [o.kunde_adresse, o.kunde_plz, o.kunde_stadt].filter(Boolean).join(', ');
    if (!addr) {
      await logDecision('hold', null, [o.id], 'Keine Lieferadresse');
      return preDecisionHold();
    }
    try {
      const g = await geocode(addr);
      if (!g) {
        await logDecision('hold', null, [o.id], `Adresse nicht gefunden: ${addr}`);
        return 'held';
      }
      await c
        .from('customer_orders')
        .update({ kunde_lat: g.lat, kunde_lng: g.lng })
        .eq('id', o.id);
      o.kunde_lat = g.lat;
      o.kunde_lng = g.lng;
    } catch (e: unknown) {
      // Google deny / network → Order parken, Cron probiert nächste Runde wieder
      const msg = e instanceof Error ? e.message : String(e);
      await logDecision('hold', null, [o.id], `Geocoding-Fehler: ${msg.slice(0, 100)}`);
      return preDecisionHold();
    }
  }

  // 3) Driver-Pool: tenant + active + online + im Radius vom Restaurant (haversine)
  if (loc.lat == null || loc.lng == null) {
    await logDecision('hold', null, [o.id], 'Restaurant nicht geocodiert');
    return 'held';
  }
  const drivers = await driversForTenant(loc.tenant_id);
  const nearby = drivers.filter((d) => {
    if (d.last_lat == null || d.last_lng == null) return true;
    const km = haversineKm(
      { lat: d.last_lat, lng: d.last_lng },
      { lat: loc.lat!, lng: loc.lng! },
    );
    return km <= d.max_radius_km;
  });
  let deterministicWinner: DriverRow | null = null;
  let deterministicDecision: DeterministicDispatchDecision | null = null;
  let deterministicActionId: string | null = null;
  let shadowWinnerDriverId: string | null | undefined;
  const finish = async (
    outcome: Outcome,
    incumbentDriverId: string | null,
    incumbentReason: string,
  ): Promise<Outcome> => {
    if (deterministicMode === 'shadow' && shadowWinnerDriverId !== undefined) {
      await logDecision('hold', shadowWinnerDriverId, [o.id], 'T07_SHADOW_INCUMBENT_OUTCOME', {
        shadowWinnerDriverId,
        incumbentDriverId,
        incumbentOutcome: outcome,
        incumbentReason,
        matchesIncumbent:
          outcome === 'assigned' &&
          shadowWinnerDriverId === incumbentDriverId,
      });
    }
    return outcome;
  };
  if (deterministicPolicy.evaluate) {
    if (!useAtomicV2) {
      await logDecision('hold', null, [o.id], 'T07_CANONICAL_WRITER_REQUIRED', {
        mode: deterministicMode,
      });
      if (deterministicPolicy.mayInvokeAtomicWriter) return 'held';
    } else if (
      loc.lat == null || loc.lng == null ||
      o.kunde_lat == null || o.kunde_lng == null
    ) {
      await logDecision('hold', null, [o.id], 'T07_ROUTE_COORDINATES_MISSING', {
        mode: deterministicMode,
      });
      if (deterministicPolicy.mayInvokeAtomicWriter) return 'held';
    } else {
      const snapshots = await loadDeterministicDriverSnapshots(loc.tenant_id);
      if (!snapshots) {
        await logDecision('hold', null, [o.id], 'T07_CANDIDATE_SNAPSHOT_FAILED', {
          mode: deterministicMode,
        });
        if (deterministicPolicy.mayInvokeAtomicWriter) return 'held';
      }
      const dispatchConfig = snapshots
        ? await loadDeterministicTenantConfig(loc.tenant_id)
        : null;
      if (snapshots && !dispatchConfig) {
        await logDecision('hold', null, [o.id], 'T07_TENANT_CONFIG_FAILED', {
          mode: deterministicMode,
        });
        if (deterministicPolicy.mayInvokeAtomicWriter) return 'held';
      }
      if (snapshots && dispatchConfig) {
        const evaluatedAt = new Date();
        deterministicActionId =
          deterministicPolicy.mayInvokeAtomicWriter ? randomUUID() : null;
        const decision = decideDeterministicDispatch({
          id: o.id,
          tenantId: loc.tenant_id,
          pickup: { lat: loc.lat, lng: loc.lng },
          dropoff: { lat: o.kunde_lat, lng: o.kunde_lng },
          deliveryDeadlineAt: o.eta_latest ?? null,
        }, snapshots, {
          maxDeliveryKm: dispatchConfig.maxDeliveryKm,
          idleGpsStaleSeconds: dispatchConfig.idleGpsStaleSeconds,
          maxGpsAccuracyM: dispatchConfig.maxGpsAccuracyM,
        }, evaluatedAt);
        deterministicDecision = decision;
        if (deterministicMode === 'shadow') {
          shadowWinnerDriverId = decision.winnerDriverId;
        }
        await logDecision(
          deterministicMode === 'shadow'
            ? 'hold'
            : decision.winnerDriverId ? 'reroute' : 'hold',
          decision.winnerDriverId,
          [o.id],
          deterministicMode === 'shadow'
            ? 'T07_SHADOW_DECISION'
            : decision.winnerDriverId
              ? 'T07_CANDIDATE_SELECTED_PENDING_CAS'
              : decision.reasonCode,
          {
            mode: deterministicMode,
            decisionActionId: deterministicActionId,
            ...decision,
          } as unknown as Record<string, unknown>,
        );
        if (deterministicPolicy.mayInvokeAtomicWriter) {
          if (!decision.winnerDriverId) return 'held';
          deterministicWinner =
            drivers.find((driver) => driver.id === decision.winnerDriverId) ?? null;
          if (!deterministicWinner) return 'held';
        }
      }
    }
  }

  if (deterministicPolicy.continueIncumbent && smartLongDistanceBatchingEnabled()) {
    const hold = decideLongDistanceHold({
      id: o.id,
      pickup: { lat: loc.lat, lng: loc.lng },
      dropoff: { lat: o.kunde_lat, lng: o.kunde_lng },
      createdAt: o.created_at ?? new Date(0).toISOString(),
      deadlineAt: o.eta_latest ?? null,
    }, new Date());
    await logDecision(
      hold.action === 'hold' ? 'hold' : 'reroute',
      null,
      [o.id],
      `LONG_DISTANCE_${hold.reasonCode}`,
      hold as unknown as Record<string, unknown>,
    );
    if (hold.action === 'reject' || hold.action === 'hold') {
      return finish('held', null, `LONG_DISTANCE_${hold.reasonCode}`);
    }
  }

  if (deterministicPolicy.continueIncumbent && nearby.length === 0) {
    await logDecision('hold', null, [o.id], 'Kein Fahrer im Radius');
    return finish('held', null, 'NO_DRIVER_IN_RADIUS');
  }

  // 4) Bundling: gibt's einen Driver mit pending_acceptance Bundle das passt?
  for (const d of useAtomicWriter ? [] : nearby) {
    const { data: openBatch } = await c
      .from('mise_delivery_batches')
      .select('id, state')
      .eq('driver_id', d.id)
      .in('state', ['pending_acceptance', 'assigned', 'at_restaurant'])
      .maybeSingle();
    if (!openBatch) continue;

    let corridorDecision: CorridorBundleDecision | null = null;
    const fits = smartLongDistanceBatchingEnabled()
      ? Boolean(corridorDecision = await canSmartCorridorBundle(openBatch.id, d, o, loc, preset))
        && corridorDecision.compatible
      : await canBundle(openBatch.id, d, o, loc, preset);
    if (!fits) continue;

    await addOrderToBundle(openBatch.id, o.id, loc, d.vehicle);
    // Route wird erst nach komplettem Pickup berechnet (siehe picked-up endpoint)
    await logDecision(
      'bundle',
      d.id,
      [o.id],
      `An offenen Bundle gehängt — ${corridorDecision?.reasonCode ?? 'kürzerer Umweg als neuer Trip'}.`,
      corridorDecision
        ? corridorDecision as unknown as Record<string, unknown>
        : undefined,
    );
    return finish('bundled', d.id, 'LEGACY_BUNDLE');
  }

  if (useAtomicV2 && o.eta_earliest && o.eta_latest) {
    const appendOutcome = await tryT08RouteAppend(
      c,
      ATOMIC_V2_WRITER_INSTANCE_ID,
      {
        id: o.id,
        locationId: o.location_id,
        dispatchVersion: Number(o.dispatch_version ?? 0),
        pickupDeadlineAt: o.eta_earliest,
        deliveryDeadlineAt: o.eta_latest,
        dropoff: {
          lat: o.kunde_lat!,
          lng: o.kunde_lng!,
          address: o.kunde_adresse ?? '',
        },
      },
      {
        tenantId: loc.tenant_id,
        id: loc.id,
        lat: loc.lat,
        lng: loc.lng,
        address: [loc.adresse, loc.plz, loc.stadt].filter(Boolean).join(', ') || loc.name,
      },
      (reason, driverId, data) =>
        logDecision('hold', driverId, [o.id], reason, data),
    );
    if (appendOutcome === 'appended') {
      return finish('bundled', null, 'T08_ROUTE_APPEND_COMMITTED');
    }
    if (appendOutcome === 'conflict') {
      return finish('held', null, 'T08_ROUTE_APPEND_CONFLICT');
    }
  }

  // 4b) Spar-Modus: kein passender Bundle -> kurz warten (sammeln) statt sofort allein rauszuschicken
  if (deterministicPolicy.continueIncumbent && preset.holdSec > 0 && o.created_at) {
    const ageSec = (Date.now() - new Date(o.created_at).getTime()) / 1000;
    if (ageSec < preset.holdSec) {
      await logDecision('hold', null, [o.id], `Spar-Modus: warte auf Buendel (${Math.round(ageSec)}/${preset.holdSec}s)`);
      return finish('held', null, 'LEGACY_STRATEGY_HOLD');
    }
  }

  // 5) Neuer Bundle für nearest-Driver (nach last position oder zufällig)
  let best: DriverRow;
  if (deterministicWinner) {
    best = deterministicWinner;
  } else if (intelligent20kmEnabled(useAtomicWriter)) {
    const driverIds = nearby.map((driver) => driver.id);
    const [{ data: details, error: detailsError }, { data: recent, error: recentError },
      { data: tenantConfig, error: tenantError }, { data: deadlineRow, error: deadlineError }] =
      await Promise.all([
        c.from('mise_drivers')
          .select('id,vehicle,state,last_lat,last_lng,last_position_at,current_capacity,max_capacity')
          .in('id', driverIds),
        c.from('mise_frank_decisions')
          .select('driver_id,created_at')
          .in('driver_id', driverIds)
          .eq('type', 'assign')
          .gte('created_at', new Date(Date.now() - 60 * 60_000).toISOString()),
        c.from('tenants')
          .select('lieferradius_km,dispatch_config')
          .eq('id', loc.tenant_id)
          .maybeSingle(),
        c.from('customer_orders')
          .select('eta_latest')
          .eq('id', o.id)
          .maybeSingle(),
      ]);
    if (detailsError || recentError || tenantError || deadlineError) {
      await logDecision('hold', null, [o.id], 'INTELLIGENT_INPUT_LOAD_FAILED', {
        reason_code: 'INTELLIGENT_INPUT_LOAD_FAILED',
      });
      return finish('held', null, 'INTELLIGENT_INPUT_LOAD_FAILED');
    }

    const recentRows = (recent ?? []) as Array<{
      driver_id: string | null;
      created_at: string;
    }>;
    const candidates: IntelligentDispatchDriver[] = (details ?? []).map((row: any) => {
      const assignments = recentRows.filter((entry) => entry.driver_id === row.id);
      const assignmentTimes = assignments.map((entry) => entry.created_at).sort();
      return {
        id: row.id,
        vehicle: row.vehicle,
        state: row.state,
        position: { lat: row.last_lat, lng: row.last_lng },
        lastPositionAt: row.last_position_at,
        activeStops: Number(row.current_capacity ?? 0),
        maxCapacity: Number(row.max_capacity ?? (row.vehicle === 'car' ? 4 : 2)),
        assignmentsLastHour: assignments.length,
        lastAssignedAt: assignmentTimes[assignmentTimes.length - 1] ?? null,
      };
    });
    const dispatchConfig = (tenantConfig?.dispatch_config ?? {}) as Record<string, unknown>;
    const configuredMax = Number(
      dispatchConfig.max_delivery_km ??
      tenantConfig?.lieferradius_km ??
      process.env.P0_MAX_DELIVERY_KM ??
      8,
    );
    const decision = decideIntelligentDispatch(
      {
        id: o.id,
        pickup: { lat: loc.lat, lng: loc.lng },
        dropoff: { lat: o.kunde_lat, lng: o.kunde_lng },
        deadlineAt: deadlineRow?.eta_latest ?? null,
      },
      candidates,
      { maxDeliveryKm: configuredMax },
      new Date(),
    );
    await logDecision(
      decision.winnerDriverId ? 'reroute' : 'hold',
      decision.winnerDriverId,
      [o.id],
      decision.winnerDriverId
        ? 'INTELLIGENT_CANDIDATE_SELECTED'
        : 'NO_INTELLIGENT_CANDIDATE',
      decision as unknown as Record<string, unknown>,
    );
    if (!decision.winnerDriverId) return finish('held', null, 'INTELLIGENT_NO_WINNER');
    const selected = nearby.find((driver) => driver.id === decision.winnerDriverId);
    if (!selected) return finish('held', null, 'INTELLIGENT_WINNER_NOT_IN_POOL');
    best = selected;
  } else {
    best = pickBest(nearby, loc);
  }
  const atomicMode = useAtomicV2 ? 'v2' : useAtomicV1 ? 'v1' : null;
  const deterministicExecution =
    deterministicPolicy.mayInvokeAtomicWriter && deterministicDecision
      ? await executeDeterministicDecision(
        'active',
        deterministicDecision,
        async () => createBundle(
          best, o, loc, atomicMode, deterministicActionId ?? undefined,
        ),
      )
      : null;
  const created = deterministicExecution?.mode === 'active'
    ? deterministicExecution.result
    : await createBundle(
        best, o, loc, atomicMode, deterministicActionId ?? undefined,
      );
  if (!created) return finish('held', best.id, 'CANONICAL_WRITER_REJECTED');
  // Route erst nach Pickup
  // Atomic-v1 schreibt Audit + Push-Outbox bereits in derselben Transaktion.
  if (!created.atomic) {
    await logDecision('assign', best.id, [o.id], `Direkt zugewiesen — kein passender Bundle offen.`);
  } else if (deterministicMode === 'active') {
    await logDecision('assign', best.id, [o.id], 'T07_ASSIGNMENT_COMMITTED', {
      algorithmVersion: 'deterministic-baseline-v1',
      decisionActionId: created.actionId,
      correlationId: created.correlationId,
      batchId: created.batchId,
    });
  }
  return finish('assigned', best.id, 'INCUMBENT_ASSIGNMENT_COMMITTED');
}

async function loadDeterministicTenantConfig(tenantId: string): Promise<{
  maxDeliveryKm: number;
  idleGpsStaleSeconds: number;
  maxGpsAccuracyM: number;
} | null> {
  const c = sb();
  const [{ data: tenant, error: tenantError }, { data: gps, error: gpsError }] =
    await Promise.all([
      c.from('tenants').select('lieferradius_km,dispatch_config').eq('id', tenantId).maybeSingle(),
      c.from('mise_gps_transport_config')
        .select('idle_stale_seconds,max_accuracy_m')
        .eq('tenant_id', tenantId)
        .maybeSingle(),
    ]);
  if (tenantError || gpsError || !gps) return null;
  const config = (tenant?.dispatch_config ?? {}) as Record<string, unknown>;
  return {
    maxDeliveryKm: Number(config.max_delivery_km ?? tenant?.lieferradius_km ?? 20),
    idleGpsStaleSeconds: Number(gps.idle_stale_seconds),
    maxGpsAccuracyM: Number(gps.max_accuracy_m),
  };
}

async function loadDeterministicDriverSnapshots(
  tenantId: string,
): Promise<DeterministicDriverSnapshot[] | null> {
  const c = sb();
  const { data: memberships, error: membershipsError } = await c
    .from('mise_driver_tenants')
    .select('driver_id,status')
    .eq('tenant_id', tenantId)
    .limit(500);
  if (membershipsError) return null;
  if (snapshotPageSaturated((memberships ?? []).length, 500)) return null;
  const ids = (memberships ?? []).map((row: any) => row.driver_id as string);
  if (ids.length === 0) return [];
  const membershipByDriver = new Map(
    (memberships ?? []).map((row: any) => [row.driver_id, row.status === 'active']),
  );
  const { data: activeBatches, error: activeBatchesError } = await c
    .from('mise_delivery_batches')
    .select('id,driver_id,state')
    .in('driver_id', ids)
    .not('state', 'in', '("completed","cancelled")')
    .limit(500);
  if (activeBatchesError) return null;
  if (snapshotPageSaturated((activeBatches ?? []).length, 500)) return null;
  const batchIds = (activeBatches ?? []).map((batch: any) => batch.id as string);
  const { data: activeStops, error: activeStopsError } = batchIds.length
    ? await c.from('mise_delivery_batch_stops')
      .select('batch_id,completed_at')
      .in('batch_id', batchIds)
      .is('completed_at', null)
      .limit(2000)
    : { data: [], error: null };
  if (activeStopsError) return null;
  if (snapshotPageSaturated((activeStops ?? []).length, 2000)) return null;
  const driverByBatch = new Map(
    (activeBatches ?? []).map((batch: any) => [batch.id, batch.driver_id]),
  );
  const activeStopsByDriver = new Map<string, number>();
  for (const stop of activeStops ?? []) {
    const driverId = driverByBatch.get((stop as any).batch_id) as string | undefined;
    if (driverId) {
      activeStopsByDriver.set(
        driverId,
        (activeStopsByDriver.get(driverId) ?? 0) + 1,
      );
    }
  }
  const since = new Date(Date.now() - 60 * 60_000).toISOString();
  const [
    { data: details, error: detailsError },
    { data: positions, error: positionsError },
    { data: exceptions, error: exceptionsError },
    { data: assignments, error: assignmentsError },
  ] = await Promise.all([
    c.from('mise_drivers')
      .select('id,active,state,vehicle,max_radius_km,current_capacity,max_capacity')
      .in('id', ids).limit(500),
    c.from('mise_driver_position_current')
      .select('driver_id,tenant_id,captured_at,received_at,latitude,longitude,accuracy_m,quality_flags,operational_state')
      .eq('tenant_id', tenantId).in('driver_id', ids).limit(500),
    c.from('driver_exceptions_v2')
      .select('driver_id,state').in('driver_id', ids)
      .in('state', ['reported', 'triaged', 'mitigating', 'reassignment_required'])
      .limit(500),
    c.from('mise_frank_decisions')
      .select('driver_id,created_at').in('driver_id', ids)
      .eq('type', 'assign').gte('created_at', since).limit(5000),
  ]);
  if (detailsError || positionsError || exceptionsError || assignmentsError) return null;
  if (
    snapshotPageSaturated((details ?? []).length, 500) ||
    snapshotPageSaturated((positions ?? []).length, 500) ||
    snapshotPageSaturated((exceptions ?? []).length, 500) ||
    snapshotPageSaturated((assignments ?? []).length, 5000)
  ) return null;
  const positionByDriver = new Map((positions ?? []).map((row: any) => [row.driver_id, row]));
  const blocked = new Set((exceptions ?? []).map((row: any) => row.driver_id));
  return (details ?? []).map((row: any) => {
    const position = positionByDriver.get(row.id) as any;
    const recent = (assignments ?? [])
      .filter((entry: any) => entry.driver_id === row.id)
      .map((entry: any) => entry.created_at as string)
      .sort();
    return {
      id: row.id,
      tenantMembershipActive: membershipByDriver.get(row.id) === true,
      shiftActive: canonicalShiftEligible(Boolean(row.active), row.state),
      active: Boolean(row.active),
      state: row.state,
      vehicle: row.vehicle,
      maxRadiusKm: Number(row.max_radius_km ?? 0),
      currentCapacity: Number(row.current_capacity ?? 0),
      maxCapacity: Number(row.max_capacity ?? (row.vehicle === 'car' ? 4 : 2)),
      activeRouteStops: activeStopsByDriver.get(row.id) ?? 0,
      blockingException: blocked.has(row.id),
      assignmentsLastHour: recent.length,
      lastAssignedAt: recent[recent.length - 1] ?? null,
      gps: position ? {
        latitude: Number(position.latitude),
        longitude: Number(position.longitude),
        captured_at: position.captured_at,
        received_at: position.received_at,
        accuracy_m: Number(position.accuracy_m),
        quality_flags: position.quality_flags ?? [],
        operational_state: position.operational_state,
      } : null,
    };
  });
}

async function driversForTenant(tenantId: string): Promise<DriverRow[]> {
  const c = sb();
  const { data, error } = await c
    .from('mise_driver_tenants')
    .select(
      `status,
       driver:driver_id(id, vehicle, max_radius_km, last_lat, last_lng, state, active)`,
    )
    .eq('tenant_id', tenantId)
    .eq('status', 'active');
  if (error) throw new Error(`DISPATCH_DRIVER_POOL_LOAD_FAILED:${error.code ?? 'unknown'}`);
  return (data ?? [])
    .map((row: any) => row.driver)
    .filter((d: any) => d && d.active && d.state !== 'offline')
    .map((d: any) => ({
      id: d.id,
      vehicle: d.vehicle,
      max_radius_km: Number(d.max_radius_km),
      last_lat: d.last_lat,
      last_lng: d.last_lng,
      state: d.state,
    }));
}

async function canBundle(
  batchId: string,
  driver: DriverRow,
  newOrder: OrderRow,
  pickupLoc: LocationRow,
  preset: StrategyPreset,
): Promise<boolean> {
  const c = sb();
  const { data: stops } = await c
    .from('mise_delivery_batch_stops')
    .select('id, type, lat, lng, order_id')
    .eq('batch_id', batchId);
  const dropoffs = (stops ?? []).filter((s: any) => s.type === 'dropoff');
  const pickups = (stops ?? []).filter((s: any) => s.type === 'pickup');

  // Slot-Check
  if (dropoffs.length >= VEHICLE_SLOTS[driver.vehicle] + preset.slotBonus) return false;

  // Pickup-Restaurant identisch? Sonst zwingt das eine 2. Pickup-Stop → nur erlaubt
  // wenn Pickup auch nah am bestehenden Bundle (haversine < detour)
  const samePickup = pickups.some(
    (p: any) =>
      p.lat != null &&
      p.lng != null &&
      pickupLoc.lat != null &&
      pickupLoc.lng != null &&
      haversineKm({ lat: p.lat, lng: p.lng }, { lat: pickupLoc.lat, lng: pickupLoc.lng }) < 0.1,
  );

  // Dropoff in der Nähe einer existierenden Dropoff?
  if (newOrder.kunde_lat == null || newOrder.kunde_lng == null) return false;
  const nearDropoff = dropoffs.some((d: any) => {
    if (d.lat == null || d.lng == null) return false;
    return (
      haversineKm(
        { lat: d.lat, lng: d.lng },
        { lat: newOrder.kunde_lat!, lng: newOrder.kunde_lng! },
      ) < preset.detourKm
    );
  });

  return samePickup && nearDropoff;
}

async function canSmartCorridorBundle(
  batchId: string,
  driver: DriverRow,
  newOrder: OrderRow,
  pickupLoc: LocationRow,
  preset: StrategyPreset,
): Promise<CorridorBundleDecision> {
  const { data: stops } = await sb()
    .from('mise_delivery_batch_stops')
    .select('order_id,type,sequence,lat,lng,completed_at')
    .eq('batch_id', batchId)
    .order('sequence', { ascending: true });
  const open = (stops ?? []).filter((stop: any) => stop.completed_at == null);
  const pickups = open.filter((stop: any) => stop.type === 'pickup');
  const dropoffs = open.filter((stop: any) => stop.type === 'dropoff');
  const samePickup = pickups.some((stop: any) =>
    stop.lat != null && stop.lng != null &&
    pickupLoc.lat != null && pickupLoc.lng != null &&
    haversineKm(
      { lat: stop.lat, lng: stop.lng },
      { lat: pickupLoc.lat, lng: pickupLoc.lng },
    ) < 0.1);
  const routeEnd = dropoffs[dropoffs.length - 1];
  return evaluateCorridorBundle({
    routeStart: samePickup
      ? { lat: pickupLoc.lat, lng: pickupLoc.lng }
      : { lat: null, lng: null },
    routeEnd: { lat: routeEnd?.lat ?? null, lng: routeEnd?.lng ?? null },
    candidate: {
      id: newOrder.id,
      pickup: { lat: pickupLoc.lat, lng: pickupLoc.lng },
      dropoff: { lat: newOrder.kunde_lat, lng: newOrder.kunde_lng },
      createdAt: newOrder.created_at ?? new Date(0).toISOString(),
      deadlineAt: newOrder.eta_latest ?? null,
    },
    existingAdditionalOrders: Math.max(
      0,
      new Set(dropoffs.map((stop: any) => stop.order_id)).size - 1,
    ),
    activeStops: dropoffs.length,
    maxCapacity: VEHICLE_SLOTS[driver.vehicle] + preset.slotBonus,
  }, new Date());
}

function pickBest(drivers: DriverRow[], pickupLoc: LocationRow): DriverRow {
  if (pickupLoc.lat == null || pickupLoc.lng == null) return drivers[0];
  return drivers
    .map((d) => ({
      d,
      km:
        d.last_lat != null && d.last_lng != null
          ? haversineKm(
              { lat: d.last_lat, lng: d.last_lng },
              { lat: pickupLoc.lat!, lng: pickupLoc.lng! },
            )
          : 999,
    }))
    .sort((a, b) => a.km - b.km)[0].d;
}

async function createBundle(
  driver: DriverRow,
  o: OrderRow,
  loc: LocationRow,
  atomicMode: 'v1' | 'v2' | null,
  actionId?: string,
): Promise<{
  batchId: string;
  atomic: boolean;
  actionId?: string;
  correlationId?: string;
} | null> {
  const c = sb();
  if (atomicMode) {
    if (
      o.kunde_lat == null || o.kunde_lng == null ||
      loc.lat == null || loc.lng == null
    ) return null;
    const decisionId = actionId ?? randomUUID();
    if (atomicMode === 'v2') {
      if (!o.eta_earliest || !o.eta_latest) {
        await logDecision(
          'hold',
          null,
          [o.id],
          'ATOMIC_V2_PERSISTENT_DEADLINE_MISSING',
        );
        return null;
      }
      const lease = await claimAtomicWriterV2(
        c,
        loc.tenant_id,
        ATOMIC_V2_WRITER_INSTANCE_ID,
      );
      if (!lease.ok || lease.writer_epoch == null) return null;
      const { data: driverVersion, error: driverVersionError } = await c
        .from('mise_drivers')
        .select('state_version')
        .eq('id', driver.id)
        .single();
      if (driverVersionError || driverVersion?.state_version == null) {
        await logDecision(
          'hold',
          driver.id,
          [o.id],
          'ATOMIC_V2_DRIVER_VERSION_LOAD_FAILED',
        );
        return null;
      }
      const result = await createAtomicAssignmentV2(c, {
        tenantId: loc.tenant_id,
        writerId: ATOMIC_V2_WRITER_INSTANCE_ID,
        writerEpoch: lease.writer_epoch,
        driverId: driver.id,
        expectedDriverVersion: Number(driverVersion.state_version),
        actionId: decisionId,
        orders: [{
          orderId: o.id,
          expectedOrderVersion: Number(o.dispatch_version ?? 0),
          pickup: {
            lat: loc.lat,
            lng: loc.lng,
            address:
              [loc.adresse, loc.plz, loc.stadt].filter(Boolean).join(', ') ||
              loc.name,
          },
          dropoff: {
            lat: o.kunde_lat,
            lng: o.kunde_lng,
            address: o.kunde_adresse ?? '',
          },
          pickupDeadlineAt: o.eta_earliest,
          deliveryDeadlineAt: o.eta_latest,
        }],
        push: {
          title: `Neue Tour: ${loc.name}`,
          body: 'Eine neue Lieferung ist dir zugewiesen.',
        },
      });
      if (!result.ok || !result.batch_id) {
        if (actionId) {
          await logDecision('hold', driver.id, [o.id], 'T07_ATOMIC_CAS_REJECTED', {
            algorithmVersion: 'deterministic-baseline-v1',
            decisionActionId: decisionId,
            correlationId: result.correlation_id,
            atomicReasonCode: result.reason_code ?? 'INVALID_ATOMIC_RESULT',
          });
        }
        return null;
      }
      return {
        batchId: result.batch_id,
        atomic: true,
        actionId: decisionId,
        correlationId: result.correlation_id,
      };
    }
    const result = await createAtomicSingleOrderOffer(c, {
      tenantId: loc.tenant_id,
      orderId: o.id,
      driverId: driver.id,
      expectedOrderVersion: Number(o.dispatch_version ?? 0),
      decisionId,
      idempotencyKey: decisionId,
      offerTtlSeconds: Math.max(
        10,
        Math.min(120, Number(process.env.P0_ATOMIC_OFFER_TTL_SECONDS ?? 20)),
      ),
      pickup: {
        lat: loc.lat,
        lng: loc.lng,
        address: [loc.adresse, loc.plz, loc.stadt].filter(Boolean).join(', ') || loc.name,
      },
      dropoff: {
        lat: o.kunde_lat,
        lng: o.kunde_lng,
        address: o.kunde_adresse ?? '',
      },
      push: {
        title: `Neue Tour: ${loc.name}`,
        body: 'Eine neue Lieferung wartet auf deine Annahme.',
      },
    });
    if (!result.ok || !result.batch_id) return null;
    return {
      batchId: result.batch_id,
      atomic: true,
      actionId: decisionId,
      correlationId: result.correlation_id,
    };
  }

  const { data: batch, error } = await c
    .from('mise_delivery_batches')
    .insert({ driver_id: driver.id, state: 'pending_acceptance' })
    .select('id')
    .single();
  if (error || !batch) throw new Error(error?.message ?? 'Batch insert failed');

  await c.from('mise_delivery_batch_stops').insert([
    {
      batch_id: batch.id,
      order_id: o.id,
      type: 'pickup',
      sequence: 0,
      lat: loc.lat,
      lng: loc.lng,
      address: [loc.adresse, loc.plz, loc.stadt].filter(Boolean).join(', ') || loc.name,
    },
    {
      batch_id: batch.id,
      order_id: o.id,
      type: 'dropoff',
      sequence: 1,
      lat: o.kunde_lat,
      lng: o.kunde_lng,
      address: o.kunde_adresse,
    },
  ]);

  await c
    .from('customer_orders')
    .update({ mise_batch_id: batch.id, mise_driver_id: driver.id })
    .eq('id', o.id);

  return { batchId: batch.id, atomic: false };
}

async function addOrderToBundle(
  batchId: string,
  orderId: string,
  loc: LocationRow,
  _vehicle: 'bike' | 'car',
): Promise<void> {
  const c = sb();
  // Existing max sequence holen
  const { data: stops } = await c
    .from('mise_delivery_batch_stops')
    .select('sequence, type, order_id, lat, lng')
    .eq('batch_id', batchId)
    .order('sequence', { ascending: false });
  const maxSeq = stops && stops.length > 0 ? stops[0].sequence : -1;

  // Pickup für selben Restaurant → nicht erneut anlegen
  const samePickup = (stops ?? []).find(
    (s: any) =>
      s.type === 'pickup' &&
      s.lat != null &&
      s.lng != null &&
      loc.lat != null &&
      loc.lng != null &&
      haversineKm({ lat: s.lat, lng: s.lng }, { lat: loc.lat, lng: loc.lng }) < 0.1,
  );

  const { data: o } = await c
    .from('customer_orders')
    .select('kunde_lat, kunde_lng, kunde_adresse')
    .eq('id', orderId)
    .single();

  const inserts: Array<{
    batch_id: string;
    order_id: string;
    type: 'pickup' | 'dropoff';
    sequence: number;
    lat: number | null;
    lng: number | null;
    address: string | null;
  }> = [];
  let nextSeq = maxSeq + 1;
  if (!samePickup) {
    inserts.push({
      batch_id: batchId,
      order_id: orderId,
      type: 'pickup',
      sequence: nextSeq++,
      lat: loc.lat,
      lng: loc.lng,
      address: [loc.adresse, loc.plz, loc.stadt].filter(Boolean).join(', ') || loc.name,
    });
  }
  inserts.push({
    batch_id: batchId,
    order_id: orderId,
    type: 'dropoff',
    sequence: nextSeq,
    lat: o?.kunde_lat ?? null,
    lng: o?.kunde_lng ?? null,
    address: o?.kunde_adresse ?? null,
  });
  await c.from('mise_delivery_batch_stops').insert(inserts);
  await c
    .from('customer_orders')
    .update({ mise_batch_id: batchId })
    .eq('id', orderId);
  // mise_driver_id wird über die Bundle-Verknüpfung indirekt klar — Backwards-Kompatibilität
  const { data: bundleDriver } = await c
    .from('mise_delivery_batches')
    .select('driver_id')
    .eq('id', batchId)
    .maybeSingle();
  if (bundleDriver?.driver_id) {
    await c
      .from('customer_orders')
      .update({ mise_driver_id: bundleDriver.driver_id })
      .eq('id', orderId);
  }
}

/**
 * Berechnet die Multi-Stop-Route über Google Directions (mit waypoint-optimize),
 * speichert polyline + total_distance + total_eta + neue stop-sequence.
 *
 * Fallback wenn Google nicht antwortet: Stops bleiben in DB-Reihenfolge,
 * polyline bleibt null, distance/eta via Haversine geschätzt.
 */
export async function rerouteBundle(batchId: string): Promise<void> {
  const c = sb();
  const { data: stops } = await c
    .from('mise_delivery_batch_stops')
    .select('id, type, sequence, lat, lng')
    .eq('batch_id', batchId)
    .order('sequence', { ascending: true });
  if (!stops || stops.length < 2) return;

  // Pickups zuerst, dann Dropoffs (vereinfacht; bei mehr als 1 pickup wird Google
  // optimieren). Driver-Position als origin wäre besser, ist aber für v1 weggelassen.
  const pickups = stops.filter((s: any) => s.type === 'pickup');
  const dropoffs = stops.filter((s: any) => s.type === 'dropoff');
  const ordered = [...pickups, ...dropoffs].filter(
    (s: any) => s.lat != null && s.lng != null,
  );
  if (ordered.length < 2) return;

  const origin = { lat: ordered[0].lat as number, lng: ordered[0].lng as number };
  const destination = {
    lat: ordered[ordered.length - 1].lat as number,
    lng: ordered[ordered.length - 1].lng as number,
  };
  const waypoints = ordered.slice(1, -1).map((s: any) => ({ lat: s.lat as number, lng: s.lng as number }));

  let route: RouteResult | null = null;
  try {
    route = await directions({
      origin,
      destination,
      waypoints,
      optimize: dropoffs.length > 1, // nur bei mehreren Dropoffs Sinn
      mode: 'driving',
    });
  } catch {
    route = null;
  }

  if (route) {
    await c
      .from('mise_delivery_batches')
      .update({
        polyline: route.polyline,
        total_distance_km: Math.round((route.total_distance_m / 1000) * 10) / 10,
        total_eta_min: Math.round(route.total_duration_s / 60),
      })
      .eq('id', batchId);
  } else {
    // Fallback: haversine
    let km = 0;
    for (let i = 0; i < ordered.length - 1; i++) {
      km += haversineKm(
        { lat: ordered[i].lat as number, lng: ordered[i].lng as number },
        { lat: ordered[i + 1].lat as number, lng: ordered[i + 1].lng as number },
      );
    }
    await c
      .from('mise_delivery_batches')
      .update({
        polyline: null,
        total_distance_km: Math.round(km * 10) / 10,
        total_eta_min: Math.round((km / 18) * 60), // bike-Annahme
      })
      .eq('id', batchId);
  }
}

async function logDecision(
  type: 'assign' | 'hold' | 'rebalance' | 'reroute' | 'bundle' | 'cancel',
  driverId: string | null,
  orderIds: string[],
  reasonText: string,
  reasonData?: Record<string, unknown>,
): Promise<void> {
  const c = sb();
  const { error } = await c.from('mise_frank_decisions').insert({
    type,
    driver_id: driverId,
    order_ids: orderIds,
    reason_text: reasonText,
    ...(reasonData ? { reason_data: reasonData } : {}),
  });
  if (error) throw new Error(`FRANK_DECISION_AUDIT_FAILED:${error.code ?? 'unknown'}`);
}
