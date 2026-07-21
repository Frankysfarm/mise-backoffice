'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Bike, CheckCircle2, Flame, Timer } from 'lucide-react';


function calcColor(remainSec: number | null): 'green' | 'yellow' | 'red' | 'critical' {
  if (remainSec === null) return 'green';
  if (remainSec > 300) return 'green';
  if (remainSec > 60) return 'yellow';
  if (remainSec > 0) return 'red';
  return 'critical';
}

const colorMap = {
  green:    { bg: 'bg-matcha-50',   border: 'border-matcha-200',  text: 'text-matcha-700',  badge: 'bg-matcha-100 text-matcha-700' },
  yellow:   { bg: 'bg-amber-50',    border: 'border-amber-300',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700' },
  red:      { bg: 'bg-rose-50',     border: 'border-rose-400',    text: 'text-rose-700',    badge: 'bg-rose-100 text-rose-700' },
  critical: { bg: 'bg-red-900',     border: 'border-red-600',     text: 'text-red-100',     badge: 'bg-red-700 text-red-100' },
};

function fmtMmSs(sec: number) {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60).toString().padStart(2, '0');
  const s = (abs % 60).toString().padStart(2, '0');
  return (sec < 0 ? '-' : '') + `${m}:${s}`;
}

export function KitchenPhase2870SmartTimingFahrerEtaCockpit({
  orders,
  timings,
  drivers,
  batches,
  stops,
}: {
  orders: Array<{ id: string; bestellnummer: string; kunde_name: string; status: string }>;
  timings: Array<{ id: string; order_id: string; cook_start_at: string | null; ready_target: string | null; prep_min: number | null; status: string }>;
  drivers: Array<{ id: string; vorname: string; nachname: string; status?: any }>;
  batches: Array<{ id: string; driver_id: string; status: string; started_at: string | null; total_eta_min: number | null }>;
  stops: Array<{ id: string; batch_id: string; order_id: string; reihenfolge: number; geliefert_am: string | null }>;
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();

  const activeOrders = orders.filter(o => ['neu', 'bestätigt', 'in_zubereitung', 'fertig'].includes(o.status));

  const rows: Array<{
    id: string;
    bestellnummer: string;
    name: string;
    status: string;
    remainSec: number | null;
    progressPct: number;
    color: 'green' | 'yellow' | 'red' | 'critical';
    driverName: string | null;
    driverEtaSec: number | null;
    delta: number | null;
  }> = activeOrders.map(o => {
    const timing = timings.find(t => t.order_id === o.id);
    let remainSec: number | null = null;
    let progressPct = 0;

    if (timing?.ready_target) {
      const readyMs = new Date(timing.ready_target).getTime();
      remainSec = Math.round((readyMs - now) / 1000);
      if (timing.cook_start_at && timing.prep_min) {
        const totalMs = timing.prep_min * 60_000;
        const elapsedMs = now - new Date(timing.cook_start_at).getTime();
        progressPct = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
      }
    }

    // Driver ETA
    let driverName: string | null = null;
    let driverEtaSec: number | null = null;

    const stop = stops.find(s => s.order_id === o.id && !s.geliefert_am);
    if (stop) {
      const batch = batches.find(b => b.id === stop.batch_id && (b.status === 'unterwegs' || b.status === 'on_route' || b.status === 'assigned' || b.status === 'pickup'));
      if (batch) {
        const driver = drivers.find(d => d.id === batch.driver_id);
        if (driver) driverName = `${driver.vorname} ${driver.nachname}`.trim();
        if (batch.started_at && batch.total_eta_min != null) {
          const etaMs = new Date(batch.started_at).getTime() + batch.total_eta_min * 60_000;
          driverEtaSec = Math.round((etaMs - now) / 1000);
        }
      }
    }

    const delta = remainSec !== null && driverEtaSec !== null ? driverEtaSec - remainSec : null;
    const color = calcColor(remainSec);

    return { id: o.id, bestellnummer: o.bestellnummer, name: o.kunde_name, status: o.status, remainSec, progressPct, color, driverName, driverEtaSec, delta };
  }).sort((a, b) => {
    // Kritisch zuerst
    const order = { critical: 0, red: 1, yellow: 2, green: 3 };
    return order[a.color] - order[b.color];
  });

  if (rows.length === 0) return null;

  const overdueCount = rows.filter(r => r.remainSec !== null && r.remainSec < 0).length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-gradient-to-r from-stone-50 to-white">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-matcha-100">
            <Timer className="h-3.5 w-3.5 text-matcha-700" />
          </div>
          <div>
            <div className="text-xs font-black tracking-wide uppercase text-char">Smart-Timing · Fahrer-ETA-Sync</div>
            <div className="text-[10px] text-stone-400">{rows.length} aktive Bestellungen</div>
          </div>
        </div>
        {overdueCount > 0 && (
          <div className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5">
            <AlertTriangle className="h-3 w-3 text-red-600" />
            <span className="text-[10px] font-bold text-red-600">{overdueCount} überfällig</span>
          </div>
        )}
      </div>

      <div className="divide-y divide-stone-100">
        {rows.slice(0, 8).map(r => {
          const c = colorMap[r.color];
          return (
            <div key={r.id} className={cn('px-4 py-2.5 transition-colors', c.bg, r.color === 'critical' && 'animate-pulse')}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-black text-stone-400">#{r.bestellnummer}</span>
                    <span className={cn('text-[10px] font-semibold truncate', c.text)}>{r.name}</span>
                    {r.status === 'fertig' && (
                      <span className="flex items-center gap-0.5 rounded-full bg-matcha-100 px-1.5 py-0.5">
                        <CheckCircle2 className="h-2.5 w-2.5 text-matcha-600" />
                        <span className="text-[9px] font-bold text-matcha-700">Fertig</span>
                      </span>
                    )}
                    {r.status === 'in_zubereitung' && (
                      <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5">
                        <Flame className="h-2.5 w-2.5 text-amber-600" />
                        <span className="text-[9px] font-bold text-amber-700">Kocht</span>
                      </span>
                    )}
                  </div>

                  {r.progressPct > 0 && (
                    <div className="mt-1 h-1 w-full rounded-full bg-stone-200 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', r.color === 'green' ? 'bg-matcha-500' : r.color === 'yellow' ? 'bg-amber-500' : 'bg-rose-500')}
                        style={{ width: `${r.progressPct}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {r.driverName && (
                    <div className="text-right">
                      <div className="flex items-center gap-0.5 justify-end">
                        <Bike className="h-2.5 w-2.5 text-stone-400" />
                        <span className="text-[9px] text-stone-500 truncate max-w-[60px]">{r.driverName.split(' ')[0]}</span>
                      </div>
                      {r.driverEtaSec !== null && (
                        <div className="text-[10px] font-semibold text-stone-500">
                          ETA {fmtMmSs(r.driverEtaSec)}
                        </div>
                      )}
                      {r.delta !== null && (
                        <div className={cn('text-[9px] font-bold', r.delta > 60 ? 'text-rose-600' : 'text-matcha-600')}>
                          {r.delta > 0 ? '+' : ''}{Math.round(r.delta / 60)}m Δ
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-right">
                    <div className={cn('text-base font-black tabular-nums leading-none', c.text)}>
                      {r.remainSec !== null ? fmtMmSs(r.remainSec) : '—'}
                    </div>
                    <div className={cn('text-[9px] font-semibold', c.text)}>
                      {r.remainSec === null ? 'kein Timing' : r.remainSec < 0 ? 'überfällig' : 'verbleibend'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {rows.length > 8 && (
        <div className="px-4 py-2 text-center text-[10px] text-stone-400 border-t border-stone-100">
          +{rows.length - 8} weitere
        </div>
      )}
    </div>
  );
}
