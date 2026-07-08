'use client';

import { useEffect, useState } from 'react';
import { Activity, Clock } from 'lucide-react';

interface Bestellung {
  id: string;
  status: string;
  created_at: string;
  prep_started_at?: string | null;
  ready_at?: string | null;
}

interface Props {
  orders: Bestellung[];
}

function ageMin(iso: string) {
  return Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
}

export function KitchenPhase761SchnellstatusBand({ orders }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5_000);
    return () => clearInterval(id);
  }, []);

  if (!orders || orders.length === 0) return null;

  const aktiv = orders.filter((o) =>
    ['new', 'confirmed', 'preparing', 'ready'].includes(o.status),
  );

  if (aktiv.length === 0) return null;

  const kritisch = aktiv.filter((o) => {
    const start = o.prep_started_at ?? o.created_at;
    return ageMin(start) >= 20;
  });
  const warnung = aktiv.filter((o) => {
    const start = o.prep_started_at ?? o.created_at;
    const age = ageMin(start);
    return age >= 12 && age < 20;
  });
  const ok = aktiv.length - kritisch.length - warnung.length;

  const ampel =
    kritisch.length > 0
      ? { color: 'bg-red-500', label: 'Kritisch', text: 'text-red-600 dark:text-red-400' }
      : warnung.length > 0
      ? { color: 'bg-amber-500', label: 'Warnung', text: 'text-amber-600 dark:text-amber-400' }
      : { color: 'bg-emerald-500', label: 'OK', text: 'text-emerald-600 dark:text-emerald-400' };

  return (
    <div className="rounded-xl border bg-card shadow-sm p-3">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Schnellstatus-Band</span>
        <span className="ml-auto flex items-center gap-1">
          <span className={`relative flex h-2 w-2`}>
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${ampel.color} opacity-60`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${ampel.color}`} />
          </span>
          <span className={`text-xs font-bold ${ampel.text}`}>{ampel.label}</span>
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 py-2">
          <p className="text-xl font-black tabular-nums text-emerald-600 dark:text-emerald-400">{ok}</p>
          <p className="text-[9px] text-emerald-700 dark:text-emerald-300">OK (&lt;12 Min)</p>
        </div>
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 py-2">
          <p className="text-xl font-black tabular-nums text-amber-600 dark:text-amber-400">{warnung.length}</p>
          <p className="text-[9px] text-amber-700 dark:text-amber-300">Warnung (12–19)</p>
        </div>
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 py-2">
          <p className="text-xl font-black tabular-nums text-red-600 dark:text-red-400">{kritisch.length}</p>
          <p className="text-[9px] text-red-700 dark:text-red-300">Kritisch (≥20)</p>
        </div>
      </div>

      {kritisch.length > 0 && (
        <div className="mt-2 space-y-1">
          {kritisch.slice(0, 3).map((o) => {
            const start = o.prep_started_at ?? o.created_at;
            const age = ageMin(start);
            return (
              <div key={o.id} className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 px-2 py-1">
                <Clock className="h-3 w-3 text-red-500 shrink-0" />
                <span className="text-[10px] font-mono text-red-700 dark:text-red-300 truncate">{o.id.slice(-6)}</span>
                <span className="ml-auto text-[10px] font-bold text-red-600 dark:text-red-400 tabular-nums">{age}m</span>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[9px] text-muted-foreground mt-2 text-right">5s Update · {aktiv.length} aktiv</p>
    </div>
  );
}
