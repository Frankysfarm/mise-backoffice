import { createHash, randomUUID } from 'node:crypto';

export const OPS_EVENT_VERSION = 1 as const;

export type OpsSeverity = 'info' | 'warning' | 'critical';
export type OpsActorRole = 'driver' | 'kitchen' | 'dispatcher' | 'admin' | 'service';
export type OpsResourceKind =
  | 'order' | 'assignment' | 'trip' | 'stop' | 'driver' | 'gps'
  | 'notification' | 'hold' | 'worker';

export type OpsReasonCode =
  | 'UNASSIGNED_ORDER_AGE'
  | 'DUPLICATE_ASSIGNMENT_ATTEMPT'
  | 'DISPATCH_FAILURE'
  | 'STALE_OR_UNTRUSTED_GPS'
  | 'PUSH_ACK_OVERDUE'
  | 'HOLD_DEADLINE_OVERDUE'
  | 'QUEUE_BACKLOG'
  | 'DELIVERY_DEADLINE_RISK'
  | 'WORKER_HEARTBEAT_OVERDUE'
  | 'WRITER_LEASE_LOST'
  | 'APP_VERSION_ERROR_RATE';

export interface OpsEventInput {
  tenant_id: string;
  correlation_id?: string;
  event_type: string;
  severity: OpsSeverity;
  reason_code: string;
  resource_kind: OpsResourceKind;
  resource_id?: string | null;
  actor_role: OpsActorRole;
  actor_id?: string | null;
  occurred_at?: string;
  attributes?: Record<string, unknown>;
}

export interface OpsEvent {
  schema_version: typeof OPS_EVENT_VERSION;
  tenant_id: string;
  correlation_id: string;
  event_type: string;
  severity: OpsSeverity;
  reason_code: string;
  resource_kind: OpsResourceKind;
  resource_id_hash: string | null;
  actor_role: OpsActorRole;
  actor_id_hash: string | null;
  occurred_at: string;
  attributes: Record<string, unknown>;
}

export interface OpsThresholds {
  unassigned_order_age_seconds: number;
  stale_gps_seconds: number;
  push_ack_seconds: number;
  queue_backlog_count: number;
  worker_heartbeat_seconds: number;
  delivery_risk_seconds: number;
  app_error_rate: number;
}

export interface OpsSnapshot {
  now: string;
  oldest_unassigned_at?: string | null;
  duplicate_assignment_attempts?: number;
  dispatch_failures?: number;
  oldest_trusted_gps_at?: string | null;
  untrusted_gps_events?: number;
  oldest_unacked_push_at?: string | null;
  overdue_hold_count?: number;
  queue_backlog_count?: number;
  nearest_delivery_deadline_at?: string | null;
  worker_last_success_at?: string | null;
  app_errors?: number;
  app_requests?: number;
}

export interface OpsAlert {
  reason_code: OpsReasonCode;
  severity: OpsSeverity;
  observed: number;
  threshold: number;
  unit: 'seconds' | 'count' | 'ratio';
}

export interface ManualOverrideEvidence {
  actor_id: string;
  actor_role: 'dispatcher' | 'admin';
  reason_code: string;
  note: string;
  expected_version: number;
  action_id: string;
  correlation_id: string;
}

export interface TenantSafetyPolicy {
  tenant_id: string;
  dispatch_enabled: boolean;
  mutation_enabled: boolean;
  observability_enabled: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_CODE = /^[A-Z][A-Z0-9_.-]{2,80}$/;
const SENSITIVE_KEY = /(?:^|_)(?:address|adresse|lat|latitude|lng|lon|longitude|coordinate|coordinates|phone|telefon|email|name|note|token|secret|password|authorization|cookie|location|position)(?:$|_)/i;
const SAFE_STRING_KEY = /^(?:app_version|app_build|platform|app_state|permission_state|network_state|api_version|algorithm_version|provider|status|state|outcome|source|operation|component|method)$/i;
const MAX_ATTRIBUTE_DEPTH = 5;

function assertUuid(value: string, label: string): void {
  if (!UUID.test(value)) throw new Error(`${label}_INVALID`);
}

function hashOpaqueId(value: string | null | undefined): string | null {
  if (!value) return null;
  return createHash('sha256').update(value).digest('hex').slice(0, 20);
}

function redactValue(value: unknown, depth: number, key = ''): unknown {
  if (depth > MAX_ATTRIBUTE_DEPTH) return '[TRUNCATED]';
  if (Array.isArray(value)) return value.slice(0, 50).map((entry) => redactValue(entry, depth + 1, key));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 100).map(([key, entry]) => {
      const normalizedKey = key.replace(/([a-z0-9])([A-Z])/g, '$1_$2');
      return [key, SENSITIVE_KEY.test(normalizedKey) ? '[REDACTED]' : redactValue(entry, depth + 1, normalizedKey)];
    }));
  }
  if (typeof value === 'string') {
    if (!SAFE_STRING_KEY.test(key)) return '[REDACTED]';
    return value.length > 128 ? `${value.slice(0, 128)}[TRUNCATED]` : value;
  }
  return value;
}

export function redactOpsAttributes(attributes: Record<string, unknown> = {}): Record<string, unknown> {
  return redactValue(attributes, 0) as Record<string, unknown>;
}

export function createOpsEvent(input: OpsEventInput): OpsEvent {
  if (!input.tenant_id.trim()) throw new Error('TENANT_ID_REQUIRED');
  const correlationId = input.correlation_id ?? randomUUID();
  assertUuid(correlationId, 'CORRELATION_ID');
  if (!/^[a-z][a-z0-9_.-]{2,100}$/.test(input.event_type)) throw new Error('EVENT_TYPE_INVALID');
  if (!SAFE_CODE.test(input.reason_code)) throw new Error('REASON_CODE_INVALID');
  const occurredAt = input.occurred_at ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(occurredAt))) throw new Error('OCCURRED_AT_INVALID');
  return {
    schema_version: OPS_EVENT_VERSION,
    tenant_id: input.tenant_id,
    correlation_id: correlationId,
    event_type: input.event_type,
    severity: input.severity,
    reason_code: input.reason_code,
    resource_kind: input.resource_kind,
    resource_id_hash: hashOpaqueId(input.resource_id),
    actor_role: input.actor_role,
    actor_id_hash: hashOpaqueId(input.actor_id),
    occurred_at: occurredAt,
    attributes: redactOpsAttributes(input.attributes),
  };
}

function ageSeconds(nowMs: number, timestamp?: string | null): number | null {
  if (!timestamp) return null;
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor((nowMs - parsed) / 1000));
}

function addThresholdAlert(
  alerts: OpsAlert[], reason_code: OpsReasonCode, observed: number | null | undefined,
  threshold: number, unit: OpsAlert['unit'], severity: OpsSeverity = 'warning',
): void {
  if (observed != null && Number.isFinite(observed) && observed >= threshold) {
    alerts.push({ reason_code, severity, observed, threshold, unit });
  }
}

export function evaluateOpsAlerts(snapshot: OpsSnapshot, thresholds: OpsThresholds): OpsAlert[] {
  const nowMs = Date.parse(snapshot.now);
  if (!Number.isFinite(nowMs)) throw new Error('OPS_SNAPSHOT_NOW_INVALID');
  const positiveThresholds = [
    thresholds.unassigned_order_age_seconds, thresholds.stale_gps_seconds,
    thresholds.push_ack_seconds, thresholds.queue_backlog_count,
    thresholds.worker_heartbeat_seconds, thresholds.delivery_risk_seconds,
  ];
  if (positiveThresholds.some((value) => !Number.isFinite(value) || value <= 0)
      || !Number.isFinite(thresholds.app_error_rate)
      || thresholds.app_error_rate <= 0 || thresholds.app_error_rate > 1) {
    throw new Error('OPS_THRESHOLDS_INVALID');
  }
  const alerts: OpsAlert[] = [];
  addThresholdAlert(alerts, 'UNASSIGNED_ORDER_AGE',
    ageSeconds(nowMs, snapshot.oldest_unassigned_at), thresholds.unassigned_order_age_seconds, 'seconds');
  addThresholdAlert(alerts, 'DUPLICATE_ASSIGNMENT_ATTEMPT',
    snapshot.duplicate_assignment_attempts, 1, 'count', 'critical');
  addThresholdAlert(alerts, 'DISPATCH_FAILURE', snapshot.dispatch_failures, 1, 'count', 'critical');
  addThresholdAlert(alerts, 'STALE_OR_UNTRUSTED_GPS',
    ageSeconds(nowMs, snapshot.oldest_trusted_gps_at), thresholds.stale_gps_seconds, 'seconds');
  addThresholdAlert(alerts, 'STALE_OR_UNTRUSTED_GPS',
    snapshot.untrusted_gps_events, 1, 'count');
  addThresholdAlert(alerts, 'PUSH_ACK_OVERDUE',
    ageSeconds(nowMs, snapshot.oldest_unacked_push_at), thresholds.push_ack_seconds, 'seconds');
  addThresholdAlert(alerts, 'HOLD_DEADLINE_OVERDUE', snapshot.overdue_hold_count, 1, 'count', 'critical');
  addThresholdAlert(alerts, 'QUEUE_BACKLOG',
    snapshot.queue_backlog_count, thresholds.queue_backlog_count, 'count');
  const deadlineSeconds = snapshot.nearest_delivery_deadline_at
    ? Math.floor((Date.parse(snapshot.nearest_delivery_deadline_at) - nowMs) / 1000) : null;
  if (deadlineSeconds != null && Number.isFinite(deadlineSeconds)
      && deadlineSeconds <= thresholds.delivery_risk_seconds) {
    alerts.push({
      reason_code: 'DELIVERY_DEADLINE_RISK', severity: deadlineSeconds < 0 ? 'critical' : 'warning',
      observed: deadlineSeconds, threshold: thresholds.delivery_risk_seconds, unit: 'seconds',
    });
  }
  addThresholdAlert(alerts, 'WORKER_HEARTBEAT_OVERDUE',
    ageSeconds(nowMs, snapshot.worker_last_success_at), thresholds.worker_heartbeat_seconds, 'seconds', 'critical');
  const errorRate = snapshot.app_requests && snapshot.app_requests > 0
    ? (snapshot.app_errors ?? 0) / snapshot.app_requests : null;
  addThresholdAlert(alerts, 'APP_VERSION_ERROR_RATE', errorRate, thresholds.app_error_rate, 'ratio');
  return alerts;
}

export function validateManualOverrideEvidence(value: ManualOverrideEvidence): ManualOverrideEvidence {
  if (value.actor_role !== 'dispatcher' && value.actor_role !== 'admin') {
    throw new Error('OVERRIDE_ACTOR_FORBIDDEN');
  }
  assertUuid(value.actor_id, 'OVERRIDE_ACTOR_ID');
  assertUuid(value.action_id, 'OVERRIDE_ACTION_ID');
  assertUuid(value.correlation_id, 'OVERRIDE_CORRELATION_ID');
  if (!SAFE_CODE.test(value.reason_code)) throw new Error('OVERRIDE_REASON_REQUIRED');
  if (value.note.trim().length < 8 || value.note.length > 500) throw new Error('OVERRIDE_NOTE_INVALID');
  if (!Number.isSafeInteger(value.expected_version) || value.expected_version < 0) {
    throw new Error('OVERRIDE_EXPECTED_VERSION_INVALID');
  }
  return value;
}

export function assertTenantMutationEnabled(expectedTenantId: string, policy: TenantSafetyPolicy): void {
  if (!expectedTenantId.trim() || expectedTenantId !== policy.tenant_id) {
    throw new Error('TENANT_POLICY_SCOPE_MISMATCH');
  }
  if (!policy.dispatch_enabled) throw new Error('TENANT_DISPATCH_KILL_SWITCH_ACTIVE');
  if (!policy.mutation_enabled) throw new Error('TENANT_MUTATION_DEFAULT_OFF');
}

export function canReadOperationalResource(
  actor: { role: OpsActorRole; tenant_id: string; driver_id?: string },
  resource: { tenant_id: string; kind: OpsResourceKind; driver_id?: string },
): boolean {
  if (actor.tenant_id !== resource.tenant_id) return false;
  if (actor.role === 'admin' || actor.role === 'dispatcher' || actor.role === 'service') return true;
  if (actor.role === 'driver') return Boolean(actor.driver_id && actor.driver_id === resource.driver_id);
  return actor.role === 'kitchen' && ['order', 'trip', 'stop', 'hold'].includes(resource.kind);
}

export function retentionCutoff(now: string, retentionDays: number): string {
  const parsed = Date.parse(now);
  if (!Number.isFinite(parsed)) throw new Error('RETENTION_NOW_INVALID');
  if (!Number.isSafeInteger(retentionDays) || retentionDays < 1 || retentionDays > 365) {
    throw new Error('RETENTION_DAYS_INVALID');
  }
  return new Date(parsed - retentionDays * 86_400_000).toISOString();
}
