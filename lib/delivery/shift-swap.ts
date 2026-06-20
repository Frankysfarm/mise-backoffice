/**
 * lib/delivery/shift-swap.ts — Phase 324
 *
 * Smart Shift-Swap Engine
 *
 * Fahrer können Schichten untereinander tauschen (peer-to-peer).
 * Ablauf:
 *   1. Fahrer A stellt Tausch-Anfrage für seine Schicht
 *      (gezielt an Fahrer B oder offen für alle)
 *   2. Fahrer B akzeptiert (optional: mit eigener Schicht)
 *   3. Admin genehmigt (wenn config.require_admin_approval = true)
 *   4. Schichten werden in driver_shifts getauscht
 *
 * Cron: autoExpireAllLocations() — ablaufende Anfragen schließen
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SwapStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'cancelled'
  | 'completed'
  | 'expired';

export interface SwapConfig {
  locationId: string;
  enabled: boolean;
  requireAdminApproval: boolean;
  maxSwapsPerDriverMonth: number;
  minNoticeHours: number;
  allowOpenRequests: boolean;
}

export interface SwapRequest {
  id: string;
  locationId: string;
  requesterDriverId: string;
  requesterShiftId: string;
  targetDriverId: string | null;
  acceptedByDriverId: string | null;
  acceptedShiftId: string | null;
  status: SwapStatus;
  adminApprovalRequired: boolean;
  adminApprovedAt: string | null;
  adminApprovedBy: string | null;
  adminRejectionReason: string | null;
  notes: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface SwapRequestWithDetails extends SwapRequest {
  requesterName: string | null;
  requesterVehicle: string | null;
  shiftStart: string;
  shiftEnd: string;
  targetName: string | null;
}

export interface SwapStats {
  locationId: string;
  pendingCount: number;
  completed30d: number;
  declined30d: number;
  expiredTotal: number;
  avgCompletionHours: number | null;
}

export interface SwapDashboard {
  stats: SwapStats;
  openRequests: SwapRequestWithDetails[];
  recentCompleted: SwapRequest[];
  config: SwapConfig;
}

export interface CreateSwapInput {
  locationId: string;
  requesterDriverId: string;
  requesterShiftId: string;
  targetDriverId?: string;
  notes?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseConfig(row: Record<string, unknown>): SwapConfig {
  return {
    locationId:             row.location_id as string,
    enabled:                Boolean(row.enabled),
    requireAdminApproval:   Boolean(row.require_admin_approval),
    maxSwapsPerDriverMonth: Number(row.max_swaps_per_driver_month),
    minNoticeHours:         Number(row.min_notice_hours),
    allowOpenRequests:      Boolean(row.allow_open_requests),
  };
}

function parseRequest(row: Record<string, unknown>): SwapRequest {
  return {
    id:                     row.id as string,
    locationId:             row.location_id as string,
    requesterDriverId:      row.requester_driver_id as string,
    requesterShiftId:       row.requester_shift_id as string,
    targetDriverId:         (row.target_driver_id as string) ?? null,
    acceptedByDriverId:     (row.accepted_by_driver_id as string) ?? null,
    acceptedShiftId:        (row.accepted_shift_id as string) ?? null,
    status:                 row.status as SwapStatus,
    adminApprovalRequired:  Boolean(row.admin_approval_required),
    adminApprovedAt:        (row.admin_approved_at as string) ?? null,
    adminApprovedBy:        (row.admin_approved_by as string) ?? null,
    adminRejectionReason:   (row.admin_rejection_reason as string) ?? null,
    notes:                  (row.notes as string) ?? null,
    expiresAt:              row.expires_at as string,
    acceptedAt:             (row.accepted_at as string) ?? null,
    completedAt:            (row.completed_at as string) ?? null,
    createdAt:              row.created_at as string,
  };
}

function parseWithDetails(row: Record<string, unknown>): SwapRequestWithDetails {
  return {
    ...parseRequest(row),
    requesterName:    (row.requester_name as string) ?? null,
    requesterVehicle: (row.requester_vehicle as string) ?? null,
    shiftStart:       row.shift_start as string,
    shiftEnd:         row.shift_end as string,
    targetName:       (row.target_name as string) ?? null,
  };
}

// ── Config ────────────────────────────────────────────────────────────────────

const CONFIG_DEFAULTS: Omit<SwapConfig, 'locationId'> = {
  enabled:                true,
  requireAdminApproval:   true,
  maxSwapsPerDriverMonth: 4,
  minNoticeHours:         24,
  allowOpenRequests:      true,
};

export async function getConfig(locationId: string): Promise<SwapConfig> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('shift_swap_config')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();

  if (!data) return { locationId, ...CONFIG_DEFAULTS };
  return parseConfig(data as Record<string, unknown>);
}

export async function upsertConfig(
  locationId: string,
  input: Partial<Omit<SwapConfig, 'locationId'>>,
): Promise<SwapConfig> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('shift_swap_config')
    .upsert({
      location_id:               locationId,
      enabled:                   input.enabled                   ?? CONFIG_DEFAULTS.enabled,
      require_admin_approval:    input.requireAdminApproval      ?? CONFIG_DEFAULTS.requireAdminApproval,
      max_swaps_per_driver_month: input.maxSwapsPerDriverMonth   ?? CONFIG_DEFAULTS.maxSwapsPerDriverMonth,
      min_notice_hours:          input.minNoticeHours            ?? CONFIG_DEFAULTS.minNoticeHours,
      allow_open_requests:       input.allowOpenRequests         ?? CONFIG_DEFAULTS.allowOpenRequests,
      updated_at:                new Date().toISOString(),
    }, { onConflict: 'location_id' })
    .select()
    .single();

  if (error) throw new Error(`shift_swap_config upsert: ${error.message}`);
  return parseConfig(data as Record<string, unknown>);
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createSwapRequest(input: CreateSwapInput): Promise<SwapRequest> {
  const sb = createServiceClient();
  const cfg = await getConfig(input.locationId);

  if (!cfg.enabled) throw new Error('Schicht-Tausch ist für diese Location deaktiviert');

  // Schicht prüfen — existiert sie und gehört sie dem Fahrer?
  const { data: shift } = await sb
    .from('driver_shifts')
    .select('id, planned_start, driver_id, location_id, status')
    .eq('id', input.requesterShiftId)
    .eq('driver_id', input.requesterDriverId)
    .eq('location_id', input.locationId)
    .maybeSingle();

  if (!shift) throw new Error('Schicht nicht gefunden oder gehört nicht diesem Fahrer');
  if (!['scheduled'].includes(shift.status as string)) {
    throw new Error('Nur zukünftige (scheduled) Schichten können getauscht werden');
  }

  // Mindest-Vorlaufzeit prüfen
  const hoursUntilShift =
    (new Date(shift.planned_start as string).getTime() - Date.now()) / 3_600_000;
  if (hoursUntilShift < cfg.minNoticeHours) {
    throw new Error(
      `Tausch-Anfragen müssen mindestens ${cfg.minNoticeHours} Stunden vor Schichtbeginn gestellt werden`,
    );
  }

  // Monatliches Limit prüfen
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const { count } = await sb
    .from('shift_swap_requests')
    .select('*', { count: 'exact', head: true })
    .eq('requester_driver_id', input.requesterDriverId)
    .eq('location_id', input.locationId)
    .in('status', ['pending', 'accepted', 'completed'])
    .gte('created_at', monthStart.toISOString());

  if ((count ?? 0) >= cfg.maxSwapsPerDriverMonth) {
    throw new Error(
      `Monatliches Tausch-Limit von ${cfg.maxSwapsPerDriverMonth} Anfragen erreicht`,
    );
  }

  const expiresAt = new Date(Date.now() + 48 * 3_600_000).toISOString();

  const { data, error } = await sb
    .from('shift_swap_requests')
    .insert({
      location_id:             input.locationId,
      requester_driver_id:     input.requesterDriverId,
      requester_shift_id:      input.requesterShiftId,
      target_driver_id:        input.targetDriverId ?? null,
      admin_approval_required: cfg.requireAdminApproval,
      notes:                   input.notes ?? null,
      expires_at:              expiresAt,
    })
    .select()
    .single();

  if (error) throw new Error(`shift_swap_requests insert: ${error.message}`);
  return parseRequest(data as Record<string, unknown>);
}

// ── Accept ────────────────────────────────────────────────────────────────────

export async function acceptSwapRequest(
  swapId: string,
  acceptingDriverId: string,
  acceptingShiftId?: string,
): Promise<SwapRequest> {
  const sb = createServiceClient();

  // Anfrage laden + validieren
  const { data: swap } = await sb
    .from('shift_swap_requests')
    .select('*')
    .eq('id', swapId)
    .eq('status', 'pending')
    .maybeSingle();

  if (!swap) throw new Error('Tausch-Anfrage nicht gefunden oder nicht mehr offen');

  const s = swap as Record<string, unknown>;

  // Ziel-Fahrer-Check: wenn spezifisch angegeben, muss es dieser Fahrer sein
  if (s.target_driver_id && s.target_driver_id !== acceptingDriverId) {
    throw new Error('Diese Anfrage ist an einen anderen Fahrer gerichtet');
  }

  // Kein Selbst-Tausch
  if (s.requester_driver_id === acceptingDriverId) {
    throw new Error('Eigene Anfragen können nicht akzeptiert werden');
  }

  // Wenn keine Admin-Genehmigung nötig → direkt abschließen
  const requiresAdmin = Boolean(s.admin_approval_required);
  const newStatus: SwapStatus = requiresAdmin ? 'accepted' : 'completed';

  const { data, error } = await sb
    .from('shift_swap_requests')
    .update({
      status:                newStatus,
      accepted_by_driver_id: acceptingDriverId,
      accepted_shift_id:     acceptingShiftId ?? null,
      accepted_at:           new Date().toISOString(),
      completed_at:          requiresAdmin ? null : new Date().toISOString(),
    })
    .eq('id', swapId)
    .select()
    .single();

  if (error) throw new Error(`swap accept: ${error.message}`);

  // Wenn keine Genehmigung nötig → Schichten sofort tauschen
  if (!requiresAdmin) {
    await executeShiftSwap(
      s.requester_shift_id as string,
      s.requester_driver_id as string,
      acceptingShiftId ?? null,
      acceptingDriverId,
    );
  }

  return parseRequest(data as Record<string, unknown>);
}

// ── Reject / Cancel ───────────────────────────────────────────────────────────

export async function rejectSwapRequest(
  swapId: string,
  driverId: string,
): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb
    .from('shift_swap_requests')
    .update({ status: 'rejected' })
    .eq('id', swapId)
    .eq('target_driver_id', driverId)
    .eq('status', 'pending');

  if (error) throw new Error(`swap reject: ${error.message}`);
}

export async function cancelSwapRequest(
  swapId: string,
  requesterDriverId: string,
): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb
    .from('shift_swap_requests')
    .update({ status: 'cancelled' })
    .eq('id', swapId)
    .eq('requester_driver_id', requesterDriverId)
    .eq('status', 'pending');

  if (error) throw new Error(`swap cancel: ${error.message}`);
}

// ── Admin Approval ────────────────────────────────────────────────────────────

export async function adminApproveSwap(swapId: string, adminId: string): Promise<void> {
  const sb = createServiceClient();

  const { data: swap } = await sb
    .from('shift_swap_requests')
    .select('*')
    .eq('id', swapId)
    .eq('status', 'accepted')
    .maybeSingle();

  if (!swap) throw new Error('Anfrage nicht gefunden oder nicht im Status "accepted"');
  const s = swap as Record<string, unknown>;

  // Schichten tauschen
  await executeShiftSwap(
    s.requester_shift_id as string,
    s.requester_driver_id as string,
    (s.accepted_shift_id as string) ?? null,
    s.accepted_by_driver_id as string,
  );

  await sb
    .from('shift_swap_requests')
    .update({
      status:           'completed',
      admin_approved_at: new Date().toISOString(),
      admin_approved_by: adminId,
      completed_at:     new Date().toISOString(),
    })
    .eq('id', swapId);
}

export async function adminRejectSwap(
  swapId: string,
  adminId: string,
  reason: string,
): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb
    .from('shift_swap_requests')
    .update({
      status:                  'rejected',
      admin_approved_by:       adminId,
      admin_rejection_reason:  reason,
    })
    .eq('id', swapId)
    .in('status', ['pending', 'accepted']);

  if (error) throw new Error(`admin reject: ${error.message}`);
}

// ── Core Swap Logic ───────────────────────────────────────────────────────────

async function executeShiftSwap(
  shiftAId: string,
  driverAId: string,
  shiftBId: string | null,
  driverBId: string,
): Promise<void> {
  const sb = createServiceClient();

  // Schicht A → Fahrer B zuweisen
  await sb.from('driver_shifts').update({ driver_id: driverBId }).eq('id', shiftAId);

  // Wenn Schicht B vorhanden → Fahrer A zuweisen
  if (shiftBId) {
    await sb.from('driver_shifts').update({ driver_id: driverAId }).eq('id', shiftBId);
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getOpenRequests(locationId: string): Promise<SwapRequestWithDetails[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('v_open_swap_requests')
    .select('*')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false });

  return (data ?? []).map(r => parseWithDetails(r as Record<string, unknown>));
}

export async function getDriverRequests(
  driverId: string,
  locationId: string,
): Promise<SwapRequest[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('shift_swap_requests')
    .select('*')
    .eq('location_id', locationId)
    .or(`requester_driver_id.eq.${driverId},target_driver_id.eq.${driverId},accepted_by_driver_id.eq.${driverId}`)
    .order('created_at', { ascending: false })
    .limit(30);

  return (data ?? []).map(r => parseRequest(r as Record<string, unknown>));
}

export async function getSwapHistory(
  locationId: string,
  limit = 50,
): Promise<SwapRequest[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('shift_swap_requests')
    .select('*')
    .eq('location_id', locationId)
    .not('status', 'eq', 'pending')
    .order('updated_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map(r => parseRequest(r as Record<string, unknown>));
}

export async function getAvailableSwapPartners(
  shiftId: string,
  locationId: string,
): Promise<Array<{ driverId: string; driverName: string; vehicle: string; upcomingShifts: number }>> {
  const sb = createServiceClient();

  // Shift-Zeitraum laden
  const { data: shift } = await sb
    .from('driver_shifts')
    .select('planned_start, planned_end, driver_id')
    .eq('id', shiftId)
    .maybeSingle();

  if (!shift) return [];

  // Alle aktiven Fahrer dieser Location
  const { data: drivers } = await sb
    .from('mise_drivers')
    .select('id, name, vehicle')
    .eq('location_id', locationId)
    .eq('is_active', true)
    .neq('id', shift.driver_id as string);

  if (!drivers || drivers.length === 0) return [];

  // Upcoming shifts for each driver
  const result = await Promise.all(
    (drivers as Array<{ id: string; name: string; vehicle: string }>).map(async d => {
      const { count } = await sb
        .from('driver_shifts')
        .select('*', { count: 'exact', head: true })
        .eq('driver_id', d.id)
        .eq('status', 'scheduled')
        .gte('planned_start', new Date().toISOString())
        .limit(1);

      return {
        driverId:      d.id,
        driverName:    d.name,
        vehicle:       d.vehicle,
        upcomingShifts: count ?? 0,
      };
    }),
  );

  return result.filter(d => d.upcomingShifts > 0);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

async function getStats(locationId: string): Promise<SwapStats> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('v_shift_swap_stats')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();

  if (!data) {
    return {
      locationId,
      pendingCount:      0,
      completed30d:      0,
      declined30d:       0,
      expiredTotal:      0,
      avgCompletionHours: null,
    };
  }
  const d = data as Record<string, unknown>;
  return {
    locationId,
    pendingCount:       Number(d.pending_count ?? 0),
    completed30d:       Number(d.completed_30d ?? 0),
    declined30d:        Number(d.declined_30d ?? 0),
    expiredTotal:       Number(d.expired_total ?? 0),
    avgCompletionHours: d.avg_completion_hours != null ? Number(d.avg_completion_hours) : null,
  };
}

export async function getSwapDashboard(locationId: string): Promise<SwapDashboard> {
  const [stats, openRequests, recentCompleted, config] = await Promise.all([
    getStats(locationId),
    getOpenRequests(locationId),
    getSwapHistory(locationId, 10),
    getConfig(locationId),
  ]);

  return { stats, openRequests, recentCompleted, config };
}

// ── Cron ──────────────────────────────────────────────────────────────────────

export async function autoExpireStaleSwaps(locationId: string): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('shift_swap_requests')
    .update({ status: 'expired' })
    .eq('location_id', locationId)
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())
    .select('id');

  return data?.length ?? 0;
}

export async function autoExpireAllLocations(): Promise<{ locations: number; expired: number }> {
  const sb = createServiceClient();
  const { data: locations } = await sb
    .from('mise_locations')
    .select('id')
    .eq('is_active', true);

  if (!locations) return { locations: 0, expired: 0 };

  let expired = 0;
  for (const loc of locations) {
    expired += await autoExpireStaleSwaps(loc.id as string);
  }
  return { locations: locations.length, expired };
}
