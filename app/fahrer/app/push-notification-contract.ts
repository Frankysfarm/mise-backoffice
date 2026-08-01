export const PUSH_PENDING_KEY = 'mise_pending_driver_notifications_v2';
export const PUSH_PROCESSED_KEY = 'mise_processed_driver_notifications_v2';
export const MAX_PROCESSED_NOTIFICATION_IDS = 256;

export type DriverPushNotification = {
  notificationId: string;
  assignmentId: string;
  assignmentVersion: number;
  expiresAt: string | null;
};

export function parseDriverPushNotification(value: unknown): DriverPushNotification | null {
  if (!value || typeof value !== 'object') return null;
  const outer = value as Record<string, unknown>;
  const nested = outer.data && typeof outer.data === 'object'
    ? outer.data as Record<string, unknown>
    : {};
  const source = { ...outer, ...nested };
  const notificationId = source.notification_id;
  const assignmentId = source.assignment_id ?? source.batch_id;
  const assignmentVersion = Number(source.assignment_version);
  const expiresAt = source.expires_at ?? source.lease_expires_at ?? null;
  if (typeof notificationId !== 'string' || notificationId.length < 8) return null;
  if (typeof assignmentId !== 'string' || assignmentId.length < 8) return null;
  if (!Number.isSafeInteger(assignmentVersion) || assignmentVersion < 1) return null;
  if (expiresAt !== null && (typeof expiresAt !== 'string' || !Number.isFinite(Date.parse(expiresAt)))) return null;
  return { notificationId, assignmentId, assignmentVersion, expiresAt };
}

export function isDriverPushExpired(notification: DriverPushNotification, nowMs = Date.now()): boolean {
  return notification.expiresAt !== null && Date.parse(notification.expiresAt) <= nowMs;
}

export function readNotificationIds(storage: Pick<Storage, 'getItem'>, key: string): string[] {
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

export function rememberProcessedNotification(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  notificationId: string,
): void {
  const ids = readNotificationIds(storage, PUSH_PROCESSED_KEY)
    .filter((id) => id !== notificationId);
  ids.push(notificationId);
  storage.setItem(PUSH_PROCESSED_KEY, JSON.stringify(ids.slice(-MAX_PROCESSED_NOTIFICATION_IDS)));
}
