'use client';

import React, { useEffect, useState } from 'react';
import { Users, Package, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  stops?: { geliefert_am: string | null }[];
};

type Driver = {
  employee_id: string;
  ist_online: boolean;
  aktueller_batch_id: string | null;
};

type Props = {
  batches: Batch[];
  drivers: Driver[];
};

/* Echtzeit-Kapazitätsring: Fahrer-Auslastung als SVG-Donut.
   Zeigt wie viele Fahrer aktiv/frei/offline sind auf einen Blick. */
export function DispatchTourKapazitaetsRing({ batches, drivers }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const online = drivers.filter((d) => d.ist_online);
  const busy = online.filter((d) => d.aktueller_batch_id !== null);
  const free = online.filter((d) => d.aktueller_batch_id === null);
  const offline = drivers.filter((d) => !d.ist_online);

  const pendingOrders = batches.filter(
    (b) => b.status === 'offen' || b.status === 'pending',
  ).length;

  const total = drivers.length || 1;
  const busyPct = Math.round((busy.length / total) * 100);
  const freePct = Math.round((free.length / total) * 100);

  // SVG ring math
  const R = 36;
  const C = 2 * Math.PI * R;
  const busyDash = (busyPct / 100) * C;
  const freeDash = (freePct / 100) * C;
  const busyOffset = 0;
  const freeOffset = -(busyDash);

  const utilizationColor =
    busyPct >= 90 ? 'text-red-600' : busyPct >= 70 ? 'text-amber-600' : 'text-matcha-700';

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Fahrer-Kapazität</span>
        <span className={cn('ml-auto text-xs font-black tabular-nums', utilizationColor)}>
          {busyPct}% ausgelastet
        </span>
      </div>

      <div className="flex items-center gap-5">
        {/* SVG Donut */}
        <div className="relative shrink-0">
          <svg width="96" height="96" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r={R} fill="none" stroke="#e5e7eb" strokeWidth="10" />
            {/* Free (matcha) */}
            {freePct > 0 && (
              <circle
                cx="48" cy="48" r={R} fill="none"
                stroke="#4d7c0f"
                strokeWidth="10"
                strokeDasharray={`${freeDash} ${C - freeDash}`}
                strokeDashoffset={freeOffset}
                strokeLinecap="round"
                transform="rotate(-90 48 48)"
              />
            )}
            {/* Busy (amber/red) */}
            {busyPct > 0 && (
              <circle
                cx="48" cy="48" r={R} fill="none"
                stroke={busyPct >= 90 ? '#dc2626' : '#f59e0b'}
                strokeWidth="10"
                strokeDasharray={`${busyDash} ${C - busyDash}`}
                strokeDashoffset={busyOffset}
                strokeLinecap="round"
                transform="rotate(-90 48 48)"
              />
            )}
            <text x="48" y="44" textAnchor="middle" className="fill-foreground" style={{ fontSize: 18, fontWeight: 900 }}>
              {online.length}
            </text>
            <text x="48" y="58" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 9 }}>
              online
            </text>
          </svg>
        </div>

        {/* Stats */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="text-[11px] text-muted-foreground">Unterwegs</span>
            </div>
            <span className="text-sm font-black tabular-nums text-amber-600">{busy.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-matcha-500" />
              <span className="text-[11px] text-muted-foreground">Verfügbar</span>
            </div>
            <span className="text-sm font-black tabular-nums text-matcha-700">{free.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-gray-300" />
              <span className="text-[11px] text-muted-foreground">Offline</span>
            </div>
            <span className="text-sm font-black tabular-nums text-muted-foreground">{offline.length}</span>
          </div>
          {pendingOrders > 0 && (
            <div className="flex items-center justify-between pt-1 border-t">
              <div className="flex items-center gap-1.5">
                <Package className="h-3 w-3 text-red-500" />
                <span className="text-[11px] text-red-600 font-bold">Wartend</span>
              </div>
              <span className="text-sm font-black tabular-nums text-red-600">{pendingOrders}</span>
            </div>
          )}
        </div>
      </div>

      {free.length === 0 && pendingOrders > 0 && (
        <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700">
          Alle Fahrer belegt — {pendingOrders} Bestellung{pendingOrders > 1 ? 'en' : ''} warten!
        </div>
      )}
    </div>
  );
}
