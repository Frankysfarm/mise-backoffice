'use client';

/**
 * SmartDeliveryTimingWall
 * Neue Komponente für das Smart Delivery System.
 * Zeigt Echtzeit-Countdown mit Farbkodierung (grün/gelb/rot) für jede Bestellung.
 * Integriert Küchen-Timing, Fahrer-ETA und SLA-Status.
 */

import { useEffect, useState, useCallback } from 'react';
import { Clock, Flame, CheckCircle2, AlertTriangle, ChefHat, Bike, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimingOrder {
  id: string;
  bestellnummer: string;
  kunde_name: string;
  status: 'bestätigt' | 'in_zubereitung' | 'fertig' | string;
  bestellt_am: string;
  geschaetzte_zubereitung_min: number;
  items_count?: number;
  driver_eta_min?: number;
}

function useTimingOrders(locationId: string | null) {
  const [orders, setOrders] = useState<TimingOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) {
      // Mock-Daten für Demo
      setOrders([
        { id: '1', bestellnummer: '#1042', kunde_name: 'Müller, T.', status: 'in_zubereitung', bestellt_am: new Date(Date.now() - 8 * 60_000).toISOString(), geschaetzte_zubereitung_min: 15, items_count: 3 },
        { id: '2', bestellnummer: '#1043', kunde_name: 'Schmidt, A.', status: 'bestätigt', bestellt_am: new Date(Date.now() - 3 * 60_000).toISOString(), geschaetzte_zubereitung_min: 20, items_count: 2 },
        { id: '3', bestellnummer: '#1044', kunde_name: 'Weber, K.', status: 'in_zubereitung', bestellt_am: new Date(Date.now() - 22 * 60_000).toISOString(), geschaetzte_zubereitung_min: 18, items_count: 4, driver_eta_min: 5 },
        { id: '4', bestellnummer: '#1045', kunde_name: 'Fischer, M.', status: 'fertig', bestellt_am: new Date(Date.now() - 25 * 60_000).toISOString(), geschaetzte_zubereitung_min: 20, items_count: 1 },
        { id: '5', bestellnummer: '#1046', kunde_name: 'Becker, L.', status: 'bestätigt', bestellt_am: new Date(Date.now() - 1 * 60_000).toISOString(), geschaetzte_zubereitung_min: 25, items_count: 5 },
      ]);
      setLoading(false);
      return;
    }
    try {
      const r = await fetch(`/api/delivery/kitchen?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setOrders(await r.json());
    } catch {}
    setLoading(false);
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [load]);

  return { orders, loading };
}

function getElapsedMin(bestellt_am: string): number {
  return Math.floor((Date.now() - new Date(bestellt_am).getTime()) / 60_000);
}

function getTimingStatus(elapsed: number, zielMin: number): 'ok' | 'warn' | 'critical' | 'done' {
  if (elapsed < zielMin * 0.6) return 'ok';
  if (elapsed < zielMin * 0.85) return 'warn';
  if (elapsed < zielMin * 1.1) return 'warn';
  return 'critical';
}

function CountdownRing({ elapsed, target, status }: { elapsed: number; target: number; status: string }) {
  const pct = Math.min(1, elapsed / target);
  const radius = 20;
  const circ = 2 * Math.PI * radius;
  const dash = circ * (1 - pct);

  const colors = {
    ok: { stroke: '#22c55e', text: 'text-green-600' },
    warn: { stroke: '#f59e0b', text: 'text-amber-600' },
    critical: { stroke: '#ef4444', text: 'text-red-600' },
    done: { stroke: '#3b82f6', text: 'text-blue-600' },
  };
  const c = colors[status as keyof typeof colors] ?? colors.ok;
  const remaining = Math.max(0, target - elapsed);

  return (
    <div className="relative flex items-center justify-center w-14 h-14">
      <svg width="56" height="56" className="rotate-[-90deg]">
        <circle cx="28" cy="28" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <circle
          cx="28" cy="28" r={radius} fill="none"
          stroke={c.stroke} strokeWidth="4"
          strokeDasharray={circ}
          strokeDashoffset={dash}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <span className={cn('absolute text-xs font-black tabular-nums', c.text)}>
        {remaining > 0 ? `${remaining}m` : `+${elapsed - target}m`}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    bestätigt: { label: 'Neu', cls: 'bg-blue-100 text-blue-700 border-blue-200', icon: <Clock className="w-3 h-3" /> },
    in_zubereitung: { label: 'Kochend', cls: 'bg-amber-100 text-amber-700 border-amber-200', icon: <Flame className="w-3 h-3" /> },
    fertig: { label: 'Fertig', cls: 'bg-green-100 text-green-700 border-green-200', icon: <CheckCircle2 className="w-3 h-3" /> },
  };
  const s = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-700 border-gray-200', icon: <ChefHat className="w-3 h-3" /> };
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border', s.cls)}>
      {s.icon}{s.label}
    </span>
  );
}

export function SmartDeliveryTimingWall({ locationId }: { locationId?: string | null }) {
  const [now, setNow] = useState(Date.now());
  const { orders, loading } = useTimingOrders(locationId ?? null);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(iv);
  }, []);

  const activeOrders = orders.filter(o => o.status !== 'storniert');
  const overdue = activeOrders.filter(o => {
    const elapsed = Math.floor((now - new Date(o.bestellt_am).getTime()) / 60_000);
    return elapsed > o.geschaetzte_zubereitung_min && o.status !== 'fertig';
  });

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 animate-pulse">
        <div className="h-6 bg-stone-100 rounded w-48 mb-3" />
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-stone-50 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-gradient-to-r from-matcha-50 to-white">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-matcha-500 flex items-center justify-center">
            <Timer className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-stone-800">Smart Timing Wall</div>
            <div className="text-[10px] text-stone-500">{activeOrders.length} aktive Bestellungen</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {overdue.length > 0 && (
            <div className="flex items-center gap-1 bg-red-50 border border-red-200 px-2 py-1 rounded-lg animate-pulse">
              <AlertTriangle className="w-3 h-3 text-red-500" />
              <span className="text-xs font-bold text-red-700">{overdue.length} überfällig</span>
            </div>
          )}
          <div className="text-[10px] text-stone-400 font-mono">
            {new Date(now).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Order Grid */}
      <div className="p-3 space-y-2">
        {activeOrders.length === 0 && (
          <div className="text-center py-6 text-stone-400 text-sm">
            <ChefHat className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Keine aktiven Bestellungen
          </div>
        )}

        {activeOrders.slice(0, 8).map(order => {
          const elapsed = Math.floor((now - new Date(order.bestellt_am).getTime()) / 60_000);
          const timingStatus = order.status === 'fertig' ? 'done' : getTimingStatus(elapsed, order.geschaetzte_zubereitung_min);

          const rowColors = {
            ok: 'border-green-100 bg-green-50/30',
            warn: 'border-amber-100 bg-amber-50/30',
            critical: 'border-red-200 bg-red-50/40',
            done: 'border-blue-100 bg-blue-50/20',
          };

          return (
            <div
              key={order.id}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl border transition-all',
                rowColors[timingStatus],
                timingStatus === 'critical' && 'animate-[pulse_2s_ease-in-out_infinite]',
              )}
            >
              {/* Countdown Ring */}
              <CountdownRing elapsed={elapsed} target={order.geschaetzte_zubereitung_min} status={timingStatus} />

              {/* Order Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-black text-stone-800">{order.bestellnummer}</span>
                  <StatusBadge status={order.status} />
                  {order.items_count && (
                    <span className="text-[10px] text-stone-400">{order.items_count} Artikel</span>
                  )}
                </div>
                <div className="text-xs text-stone-600 truncate">{order.kunde_name}</div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[10px] text-stone-400 tabular-nums flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {elapsed}m / {order.geschaetzte_zubereitung_min}m
                  </span>
                  {order.driver_eta_min && (
                    <span className="text-[10px] text-blue-600 font-medium flex items-center gap-0.5">
                      <Bike className="w-2.5 h-2.5" />
                      Fahrer in {order.driver_eta_min}m
                    </span>
                  )}
                </div>
              </div>

              {/* SLA Indicator */}
              <div className={cn(
                'w-2 h-10 rounded-full shrink-0',
                timingStatus === 'ok' && 'bg-green-400',
                timingStatus === 'warn' && 'bg-amber-400',
                timingStatus === 'critical' && 'bg-red-500',
                timingStatus === 'done' && 'bg-blue-400',
              )} />
            </div>
          );
        })}
      </div>

      {/* Summary Footer */}
      <div className="border-t border-stone-100 px-4 py-2 bg-stone-50 flex items-center justify-between">
        <div className="flex items-center gap-4 text-[10px]">
          <span className="flex items-center gap-1 text-green-700">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            {activeOrders.filter(o => {
              const e = Math.floor((now - new Date(o.bestellt_am).getTime()) / 60_000);
              return getTimingStatus(e, o.geschaetzte_zubereitung_min) === 'ok';
            }).length} im Plan
          </span>
          <span className="flex items-center gap-1 text-amber-700">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            {activeOrders.filter(o => {
              const e = Math.floor((now - new Date(o.bestellt_am).getTime()) / 60_000);
              return getTimingStatus(e, o.geschaetzte_zubereitung_min) === 'warn';
            }).length} knapp
          </span>
          <span className="flex items-center gap-1 text-red-700">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            {overdue.length} überfällig
          </span>
        </div>
        <span className="text-[10px] text-stone-400">Smart Timing · mise</span>
      </div>
    </div>
  );
}
