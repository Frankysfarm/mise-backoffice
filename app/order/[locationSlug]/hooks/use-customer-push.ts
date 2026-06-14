'use client';

import { useCallback, useEffect, useState } from 'react';

type PushState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported' | 'subscribed';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function useCustomerPush(params: {
  locationId: string;
  orderId?:   string;
  email?:     string;
}) {
  const [state, setState] = useState<PushState>('idle');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
    } else if (Notification.permission === 'granted') {
      setState('granted');
    } else if (Notification.permission === 'denied') {
      setState('denied');
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
      return;
    }

    setState('requesting');
    try {
      const keyRes = await fetch('/api/delivery/push/customer/vapid-key');
      if (!keyRes.ok) { setState('denied'); return; }
      const { publicKey } = await keyRes.json() as { publicKey: string };

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const subJson = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };

      await fetch('/api/delivery/push/customer/subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          locationId:  params.locationId,
          subscription: { endpoint: subJson.endpoint, keys: subJson.keys },
          email:       params.email,
          orderId:     params.orderId,
          lang:        navigator.language?.slice(0, 2) ?? 'de',
        }),
      });

      setState('subscribed');
    } catch {
      setState(Notification.permission === 'denied' ? 'denied' : 'idle');
    }
  }, [params.locationId, params.orderId, params.email]);

  const unsubscribe = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;
      await fetch('/api/delivery/push/customer/subscribe', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
      setState('idle');
    } catch {}
  }, []);

  return { state, subscribe, unsubscribe };
}
