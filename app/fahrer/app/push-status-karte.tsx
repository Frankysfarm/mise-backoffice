'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, CheckCircle2, Clock, Package, Truck, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PushEvent {
  type: 'picked_up' | 'driver_departing' | 'delivered' | 'almost_there';
  sentAt: string;
  delivered: boolean;
}

interface Props {
  orderId: string;
  orderStatus: string;
  fahrerId?: string | null;
}

const EVENT_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  picked_up:        { label: 'Abgeholt gemeldet',       icon: Package, color: 'text-blue-600' },
  driver_departing: { label: 'Fahrer startet',          icon: Truck,   color: 'text-orange-600' },
  almost_there:     { label: 'Fast angekommen',         icon: Bell,    color: 'text-amber-600' },
  delivered:        { label: 'Zugestellt bestätigt',    icon: ShoppingBag, color: 'text-green-600' },
};

export function FahrerPushStatusKarte({ orderId, orderStatus }: Props) {
  const [pushEvents, setPushEvents] = useState<PushEvent[]>([]);
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // Check push permission
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPushEnabled(false);
      return;
    }
    setPushEnabled(Notification.permission === 'granted');
  }, []);

  // Poll push log für diese Bestellung
  useEffect(() => {
    if (!orderId) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/push?orderId=${orderId}`, { cache: 'no-store' });
        if (res.ok) {
          const body = await res.json() as { events?: PushEvent[] };
          setPushEvents(body.events ?? []);
        }
      } catch {}
      finally { setLoading(false); }
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [orderId]);

  async function requestPermission() {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPushEnabled(result === 'granted');
  }

  const isActive = !['geliefert', 'storniert', 'abgebrochen'].includes(orderStatus);

  if (loading) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {pushEnabled === false ? (
            <BellOff size={14} className="text-gray-400" />
          ) : (
            <Bell size={14} className="text-matcha-600" />
          )}
          <span className="text-xs font-semibold text-gray-700">Push-Benachrichtigungen</span>
        </div>
        <span className={cn(
          'text-xs px-1.5 py-0.5 rounded-full font-medium',
          pushEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
        )}>
          {pushEnabled ? 'Aktiv' : 'Inaktiv'}
        </span>
      </div>

      {pushEnabled === false && isActive && (
        <button
          onClick={() => void requestPermission()}
          className="w-full text-xs bg-matcha-600 text-white rounded-lg py-1.5 px-3 font-medium hover:bg-matcha-700 transition-colors mb-2"
        >
          Push-Benachrichtigungen aktivieren
        </button>
      )}

      {pushEvents.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-gray-500 font-medium">Versendete Nachrichten</p>
          {pushEvents.slice(-3).reverse().map((ev, i) => {
            const meta = EVENT_META[ev.type];
            if (!meta) return null;
            const Icon = meta.icon;
            const time = new Date(ev.sentAt);
            const timeStr = time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            return (
              <div key={i} className="flex items-center gap-2">
                <Icon size={11} className={cn('shrink-0', meta.color)} />
                <span className="text-xs text-gray-600 flex-1 truncate">{meta.label}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {ev.delivered ? (
                    <CheckCircle2 size={10} className="text-green-500" />
                  ) : (
                    <Clock size={10} className="text-gray-300" />
                  )}
                  <span className="text-[10px] text-gray-400 font-mono">{timeStr}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pushEvents.length === 0 && isActive && (
        <p className="text-xs text-gray-400 text-center py-1">
          Noch keine Push-Nachrichten für diese Tour
        </p>
      )}
    </div>
  );
}
