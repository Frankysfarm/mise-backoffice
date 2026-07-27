'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { snapshotThenTechnicalAck } from './push-reconcile';

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

    if (!Cap?.isNativePlatform?.()) { beacon('abort', 'not-native'); return; }
    const PN = Cap.Plugins?.PushNotifications;
    if (!PN) { beacon('abort', 'no-PN-plugin'); return; }
    const pendingAckKey = 'mise_pending_notification_acks_v1';
    const readPendingAcks = (): string[] => {
      try {
        const value = JSON.parse(localStorage.getItem(pendingAckKey) ?? '[]');
        return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
      } catch {
        return [];
      }
    };
    const savePendingAcks = (ids: string[]) => localStorage.setItem(pendingAckKey, JSON.stringify([...new Set(ids)]));
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
    const reconcileAndAck = async (notificationId: string) => {
      savePendingAcks([...readPendingAcks(), notificationId]);
      let accessToken = '';
      await snapshotThenTechnicalAck(notificationId, async () => {
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
      savePendingAcks(readPendingAcks().filter((id) => id !== notificationId));
    };
    const notificationId = (event: unknown): string | null => {
      const record = event as { notification?: { data?: Record<string, unknown> }; data?: Record<string, unknown> };
      const value = record?.notification?.data?.notification_id ?? record?.data?.notification_id;
      return typeof value === 'string' ? value : null;
    };
    const listenerHandles: Array<{ remove?: () => Promise<void> | void }> = [];
    let disposed = false;

    try {
      PN.addListener?.('registration', async (t: { value?: string }) => {
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
      PN.addListener?.('registrationError', (e: unknown) => beacon('registrationError', String((e as any)?.error ?? JSON.stringify(e))));
      for (const eventName of ['pushNotificationReceived', 'pushNotificationActionPerformed']) {
        const handle = PN.addListener?.(eventName, (event: unknown) => {
          const id = notificationId(event);
          if (!id) return;
          reconcileAndAck(id).catch((error) => beacon('snapshot-ack-error', String((error as Error).message)));
        });
        if (handle) {
          Promise.resolve(handle).then(async (resolved) => {
            if (disposed) await resolved.remove?.();
            else listenerHandles.push(resolved);
          })
            .catch((error) => beacon('listener-add-error', String(error)));
        }
      }
      for (const id of readPendingAcks()) {
        reconcileAndAck(id).catch((error) => beacon('pending-snapshot-ack-error', String((error as Error).message)));
      }
      reconcileSnapshot().catch((error) => beacon('startup-snapshot-error', String((error as Error).message)));
    } catch (e) { beacon('listener-error', String((e as Error)?.message ?? e)); }

    (async () => {
      try {
        const perm = await PN.requestPermissions();
        beacon('permission', perm);
        if (perm?.receive === 'granted') {
          await PN.register();
          beacon('register-called', 'ok');
        }
      } catch (e) { beacon('register-error', String((e as Error)?.message ?? e)); }
    })();

    try { Cap.Plugins?.Geolocation?.requestPermissions?.(); } catch { /* noop */ }

    // Access-Token nativ verfuegbar machen (fuer CallKit-Annehmen -> accept-tour)
    const storeToken = async () => {
      try {
        const Pref = Cap.Plugins?.Preferences;
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
      const Pref = Cap.Plugins?.Preferences;
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
      for (const handle of listenerHandles) {
        Promise.resolve(handle.remove?.()).catch((error) => beacon('listener-remove-error', String(error)));
      }
    };
  }, []);

  return null;
}
