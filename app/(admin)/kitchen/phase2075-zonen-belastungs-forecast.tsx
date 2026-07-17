'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { BarChart2, ChevronDown, ChevronUp, AlertTriangle, Package } from 'lucide-react';
import { useState } from 'react';

interface Order {
  id: string;
  delivery_zone?: string | null;
  status?: string;
  scheduled_for?: string | null;
  created_at?: string;
}

interface Props {
  orders: Order[];
}

interface ZoneForecast {
  zone: string;
  current: number;
  nextHour: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  batch_empfehlung: boolean;
}

const AMPEL_THRESHOLDS = { gelb: 4, rot: 7 };
const BATCH_MIN = 3;

const AMPEL_STYLE = {
  gruen: { tile: 'border-green-200 bg-green-50',   label: 'Normal',  bar: 'bg-green-500',  text: 'text-green-700' },
  gelb:  { tile: 'border-amber-200 bg-amber-50',   label: 'Erhöht',  bar: 'bg-amber-400',  text: 'text-amber-700' },
  rot:   { tile: 'border-red-200   bg-red-50',     label: 'Peak',    bar: 'bg-red-500',    text: 'text-red-700'   },
};

export function KitchenPhase2075ZonenBelastungsForecast({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const { forecasts, totalAlert } = useMemo(() => {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const ZONES = ['A', 'B', 'C', 'D'];

    const active = orders.filter(o =>
      o.status === 'pending' || o.status === 'confirmed' || o.status === 'preparing'
    );

    const current = new Map<string, number>();
    const nextHourMap = new Map<string, number>();

    for (const o of active) {
      const zone = (o.delivery_zone ?? 'A').toUpperCase();
      current.set(zone, (current.get(zone) ?? 0) + 1);

      const ts = o.scheduled_for
        ? new Date(o.scheduled_for).getTime()
        : o.created_at
          ? new Date(o.created_at).getTime() + 30 * 60 * 1000
          : now + 30 * 60 * 1000;

      if (ts >= now && ts <= now + oneHour) {
        nextHourMap.set(zone, (nextHourMap.get(zone) ?? 0) + 1);
      }
    }

    const forecasts: ZoneForecast[] = ZONES.map(zone => {
      const cur = current.get(zone) ?? 0;
      const next = nextHourMap.get(zone) ?? Math.round(cur * 0.8);
      const ampel: 'gruen' | 'gelb' | 'rot' =
        next >= AMPEL_THRESHOLDS.rot ? 'rot' :
        next >= AMPEL_THRESHOLDS.gelb ? 'gelb' :
        'gruen';
      return {
        zone,
        current: cur,
        nextHour: next,
        ampel,
        batch_empfehlung: next >= BATCH_MIN,
      };
    }).filter(z => z.current > 0 || z.nextHour > 0);

    return {
      forecasts,
      totalAlert: forecasts.filter(z => z.ampel === 'rot').length,
    };
  }, [orders]);

  if (forecasts.length === 0) return null;

  const maxOrders = Math.max(...forecasts.map(z => z.nextHour), 1);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
          <BarChart2 className="h-4 w-4 text-blue-500 shrink-0" />
          Zonen-Belastungs-Forecast
          <span className="text-muted-foreground font-normal normal-case tracking-normal">nächste Stunde</span>
          {totalAlert > 0 && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] bg-red-100 text-red-700 border border-red-200">
              <AlertTriangle className="w-3 h-3" />
              {totalAlert} Peak
            </span>
          )}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 py-3 space-y-3">
          {/* Alert banner */}
          {totalAlert > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700">
                Peak-Aufkommen in {forecasts.filter(z => z.ampel === 'rot').map(z => `Zone ${z.zone}`).join(', ')}.
                Jetzt Batch-Bündelung vorbereiten!
              </p>
            </div>
          )}

          {/* Zone bars */}
          <div className="space-y-2">
            {forecasts.sort((a, b) => b.nextHour - a.nextHour).map(z => {
              const s = AMPEL_STYLE[z.ampel];
              const barPct = Math.min((z.nextHour / maxOrders) * 100, 100);
              return (
                <div key={z.zone} className={cn('rounded-lg border p-3 space-y-2', s.tile)}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black">Zone {z.zone}</span>
                    <div className="flex items-center gap-2">
                      {z.batch_empfehlung && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-blue-100 text-blue-700 border border-blue-200 font-bold">
                          <Package className="w-2.5 h-2.5" />
                          Batch!
                        </span>
                      )}
                      <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-bold', s.text, 'bg-white/60 border')}>{s.label}</span>
                    </div>
                  </div>

                  {/* Bar */}
                  <div className="space-y-1">
                    <div className="h-2 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', s.bar)}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Jetzt: <strong>{z.current}</strong> aktiv</span>
                      <span>Prognose +1h: <strong className={s.text}>{z.nextHour}</strong> Aufträge</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legende */}
          <div className="flex items-center gap-3 pt-1 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" />Normal (&lt;{AMPEL_THRESHOLDS.gelb})</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400" />Erhöht (&lt;{AMPEL_THRESHOLDS.rot})</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" />Peak (≥{AMPEL_THRESHOLDS.rot})</div>
            <div className="flex items-center gap-1 ml-auto text-blue-600"><Package className="w-3 h-3" />= Batch-Empfehlung</div>
          </div>
        </div>
      )}
    </div>
  );
}
