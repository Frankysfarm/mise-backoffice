/**
 * lib/delivery/proof.ts
 *
 * Delivery Proof & Failed-Attempt Engine — Phase 40
 *
 * Verwaltet Liefernachweise (Fotos, Hinweisarten) und fehlgeschlagene
 * Zustellversuche inklusive Retry-Planung und Admin-Auflösung.
 *
 * Graceful Fallback: Alle Funktionen fangen Migration-fehlt-Fehler ab
 * und geben leere/Fallback-Daten zurück → kein Fatal-Crash.
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─────────────────────────────────────────────────────────────────────────────
// Typen
// ─────────────────────────────────────────────────────────────────────────────

export type ProofType =
  | 'photo'
  | 'left_at_door'
  | 'neighbour'
  | 'handed_to_person'
  | 'contactless';

export type FailedReason =
  | 'no_answer'
  | 'wrong_address'
  | 'refused'
  | 'access_denied'
  | 'not_home'
  | 'other';

export type FailedResolution =
  | 'delivered'
  | 'returned_to_restaurant'
  | 'cancelled'
  | 'rescheduled';

export interface DeliveryProof {
  id: string;
  tourStopId: string;
  orderId: string | null;
  batchId: string | null;
  locationId: string;
  proofType: ProofType;
  photoUrl: string | null;
  notes: string | null;
  driverLat: number | null;
  driverLng: number | null;
  createdAt: string;
}

export interface FailedAttempt {
  id: string;
  tourStopId: string | null;
  orderId: string;
  batchId: string | null;
  locationId: string;
  driverId: string | null;
  reason: FailedReason;
  attemptNumber: number;
  photoUrl: string | null;
  notes: string | null;
  driverLat: number | null;
  driverLng: number | null;
  nextAttemptAt: string | null;
  resolvedAt: string | null;
  resolution: FailedResolution | null;
  createdAt: string;
}

export interface PendingFailedAttempt extends FailedAttempt {
  bestellnummer: string | null;
  kundeName: string | null;
  kundeAdresse: string | null;
  kundePlz: string | null;
  kundeStadt: string | null;
  kundeTelefon: string | null;
  gesamtbetrag: number | null;
  orderStatus: string | null;
  driverName: string | null;
  driverVehicle: string | null;
}

export interface ProofInput {
  tourStopId: string;
  orderId: string | null;
  batchId: string | null;
  proofType: ProofType;
  photoUrl?: string | null;
  notes?: string | null;
  driverLat?: number | null;
  driverLng?: number | null;
}

export interface FailedAttemptInput {
  tourStopId: string | null;
  orderId: string;
  batchId: string | null;
  driverId: string | null;
  reason: FailedReason;
  photoUrl?: string | null;
  notes?: string | null;
  driverLat?: number | null;
  driverLng?: number | null;
}

export interface FailedAttemptStats {
  total: number;
  pending: number;
  resolved: number;
  resolutionRate: number;
  byReason: Record<FailedReason, number>;
  byResolution: Partial<Record<FailedResolution, number>>;
  avgResolutionHours: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Proof of Delivery
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Liefernachweis für einen erfolgreich abgeschlossenen Stop eintragen.
 * Fire-and-forget kompatibel.
 */
export async function recordDeliveryProof(
  locationId: string,
  input: ProofInput,
): Promise<DeliveryProof | null> {
  const sb = createServiceClient();

  try {
    const { data, error } = await sb
      .from('delivery_proofs')
      .insert({
        tour_stop_id: input.tourStopId,
        order_id:     input.orderId,
        batch_id:     input.batchId,
        location_id:  locationId,
        proof_type:   input.proofType,
        photo_url:    input.photoUrl ?? null,
        notes:        input.notes ?? null,
        driver_lat:   input.driverLat ?? null,
        driver_lng:   input.driverLng ?? null,
      })
      .select('*')
      .single();

    if (error) {
      // Graceful: Migration noch nicht eingespielt
      if (error.code === '42P01') return null;
      throw error;
    }

    return mapProofRow(data);
  } catch {
    return null;
  }
}

/**
 * Liefernachweis für eine Bestellung abrufen (Admin / Tracking).
 */
export async function getOrderProof(orderId: string): Promise<DeliveryProof | null> {
  const sb = createServiceClient();

  try {
    const { data, error } = await sb
      .from('delivery_proofs')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error?.code === '42P01') return null;
    if (error || !data) return null;
    return mapProofRow(data);
  } catch {
    return null;
  }
}

/**
 * Alle Liefernachweise für eine Location abrufen (Admin-Dashboard).
 */
export async function listProofs(
  locationId: string,
  limitDays = 7,
): Promise<DeliveryProof[]> {
  const sb = createServiceClient();
  const since = new Date(Date.now() - limitDays * 86_400_000).toISOString();

  try {
    const { data, error } = await sb
      .from('delivery_proofs')
      .select('*')
      .eq('location_id', locationId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error?.code === '42P01') return [];
    if (error) throw error;
    return (data ?? []).map(mapProofRow);
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Failed Attempt Tracking
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fehlgeschlagenen Zustellversuch erfassen.
 * Erhöht attempt_number automatisch (zählt vorherige Versuche für dieselbe Order).
 * Setzt customer_orders.status auf 'nicht_zugestellt' (fire-and-forget).
 */
export async function recordFailedAttempt(
  locationId: string,
  input: FailedAttemptInput,
): Promise<FailedAttempt | null> {
  const sb = createServiceClient();

  try {
    // Bisherige Versuche für diese Bestellung zählen
    const { count } = await sb
      .from('delivery_failed_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', input.orderId)
      .eq('location_id', locationId);

    const attemptNumber = (count ?? 0) + 1;

    const { data, error } = await sb
      .from('delivery_failed_attempts')
      .insert({
        tour_stop_id:   input.tourStopId,
        order_id:       input.orderId,
        batch_id:       input.batchId,
        location_id:    locationId,
        driver_id:      input.driverId,
        reason:         input.reason,
        attempt_number: attemptNumber,
        photo_url:      input.photoUrl ?? null,
        notes:          input.notes ?? null,
        driver_lat:     input.driverLat ?? null,
        driver_lng:     input.driverLng ?? null,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '42P01') return null;
      throw error;
    }

    // Bestellstatus auf 'nicht_zugestellt' setzen (fire-and-forget)
    sb.from('customer_orders')
      .update({ status: 'nicht_zugestellt' })
      .eq('id', input.orderId)
      .catch(() => {});

    return mapAttemptRow(data);
  } catch {
    return null;
  }
}

/**
 * Alle offenen fehlgeschlagenen Versuche einer Location (via View).
 */
export async function getPendingFailedAttempts(
  locationId: string,
): Promise<PendingFailedAttempt[]> {
  const sb = createServiceClient();

  try {
    const { data, error } = await sb
      .from('v_pending_failed_attempts')
      .select('*')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false });

    if (error?.code === '42P01' || error?.code === '42501') return [];
    if (error) throw error;

    return (data ?? []).map(mapPendingRow);
  } catch {
    return [];
  }
}

/**
 * Retry einplanen: Nächsten Zustellversuch terminieren.
 */
export async function scheduleRetry(
  attemptId: string,
  locationId: string,
  nextAttemptAt: Date,
): Promise<boolean> {
  const sb = createServiceClient();

  try {
    const { error } = await sb
      .from('delivery_failed_attempts')
      .update({ next_attempt_at: nextAttemptAt.toISOString() })
      .eq('id', attemptId)
      .eq('location_id', locationId)
      .is('resolved_at', null);

    if (error) throw error;

    // Bestellstatus auf 'scheduled' für Retry setzen
    const { data: attempt } = await sb
      .from('delivery_failed_attempts')
      .select('order_id')
      .eq('id', attemptId)
      .maybeSingle();

    if (attempt?.order_id) {
      sb.from('customer_orders')
        .update({ status: 'retry_scheduled', scheduled_at: nextAttemptAt.toISOString() })
        .eq('id', attempt.order_id as string)
        .catch(() => {});
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Fehlgeschlagenen Versuch abschliessen (delivered / returned / cancelled).
 */
export async function resolveFailedAttempt(
  attemptId: string,
  locationId: string,
  resolution: FailedResolution,
): Promise<boolean> {
  const sb = createServiceClient();

  try {
    const { error } = await sb
      .from('delivery_failed_attempts')
      .update({
        resolution,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', attemptId)
      .eq('location_id', locationId);

    if (error) throw error;
    return true;
  } catch {
    return false;
  }
}

/**
 * Statistiken zu fehlgeschlagenen Versuchen (Admin-Dashboard).
 */
export async function getFailedAttemptStats(
  locationId: string,
  limitDays = 30,
): Promise<FailedAttemptStats> {
  const sb = createServiceClient();
  const since = new Date(Date.now() - limitDays * 86_400_000).toISOString();

  const empty: FailedAttemptStats = {
    total: 0,
    pending: 0,
    resolved: 0,
    resolutionRate: 0,
    byReason: {
      no_answer: 0, wrong_address: 0, refused: 0,
      access_denied: 0, not_home: 0, other: 0,
    },
    byResolution: {},
    avgResolutionHours: null,
  };

  try {
    const { data, error } = await sb
      .from('delivery_failed_attempts')
      .select('reason, resolution, resolved_at, created_at')
      .eq('location_id', locationId)
      .gte('created_at', since);

    if (error?.code === '42P01') return { ...empty, _fallback: true } as FailedAttemptStats & { _fallback?: boolean };
    if (error) throw error;

    const rows = data ?? [];
    const total    = rows.length;
    const resolved = rows.filter((r) => r.resolved_at != null).length;
    const pending  = total - resolved;

    const byReason = { ...empty.byReason };
    for (const r of rows) {
      const key = r.reason as FailedReason;
      if (key in byReason) byReason[key]++;
    }

    const byResolution: Partial<Record<FailedResolution, number>> = {};
    for (const r of rows.filter((r) => r.resolution != null)) {
      const key = r.resolution as FailedResolution;
      byResolution[key] = (byResolution[key] ?? 0) + 1;
    }

    const resolutionTimes = rows
      .filter((r) => r.resolved_at != null && r.created_at != null)
      .map((r) => (new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime()) / 3_600_000);

    const avgResolutionHours =
      resolutionTimes.length > 0
        ? resolutionTimes.reduce((s, v) => s + v, 0) / resolutionTimes.length
        : null;

    return {
      total,
      pending,
      resolved,
      resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
      byReason,
      byResolution,
      avgResolutionHours: avgResolutionHours != null ? Math.round(avgResolutionHours * 10) / 10 : null,
    };
  } catch {
    return empty;
  }
}

/**
 * Alle fälligen Retry-Attempts freigeben (Cron-Tick).
 * Setzt schedule_status='released' für Bestellungen deren Retry-Zeit abgelaufen ist.
 */
export async function releaseRetryAttempts(): Promise<{ released: number }> {
  const sb = createServiceClient();

  try {
    const { data, error } = await sb
      .from('delivery_failed_attempts')
      .select('id, order_id')
      .is('resolved_at', null)
      .not('next_attempt_at', 'is', null)
      .lte('next_attempt_at', new Date().toISOString());

    if (error?.code === '42P01') return { released: 0 };
    if (error || !data?.length) return { released: 0 };

    let released = 0;
    for (const attempt of data) {
      if (!attempt.order_id) continue;

      // Bestellung wieder in die Dispatch-Queue (released)
      const { error: upErr } = await sb
        .from('customer_orders')
        .update({ status: 'pending', schedule_status: 'released' })
        .eq('id', attempt.order_id as string)
        .eq('status', 'retry_scheduled');

      if (!upErr) {
        // Attempt als 'rescheduled' markieren (wurde bearbeitet)
        await sb
          .from('delivery_failed_attempts')
          .update({ resolution: 'rescheduled', resolved_at: new Date().toISOString() })
          .eq('id', attempt.id as string);
        released++;
      }
    }

    return { released };
  } catch {
    return { released: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Row Mapper
// ─────────────────────────────────────────────────────────────────────────────

function mapProofRow(row: Record<string, unknown>): DeliveryProof {
  return {
    id:           row.id as string,
    tourStopId:   row.tour_stop_id as string,
    orderId:      (row.order_id as string | null) ?? null,
    batchId:      (row.batch_id as string | null) ?? null,
    locationId:   row.location_id as string,
    proofType:    row.proof_type as ProofType,
    photoUrl:     (row.photo_url as string | null) ?? null,
    notes:        (row.notes as string | null) ?? null,
    driverLat:    (row.driver_lat as number | null) ?? null,
    driverLng:    (row.driver_lng as number | null) ?? null,
    createdAt:    row.created_at as string,
  };
}

function mapAttemptRow(row: Record<string, unknown>): FailedAttempt {
  return {
    id:             row.id as string,
    tourStopId:     (row.tour_stop_id as string | null) ?? null,
    orderId:        row.order_id as string,
    batchId:        (row.batch_id as string | null) ?? null,
    locationId:     row.location_id as string,
    driverId:       (row.driver_id as string | null) ?? null,
    reason:         row.reason as FailedReason,
    attemptNumber:  row.attempt_number as number,
    photoUrl:       (row.photo_url as string | null) ?? null,
    notes:          (row.notes as string | null) ?? null,
    driverLat:      (row.driver_lat as number | null) ?? null,
    driverLng:      (row.driver_lng as number | null) ?? null,
    nextAttemptAt:  (row.next_attempt_at as string | null) ?? null,
    resolvedAt:     (row.resolved_at as string | null) ?? null,
    resolution:     (row.resolution as FailedResolution | null) ?? null,
    createdAt:      row.created_at as string,
  };
}

function mapPendingRow(row: Record<string, unknown>): PendingFailedAttempt {
  return {
    ...mapAttemptRow(row),
    bestellnummer: (row.bestellnummer as string | null) ?? null,
    kundeName:     (row.kunde_name as string | null) ?? null,
    kundeAdresse:  (row.kunde_adresse as string | null) ?? null,
    kundePlz:      (row.kunde_plz as string | null) ?? null,
    kundeStadt:    (row.kunde_stadt as string | null) ?? null,
    kundeTelefon:  (row.kunde_telefon as string | null) ?? null,
    gesamtbetrag:  (row.gesamtbetrag as number | null) ?? null,
    orderStatus:   (row.order_status as string | null) ?? null,
    driverName:    (row.driver_name as string | null) ?? null,
    driverVehicle: (row.driver_vehicle as string | null) ?? null,
  };
}
