'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { AlertTriangle, Clock, Truck, ChefHat, TrendingDown, Bell, X } from 'lucide-react';

type Alarm = {
  id: string;
  level: 'critical' | 'warn';
  icon: React.ReactNode;
  title: string;
  detail: string;
};

type Order = {
  id: string;
  status: string;
  fertig_am: string | null;
  bestellt_am: string | null;
};

type BatchStop = {
  id: string;
  geliefert_am: string | null;
  angekommen_am: string | null;
};

function buildAlarms(orders: Order[], stops: BatchStop[]): Alarm[] {
  const now = Date.now();
  const alarms: Alarm[] = [];

  // Fertig orders waiting >12 min for pickup
  const longWaitFertig = orders.filter((o) => {
    if (o.status !== 'fertig' || !o.fertig_am) return false;
    return now - new Date(o.fertig_am).getTime() > 12 * 60_000;
  });
  if (longWaitFertig.length > 0) {
    const max = Math.max(
      ...longWaitFertig.map((o) => now - new Date(o.fertig_am!).getTime()),
    );
    alarms.push({
      id: 'fertig-wait',
      level: max > 20 * 60_000 ? 'critical' : 'warn',
      icon: <ChefHat className="h-4 w-4" />,
      title: `${longWaitFertig.length} Bestellung${longWaitFertig.length > 1 ? 'en' : ''} warten auf Abholung`,
      detail: `Längste Wartezeit: ${Math.floor(max / 60_000)} Min — Fahrer zuweisen!`,
    });
  }

  // Orders in_zubereitung >25 min (possible kitchen issue)
  const longKitchen = orders.filter((o) => {
    if (o.status !== 'in_zubereitung' || !o.bestellt_am) return false;
    return now - new Date(o.bestellt_am).getTime() > 25 * 60_000;
  });
  if (longKitchen.length > 0) {
    alarms.push({
      id: 'kitchen-slow',
      level: longKitchen.length > 2 ? 'critical' : 'warn',
      icon: <Clock className="h-4 w-4" />,
      title: `${longKitchen.length} Bestellung${longKitchen.length > 1 ? 'en' : ''} in Zubereitung >25 Min`,
      detail: 'Küche könnte überlastet sein — nachfragen!',
    });
  }

  // Stops arrived but not confirmed for >10 min
  const stuckStops = stops.filter((s) => {
    if (!s.angekommen_am || s.geliefert_am) return false;
    return now - new Date(s.angekommen_am).getTime() > 10 * 60_000;
  });
  if (stuckStops.length > 0) {
    alarms.push({
      id: 'stuck-stops',
      level: 'warn',
      icon: <Truck className="h-4 w-4" />,
      title: `${stuckStops.length} Stop${stuckStops.length > 1 ? 's' : ''} ohne Lieferbestätigung >10 Min`,
      detail: 'Fahrer kontaktieren — mögliches Problem vor Ort',
    });
  }

  return alarms.sort((a, b) => (a.level === 'critical' ? -1 : 1));
}

export function SchichtAlarmZentrale({ locationId }: { locationId: string | null }) {
  const supabase = createClient();
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!locationId) { setLoading(false); return; }

    const [{ data: orders }, { data: stops }] = await Promise.all([
      supabase
        .from('customer_orders')
        .select('id, status, fertig_am, bestellt_am')
        .eq('location_id', locationId)
        .in('status', ['fertig', 'in_zubereitung', 'unterwegs'])
        .gte('bestellt_am', new Date(Date.now() - 4 * 60 * 60_000).toISOString()),
      supabase
        .from('delivery_batch_stops')
        .select('id, geliefert_am, angekommen_am')
        .is('geliefert_am', null)
        .not('angekommen_am', 'is', null),
    ]);

    setAlarms(buildAlarms(orders ?? [], stops ?? []));
    setLoading(false);
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const visible = alarms.filter((a) => !dismissed.has(a.id));
  if (loading || visible.length === 0) return null;

  const critCount = visible.filter((a) => a.level === 'critical').length;

  return (
    <div className="rounded-xl border border-red-700/40 bg-red-950/70 overflow-hidden shadow-strong">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-red-700/40 bg-red-900/60">
        <Bell className="h-4 w-4 text-red-300 shrink-0 animate-pulse" />
        <span className="text-[11px] font-black uppercase tracking-widest text-red-200">
          Schicht-Alarme · {visible.length} aktiv
        </span>
        {critCount > 0 && (
          <span className="ml-auto rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-white">
            {critCount} Kritisch
          </span>
        )}
      </div>

      {/* Alarm list */}
      <div className="divide-y divide-red-800/30">
        {visible.map((alarm) => (
          <div
            key={alarm.id}
            className={cn(
              'flex items-start gap-3 px-4 py-3',
              alarm.level === 'critical' ? 'bg-red-950/60' : 'bg-orange-950/40',
            )}
          >
            <div className={cn(
              'shrink-0 mt-0.5',
              alarm.level === 'critical' ? 'text-red-400' : 'text-amber-400',
            )}>
              {alarm.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className={cn(
                'text-sm font-bold',
                alarm.level === 'critical' ? 'text-red-200' : 'text-amber-200',
              )}>
                {alarm.title}
              </div>
              <div className="text-[11px] text-red-400/80 mt-0.5">
                {alarm.detail}
              </div>
            </div>
            <button
              onClick={() => setDismissed((d) => new Set([...d, alarm.id]))}
              className="shrink-0 text-red-600 hover:text-red-300 mt-0.5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
