/**
 * lib/delivery/messaging.ts
 *
 * Driver Broadcast & Operational Messages — Phase 47
 *
 * Dispatch-Mitarbeiter können Betriebsnachrichten an alle aktiven Fahrer
 * einer Location senden. Nachrichten sind priorisierbar (normal / urgent)
 * und laufen automatisch nach 4 Stunden ab.
 *
 * Funktionen:
 *   sendBroadcast()          — neue Nachricht versenden
 *   listBroadcasts()         — alle Nachrichten einer Location (Admin)
 *   getActiveBroadcasts()    — gültige Nachrichten für Fahrer-App
 *   markBroadcastRead()      — Lesebestätigung für einzelnen Fahrer
 *   deleteBroadcast()        — Nachricht vorzeitig löschen
 *   expireOldBroadcasts()    — Cron-Helfer: abgelaufene bereinigen
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { logCommunication } from './comms-log';

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface DriverBroadcast {
  id: string;
  locationId: string;
  message: string;
  priority: 'normal' | 'urgent';
  target: string;
  sentByName: string | null;
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
  readCount: number;
}

export interface SendBroadcastResult {
  id: string;
  createdAt: string;
}

// ─── Hilfsfunktion: Migration-Guard ──────────────────────────────────────────

async function isMigrationMissing(sb: ReturnType<typeof createServiceClient>): Promise<boolean> {
  const { error } = await sb
    .from('driver_broadcasts')
    .select('id')
    .limit(0);
  return !!error && (error.code === '42P01' || error.message.includes('driver_broadcasts'));
}

// ─── Öffentliche Funktionen ───────────────────────────────────────────────────

/**
 * Sendet eine Broadcast-Nachricht an alle aktiven Fahrer einer Location.
 * target: 'all' (Standard) oder eine mise_drivers.id für Direktnachrichten.
 */
export async function sendBroadcast(params: {
  locationId: string;
  message: string;
  priority?: 'normal' | 'urgent';
  sentByName?: string;
  target?: string;
  expiresInHours?: number;
}): Promise<SendBroadcastResult> {
  const {
    locationId,
    message,
    priority = 'normal',
    sentByName,
    target = 'all',
    expiresInHours = 4,
  } = params;

  const sb = createServiceClient();
  if (await isMigrationMissing(sb)) {
    throw new Error('Migration 039 noch nicht eingespielt');
  }

  const trimmed = message.trim().slice(0, 280);
  if (!trimmed) throw new Error('Nachricht darf nicht leer sein');

  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

  const { data, error } = await sb
    .from('driver_broadcasts')
    .insert({
      location_id:   locationId,
      message:       trimmed,
      priority,
      target,
      sent_by_name:  sentByName ?? null,
      expires_at:    expiresAt,
    })
    .select('id, created_at')
    .single();

  if (error) throw new Error(`sendBroadcast: ${error.message}`);

  // Kommunikations-Log (fire-and-forget)
  void logCommunication({
    locationId,
    channel:       'broadcast',
    messageType:   'broadcast',
    direction:     'dispatch_to_driver',
    body:          trimmed,
    sentByName,
    referenceType: 'broadcast',
    referenceId:   data.id as string,
    metadata:      { priority, target },
  });

  return {
    id:        data.id as string,
    createdAt: data.created_at as string,
  };
}

/**
 * Listet alle Nachrichten einer Location für die Admin-Ansicht.
 * Enthält auch abgelaufene (is_active=false). Sortiert neu→alt.
 */
export async function listBroadcasts(
  locationId: string,
  limit = 50,
): Promise<DriverBroadcast[]> {
  const sb = createServiceClient();
  if (await isMigrationMissing(sb)) return [];

  const { data, error } = await sb
    .from('v_broadcast_status')
    .select('id, location_id, message, priority, target, sent_by_name, created_at, expires_at, is_active, read_count')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (error.code === '42P01') return [];
    console.error('[messaging] listBroadcasts:', error.message);
    return [];
  }

  return (data ?? []).map(mapRow);
}

/**
 * Gibt aktive (nicht abgelaufene) Nachrichten für einen Fahrer zurück.
 * Für 'all'-Broadcasts: alle; für Direkt-Broadcasts: nur wenn target === driverId.
 * Sortiert: urgent zuerst, dann nach Zeit (neu→alt).
 */
export async function getActiveBroadcasts(
  locationId: string,
  driverId: string,
): Promise<DriverBroadcast[]> {
  const sb = createServiceClient();
  if (await isMigrationMissing(sb)) return [];

  const now = new Date().toISOString();

  const { data, error } = await sb
    .from('driver_broadcasts')
    .select('id, location_id, message, priority, target, sent_by_name, created_at, expires_at')
    .eq('location_id', locationId)
    .gt('expires_at', now)
    .order('priority', { ascending: false }) // urgent vor normal (lexikographisch: u > n)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    if (error.code === '42P01') return [];
    console.error('[messaging] getActiveBroadcasts:', error.message);
    return [];
  }

  const rows = (data ?? []).filter(
    (b) => b.target === 'all' || b.target === driverId,
  );

  return rows.map((b) => ({
    id:          b.id as string,
    locationId:  b.location_id as string,
    message:     b.message as string,
    priority:    b.priority as 'normal' | 'urgent',
    target:      b.target as string,
    sentByName:  b.sent_by_name as string | null,
    createdAt:   b.created_at as string,
    expiresAt:   b.expires_at as string,
    isActive:    true,
    readCount:   0,
  }));
}

/**
 * Markiert eine Broadcast-Nachricht als gelesen für einen bestimmten Fahrer.
 * Idempotent — ignoriert Konflikte (PRIMARY KEY).
 */
export async function markBroadcastRead(
  broadcastId: string,
  driverId: string,
): Promise<void> {
  const sb = createServiceClient();
  if (await isMigrationMissing(sb)) return;

  const { error } = await sb
    .from('driver_broadcast_reads')
    .upsert(
      { broadcast_id: broadcastId, driver_id: driverId },
      { onConflict: 'broadcast_id,driver_id', ignoreDuplicates: true },
    );

  if (error && error.code !== '23505') {
    console.error('[messaging] markBroadcastRead:', error.message);
  }
}

/**
 * Löscht eine Nachricht vorzeitig (nur wenn sie zur Location gehört).
 */
export async function deleteBroadcast(
  broadcastId: string,
  locationId: string,
): Promise<boolean> {
  const sb = createServiceClient();
  if (await isMigrationMissing(sb)) return false;

  const { error, count } = await sb
    .from('driver_broadcasts')
    .delete({ count: 'exact' })
    .eq('id', broadcastId)
    .eq('location_id', locationId);

  if (error) {
    console.error('[messaging] deleteBroadcast:', error.message);
    return false;
  }
  return (count ?? 0) > 0;
}

/**
 * Cron-Helfer: löscht abgelaufene Nachrichten die älter als 24 h sind.
 * Hält die Tabelle klein ohne aktive Broadcasts zu entfernen.
 */
export async function expireOldBroadcasts(): Promise<{ deleted: number }> {
  const sb = createServiceClient();
  if (await isMigrationMissing(sb)) return { deleted: 0 };

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { error, count } = await sb
    .from('driver_broadcasts')
    .delete({ count: 'exact' })
    .lt('expires_at', cutoff);

  if (error) {
    if (error.code === '42P01') return { deleted: 0 };
    console.error('[messaging] expireOldBroadcasts:', error.message);
    return { deleted: 0 };
  }

  return { deleted: count ?? 0 };
}

// ─── Intern ───────────────────────────────────────────────────────────────────

function mapRow(b: Record<string, unknown>): DriverBroadcast {
  return {
    id:          b.id as string,
    locationId:  b.location_id as string,
    message:     b.message as string,
    priority:    b.priority as 'normal' | 'urgent',
    target:      b.target as string,
    sentByName:  b.sent_by_name as string | null,
    createdAt:   b.created_at as string,
    expiresAt:   b.expires_at as string,
    isActive:    b.is_active as boolean,
    readCount:   (b.read_count as number | null) ?? 0,
  };
}
