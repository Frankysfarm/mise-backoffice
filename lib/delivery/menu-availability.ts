/**
 * lib/delivery/menu-availability.ts
 *
 * Phase 185: Smart Dynamic Menu Availability Engine
 *
 * Verwaltet die Echtzeit-Verfügbarkeit von Menü-Artikeln.
 * Artikel können manuell durch die Küche oder automatisch bei Überlastung
 * deaktiviert und für die Storefront unsichtbar/ausgegraut geschaltet werden.
 *
 * Funktionen:
 *  - getAvailabilityState()     — Storefront-Polling (minimale Payload)
 *  - getDisabledItems()         — Namen deaktivierter Artikel (Storefront-Filter)
 *  - getManagedItems()          — alle Einträge mit Status (Admin)
 *  - addManagedItem()           — Artikel zur Engine hinzufügen
 *  - removeManagedItem()        — Artikel aus Engine entfernen
 *  - disableItem()              — manuell deaktivieren
 *  - restoreItem()              — wiederherstellen
 *  - autoRestoreExpired()       — abgelaufene Sperren aufheben
 *  - evaluateAutoDisable()      — Queue-basiertes Auto-Disable für eine Location
 *  - evaluateAllLocations()     — Cron-Batch
 *  - refreshDisableCounts()     — 7-Tage-Zähler aktualisieren
 *  - getDashboard()             — kombinierter Admin-Response
 *  - getRecentEvents()          — Ereignis-Log
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Types ──────────────────────────────────────────────────────────────────────

export type AvailabilityEventType =
  | 'auto_disabled'
  | 'manual_disabled'
  | 'auto_restored'
  | 'manual_restored'
  | 'item_added'
  | 'item_removed';

export type ItemState = 'available' | 'disabled';

export interface ManagedItem {
  id: string;
  locationId: string;
  itemName: string;
  autoDisableEnabled: boolean;
  queueDepthThreshold: number;
  isDisabled: boolean;
  disabledReason: string | null;
  disabledUntil: string | null;
  disabledBy: string | null;
  disabledAt: string | null;
  disableCount7d: number;
  lastAutoDisabledAt: string | null;
  currentState: ItemState;
  disabledMinutesRemaining: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilityStateItem {
  itemName: string;
  state: ItemState;
  disabledReason: string | null;
  disabledMinutesRemaining: number | null;
  disabledBy: string | null;
}

export interface AvailabilityEvent {
  id: string;
  itemName: string;
  eventType: AvailabilityEventType;
  triggerQueueDepth: number | null;
  triggerReason: string | null;
  disabledBy: string | null;
  durationMin: number | null;
  createdAt: string;
}

export interface MenuAvailabilityDashboard {
  totalManaged: number;
  currentlyDisabled: number;
  autoDisabledToday: number;
  manualDisabledCount: number;
  mostDisabledItem: string | null;
  items: ManagedItem[];
  recentEvents: AvailabilityEvent[];
  generatedAt: string;
}

export interface AddItemInput {
  itemName: string;
  autoDisableEnabled?: boolean;
  queueDepthThreshold?: number;
}

export interface EvaluateResult {
  locationId: string;
  queueDepth: number;
  checkedItems: number;
  autoDisabled: number;
  autoRestored: number;
}

// ── Row Mappers ────────────────────────────────────────────────────────────────

function rowToItem(r: Record<string, unknown>): ManagedItem {
  return {
    id:                       r.id as string,
    locationId:               r.location_id as string,
    itemName:                 r.item_name as string,
    autoDisableEnabled:       r.auto_disable_enabled as boolean,
    queueDepthThreshold:      (r.queue_depth_threshold as number) ?? 8,
    isDisabled:               (r.is_disabled as boolean) ?? false,
    disabledReason:           r.disabled_reason as string | null,
    disabledUntil:            r.disabled_until as string | null,
    disabledBy:               r.disabled_by as string | null,
    disabledAt:               r.disabled_at as string | null,
    disableCount7d:           (r.disable_count_7d as number) ?? 0,
    lastAutoDisabledAt:       r.last_auto_disabled_at as string | null,
    currentState:             (r.current_state as ItemState) ?? (r.is_disabled ? 'disabled' : 'available'),
    disabledMinutesRemaining: r.disabled_minutes_remaining as number | null,
    createdAt:                r.created_at as string,
    updatedAt:                r.updated_at as string,
  };
}

function rowToEvent(r: Record<string, unknown>): AvailabilityEvent {
  return {
    id:                r.id as string,
    itemName:          r.item_name as string,
    eventType:         r.event_type as AvailabilityEventType,
    triggerQueueDepth: r.trigger_queue_depth as number | null,
    triggerReason:     r.trigger_reason as string | null,
    disabledBy:        r.disabled_by as string | null,
    durationMin:       r.duration_min as number | null,
    createdAt:         r.created_at as string,
  };
}

// ── Storefront-Funktionen ──────────────────────────────────────────────────────

/** Aktueller Verfügbarkeitsstatus aller überwachten Artikel — für Storefront */
export async function getAvailabilityState(
  locationId: string,
): Promise<AvailabilityStateItem[]> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('v_menu_availability_state')
    .select('item_name, current_state, disabled_reason, disabled_minutes_remaining, disabled_by')
    .eq('location_id', locationId);
  return (data ?? []).map((r) => ({
    itemName:                 r.item_name as string,
    state:                    (r.current_state as ItemState) ?? 'available',
    disabledReason:           r.disabled_reason as string | null,
    disabledMinutesRemaining: r.disabled_minutes_remaining as number | null,
    disabledBy:               r.disabled_by as string | null,
  }));
}

/** Nur Namen der aktuell deaktivierten Artikel — minimale Payload für Storefront */
export async function getDisabledItems(locationId: string): Promise<string[]> {
  const state = await getAvailabilityState(locationId);
  return state.filter((s) => s.state === 'disabled').map((s) => s.itemName);
}

// ── Admin-Funktionen ───────────────────────────────────────────────────────────

/** Alle konfigurierten Artikel mit aktuellem Status */
export async function getManagedItems(locationId: string): Promise<ManagedItem[]> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('v_menu_availability_state')
    .select('*')
    .eq('location_id', locationId)
    .order('item_name');
  return (data ?? []).map(rowToItem);
}

/** Artikel zur Engine hinzufügen (idempotent via UPSERT) */
export async function addManagedItem(
  locationId: string,
  input: AddItemInput,
): Promise<ManagedItem> {
  const svc = createServiceClient();
  const now = new Date().toISOString();

  const { data, error } = await svc
    .from('menu_availability_overrides')
    .upsert(
      {
        location_id:           locationId,
        item_name:             input.itemName.trim(),
        auto_disable_enabled:  input.autoDisableEnabled ?? true,
        queue_depth_threshold: input.queueDepthThreshold ?? 8,
        updated_at:            now,
      },
      { onConflict: 'location_id,item_name' },
    )
    .select('*')
    .single();

  if (error) throw new Error(`addManagedItem: ${error.message}`);

  await svc.from('menu_availability_events').insert({
    location_id: locationId,
    item_name:   input.itemName.trim(),
    event_type:  'item_added',
  }).then(null, () => null);

  return rowToItem(data as Record<string, unknown>);
}

/** Artikel aus Engine entfernen */
export async function removeManagedItem(
  locationId: string,
  itemName: string,
): Promise<void> {
  const svc = createServiceClient();
  await svc
    .from('menu_availability_overrides')
    .delete()
    .eq('location_id', locationId)
    .eq('item_name', itemName);

  await svc.from('menu_availability_events').insert({
    location_id: locationId,
    item_name:   itemName,
    event_type:  'item_removed',
  }).then(null, () => null);
}

/** Artikel manuell deaktivieren */
export async function disableItem(
  locationId: string,
  itemName: string,
  durationMin: number | null,
  reason: string,
  disabledBy: string,
): Promise<void> {
  const svc = createServiceClient();
  const now = new Date();
  const disabledUntil = durationMin
    ? new Date(now.getTime() + durationMin * 60_000).toISOString()
    : null;

  const { error } = await svc
    .from('menu_availability_overrides')
    .update({
      is_disabled:     true,
      disabled_reason: reason,
      disabled_until:  disabledUntil,
      disabled_by:     disabledBy,
      disabled_at:     now.toISOString(),
      updated_at:      now.toISOString(),
    })
    .eq('location_id', locationId)
    .eq('item_name', itemName);

  if (error) throw new Error(`disableItem: ${error.message}`);

  await svc.from('menu_availability_events').insert({
    location_id:   locationId,
    item_name:     itemName,
    event_type:    'manual_disabled',
    trigger_reason: reason,
    disabled_by:   disabledBy,
  }).then(null, () => null);
}

/** Artikel wiederherstellen (manuell oder auto) */
export async function restoreItem(
  locationId: string,
  itemName: string,
  restoredBy: string,
  wasAuto: boolean,
): Promise<void> {
  const svc = createServiceClient();

  const { data: current } = await svc
    .from('menu_availability_overrides')
    .select('disabled_at')
    .eq('location_id', locationId)
    .eq('item_name', itemName)
    .maybeSingle();

  const durationMin = current?.disabled_at
    ? Math.round((Date.now() - new Date(current.disabled_at as string).getTime()) / 60_000)
    : null;

  const now = new Date().toISOString();
  await svc
    .from('menu_availability_overrides')
    .update({
      is_disabled:     false,
      disabled_until:  null,
      disabled_by:     null,
      disabled_at:     null,
      disabled_reason: null,
      updated_at:      now,
    })
    .eq('location_id', locationId)
    .eq('item_name', itemName);

  await svc.from('menu_availability_events').insert({
    location_id:  locationId,
    item_name:    itemName,
    event_type:   wasAuto ? 'auto_restored' : 'manual_restored',
    disabled_by:  restoredBy,
    duration_min: durationMin,
  }).then(null, () => null);
}

// ── Auto-Disable Engine ────────────────────────────────────────────────────────

/** Bereinigt abgelaufene Sperren für eine Location */
export async function autoRestoreExpired(locationId: string): Promise<number> {
  const svc = createServiceClient();
  const now = new Date().toISOString();

  const { data: expired } = await svc
    .from('menu_availability_overrides')
    .select('item_name, disabled_at')
    .eq('location_id', locationId)
    .eq('is_disabled', true)
    .not('disabled_until', 'is', null)
    .lte('disabled_until', now);

  if (!expired?.length) return 0;

  for (const row of expired) {
    const durationMin = row.disabled_at
      ? Math.round((Date.now() - new Date(row.disabled_at as string).getTime()) / 60_000)
      : null;

    await svc
      .from('menu_availability_overrides')
      .update({
        is_disabled:     false,
        disabled_until:  null,
        disabled_by:     null,
        disabled_at:     null,
        disabled_reason: null,
        updated_at:      now,
      })
      .eq('location_id', locationId)
      .eq('item_name', row.item_name as string);

    await svc.from('menu_availability_events').insert({
      location_id:    locationId,
      item_name:      row.item_name as string,
      event_type:     'auto_restored',
      trigger_reason: 'duration_expired',
      duration_min:   durationMin,
    }).then(null, () => null);
  }

  return expired.length;
}

/** Queue-basiertes Auto-Disable / Auto-Restore für eine Location */
export async function evaluateAutoDisable(locationId: string): Promise<EvaluateResult> {
  const svc = createServiceClient();

  // 1) Aktuelle Queue-Tiefe (aktive Bestellungen)
  const { count } = await svc
    .from('customer_orders')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .in('status', ['neu', 'in_zubereitung', 'bereit_zur_lieferung']);

  const depth = count ?? 0;

  // 2) Abgelaufene Sperren aufheben
  await autoRestoreExpired(locationId);

  // 3) Artikel mit Auto-Disable-Konfiguration laden
  const { data: items } = await svc
    .from('menu_availability_overrides')
    .select('item_name, queue_depth_threshold, is_disabled, disabled_by')
    .eq('location_id', locationId)
    .eq('auto_disable_enabled', true);

  if (!items?.length) {
    return { locationId, queueDepth: depth, checkedItems: 0, autoDisabled: 0, autoRestored: 0 };
  }

  let autoDisabled = 0;
  let autoRestored = 0;
  const now = new Date().toISOString();

  for (const item of items) {
    const threshold = (item.queue_depth_threshold as number) ?? 8;
    const isDisabled = item.is_disabled as boolean;
    const disabledBy = item.disabled_by as string | null;

    if (!isDisabled && depth > threshold) {
      // Zu heiß — auto-deaktivieren für 30 Minuten
      await svc
        .from('menu_availability_overrides')
        .update({
          is_disabled:             true,
          disabled_reason:         `Küche überlastet (${depth} Bestellungen)`,
          disabled_by:             'auto',
          disabled_at:             now,
          disabled_until:          new Date(Date.now() + 30 * 60_000).toISOString(),
          last_auto_disabled_at:   now,
          updated_at:              now,
        })
        .eq('location_id', locationId)
        .eq('item_name', item.item_name as string);

      await svc.from('menu_availability_events').insert({
        location_id:          locationId,
        item_name:            item.item_name as string,
        event_type:           'auto_disabled',
        trigger_queue_depth:  depth,
        trigger_reason:       `queue_depth_${depth}_exceeds_threshold_${threshold}`,
      }).then(null, () => null);

      autoDisabled++;
    } else if (isDisabled && disabledBy === 'auto' && depth <= threshold) {
      // Last wieder normal — auto-restore
      await restoreItem(locationId, item.item_name as string, 'auto', true);
      autoRestored++;
    }
  }

  return { locationId, queueDepth: depth, checkedItems: items.length, autoDisabled, autoRestored };
}

/** Cron-Batch: alle aktiven Locations evaluieren */
export async function evaluateAllLocations(): Promise<EvaluateResult[]> {
  const svc = createServiceClient();
  const { data: locations } = await svc
    .from('locations')
    .select('id')
    .eq('aktiv', true);

  if (!locations?.length) return [];

  const results = await Promise.allSettled(
    locations.map((l) => evaluateAutoDisable(l.id as string)),
  );
  return results
    .filter((r): r is PromiseFulfilledResult<EvaluateResult> => r.status === 'fulfilled')
    .map((r) => r.value);
}

/** 7-Tage-Deaktivierungs-Zähler aktualisieren (täglich via Cron) */
export async function refreshDisableCounts(): Promise<void> {
  const svc = createServiceClient();
  await svc.rpc('refresh_menu_disable_counts').then(null, () => null);
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

export async function getDashboard(locationId: string): Promise<MenuAvailabilityDashboard> {
  const svc = createServiceClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [itemsRes, eventsRes, autoTodayRes] = await Promise.allSettled([
    svc
      .from('v_menu_availability_state')
      .select('*')
      .eq('location_id', locationId)
      .order('item_name'),
    svc
      .from('menu_availability_events')
      .select('*')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(30),
    svc
      .from('menu_availability_events')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('event_type', 'auto_disabled')
      .gte('created_at', todayStart.toISOString()),
  ]);

  const items = itemsRes.status === 'fulfilled'
    ? (itemsRes.value.data ?? []).map(rowToItem)
    : [];
  const events = eventsRes.status === 'fulfilled'
    ? (eventsRes.value.data ?? []).map(rowToEvent)
    : [];
  const autoToday = autoTodayRes.status === 'fulfilled'
    ? (autoTodayRes.value.count ?? 0)
    : 0;

  const disabled = items.filter((i) => i.currentState === 'disabled');
  const manualDisabled = disabled.filter((i) => i.disabledBy !== 'auto').length;
  const mostDisabled = items.reduce<ManagedItem | null>(
    (best, cur) => (!best || cur.disableCount7d > best.disableCount7d ? cur : best),
    null,
  );

  return {
    totalManaged:        items.length,
    currentlyDisabled:   disabled.length,
    autoDisabledToday:   autoToday,
    manualDisabledCount: manualDisabled,
    mostDisabledItem:    mostDisabled?.disableCount7d ? mostDisabled.itemName : null,
    items,
    recentEvents:        events,
    generatedAt:         new Date().toISOString(),
  };
}

export async function getRecentEvents(
  locationId: string,
  limit = 50,
): Promise<AvailabilityEvent[]> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('menu_availability_events')
    .select('*')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []).map(rowToEvent);
}
