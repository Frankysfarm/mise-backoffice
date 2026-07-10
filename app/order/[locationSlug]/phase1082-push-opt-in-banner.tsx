'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, X, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1082 — Bestellstatus-Push-Opt-In-Banner (Storefront)
 *
 * Banner für Browser-Push-Benachrichtigungen bei Statusänderungen.
 * Zeigt sich wenn eine aktive Bestellung vorhanden und Push nicht bereits erteilt.
 */

const ACTIVE_STATUSES = new Set([
  'confirmed', 'angenommen', 'in_preparation', 'zubereitung', 'bereit', 'ready',
  'dispatched', 'en_route', 'unterwegs', 'picked_up',
]);

interface Props {
  orderId?: string | null;
  status?: string | null;
}

type PushState = 'idle' | 'granted' | 'denied' | 'loading' | 'unsupported';

export function Phase1082PushOptInBanner({ orderId, status }: Props) {
  const [pushState, setPushState] = useState<PushState>('idle');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPushState('unsupported');
      return;
    }
    if (Notification.permission === 'granted') setPushState('granted');
    else if (Notification.permission === 'denied') setPushState('denied');
    else setPushState('idle');
  }, []);

  const requestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setPushState('loading');
    try {
      const perm = await Notification.requestPermission();
      setPushState(perm === 'granted' ? 'granted' : 'denied');
      if (perm === 'granted') {
        new Notification('Bestellbenachrichtigungen aktiviert!', {
          body: 'Du erhältst jetzt Updates zu deiner Bestellung.',
          icon: '/icon-192.png',
        });
      }
    } catch {
      setPushState('denied');
    }
  };

  const isActive = orderId && status && ACTIVE_STATUSES.has(status);

  if (!isActive) return null;
  if (dismissed) return null;
  if (pushState === 'unsupported') return null;
  if (pushState === 'denied') return null;

  if (pushState === 'granted') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-green-300 bg-green-50 dark:bg-green-900/20 px-4 py-2.5 text-sm text-green-800 dark:text-green-300">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
        <span className="font-medium">Push-Benachrichtigungen aktiv</span>
        <span className="text-xs text-green-600">— du wirst bei Statusänderungen benachrichtigt</span>
      </div>
    );
  }

  return (
    <div className={cn(
      'relative flex items-start gap-3 rounded-xl border px-4 py-3 shadow-sm',
      'border-blue-300 bg-blue-50 dark:bg-blue-900/20',
    )}>
      <Bell className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
          Bleib informiert über deine Lieferung
        </p>
        <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
          Erhalte sofortige Benachrichtigungen wenn deine Bestellung abgeholt wird oder unterwegs ist.
        </p>
        <button
          onClick={requestPermission}
          disabled={pushState === 'loading'}
          className={cn(
            'mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition',
            'bg-blue-600 text-white hover:bg-blue-700 active:scale-95',
            pushState === 'loading' && 'opacity-70 cursor-not-allowed',
          )}
        >
          {pushState === 'loading' ? (
            <>
              <span className="h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin inline-block" />
              Wird aktiviert…
            </>
          ) : (
            <>
              <Bell className="h-3 w-3" />
              Benachrichtigungen aktivieren
            </>
          )}
        </button>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-lg p-1 text-blue-400 hover:bg-blue-100 hover:text-blue-600 transition"
        aria-label="Schließen"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
