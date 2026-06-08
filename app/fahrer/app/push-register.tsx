'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Fragt beim App-Start automatisch die NATIVEN iOS-Berechtigungen ab
 * (System-Dialoge fuer Standort + Mitteilungen) und registriert das
 * APNs-Push-Token beim Server.
 *
 * - Laeuft NUR in der nativen App (Capacitor). Im Browser: no-op.
 * - Loest die echten weissen Apple-Popups aus (nicht die app-eigene Seite).
 */
export function PushRegister() {
  useEffect(() => {
    const Cap = (window as unknown as { Capacitor?: any }).Capacitor;
    if (!Cap?.isNativePlatform?.()) return;

    let regHandle: { remove?: () => void } | null = null;

    (async () => {
      // 1) Standort nativ anfragen (iOS-System-Dialog)
      try {
        const Geo = Cap.Plugins?.Geolocation;
        if (Geo?.requestPermissions) await Geo.requestPermissions();
      } catch {
        /* noop */
      }
      // 2) Mitteilungen nativ anfragen (iOS-System-Dialog) + registrieren
      try {
        const PN = Cap.Plugins?.PushNotifications;
        if (PN) {
          const perm = await PN.requestPermissions();
          if (perm?.receive === 'granted') await PN.register();
        }
      } catch {
        /* noop */
      }
    })();

    // Token-Listener: rohes APNs-Token -> Server
    try {
      const PN = Cap.Plugins?.PushNotifications;
      if (PN?.addListener) {
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
        if (maybe && typeof maybe.then === 'function') maybe.then((h: { remove?: () => void }) => { regHandle = h; });
        else regHandle = maybe;
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
