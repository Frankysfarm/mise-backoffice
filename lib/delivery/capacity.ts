/**
 * lib/delivery/capacity.ts
 *
 * Kitchen-Queue-Signal Engine — Phase 44
 *
 * Schließt die Feedback-Schleife von der Küchenauslastung zur Storefront.
 * Wenn die Küche überlastet ist, wird ein Signal gesetzt das:
 *   - die angezeigte ETA im Storefront verlängert
 *   - eine Hinweis-Banner auslöst ("Aktuell erhöhte Wartezeit")
 *   - optional die Bestellannahme pausiert
 *
 * Signal-Typen:
 *   normal   — Betrieb läuft normal, keine Erweiterung
 *   extended — Erhöhte Wartezeit (auto oder manuell)
 *   paused   — Bestellannahme empfohlen zu pausieren (nur manuell)
 *
 * Auto-Evaluierung (Cron alle 2 Min):
 *   queueDepth >= 7  → extended (+20 Min)
 *   queueDepth >= 4  → extended (+10 Min)
 *   queueDepth < 4   → normal
 *   Manuelle 'paused'-Signale werden niemals auto-downgraded.
 */
import 'server-only';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// Service-Client (singleton)
// ============================================================

let _sb: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (_sb) return _sb;
  _sb = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return _sb;
}

// ============================================================
// Typen
// ============================================================

export type QueueSignalType = 'normal' | 'extended' | 'paused';

export interface QueueSignal {
  locationId: string;
  signalType: QueueSignalType;
  etaExtensionMin: number;
  messageDe: string | null;
  autoTriggered: boolean;
  triggerSource: string | null;
  queueDepth: number | null;
  expiresAt: string | null;
  updatedAt: string;
}

export interface QueueSignalInput {
  signalType: QueueSignalType;
  etaExtensionMin?: number;
  messageDe?: string | null;
  expiresAt?: string | null;
}

export interface AutoEvalResult {
  locationId: string;
  prevSignal: QueueSignalType;
  newSignal: QueueSignalType;
  queueDepth: number;
  action: 'upgraded' | 'downgraded' | 'unchanged';
}

export interface SignalHistoryEntry {
  id: string;
  locationId: string;
  signalType: QueueSignalType;
  etaExtensionMin: number;
  messageDe: string | null;
  autoTriggered: boolean;
  queueDepth: number | null;
  recordedAt: string;
}

const DEFAULT_MESSAGES: Record<QueueSignalType, string | null> = {
  normal:   null,
  extended: 'Aktuell etwas mehr Betrieb — bitte etwas mehr Zeit einplanen.',
  paused:   'Wir nehmen momentan keine neuen Lieferbestellungen an.',
};

// ============================================================
// Kern-Funktionen
// ============================================================

/** Aktuelles Queue-Signal für eine Location lesen. */
export async function getCurrentQueueSignal(locationId: string): Promise<QueueSignal> {
  try {
    const { data } = await sb()
      .from('location_queue_signals')
      .select('*')
      .eq('location_id', locationId)
      .maybeSingle();

    if (!data) {
      return _defaultSignal(locationId);
    }

    // Abgelaufene Signale als normal behandeln
    if (data.expires_at && new Date(data.expires_at as string) < new Date()) {
      return _defaultSignal(locationId);
    }

    return _mapRow(data);
  } catch {
    return _defaultSignal(locationId);
  }
}

/** Queue-Signal setzen (UPSERT — 1 Zeile pro Location). */
export async function setQueueSignal(
  locationId: string,
  input: QueueSignalInput,
  autoTriggered = false,
  triggerSource: string | null = null,
  queueDepth: number | null = null,
  createdBy: string | null = null,
): Promise<QueueSignal> {
  const etaExtensionMin = input.etaExtensionMin ?? (input.signalType === 'normal' ? 0 : 10);
  const messageDe = input.messageDe ?? DEFAULT_MESSAGES[input.signalType];

  const { data } = await sb()
    .from('location_queue_signals')
    .upsert(
      {
        location_id:       locationId,
        signal_type:       input.signalType,
        eta_extension_min: etaExtensionMin,
        message_de:        messageDe,
        auto_triggered:    autoTriggered,
        trigger_source:    triggerSource,
        queue_depth:       queueDepth,
        created_by:        createdBy,
        expires_at:        input.expiresAt ?? null,
        updated_at:        new Date().toISOString(),
      },
      { onConflict: 'location_id' },
    )
    .select()
    .single();

  // History-Eintrag schreiben (fire-and-forget)
  void Promise.resolve(
    sb()
      .from('queue_signal_history')
      .insert({
        location_id:       locationId,
        signal_type:       input.signalType,
        eta_extension_min: etaExtensionMin,
        message_de:        messageDe,
        auto_triggered:    autoTriggered,
        queue_depth:       queueDepth,
      }),
  ).catch(() => {});

  return data ? _mapRow(data) : _defaultSignal(locationId);
}

/** Signal auf 'normal' zurücksetzen (manuell durch Admin). */
export async function resetQueueSignal(locationId: string): Promise<void> {
  await setQueueSignal(
    locationId,
    { signalType: 'normal', etaExtensionMin: 0, messageDe: null },
    false,
    'manual_reset',
  );
}

/** History-Log lesen. */
export async function getSignalHistory(
  locationId: string,
  limit = 20,
): Promise<SignalHistoryEntry[]> {
  try {
    const { data } = await sb()
      .from('queue_signal_history')
      .select('*')
      .eq('location_id', locationId)
      .order('recorded_at', { ascending: false })
      .limit(limit);

    return (data ?? []).map(_mapHistoryRow);
  } catch {
    return [];
  }
}

// ============================================================
// Auto-Evaluierung (Cron)
// ============================================================

/**
 * Bewertet Küchenauslastung für eine Location und setzt das Signal automatisch.
 * Manuelle 'paused'-Signale werden nicht überschrieben.
 */
export async function evaluateAutoSignal(locationId: string): Promise<AutoEvalResult> {
  const current = await getCurrentQueueSignal(locationId);

  // Manuelle Pause nicht überschreiben
  if (!current.autoTriggered && current.signalType === 'paused') {
    return {
      locationId,
      prevSignal: current.signalType,
      newSignal:  current.signalType,
      queueDepth: 0,
      action:     'unchanged',
    };
  }

  const queueDepth = await _getKitchenQueueDepth(locationId);

  let targetSignal: QueueSignalType;
  let targetEtaExt: number;

  if (queueDepth >= 7) {
    targetSignal = 'extended';
    targetEtaExt = 20;
  } else if (queueDepth >= 4) {
    targetSignal = 'extended';
    targetEtaExt = 10;
  } else {
    targetSignal = 'normal';
    targetEtaExt = 0;
  }

  if (
    targetSignal === current.signalType &&
    targetEtaExt === current.etaExtensionMin
  ) {
    return {
      locationId,
      prevSignal: current.signalType,
      newSignal:  targetSignal,
      queueDepth,
      action:     'unchanged',
    };
  }

  await setQueueSignal(
    locationId,
    { signalType: targetSignal, etaExtensionMin: targetEtaExt },
    true,
    'kitchen_queue',
    queueDepth,
  );

  const signalRank: Record<QueueSignalType, number> = { normal: 0, extended: 1, paused: 2 };
  const action =
    signalRank[targetSignal] > signalRank[current.signalType]
      ? 'upgraded'
      : 'downgraded';

  return { locationId, prevSignal: current.signalType, newSignal: targetSignal, queueDepth, action };
}

/** Cron-Wrapper: alle aktiven Locations evaluieren. */
export async function evaluateAutoSignalAllLocations(): Promise<{
  locations: number;
  upgraded: number;
  downgraded: number;
  errors: number;
}> {
  try {
    const { data: locations } = await sb()
      .from('locations')
      .select('id')
      .eq('is_active', true)
      .limit(50);

    if (!locations?.length) return { locations: 0, upgraded: 0, downgraded: 0, errors: 0 };

    const results = await Promise.allSettled(
      locations.map((loc) => evaluateAutoSignal(loc.id as string)),
    );

    let upgraded = 0;
    let downgraded = 0;
    let errors = 0;

    for (const r of results) {
      if (r.status === 'rejected') {
        errors++;
      } else {
        if (r.value.action === 'upgraded')   upgraded++;
        if (r.value.action === 'downgraded') downgraded++;
      }
    }

    return { locations: locations.length, upgraded, downgraded, errors };
  } catch {
    return { locations: 0, upgraded: 0, downgraded: 0, errors: 1 };
  }
}

// ============================================================
// Hilfsfunktionen
// ============================================================

async function _getKitchenQueueDepth(locationId: string): Promise<number> {
  try {
    const { count } = await sb()
      .from('customer_orders')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .in('status', ['neu', 'bestätigt', 'in_zubereitung', 'fertig'])
      .eq('typ', 'lieferung');
    return count ?? 0;
  } catch {
    return 0;
  }
}

function _defaultSignal(locationId: string): QueueSignal {
  return {
    locationId,
    signalType:       'normal',
    etaExtensionMin:  0,
    messageDe:        null,
    autoTriggered:    false,
    triggerSource:    null,
    queueDepth:       null,
    expiresAt:        null,
    updatedAt:        new Date().toISOString(),
  };
}

function _mapRow(row: Record<string, unknown>): QueueSignal {
  return {
    locationId:       row.location_id as string,
    signalType:       row.signal_type as QueueSignalType,
    etaExtensionMin:  (row.eta_extension_min as number) ?? 0,
    messageDe:        (row.message_de as string | null) ?? null,
    autoTriggered:    Boolean(row.auto_triggered),
    triggerSource:    (row.trigger_source as string | null) ?? null,
    queueDepth:       (row.queue_depth as number | null) ?? null,
    expiresAt:        (row.expires_at as string | null) ?? null,
    updatedAt:        row.updated_at as string,
  };
}

function _mapHistoryRow(row: Record<string, unknown>): SignalHistoryEntry {
  return {
    id:               row.id as string,
    locationId:       row.location_id as string,
    signalType:       row.signal_type as QueueSignalType,
    etaExtensionMin:  (row.eta_extension_min as number) ?? 0,
    messageDe:        (row.message_de as string | null) ?? null,
    autoTriggered:    Boolean(row.auto_triggered),
    queueDepth:       (row.queue_depth as number | null) ?? null,
    recordedAt:       row.recorded_at as string,
  };
}
