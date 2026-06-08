'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

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

    try {
      PN.addListener?.('registration', async (t: { value?: string }) => {
        beacon('registration', { len: t?.value?.length ?? 0, head: (t?.value ?? '').slice(0, 10) });
        try {
          const sb = createClient();
          const { data } = await sb.auth.getSession();
          const token = data?.session?.access_token;
          if (token && t?.value) {
            const r = await fetch('/api/driver/v1/me/push-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ expo_push_token: t.value, push_enabled: true }),
            });
            beacon('token-posted', { ok: r.ok, status: r.status });
          } else {
            beacon('token-post-skip', { hasSession: !!token, hasToken: !!t?.value });
          }
        } catch (e) { beacon('token-post-error', String((e as Error)?.message ?? e)); }
      });
      PN.addListener?.('registrationError', (e: unknown) => beacon('registrationError', String((e as any)?.error ?? JSON.stringify(e))));
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
  }, []);

  return null;
}
