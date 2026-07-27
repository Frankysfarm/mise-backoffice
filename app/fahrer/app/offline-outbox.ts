'use client';

import {
  validateDriverV2ActionEnvelope, validateDriverV2Envelope,
  type DriverV2Action, type DriverV2Envelope,
} from '@/lib/delivery/driver-v2-contract';

export const OFFLINE_OUTBOX_KEY = 'mise_offline_queue';
export const OFFLINE_OUTBOX_VERSION = 1 as const;
export const MAX_OFFLINE_ATTEMPTS = 5;
export const TERMINAL_RETENTION_MS = 7 * 24 * 60 * 60_000;
export const LEGACY_QUEUE_COMPAT_ENABLED =
  process.env.NEXT_PUBLIC_DRIVER_LEGACY_OFFLINE_QUEUE_COMPAT === 'true';
let replayInFlight: Promise<{ ok: number; fail: number }> | null = null;

export interface OfflineActionV1 {
  version: 1;
  actionId: string;
  action: string;
  endpoint: string;
  method: 'POST';
  body: Record<string, unknown>;
  headers: Record<string, string>;
  createdAt: string;
  expectedVersion: number | null;
  attempts: number;
  terminalResult: { ok: boolean; status: number; reasonCode: string | null; at: string } | null;
  requestFingerprint: string;
}

interface OfflineOutboxV1 {
  version: 1;
  actions: OfflineActionV1[];
  quarantine: Array<{ value: unknown; reason: string; quarantinedAt: string }>;
}

const ACTION_ENDPOINTS = {
  ack_receipt: '/api/driver/v2/assignments/ack',
  start_shift: '/api/driver/v2/session/start',
  end_shift: '/api/driver/v2/session/end',
  arrive: '/api/driver/v2/stops/arrive',
  resolve_items: '/api/driver/v2/items/resolve',
  atomic_pickup: '/api/driver/v2/pickup/atomic',
  complete_stop: '/api/driver/v2/stops/complete',
  report_exception: '/api/driver/v2/exceptions',
} as const;
type OfflineDriverAction = keyof typeof ACTION_ENDPOINTS;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function actionId(): string {
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    throw new Error('CRYPTO_UUID_UNAVAILABLE');
  }
  return crypto.randomUUID();
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function fingerprint(action: string, endpoint: string, body: Record<string, unknown>): string {
  const input = `${action}\n${endpoint}\n${stableJson(body)}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function validateAction(action: string, endpoint: string, body: Record<string, unknown>): string | null {
  if (!(action in ACTION_ENDPOINTS)
    || ACTION_ENDPOINTS[action as OfflineDriverAction] !== endpoint) return 'ACTION_ENDPOINT_MISMATCH';
  if (typeof body.action_id !== 'string' || !UUID.test(body.action_id)) return 'ACTION_ID_INVALID';
  try {
    const envelope = validateDriverV2Envelope(body);
    validateDriverV2ActionEnvelope(action as DriverV2Action, envelope as DriverV2Envelope);
  } catch (error) {
    return error instanceof Error ? error.message : 'EXPECTED_AUTHORITY_MISSING';
  }
  return null;
}

export function parseOfflineOutbox(raw: string | null): OfflineOutboxV1 {
  if (!raw) return { version: 1, actions: [], quarantine: [] };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isRecord(parsed) && parsed.version === 1 && Array.isArray(parsed.actions)) {
      const quarantine = Array.isArray(parsed.quarantine) ? parsed.quarantine.filter(isRecord)
        .map((item) => ({
          value: item.value, reason: String(item.reason ?? 'LEGACY_QUARANTINE'),
          quarantinedAt: String(item.quarantinedAt ?? new Date().toISOString()),
        })) : [];
      const candidateActions = parsed.actions.filter((item): item is OfflineActionV1 =>
        isRecord(item) && item.version === 1 && typeof item.actionId === 'string'
        && typeof item.endpoint === 'string' && item.method === 'POST'
        && isRecord(item.body) && typeof item.createdAt === 'string'
        && typeof item.action === 'string');
      const accepted = candidateActions.filter((item) =>
        item.body.action_id === item.actionId
        && !validateAction(item.action, item.endpoint, item.body)
        && item.requestFingerprint === fingerprint(item.action, item.endpoint, item.body));
      return {
        version: 1,
        actions: accepted,
        quarantine: [
          ...quarantine,
          ...candidateActions.filter((item) => !accepted.includes(item))
            .map((value) => ({
              value, reason: 'INVALID_VERSIONED_ENVELOPE', quarantinedAt: new Date().toISOString(),
            })),
        ],
      };
    }
    if (Array.isArray(parsed)) {
      return {
        version: 1,
        actions: [],
        quarantine: parsed.map((value) => ({
            value, reason: LEGACY_QUEUE_COMPAT_ENABLED
              ? 'LEGACY_FORMAT_UNSAFE_REQUIRES_OPERATOR_REVIEW' : 'LEGACY_REPLAY_DEFAULT_OFF',
            quarantinedAt: new Date().toISOString(),
        })),
      };
    }
  } catch {
    // Corrupt storage is treated as empty; callers retain no unvalidated requests.
  }
  return { version: 1, actions: [], quarantine: [{
    value: raw, reason: 'UNREADABLE_OR_UNSUPPORTED_QUEUE', quarantinedAt: new Date().toISOString(),
  }] };
}

export function readOfflineOutbox(): OfflineOutboxV1 {
  if (typeof window === 'undefined') return { version: 1, actions: [], quarantine: [] };
  const outbox = parseOfflineOutbox(localStorage.getItem(OFFLINE_OUTBOX_KEY));
  const cutoff = Date.now() - TERMINAL_RETENTION_MS;
  outbox.actions = outbox.actions.filter((item) => !item.terminalResult
    || new Date(item.terminalResult.at).getTime() >= cutoff);
  localStorage.setItem(OFFLINE_OUTBOX_KEY, JSON.stringify(outbox));
  return outbox;
}

export function writeOfflineOutbox(actions: OfflineActionV1[]): void {
  const current = parseOfflineOutbox(localStorage.getItem(OFFLINE_OUTBOX_KEY));
  localStorage.setItem(OFFLINE_OUTBOX_KEY, JSON.stringify({
    version: 1, actions, quarantine: current.quarantine,
  }));
}

export function enqueueOfflineRequest(
  endpoint: string, action: string, body: Record<string, unknown>,
  headers: Record<string, string> = { 'Content-Type': 'application/json' },
): OfflineActionV1 {
  const id = typeof body.action_id === 'string' ? body.action_id : actionId();
  const frozenBody = JSON.parse(JSON.stringify({ ...body, action_id: id })) as Record<string, unknown>;
  const validationError = validateAction(action, endpoint, frozenBody);
  if (validationError) throw new Error(validationError);
  const expectedVersion = typeof body.expected_version === 'number' ? body.expected_version
    : isRecord(body.expected_versions) && typeof body.expected_versions.driver === 'number'
      ? body.expected_versions.driver : null;
  const item: OfflineActionV1 = {
    version: 1, actionId: id, action, endpoint, method: 'POST',
    body: frozenBody, headers: { 'Content-Type': headers['Content-Type'] ?? 'application/json' },
    createdAt: new Date().toISOString(),
    expectedVersion, attempts: 0, terminalResult: null,
    requestFingerprint: fingerprint(action, endpoint, frozenBody),
  };
  const outbox = readOfflineOutbox();
  const existing = outbox.actions.find((queued) => queued.actionId === id);
  if (existing && existing.requestFingerprint !== item.requestFingerprint) {
    throw new Error('OFFLINE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST');
  }
  if (!existing) {
    writeOfflineOutbox([...outbox.actions, item]);
  }
  return item;
}

export interface OfflineReplayOptions {
  getAccessToken?: () => Promise<string | null>;
  reconcileSnapshot?: () => Promise<void>;
  applySnapshot?: (snapshot: unknown) => void;
}

async function replayOnce(options: OfflineReplayOptions = {}): Promise<{ ok: number; fail: number }> {
  const { actions } = readOfflineOutbox();
  let ok = 0;
  let fail = 0;
  const remaining: OfflineActionV1[] = [];
  for (const item of actions) {
    if (item.terminalResult) {
      remaining.push(item);
      continue;
    }
    const validationError = validateAction(item.action, item.endpoint, item.body);
    if (validationError || item.requestFingerprint !== fingerprint(item.action, item.endpoint, item.body)) {
      remaining.push({
        ...item,
        terminalResult: { ok: false, status: 0, reasonCode: validationError ?? 'FINGERPRINT_CONFLICT', at: new Date().toISOString() },
      });
      fail++;
      continue;
    }
    try {
      const accessToken = await options.getAccessToken?.();
      const response = await fetch(item.endpoint, {
        method: item.method,
        headers: { ...item.headers, ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify(item.body),
      });
      if (response.ok) {
        try {
          const result = await response.clone().json() as { snapshot?: unknown };
          if (result.snapshot) options.applySnapshot?.(result.snapshot);
        } catch {
          // A successful endpoint may legitimately return no JSON snapshot.
        }
        ok++;
        remaining.push({
          ...item,
          terminalResult: { ok: true, status: response.status, reasonCode: null, at: new Date().toISOString() },
        });
        continue;
      }
      fail++;
      const attempts = item.attempts + 1;
      if (response.status === 409) await options.reconcileSnapshot?.();
      if (attempts < MAX_OFFLINE_ATTEMPTS && response.status >= 500) {
        remaining.push({ ...item, attempts });
      } else {
        let reasonCode: string | null = null;
        try {
          const result = await response.clone().json() as { reason_code?: string };
          reasonCode = result.reason_code ?? null;
        } catch {
          reasonCode = 'HTTP_TERMINAL';
        }
        remaining.push({
          ...item, attempts,
          terminalResult: { ok: false, status: response.status, reasonCode, at: new Date().toISOString() },
        });
      }
    } catch {
      fail++;
      const attempts = item.attempts + 1;
      if (attempts < MAX_OFFLINE_ATTEMPTS) remaining.push({ ...item, attempts });
      else remaining.push({
        ...item, attempts,
        terminalResult: { ok: false, status: 0, reasonCode: 'NETWORK_RETRY_EXHAUSTED', at: new Date().toISOString() },
      });
    }
  }
  writeOfflineOutbox(remaining);
  return { ok, fail };
}

export function replayOfflineOutbox(options: OfflineReplayOptions = {}): Promise<{ ok: number; fail: number }> {
  if (replayInFlight) return replayInFlight;
  replayInFlight = replayOnce(options).finally(() => {
    replayInFlight = null;
  });
  return replayInFlight;
}

/** Integration seam for driverV2Request after the T04 client ownership handoff. */
export async function executeDriverV2OrQueue(
  endpoint: string, action: OfflineDriverAction, body: Record<string, unknown>,
  options: OfflineReplayOptions,
): Promise<{ queued: boolean; response?: Response }> {
  try {
    const accessToken = await options.getAccessToken?.();
    const response = await fetch(endpoint, {
      method: 'POST', headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      }, body: JSON.stringify(body),
    });
    if (response.status === 409) await options.reconcileSnapshot?.();
    return { queued: false, response };
  } catch {
    enqueueOfflineRequest(endpoint, action, body);
    return { queued: true };
  }
}
