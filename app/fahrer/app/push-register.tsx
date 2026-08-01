'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { snapshotThenTechnicalAck } from './push-reconcile';
import {
  PUSH_PENDING_KEY,
  PUSH_PROCESSED_KEY,
  isDriverPushExpired,
  parseDriverPushNotification,
  readNotificationIds,
  rememberProcessedNotification,
  type DriverPushNotification,
} from './push-notification-contract';

function beacon(stage: string, data: unknown) {
  try {
    fetch('/api/driver/v1/push-debug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage, data }),
      keepalive: true,
    });
  } catch { /* noop */ }
}

export function PushRegister() {
  useEffect(() => {
    const Cap = (window as unknown as { Capacitor?: any }).Capacitor;
    beacon('init', {
      hasCapacitor: !!Cap,
      isNative: Cap?.isNativePlatform?.() ?? null,
      platform: Cap?.getPlatform?.() ?? null,
      hasPlugins: !!Cap?.Plugins,
      pluginKeys: Cap?.Plugins ? Object.keys(Cap.Plugins) : [],
      hasPN: !!Cap?.Plugins?.PushNotifications,
    });

    const PN = Cap?.Plugins?.PushNotifications;
    // V1 contained notification IDs without assignment/version and is unsafe to
    // replay. Drop it once; only the complete V2 envelope is retryable.
    const legacyPendingAckKey = 'mise_pending_notification_acks_v1';
    localStorage.removeItem(legacyPendingAckKey);
    const readPendingNotifications = (): DriverPushNotification[] => {
      try {
        const value = JSON.parse(localStorage.getItem(PUSH_PENDING_KEY) ?? '[]');
        return Array.isArray(value)
          ? value.map(parseDriverPushNotification).filter((item): item is DriverPushNotification => item !== null)
          : [];
      } catch {
        return [];
      }
    };
    const savePendingNotifications = (items: DriverPushNotification[]) => {
      const unique = new Map(items.map((item) => [item.notificationId, {
        notification_id: item.notificationId,
        assignment_id: item.assignmentId,
        assignment_version: item.assignmentVersion,
        expires_at: item.expiresAt,
      }]));
      localStorage.setItem(PUSH_PENDING_KEY, JSON.stringify([...unique.values()]));
    };
    const reconcileSnapshot = async (): Promise<string> => {
      const sbc = createClient();
      const { data, error } = await sbc.auth.getSession();
      if (error || !data.session?.access_token) throw new Error('PUSH_ACK_SESSION_UNAVAILABLE');
      const headers = { Authorization: `Bearer ${data.session.access_token}` };
      const snapshotResponse = await fetch('/api/driver/v2/snapshot', { headers, credentials: 'include' });
      if (!snapshotResponse.ok) throw new Error(`PUSH_SNAPSHOT_FAILED:${snapshotResponse.status}`);
      const snapshot = await snapshotResponse.json();
      sessionStorage.setItem('mise_driver_snapshot_v2', JSON.stringify(snapshot));
      window.dispatchEvent(new CustomEvent('mise:driver-snapshot-reconciled', { detail: snapshot }));
      return data.session.access_token;
    };
    const reconcileAndAck = async (notification: DriverPushNotification) => {
      if (isDriverPushExpired(notification)) {
        savePendingNotifications(readPendingNotifications().filter((item) => item.notificationId !== notification.notificationId));
        rememberProcessedNotification(localStorage, notification.notificationId);
        return;
      }
      if (readNotificationIds(localStorage, PUSH_PROCESSED_KEY).includes(notification.notificationId)) return;
      savePendingNotifications([...readPendingNotifications(), notification]);
      let accessToken = '';
      await snapshotThenTechnicalAck(notification.notificationId, async () => {
        accessToken = await reconcileSnapshot();
      }, async (id) => {
        const actionKeyStorage = `mise_notification_ack_action:${id}`;
        let ackActionId = localStorage.getItem(actionKeyStorage);
        if (!ackActionId) {
          ackActionId = crypto.randomUUID();
          localStorage.setItem(actionKeyStorage, ackActionId);
        }
        const ackResponse = await fetch('/api/driver/v2/notifications/ack', {
          method: 'POST', credentials: 'include',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ notification_id: id, action_id: ackActionId }),
        });
        if (!ackResponse.ok) throw new Error(`PUSH_TECHNICAL_ACK_FAILED:${ackResponse.status}`);
      });
      rememberProcessedNotification(localStorage, notification.notificationId);
      savePendingNotifications(readPendingNotifications().filter((item) => item.notificationId !== notification.notificationId));
      navigator.serviceWorker?.controller?.postMessage({
        type: 'DRIVER_PUSH_ACKED', notification_id: notification.notificationId,
      });
    };
    const notificationFromNativeEvent = (event: unknown): DriverPushNotification | null => {
      const record = event as { notification?: { data?: Record<string, unknown> }; data?: Record<string, unknown> };
      return parseDriverPushNotification(record?.notification?.data ?? record?.data);
    };
    const listenerHandles: Array<{ remove?: () => Promise<void> | void }> = [];
    const inFlightNotificationIds = new Set<string>();
    let disposed = false;

    const processNotification = (notification: DriverPushNotification | null, stage: string) => {
      if (!notification) { beacon(`${stage}-invalid-contract`, {}); return; }
      if (inFlightNotificationIds.has(notification.notificationId)) return;
      inFlightNotificationIds.add(notification.notificationId);
      reconcileAndAck(notification).catch((error) =>
        beacon(`${stage}-snapshot-ack-error`, String((error as Error).message)))
        .finally(() => inFlightNotificationIds.delete(notification.notificationId));
    };
    const onServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'DRIVER_PUSH_RECEIVED') return;
      processNotification(parseDriverPushNotification(event.data.payload), 'web-push');
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onServiceWorkerMessage);
      navigator.serviceWorker.ready.then((registration) => {
        registration.active?.postMessage({ type: 'DRAIN_DRIVER_PUSHES' });
      }).catch((error) => beacon('web-push-drain-error', String(error)));
    }
    for (const notification of readPendingNotifications()) {
      processNotification(notification, 'pending');
    }
    reconcileSnapshot().catch((error) => beacon('startup-snapshot-error', String((error as Error).message)));

    if (PN) try {
      PN?.addListener?.('registration', async (t: { value?: string }) => {
        beacon('registration', { len: t?.value?.length ?? 0, head: (t?.value ?? '').slice(0, 10) });
        try {
          if (t?.value) {
            let bearer: string | undefined;
            try {
              const sbc = createClient();
              const { data } = await sbc.auth.getSession();
              bearer = data?.session?.access_token;
            } catch { /* noop */ }
            const r = await fetch('/api/driver/v1/me/push-token-save', {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
                ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
              },
              body: JSON.stringify({ expo_push_token: t.value }),
            });
            beacon('token-posted', { ok: r.ok, status: r.status });
          }
        } catch (e) { beacon('token-post-error', String((e as Error)?.message ?? e)); }
      });
      PN?.addListener?.('registrationError', (e: unknown) => beacon('registrationError', String((e as any)?.error ?? JSON.stringify(e))));
      for (const eventName of ['pushNotificationReceived', 'pushNotificationActionPerformed']) {
        const handle = PN?.addListener?.(eventName, (event: unknown) => {
          processNotification(notificationFromNativeEvent(event), 'native-push');
        });
        if (handle) {
          Promise.resolve(handle).then(async (resolved) => {
            if (disposed) await resolved.remove?.();
            else listenerHandles.push(resolved);
          })
            .catch((error) => beacon('listener-add-error', String(error)));
        }
      }
    } catch (e) { beacon('listener-error', String((e as Error)?.message ?? e)); }

    if (PN) (async () => {
      try {
        const perm = await PN.requestPermissions();
        beacon('permission', perm);
        if (perm?.receive === 'granted') {
          await PN.register();
          beacon('register-called', 'ok');
        }
      } catch (e) { beacon('register-error', String((e as Error)?.message ?? e)); }
    })();

    try { Cap?.Plugins?.Geolocation?.requestPermissions?.(); } catch { /* noop */ }

    // Access-Token nativ verfuegbar machen (fuer CallKit-Annehmen -> accept-tour)
    const storeToken = async () => {
      try {
        const Pref = Cap?.Plugins?.Preferences;
        if (!Pref) return;
        const sb = createClient();
        const { data } = await sb.auth.getSession();
        const tk = data?.session?.access_token;
        if (tk) await Pref.set({ key: 'mise_access_token', value: tk });
      } catch { /* noop */ }
    };
    storeToken();
    const tokIv = setInterval(storeToken, 60_000);

    // VoIP-Token (nativ via PushKit in Preferences) -> Server (CallKit/Uber-Anruf)
    (async () => {
      const Pref = Cap?.Plugins?.Preferences;
      if (!Pref) return;
      for (let i = 0; i < 12; i++) {
        try {
          const { value } = await Pref.get({ key: 'mise_voip_token' });
          if (value && String(value).length >= 10) {
            const sb = createClient();
            const { data } = await sb.auth.getSession();
            const tk = data?.session?.access_token;
            if (tk) {
              const r = await fetch('/api/driver/v1/me/voip-token-save', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
                body: JSON.stringify({ voip_push_token: value }),
              });
              beacon('voip-posted', { ok: r.ok, status: r.status });
            }
            return;
          }
        } catch { /* noop */ }
        await new Promise((r) => setTimeout(r, 1500));
      }
      beacon('voip-no-token', {});
    })();
    return () => {
      disposed = true;
      clearInterval(tokIv);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onServiceWorkerMessage);
      }
      for (const handle of listenerHandles) {
        Promise.resolve(handle.remove?.()).catch((error) => beacon('listener-remove-error', String(error)));
      }
    };
  }, []);

  return null;
}
