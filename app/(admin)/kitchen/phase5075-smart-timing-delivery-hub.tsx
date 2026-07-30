'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Clock, Zap, TrendingUp, AlertCircle, CheckCircle2, Bike } from 'lucide-react';

interface OrderTiming {
  id: string;
  bestellnummer?: string | null;
  status: string;
  bestellt_am?: string | null;
  zubereitung_start?: string | null;
  estimated_prep_min?: number | null;
  fahrer_eta_min?: number | null;
  items?: Array<{ name?: string; menge?: number }>;
}

interface Props {
  locationId: string | null;
}

type ColorLevel = 'ok' | 'warn' | 'critical' | 'done';

function getColorLevel(restMinutes: number, driverEta: number | null): ColorLevel {
  if (restMinutes <= 0) return 'done';
  if (driverEta !== null && restMinutes > driverEta + 3) return 'ok';
  if (restMinutes <= 3) return 'critical';
  if (restMinutes <= 8) return 'warn';
  return 'ok';
}

const COLOR_CLASSES: Record<ColorLevel, { bg: string; text: string; border: string; label: string }> = {
  ok: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Gut' },
  warn: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', label: 'Bald fertig' },
  critical: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', label: 'Kritisch' },
  done: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30', label: 'Fertig' },
};

function useNow(interval = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(iv);
  }, [interval]);
  return now;
}

export function KitchenPhase5075SmartTimingDeliveryHub({ locationId }: Props) {
  const now = useNow();
  const [orders, setOrders] = useState<OrderTiming[]>([]);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }

    async function load() {
      try {
        const res = await fetch(`/api/delivery/kitchen/queue?location_id=${locationId}`);
        if (res.ok) {
          const data = await res.json();
          setOrders(data.orders ?? data ?? []);
        } else {
          // Mock-Daten als Fallback
          setOrders(MOCK_ORDERS);
        }
      } catch {
        setOrders(MOCK_ORDERS);
      } finally {
        setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [locationId]);

  // Berechne Score: Wie viele Bestellungen sind rechtzeitig fertig?
  useEffect(() => {
    const active = orders.filter(o => ['in_zubereitung', 'neu', 'bestätigt'].includes(o.status));
    if (!active.length) { setScore(100); return; }
    const ok = active.filter(o => {
      const start = o.zubereitung_start ? new Date(o.zubereitung_start).getTime() : null;
      const prepMin = o.estimated_prep_min ?? 15;
      if (!start) return true;
      const elapsed = (now - start) / 60_000;
      return elapsed < prepMin;
    });
    setScore(Math.round((ok.length / active.length) * 100));
  }, [orders, now]);

  const active = orders.filter(o => ['in_zubereitung', 'neu', 'bestätigt'].includes(o.status));
  const critical = active.filter(o => {
    const start = o.zubereitung_start ? new Date(o.zubereitung_start).getTime() : null;
    if (!start) return false;
    const elapsed = (now - start) / 60_000;
    const prepMin = o.estimated_prep_min ?? 15;
    return elapsed >= prepMin - 3;
  });

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-4 animate-pulse">
        <div className="h-4 w-48 bg-slate-700/50 rounded mb-3" />
        <div className="grid grid-cols-3 gap-2">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-700/30 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700/40 bg-slate-900/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/40 bg-slate-800/40">
        <div className="flex items-center gap-2">
          <ChefHat className="h-4 w-4 text-indigo-400" />
          <span className="text-sm font-semibold text-slate-200">Smart Timing Hub</span>
          <span className="text-xs text-slate-500">· Echtzeit-Kochzustand</span>
        </div>
        <div className="flex items-center gap-3">
          <div className={cn('flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full',
            score >= 80 ? 'bg-emerald-500/20 text-emerald-400' :
            score >= 60 ? 'bg-amber-500/20 text-amber-400' :
            'bg-red-500/20 text-red-400'
          )}>
            <TrendingUp className="h-3 w-3" />
            Score {score}
          </div>
        </div>
      </div>

      {/* KPI-Strip */}
      <div className="grid grid-cols-3 gap-px bg-slate-700/20">
        <div className="bg-slate-800/40 px-3 py-2.5">
          <p className="text-xs text-slate-500 mb-0.5">Aktiv</p>
          <p className="text-xl font-bold text-slate-200">{active.length}</p>
        </div>
        <div className="bg-slate-800/40 px-3 py-2.5">
          <p className="text-xs text-slate-500 mb-0.5">Kritisch</p>
          <p className={cn('text-xl font-bold', critical.length > 0 ? 'text-red-400' : 'text-slate-200')}>
            {critical.length}
          </p>
        </div>
        <div className="bg-slate-800/40 px-3 py-2.5">
          <p className="text-xs text-slate-500 mb-0.5">Fertig heute</p>
          <p className="text-xl font-bold text-slate-200">
            {orders.filter(o => o.status === 'fertig').length}
          </p>
        </div>
      </div>

      {/* Bestellungen */}
      <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
        {active.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-6 text-slate-500 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Keine aktiven Bestellungen
          </div>
        )}
        {active.map(order => {
          const start = order.zubereitung_start ? new Date(order.zubereitung_start).getTime() : null;
          const prepMin = order.estimated_prep_min ?? 15;
          const elapsed = start ? (now - start) / 60_000 : 0;
          const restMin = Math.max(0, prepMin - elapsed);
          const progress = start ? Math.min(100, (elapsed / prepMin) * 100) : 0;
          const level = getColorLevel(restMin, order.fahrer_eta_min ?? null);
          const colors = COLOR_CLASSES[level];

          return (
            <div
              key={order.id}
              className={cn(
                'rounded-lg border p-3 transition-all',
                colors.bg, colors.border
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs font-mono font-bold', colors.text)}>
                    #{order.bestellnummer ?? order.id.slice(-4)}
                  </span>
                  <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', colors.bg, colors.text)}>
                    {colors.label}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {order.fahrer_eta_min !== null && order.fahrer_eta_min !== undefined && (
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <Bike className="h-3 w-3" />
                      <span>Fahrer: {Math.round(order.fahrer_eta_min)}min</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Clock className={cn('h-3 w-3', colors.text)} />
                    <span className={cn('text-sm font-bold tabular-nums', colors.text)}>
                      {restMin <= 0 ? (
                        <span className="flex items-center gap-1">
                          <Zap className="h-3 w-3" />Fertig!
                        </span>
                      ) : (
                        `${Math.floor(restMin)}:${String(Math.round((restMin % 1) * 60)).padStart(2, '0')}`
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Fortschrittsbalken */}
              <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500',
                    level === 'critical' ? 'bg-red-400' :
                    level === 'warn' ? 'bg-amber-400' :
                    level === 'done' ? 'bg-slate-500' :
                    'bg-emerald-400'
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Synchronisierungs-Hinweis */}
              {order.fahrer_eta_min !== null && order.fahrer_eta_min !== undefined && restMin > 0 && (
                <div className="mt-1.5 text-xs text-slate-500">
                  {restMin > (order.fahrer_eta_min + 3) ? (
                    <span className="text-amber-500/80">⚠ Fahrer kommt früher — Kochstart optimieren</span>
                  ) : Math.abs(restMin - order.fahrer_eta_min) <= 3 ? (
                    <span className="text-emerald-500/80">✓ Timing synchron mit Fahrer</span>
                  ) : (
                    <span className="text-blue-400/80">↑ Fertig bevor Fahrer da — gut</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {critical.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border-t border-red-500/20">
          <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
          <span className="text-xs text-red-300">
            {critical.length} Bestellung{critical.length > 1 ? 'en' : ''} überfällig — sofort handeln!
          </span>
        </div>
      )}
    </div>
  );
}

// Mock-Daten für Fallback
const MOCK_ORDERS: OrderTiming[] = [
  {
    id: 'mock-1',
    bestellnummer: '1042',
    status: 'in_zubereitung',
    bestellt_am: new Date(Date.now() - 8 * 60_000).toISOString(),
    zubereitung_start: new Date(Date.now() - 7 * 60_000).toISOString(),
    estimated_prep_min: 15,
    fahrer_eta_min: 6,
  },
  {
    id: 'mock-2',
    bestellnummer: '1043',
    status: 'in_zubereitung',
    bestellt_am: new Date(Date.now() - 4 * 60_000).toISOString(),
    zubereitung_start: new Date(Date.now() - 3 * 60_000).toISOString(),
    estimated_prep_min: 12,
    fahrer_eta_min: 10,
  },
  {
    id: 'mock-3',
    bestellnummer: '1044',
    status: 'neu',
    bestellt_am: new Date(Date.now() - 1 * 60_000).toISOString(),
    estimated_prep_min: 15,
    fahrer_eta_min: null,
  },
];
