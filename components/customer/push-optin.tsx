'use client';

import { useState, useEffect } from 'react';
import { Bell, BellRing, Check, X, Loader2, Share, Plus as PlusIcon } from 'lucide-react';

type Props = {
  orderId: string;
  tenantId: string;
  telefon?: string;
  email?: string;
};

export function PushOptInCard({ orderId, tenantId, telefon, email }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'granted' | 'denied' | 'unsupported' | 'dismissed' | 'ios-install'>('idle');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // iOS Safari: Push funktioniert nur als installierte PWA (iOS 16.4+)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;

    if (isIOS && !isStandalone) {
      setState('ios-install');
      return;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
    }
  }, []);

  async function enable() {
    setState('loading');
    try {
      if (Notification.permission === 'denied') {
        setState('denied');
        return;
      }

      // VAPID-Public-Key vom Server holen
      const keyRes = await fetch('/api/push/subscribe');
      const { publicKey } = await keyRes.json();
      if (!publicKey) {
        setState('unsupported');
        return;
      }

      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setState('denied');
        return;
      }

      const reg = await navigator.serviceWorker.register('/sw-customer.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const subJson = subscription.toJSON();

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          tenant_id: tenantId,
          telefon, email,
          subscription: {
            endpoint: subJson.endpoint,
            keys: { p256dh: subJson.keys?.p256dh, auth: subJson.keys?.auth },
          },
        }),
      });

      if (!res.ok) {
        setState('idle');
        return;
      }

      setState('granted');
    } catch (e) {
      console.error(e);
      setState('idle');
    }
  }

  if (state === 'dismissed') return null;

  if (state === 'granted') {
    return (
      <div className="rounded-2xl bg-matcha-50 border-2 border-matcha-500 p-4 text-center">
        <div className="h-10 w-10 rounded-full bg-matcha-900 text-matcha-50 flex items-center justify-center mx-auto mb-2">
          <Check className="h-5 w-5" />
        </div>
        <div className="font-display font-bold text-matcha-900">Benachrichtigungen aktiv</div>
        <p className="text-sm text-matcha-800 mt-1">Wir halten dich per Push auf dem Laufenden.</p>
      </div>
    );
  }

  if (state === 'denied') {
    return (
      <div className="rounded-2xl bg-muted/50 border p-4">
        <div className="text-sm text-muted-foreground">
          Benachrichtigungen sind in deinem Browser blockiert. Kannst du in den Einstellungen wieder aktivieren.
        </div>
      </div>
    );
  }

  if (state === 'unsupported') {
    return null; // still weggeben
  }

  if (state === 'ios-install') {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-matcha-50 to-gold/20 border-2 border-matcha-300 p-5 relative">
        <button
          onClick={() => setState('dismissed')}
          className="absolute top-3 right-3 h-7 w-7 rounded-full hover:bg-black/5 flex items-center justify-center text-muted-foreground"
          aria-label="Schließen"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3 mb-3">
          <div className="h-11 w-11 rounded-2xl bg-matcha-900 text-matcha-50 flex items-center justify-center shrink-0">
            <BellRing className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-lg font-bold">Push auf iPhone aktivieren</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Apple erlaubt Push nur für zum Home-Bildschirm gespeicherte Seiten. Einmal installieren, dann alles automatisch.
            </p>
          </div>
        </div>

        <ol className="mt-3 space-y-2 text-sm bg-white/60 rounded-xl p-4 border border-matcha-200">
          <li className="flex items-start gap-2">
            <span className="font-mono font-bold text-matcha-800 shrink-0">1.</span>
            <span className="flex items-center gap-1">
              Tippe unten in Safari auf <Share className="inline h-3.5 w-3.5" /> <strong>Teilen</strong>
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-mono font-bold text-matcha-800 shrink-0">2.</span>
            <span className="flex items-center gap-1">
              Wähle <PlusIcon className="inline h-3.5 w-3.5" /> <strong>Zum Home-Bildschirm</strong>
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-mono font-bold text-matcha-800 shrink-0">3.</span>
            <span>Öffne diese Seite vom Home-Bildschirm — der „Ja, benachrichtigen"-Button erscheint automatisch.</span>
          </li>
        </ol>

        <div className="mt-3 text-xs text-muted-foreground">
          Android · Desktop: funktioniert direkt ohne Installation.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-matcha-50 to-gold/20 border-2 border-matcha-300 p-5 relative">
      <button
        onClick={() => setState('dismissed')}
        className="absolute top-3 right-3 h-7 w-7 rounded-full hover:bg-black/5 flex items-center justify-center text-muted-foreground"
        aria-label="Schließen"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-2xl bg-matcha-900 text-matcha-50 flex items-center justify-center shrink-0">
          <BellRing className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-display text-xl font-bold leading-tight">
            Bestätige — damit du immer weißt,<br />wo deine Bestellung ist
          </h3>
          <p className="text-sm text-muted-foreground mt-2 mb-4">
            Wir sagen dir Bescheid, sobald dein Essen in der Küche ist, fertig wird und zu dir unterwegs ist.
            Plus gelegentlich unsere besten Angebote.
          </p>

          <button
            onClick={enable}
            disabled={state === 'loading'}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-matcha-900 text-matcha-50 font-display font-bold text-base hover:bg-matcha-800 disabled:opacity-60 shadow-sm"
          >
            {state === 'loading' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Bell className="h-5 w-5" />}
            {state === 'loading' ? 'Einen Moment…' : 'Ja, bestätigen'}
          </button>

          <div className="mt-3 text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>✓ Status-Updates</span>
            <span>✓ neue Angebote</span>
            <span>✓ kein Spam</span>
            <span>✓ jederzeit stoppbar</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = typeof window !== 'undefined' ? window.atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf;
}
