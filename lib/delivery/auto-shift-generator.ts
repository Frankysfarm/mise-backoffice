/**
 * lib/delivery/auto-shift-generator.ts
 *
 * Phase 209 — Auto-Shift-Generator
 *
 * Converts capacity_plan_slots gaps into concrete driver shift drafts.
 * Managers review the draft, then apply (creates driver_shifts) or discard.
 *
 * Algorithm:
 *  1. Load capacity_plan_slots with coverage_gap > 0 for next 7 days
 *  2. Group consecutive hours per day into shift blocks (max 8h)
 *  3. For each block needing N additional drivers:
 *     - Find mise_drivers for this location not already scheduled in that window
 *     - Rank candidates by reliability score (driver_reliability_scores)
 *     - Pick top-N candidates
 *  4. Save all proposals as auto_shift_draft_items within a new auto_shift_drafts row
 *
 * Exports:
 *  createShiftDraft()         — generates and saves a draft
 *  applyShiftDraft()          — applies pending items → inserts driver_shifts
 *  discardShiftDraft()        — marks draft discarded
 *  skipDraftItem()            — skip a single proposed shift
 *  getPendingDraft()          — latest pending draft for a location
 *  getDraftDetails()          — full draft with all items + driver names
 *  getGeneratorDashboard()    — KPIs + recent draft history
 *  pruneOldDrafts()           — cleanup via SQL function
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_SHIFT_BLOCK_HOURS = 8;
const MIN_ORDERS_FOR_SLOT   = 1; // skip hours with < 1 expected order

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ShiftBlock {
  date: string;
  startHour: number;
  endHour: number;
  driversNeeded: number;
  coverageGap: number;
  expectedOrders: number;
  isPeak: boolean;
}

export interface DraftItem {
  id: string;
  draftId: string;
  locationId: string;
  driverId: string;
  driverName: string;
  driverVehicle: string;
  reliabilityScore: number;
  driverRank: number;
  shiftDate: string;
  startHour: number;
  endHour: number;
  driversNeeded: number;
  coverageGap: number;
  expectedOrders: number;
  isPeak: boolean;
  status: 'pending' | 'applied' | 'skipped';
  appliedShiftId: string | null;
  createdAt: string;
}

export interface ShiftDraft {
  id: string;
  locationId: string;
  status: 'pending' | 'applied' | 'discarded';
  gapsFound: number;
  shiftsProposed: number;
  coverageBefore: number;
  coverageAfter: number;
  appliedAt: string | null;
  notes: string | null;
  createdAt: string;
  items: DraftItem[];
  itemsPending: number;
  itemsApplied: number;
  itemsSkipped: number;
  earliestDate: string | null;
  latestDate: string | null;
}

export interface GeneratorDashboard {
  pendingDraftId: string | null;
  totalDrafts: number;
  appliedDrafts: number;
  shiftsCreated: number;
  coverageGapsCurrent: number;
  recentDrafts: Array<{
    id: string;
    status: string;
    shiftsProposed: number;
    coverageBefore: number;
    coverageAfter: number;
    createdAt: string;
    appliedAt: string | null;
  }>;
}

export interface CreateDraftResult {
  draftId: string;
  blocksAnalyzed: number;
  shiftsProposed: number;
  coverageBefore: number;
  coverageAfter: number;
  errors: number;
}

// ── Row mappers ───────────────────────────────────────────────────────────────

function mapItem(
  row: Record<string, unknown>,
  driverMeta: Map<string, { name: string; vehicle: string }>,
): DraftItem {
  const meta = driverMeta.get(String(row.driver_id)) ?? { name: 'Unbekannt', vehicle: 'auto' };
  return {
    id: String(row.id),
    draftId: String(row.draft_id),
    locationId: String(row.location_id),
    driverId: String(row.driver_id),
    driverName: meta.name,
    driverVehicle: meta.vehicle,
    reliabilityScore: Number(row.reliability_score ?? 50),
    driverRank: Number(row.driver_rank ?? 1),
    shiftDate: String(row.shift_date),
    startHour: Number(row.start_hour),
    endHour: Number(row.end_hour),
    driversNeeded: Number(row.drivers_needed),
    coverageGap: Number(row.coverage_gap),
    expectedOrders: Number(row.expected_orders),
    isPeak: Boolean(row.is_peak),
    status: (row.status as DraftItem['status']) ?? 'pending',
    appliedShiftId: (row.applied_shift_id as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

// ── createShiftDraft ──────────────────────────────────────────────────────────

export async function createShiftDraft(locationId: string): Promise<CreateDraftResult> {
  const sb = createServiceClient();
  let errors = 0;

  // 1. Discard any existing pending draft for this location
  await sb
    .from('auto_shift_drafts')
    .update({ status: 'discarded', discarded_at: new Date().toISOString() })
    .eq('location_id', locationId)
    .eq('status', 'pending');

  // 2. Load capacity gaps for next 7 days (only slots with gap AND orders)
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const end7 = new Date(today);
  end7.setDate(today.getDate() + 7);

  const { data: slots } = await sb
    .from('capacity_plan_slots')
    .select('slot_date, hour_of_day, coverage_gap, recommended_drivers, scheduled_drivers, expected_orders, is_peak')
    .eq('location_id', locationId)
    .gt('coverage_gap', 0)
    .gte('expected_orders', MIN_ORDERS_FOR_SLOT)
    .gte('slot_date', today.toISOString().slice(0, 10))
    .lt('slot_date', end7.toISOString().slice(0, 10))
    .order('slot_date', { ascending: true })
    .order('hour_of_day', { ascending: true });

  if (!slots || slots.length === 0) {
    // No gaps — create empty applied draft
    const { data: draft } = await sb
      .from('auto_shift_drafts')
      .insert({
        location_id: locationId,
        status: 'applied',
        gaps_found: 0,
        shifts_proposed: 0,
        coverage_before: 100,
        coverage_after: 100,
        applied_at: new Date().toISOString(),
        notes: 'Keine Kapazitätslücken gefunden.',
      })
      .select('id')
      .single();

    return {
      draftId: draft?.id ?? '',
      blocksAnalyzed: 0,
      shiftsProposed: 0,
      coverageBefore: 100,
      coverageAfter: 100,
      errors: 0,
    };
  }

  // 3. Compute coverage_before (% of slots with no gap)
  const { data: allSlots } = await sb
    .from('capacity_plan_slots')
    .select('coverage_gap, recommended_drivers')
    .eq('location_id', locationId)
    .gte('slot_date', today.toISOString().slice(0, 10))
    .lt('slot_date', end7.toISOString().slice(0, 10))
    .gt('recommended_drivers', 0);

  const totalActiveSlots = allSlots?.length ?? 1;
  const gapSlotsBefore = allSlots?.filter((s) => Number(s.coverage_gap) > 0).length ?? 0;
  const coverageBefore = Math.round(((totalActiveSlots - gapSlotsBefore) / totalActiveSlots) * 100);

  // 4. Group consecutive hours per day into shift blocks
  const blocks: ShiftBlock[] = [];

  const byDate = new Map<string, typeof slots>();
  for (const s of slots) {
    const key = String(s.slot_date);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(s);
  }

  for (const [date, daySlots] of byDate) {
    let blockStart: number | null = null;
    let blockEnd = 0;
    let blockGap = 0;
    let blockOrders = 0;
    let blockNeeded = 0;
    let blockPeak = false;
    let blockHours = 0;

    const flush = () => {
      if (blockStart !== null && blockGap > 0) {
        blocks.push({
          date,
          startHour: blockStart,
          endHour: blockEnd,
          driversNeeded: blockNeeded,
          coverageGap: blockGap,
          expectedOrders: blockOrders,
          isPeak: blockPeak,
        });
      }
    };

    for (const slot of daySlots) {
      const h = Number(slot.hour_of_day);
      const gap = Number(slot.coverage_gap);
      const orders = Number(slot.expected_orders);
      const needed = Number(slot.recommended_drivers);

      if (blockStart === null) {
        blockStart  = h;
        blockEnd    = h + 1;
        blockGap    = gap;
        blockOrders = orders;
        blockNeeded = needed;
        blockPeak   = Boolean(slot.is_peak);
        blockHours  = 1;
      } else if (h === blockEnd && blockHours < MAX_SHIFT_BLOCK_HOURS) {
        // Extend block
        blockEnd    = h + 1;
        blockGap    = Math.max(blockGap, gap);
        blockOrders += orders;
        blockNeeded  = Math.max(blockNeeded, needed);
        blockPeak    = blockPeak || Boolean(slot.is_peak);
        blockHours++;
      } else {
        // Gap between hours or max block size reached — flush and start new
        flush();
        blockStart  = h;
        blockEnd    = h + 1;
        blockGap    = gap;
        blockOrders = orders;
        blockNeeded = needed;
        blockPeak   = Boolean(slot.is_peak);
        blockHours  = 1;
      }
    }
    flush();
  }

  if (blocks.length === 0) {
    const { data: draft } = await sb
      .from('auto_shift_drafts')
      .insert({
        location_id: locationId,
        status: 'pending',
        gaps_found: slots.length,
        shifts_proposed: 0,
        coverage_before: coverageBefore,
        coverage_after: coverageBefore,
      })
      .select('id')
      .single();

    return {
      draftId: draft?.id ?? '',
      blocksAnalyzed: 0,
      shiftsProposed: 0,
      coverageBefore,
      coverageAfter: coverageBefore,
      errors,
    };
  }

  // 5. Load all drivers for this location
  const { data: allDrivers } = await sb
    .from('mise_drivers')
    .select('id, name, vehicle, active, location_id')
    .eq('active', true);

  // Filter by location: drivers whose location matches
  // mise_drivers has no location_id directly — use driver_shifts or employees
  const { data: locationDriverLinks } = await sb
    .from('driver_shifts')
    .select('driver_id')
    .eq('location_id', locationId)
    .limit(500);

  const locationDriverIds = new Set(
    (locationDriverLinks ?? []).map((r) => String(r.driver_id)),
  );

  // If no historical shifts → fallback: all active drivers
  const eligibleDrivers = (allDrivers ?? []).filter(
    (d) => locationDriverIds.size === 0 || locationDriverIds.has(String(d.id)),
  );

  if (eligibleDrivers.length === 0) {
    const { data: draft } = await sb
      .from('auto_shift_drafts')
      .insert({
        location_id: locationId,
        status: 'pending',
        gaps_found: slots.length,
        shifts_proposed: 0,
        coverage_before: coverageBefore,
        coverage_after: coverageBefore,
        notes: 'Keine verfügbaren Fahrer gefunden.',
      })
      .select('id')
      .single();

    return {
      draftId: draft?.id ?? '',
      blocksAnalyzed: blocks.length,
      shiftsProposed: 0,
      coverageBefore,
      coverageAfter: coverageBefore,
      errors,
    };
  }

  // 6. Load reliability scores for ranking
  const driverIds = eligibleDrivers.map((d) => String(d.id));
  const { data: relScores } = await sb
    .from('driver_reliability_scores')
    .select('driver_id, score')
    .in('driver_id', driverIds);

  const reliabilityMap = new Map<string, number>();
  for (const r of relScores ?? []) {
    reliabilityMap.set(String(r.driver_id), Number(r.score ?? 50));
  }

  // Sort drivers by reliability score (desc)
  const rankedDrivers = eligibleDrivers
    .map((d) => ({ ...d, reliabilityScore: reliabilityMap.get(String(d.id)) ?? 50 }))
    .sort((a, b) => b.reliabilityScore - a.reliabilityScore);

  const driverMetaMap = new Map(
    rankedDrivers.map((d) => [String(d.id), { name: String(d.name), vehicle: String(d.vehicle ?? 'auto') }]),
  );

  // 7. Load existing scheduled shifts for next 7 days (to avoid double-booking)
  const { data: existingShifts } = await sb
    .from('driver_shifts')
    .select('driver_id, planned_start, planned_end')
    .eq('location_id', locationId)
    .in('status', ['scheduled', 'active'])
    .gte('planned_start', today.toISOString())
    .lt('planned_start', end7.toISOString());

  // Build busy map: driverId → Set of "YYYY-MM-DD|H" strings
  const busySlots = new Map<string, Set<string>>();
  for (const shift of existingShifts ?? []) {
    const dId = String(shift.driver_id);
    if (!busySlots.has(dId)) busySlots.set(dId, new Set());
    const s = new Date(shift.planned_start as string);
    const e = new Date(shift.planned_end as string);
    const cur = new Date(s);
    cur.setMinutes(0, 0, 0);
    while (cur < e) {
      const key = `${cur.toISOString().slice(0, 10)}|${cur.getUTCHours()}`;
      busySlots.get(dId)!.add(key);
      cur.setUTCHours(cur.getUTCHours() + 1);
    }
  }

  // Track which drivers are already assigned in THIS draft (to avoid double-booking within draft)
  const draftBusy = new Map<string, Set<string>>();

  // 8. Build draft items
  const draftItems: Record<string, unknown>[] = [];

  for (const block of blocks) {
    const gapNeeded = block.coverageGap;

    // Find available drivers for this block
    const availableForBlock: typeof rankedDrivers = [];

    for (const driver of rankedDrivers) {
      const dId = String(driver.id);
      let isFree = true;

      for (let h = block.startHour; h < block.endHour; h++) {
        const key = `${block.date}|${h}`;
        if (busySlots.get(dId)?.has(key) || draftBusy.get(dId)?.has(key)) {
          isFree = false;
          break;
        }
      }

      if (isFree) availableForBlock.push(driver);
      if (availableForBlock.length >= gapNeeded) break;
    }

    // Assign top candidates
    for (let rank = 0; rank < Math.min(gapNeeded, availableForBlock.length); rank++) {
      const driver = availableForBlock[rank];
      const dId = String(driver.id);

      draftItems.push({
        location_id:       locationId,
        driver_id:         dId,
        shift_date:        block.date,
        start_hour:        block.startHour,
        end_hour:          block.endHour,
        drivers_needed:    block.driversNeeded,
        coverage_gap:      block.coverageGap,
        expected_orders:   block.expectedOrders,
        is_peak:           block.isPeak,
        driver_rank:       rank + 1,
        reliability_score: driver.reliabilityScore,
        status:            'pending',
      });

      // Mark these hours busy in draft
      if (!draftBusy.has(dId)) draftBusy.set(dId, new Set());
      for (let h = block.startHour; h < block.endHour; h++) {
        draftBusy.get(dId)!.add(`${block.date}|${h}`);
      }
    }
  }

  // 9. Estimate coverage_after
  const gapSlotsAfter = Math.max(0, gapSlotsBefore - draftItems.length);
  const coverageAfter  = Math.round(((totalActiveSlots - gapSlotsAfter) / totalActiveSlots) * 100);

  // 10. Create draft
  const { data: draft, error: draftErr } = await sb
    .from('auto_shift_drafts')
    .insert({
      location_id:      locationId,
      status:           'pending',
      gaps_found:       slots.length,
      shifts_proposed:  draftItems.length,
      coverage_before:  coverageBefore,
      coverage_after:   Math.min(100, coverageAfter),
    })
    .select('id')
    .single();

  if (draftErr || !draft) {
    return {
      draftId: '',
      blocksAnalyzed: blocks.length,
      shiftsProposed: 0,
      coverageBefore,
      coverageAfter,
      errors: errors + 1,
    };
  }

  const draftId = String(draft.id);

  // 11. Insert items
  if (draftItems.length > 0) {
    const itemsWithDraftId = draftItems.map((item) => ({ ...item, draft_id: draftId }));
    const { error: itemsErr } = await sb
      .from('auto_shift_draft_items')
      .insert(itemsWithDraftId as Parameters<ReturnType<typeof sb.from>['insert']>[0]);

    if (itemsErr) errors++;
  }

  void driverMetaMap; // used in getDraftDetails

  return {
    draftId,
    blocksAnalyzed: blocks.length,
    shiftsProposed: draftItems.length,
    coverageBefore,
    coverageAfter: Math.min(100, coverageAfter),
    errors,
  };
}

// ── applyShiftDraft ───────────────────────────────────────────────────────────

export async function applyShiftDraft(
  draftId: string,
  locationId: string,
  appliedBy: string,
): Promise<{ shiftsCreated: number; errors: number }> {
  const sb = createServiceClient();
  let shiftsCreated = 0;
  let errors = 0;

  // Load pending items
  const { data: items } = await sb
    .from('auto_shift_draft_items')
    .select('*')
    .eq('draft_id', draftId)
    .eq('location_id', locationId)
    .eq('status', 'pending');

  if (!items || items.length === 0) {
    await sb
      .from('auto_shift_drafts')
      .update({ status: 'applied', applied_at: new Date().toISOString(), applied_by: appliedBy })
      .eq('id', draftId)
      .eq('location_id', locationId);
    return { shiftsCreated: 0, errors: 0 };
  }

  for (const item of items) {
    const date      = String(item.shift_date);
    const startH    = Number(item.start_hour);
    const endH      = Number(item.end_hour);
    const plannedStart = new Date(`${date}T${String(startH).padStart(2, '0')}:00:00Z`);
    const plannedEnd   = new Date(`${date}T${String(endH >= 24 ? 23 : endH).padStart(2, '0')}:${endH >= 24 ? '59' : '00'}:00Z`);
    if (endH >= 24) plannedEnd.setUTCMinutes(59);

    const { data: shift, error: shiftErr } = await sb
      .from('driver_shifts')
      .insert({
        driver_id:     String(item.driver_id),
        location_id:   locationId,
        planned_start: plannedStart.toISOString(),
        planned_end:   plannedEnd.toISOString(),
        status:        'scheduled',
        notes:         `Auto-generiert (Draft ${draftId.slice(0, 8)})`,
        created_by:    appliedBy,
      })
      .select('id')
      .single();

    if (shiftErr || !shift) {
      errors++;
      continue;
    }

    await sb
      .from('auto_shift_draft_items')
      .update({ status: 'applied', applied_shift_id: String(shift.id) })
      .eq('id', String(item.id));

    shiftsCreated++;
  }

  // Mark draft applied
  await sb
    .from('auto_shift_drafts')
    .update({
      status:     'applied',
      applied_at: new Date().toISOString(),
      applied_by: appliedBy,
    })
    .eq('id', draftId)
    .eq('location_id', locationId);

  return { shiftsCreated, errors };
}

// ── discardShiftDraft ─────────────────────────────────────────────────────────

export async function discardShiftDraft(
  draftId: string,
  locationId: string,
): Promise<boolean> {
  const sb = createServiceClient();
  const { error } = await sb
    .from('auto_shift_drafts')
    .update({ status: 'discarded', discarded_at: new Date().toISOString() })
    .eq('id', draftId)
    .eq('location_id', locationId)
    .eq('status', 'pending');

  return !error;
}

// ── skipDraftItem ─────────────────────────────────────────────────────────────

export async function skipDraftItem(
  itemId: string,
  locationId: string,
): Promise<boolean> {
  const sb = createServiceClient();
  const { error } = await sb
    .from('auto_shift_draft_items')
    .update({ status: 'skipped' })
    .eq('id', itemId)
    .eq('location_id', locationId)
    .eq('status', 'pending');

  return !error;
}

// ── getPendingDraft ───────────────────────────────────────────────────────────

export async function getPendingDraft(locationId: string): Promise<ShiftDraft | null> {
  const sb = createServiceClient();

  const { data: draft } = await sb
    .from('auto_shift_drafts')
    .select('*')
    .eq('location_id', locationId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!draft) return null;
  return getDraftDetails(String(draft.id), locationId);
}

// ── getDraftDetails ───────────────────────────────────────────────────────────

export async function getDraftDetails(
  draftId: string,
  locationId: string,
): Promise<ShiftDraft | null> {
  const sb = createServiceClient();

  const [draftRes, itemsRes] = await Promise.all([
    sb.from('auto_shift_drafts').select('*').eq('id', draftId).eq('location_id', locationId).maybeSingle(),
    sb.from('auto_shift_draft_items').select('*').eq('draft_id', draftId).eq('location_id', locationId).order('shift_date').order('start_hour'),
  ]);

  if (!draftRes.data) return null;

  const items = itemsRes.data ?? [];
  const driverIds = [...new Set(items.map((i) => String(i.driver_id)))];

  let driverMeta = new Map<string, { name: string; vehicle: string }>();
  if (driverIds.length > 0) {
    const { data: drivers } = await sb
      .from('mise_drivers')
      .select('id, name, vehicle')
      .in('id', driverIds);
    driverMeta = new Map(
      (drivers ?? []).map((d) => [String(d.id), { name: String(d.name), vehicle: String(d.vehicle ?? 'auto') }]),
    );
  }

  const d = draftRes.data;
  return {
    id: String(d.id),
    locationId: String(d.location_id),
    status: d.status as ShiftDraft['status'],
    gapsFound: Number(d.gaps_found),
    shiftsProposed: Number(d.shifts_proposed),
    coverageBefore: Number(d.coverage_before),
    coverageAfter: Number(d.coverage_after),
    appliedAt: (d.applied_at as string | null) ?? null,
    notes: (d.notes as string | null) ?? null,
    createdAt: String(d.created_at),
    items: items.map((i) => mapItem(i as Record<string, unknown>, driverMeta)),
    itemsPending: items.filter((i) => i.status === 'pending').length,
    itemsApplied: items.filter((i) => i.status === 'applied').length,
    itemsSkipped: items.filter((i) => i.status === 'skipped').length,
    earliestDate: items.length > 0 ? String(items[0].shift_date) : null,
    latestDate: items.length > 0 ? String(items[items.length - 1].shift_date) : null,
  };
}

// ── getGeneratorDashboard ─────────────────────────────────────────────────────

export async function getGeneratorDashboard(locationId: string): Promise<GeneratorDashboard> {
  const sb = createServiceClient();

  const [draftsRes, gapsRes] = await Promise.all([
    sb
      .from('v_auto_shift_draft_summary')
      .select('*')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(10),
    sb
      .from('capacity_plan_slots')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .gt('coverage_gap', 0)
      .gte('slot_date', new Date().toISOString().slice(0, 10)),
  ]);

  const allDrafts = draftsRes.data ?? [];
  const pendingDraft = allDrafts.find((d) => d.status === 'pending');
  const appliedDrafts = allDrafts.filter((d) => d.status === 'applied');

  const shiftsCreated = appliedDrafts.reduce(
    (sum, d) => sum + Number(d.items_applied ?? 0),
    0,
  );

  return {
    pendingDraftId: pendingDraft ? String(pendingDraft.id) : null,
    totalDrafts: allDrafts.length,
    appliedDrafts: appliedDrafts.length,
    shiftsCreated,
    coverageGapsCurrent: gapsRes.count ?? 0,
    recentDrafts: allDrafts.slice(0, 5).map((d) => ({
      id: String(d.id),
      status: String(d.status),
      shiftsProposed: Number(d.shifts_proposed),
      coverageBefore: Number(d.coverage_before),
      coverageAfter: Number(d.coverage_after),
      createdAt: String(d.created_at),
      appliedAt: (d.applied_at as string | null) ?? null,
    })),
  };
}

// ── pruneOldDrafts ────────────────────────────────────────────────────────────

export async function pruneOldDrafts(daysToKeep = 30): Promise<number> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc('prune_old_auto_shift_drafts', { days_to_keep: daysToKeep });
  if (error) return 0;
  return Number(data ?? 0);
}
