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
    return () => clearInterval(tokIv);
  }, []);

  return null;
}
