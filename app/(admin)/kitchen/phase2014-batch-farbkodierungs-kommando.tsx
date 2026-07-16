'use client';

import { useMemo, useState, useEffect } from 'react';
import { Layers, AlertTriangle, CheckCircle2, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderItem {
  name?: string;
  quantity?: number;
}

interface Order {
  id: string;
  bestellnummer?: string | null;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  items: OrderItem[];
}

interface LaneOrder {
  id: string;
  bestellnummer: string;
  warteMin: number;
  itemCount: number;
}

interface Lane {
  key: 'rot' | 'amber' | 'gruen';
  label: string;
  beschreibung: string;
  orders: LaneOrder[];
}

const LANE_STYLE: Record<string, { header: string; badge: string; row: string; icon: React.ReactNode }> = {
  rot:   {
    header: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800',
    badge:  'bg-red-500 text-white',
    row:    'hover:bg-red-50 dark:hover:bg-red-950/50',
    icon:   null,
  },
  amber: {
    header: 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800',
    badge:  'bg-amber-500 text-white',
    row:    'hover:bg-amber-50 dark:hover:bg-amber-950/50',
    icon:   null,
  },
  gruen: {
    header: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800',
    badge:  'bg-green-500 text-white',
    row:    'hover:bg-green-50 dark:hover:bg-green-950/50',
    icon:   null,
  },
};

function laneFor(warteMin: number): 'rot' | 'amber' | 'gruen' {
  if (warteMin > 20) return 'rot';
  if (warteMin > 10) return 'amber';
  return 'gruen';
}

export function KitchenPhase2014BatchFarbkodierungsKommando({
  orders,
}: {
  orders: Order[];
}) {
  const [offen, setOffen] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const lanes = useMemo((): Lane[] => {
    const now = Date.now();
    const relevant = orders.filter(
      (o) =>
        o.status === 'neu' ||
        o.status === 'bestätigt' ||
        o.status === 'in_zubereitung',
    );

    const mapped: LaneOrder[] = relevant
      .map((o) => {
        const startMs = o.bestellt_am ? new Date(o.bestellt_am).getTime() : now;
        const warteMin = Math.round((now - startMs) / 60_000);
        const itemCount = o.items.reduce((acc, item) => acc + (item.quantity ?? 1), 0);
        return {
          id: o.id,
          bestellnummer: o.bestellnummer ?? o.id.slice(0, 6).toUpperCase(),
          warteMin,
          itemCount,
        };
      })
      .sort((a, b) => b.warteMin - a.warteMin);

    const rot: LaneOrder[] = mapped.filter((o) => laneFor(o.warteMin) === 'rot');
    const amber: LaneOrder[] = mapped.filter((o) => laneFor(o.warteMin) === 'amber');
    const gruen: LaneOrder[] = mapped.filter((o) => laneFor(o.warteMin) === 'gruen');

    return [
      { key: 'rot',   label: 'ROT — Dringend',   beschreibung: '>20 Min Wartezeit', orders: rot },
      { key: 'amber', label: 'AMBER — Bald',      beschreibung: '10–20 Min',         orders: amber },
      { key: 'gruen', label: 'GRÜN — OK',          beschreibung: '< 10 Min',          orders: gruen },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, tick]);

  const total = lanes.reduce((acc, l) => acc + l.orders.length, 0);

  if (!total) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-500" />
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">
            Batch-Farbkodierungs-Kommando
          </span>
          <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full font-mono">
            {total} Bestellungen
          </span>
        </div>
        {offen ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {offen && (
        <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-3 space-y-3">
          {lanes.map((lane) => {
            const s = LANE_STYLE[lane.key];
            return (
              <div
                key={lane.key}
                className={cn('rounded-lg border overflow-hidden', s.header)}
              >
                <div className={cn('flex items-center justify-between px-3 py-2', s.header)}>
                  <div className="flex items-center gap-2">
                    {lane.key === 'rot' && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                    {lane.key === 'amber' && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                    {lane.key === 'gruen' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{lane.label}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">{lane.beschreibung}</span>
                  </div>
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', s.badge)}>
                    {lane.orders.length}
                  </span>
                </div>

                {lane.orders.length > 0 && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {lane.orders.map((o) => (
                      <div
                        key={o.id}
                        className={cn('flex items-center justify-between px-3 py-1.5 text-xs transition-colors bg-white dark:bg-slate-800', s.row)}
                      >
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                          #{o.bestellnummer}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {o.itemCount} Artikel
                        </span>
                        <span className="tabular-nums text-slate-500 dark:text-slate-400">
                          {o.warteMin} Min
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {lane.orders.length === 0 && (
                  <p className="px-3 py-2 text-[10px] text-slate-400 italic bg-white dark:bg-slate-800">
                    Keine Bestellungen
                  </p>
                )}
              </div>
            );
          })}
          <p className="text-[9px] text-slate-400 text-right pt-1">Live-Update alle 30 Sek · sortiert nach Wartezeit</p>
        </div>
      )}
    </div>
  );
}
