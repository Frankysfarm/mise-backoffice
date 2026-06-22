'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, AlertTriangle, Package, CheckCircle2 } from 'lucide-react';

type ReadyOrder = {
  id: string;
  bestellnummer: string;
  kunde_name: string;
  fertig_am: string | null;
  delivery_zone?: string | null;
};

type WaitLevel = 'ok' | 'warn' | 'critical';

function getWaitLevel(fertigAm: string | null): WaitLevel {
  if (!fertigAm) return 'ok';
  const ms = Date.now() - new Date(fertigAm).getTime();
  if (ms > 10 * 60_000) return 'critical';
  if (ms > 5 * 60_000) return 'warn';
  return 'ok';
}

function formatWait(fertigAm: string | null, now: number): string {
  if (!fertigAm) return '—';
  const ms = now - new Date(fertigAm).getTime();
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function DispatchFertigWarteStrip({ orders }: { orders: ReadyOrder[] }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(iv);
  }, []);

  const fertig = orders.filter((o) => o.fertig_am);
  if (fertig.length === 0) return null;

  const maxWaitMs = Math.max(
    ...fertig.map((o) => (o.fertig_am ? now - new Date(o.fertig_am).getTime() : 0)),
  );
  const criticalCount = fertig.filter((o) => getWaitLevel(o.fertig_am) === 'critical').length;
  const maxWaitMin = Math.floor(maxWaitMs / 60_000);

  return (
    <div className="rounded-xl border border-amber-700/30 bg-amber-950/80 overflow-hidden shadow-md">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-amber-700/40 bg-amber-900/60">
        <Package className="h-4 w-4 text-amber-300 shrink-0" />
        <span className="text-[11px] font-black uppercase tracking-widest text-amber-200">
          Küche fertig · wartet auf Fahrer
        </span>
        <span className="ml-auto text-[10px] font-bold text-amber-400 tabular-nums">
          {fertig.length} Bestellung{fertig.length !== 1 ? 'en' : ''}
        </span>
        {criticalCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-white animate-pulse">
            <AlertTriangle className="h-3 w-3" />
            {criticalCount} &gt;10 Min
          </span>
        )}
      </div>

      {/* Order rows */}
      <div className="flex flex-col divide-y divide-amber-800/30">
        {fertig
          .slice()
          .sort((a, b) => {
            const aMs = a.fertig_am ? now - new Date(a.fertig_am).getTime() : 0;
            const bMs = b.fertig_am ? now - new Date(b.fertig_am).getTime() : 0;
            return bMs - aMs;
          })
          .slice(0, 6)
          .map((order) => {
            const level = getWaitLevel(order.fertig_am);
            const wait = formatWait(order.fertig_am, now);
            return (
              <div
                key={order.id}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5',
                  level === 'critical' ? 'bg-red-950/50' :
                  level === 'warn' ? 'bg-amber-950/40' :
                  'bg-transparent',
                )}
              >
                {/* Wait indicator dot */}
                <div
                  className={cn(
                    'h-2.5 w-2.5 rounded-full shrink-0',
                    level === 'critical' ? 'bg-red-500 animate-pulse' :
                    level === 'warn' ? 'bg-amber-400' :
                    'bg-matcha-500',
                  )}
                />

                {/* Bestellnummer + Name */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-[10px] font-black rounded px-1.5 py-0.5',
                      level === 'critical' ? 'bg-red-500/30 text-red-300' :
                      level === 'warn' ? 'bg-amber-500/30 text-amber-300' :
                      'bg-matcha-700/30 text-matcha-300',
                    )}>
                      #{order.bestellnummer.slice(-4)}
                    </span>
                    <span className="text-sm font-semibold text-white truncate">
                      {order.kunde_name}
                    </span>
                    {order.delivery_zone && (
                      <span className="text-[9px] text-amber-400 font-bold uppercase shrink-0">
                        Zone {order.delivery_zone}
                      </span>
                    )}
                  </div>
                </div>

                {/* Wait time */}
                <div className="shrink-0 flex items-center gap-1">
                  <Clock className={cn(
                    'h-3 w-3',
                    level === 'critical' ? 'text-red-400' :
                    level === 'warn' ? 'text-amber-400' :
                    'text-matcha-400',
                  )} />
                  <span className={cn(
                    'font-mono text-sm font-black tabular-nums',
                    level === 'critical' ? 'text-red-400 animate-pulse' :
                    level === 'warn' ? 'text-amber-300' :
                    'text-matcha-300',
                  )}>
                    {wait}
                  </span>
                </div>
              </div>
            );
          })}
      </div>

      {/* Footer summary */}
      {maxWaitMin > 0 && (
        <div className={cn(
          'flex items-center justify-center gap-2 px-4 py-1.5 text-[10px] font-bold border-t border-amber-700/30',
          maxWaitMin > 10 ? 'bg-red-900/40 text-red-300' :
          maxWaitMin > 5  ? 'bg-amber-900/40 text-amber-300' :
          'bg-matcha-900/30 text-matcha-400',
        )}>
          {maxWaitMin > 10 ? (
            <>
              <AlertTriangle className="h-3 w-3" />
              Maximale Wartezeit: {maxWaitMin} Min — sofort zuweisen!
            </>
          ) : maxWaitMin > 5 ? (
            <>
              <Clock className="h-3 w-3" />
              Maximale Wartezeit: {maxWaitMin} Min
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3 w-3" />
              Alle Bestellungen ≤ {maxWaitMin} Min — gut im Zeitplan
            </>
          )}
        </div>
      )}
    </div>
  );
}
