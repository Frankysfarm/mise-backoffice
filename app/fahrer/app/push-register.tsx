'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Registriert das native APNs-Push-Token (Capacitor) beim Server.
 * - Laeuft NUR in der nativen App mit installiertem PushNotifications-Plugin.
 * - Im Browser / ohne Plugin: no-op (window.Capacitor.Plugins.PushNotifications fehlt).
 * - Token (rohes 64-Hex APNs-Token) geht an /api/driver/v1/me/push-token,
 *   push-flush erkennt es und sendet echte APNs-Alerts (laute Wiederhol-Hinweise).
 */
export function PushRegister() {
  useEffect(() => {
    const Cap = (window as unknown as { Capacitor?: any }).Capacitor;
    const PN = Cap?.Plugins?.PushNotifications;
    if (!Cap?.isNativePlatform?.() || !PN) return;

    let regHandle: { remove?: () => void } | null = null;

    (async () => {
      try {
        const perm = await PN.requestPermissions();
        if (perm?.receive !== 'granted') return;
        await PN.register();
      } catch {
        /* noop */
      }
    })();

    try {
      const maybe = PN.addListener('registration', async (t: { value: string }) => {
        try {
          const sb = createClient();
          const { data } = await sb.auth.getSession();
          const token = data?.session?.access_token;
          if (!token || !t?.value) return;
          await fetch('/api/driver/v1/me/push-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ expo_push_token: t.value, push_enabled: true }),
          });
        } catch {
          /* noop */
        }
      });
      // addListener kann Promise<Handle> oder Handle sein
      if (maybe && typeof maybe.then === 'function') {
        maybe.then((h: { remove?: () => void }) => { regHandle = h; });
      } else {
        regHandle = maybe;
      }
    } catch {
      /* noop */
    }

    return () => {
      try { regHandle?.remove?.(); } catch { /* noop */ }
    };
  }, []);

  return null;
}
