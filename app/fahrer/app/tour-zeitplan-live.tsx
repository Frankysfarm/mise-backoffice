'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Timer } from 'lucide-react';

type Stop = {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    eta_earliest: string | null;
    eta_latest: string | null;
    kunde_name?: string | null;
  } | null;
};

interface Props {
  stops: Stop[];
  startedAt: string | null;
  totalEtaMin: number | null;
}

export function FahrerTourZeitplanLive({ stops, startedAt, totalEtaMin }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(t);
  }, []);

  if (!stops.length || !startedAt) return null;

  const startMs = new Date(startedAt).getTime();
  const elapsedMin = Math.floor((now - startMs) / 60_000);
  const planMin = totalEtaMin ?? 0;
  const remainMin = planMin > 0 ? Math.max(0, planMin - elapsedMin) : null;

  const done = stops.filter((s) => s.geliefert_am).length;
  const total = stops.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const timePct = planMin > 0 ? Math.min(100, Math.round((elapsedMin / planMin) * 100)) : 0;
  const gap = timePct - pct;
  const behind = gap > 20;
  const tight = gap > 8;

  const fmt = (min: number) => `${Math.floor(min / 60) > 0 ? `${Math.floor(min / 60)}h ` : ''}${min % 60}min`;

  return (
    <section className={cn(
      'rounded-2xl border p-4 space-y-3',
      behind ? 'border-red-700/40 bg-red-900/20' :
      tight  ? 'border-amber-700/40 bg-amber-900/20' :
               'border-matcha-600/30 bg-matcha-800/30',
    )}>
      <div className="flex items-center gap-2">
        <Timer className={cn('h-4 w-4 shrink-0', behind ? 'text-red-400' : tight ? 'text-amber-400' : 'text-matcha-400')} />
        <span className={cn('text-xs font-bold uppercase tracking-wide', behind ? 'text-red-300' : tight ? 'text-amber-300' : 'text-matcha-300')}>
          Tour-Zeitplan
        </span>
        <span className={cn(
          'ml-auto rounded-full px-2 py-0.5 text-[10px] font-black',
          behind ? 'bg-red-500/30 text-red-200' : tight ? 'bg-amber-500/30 text-amber-200' : 'bg-matcha-500/30 text-matcha-200',
        )}>
          {behind ? 'Im Rückstand' : tight ? 'Knapp' : 'Im Plan'}
        </span>
      </div>

      {/* Stop progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-white/50">
          <span>Stopps: {done}/{total}</span>
          <span>{pct}% abgeschlossen</span>
        </div>
        <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700',
              behind ? 'bg-red-400' : tight ? 'bg-amber-400' : 'bg-matcha-400')}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Time progress bar */}
      {planMin > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-white/50">
            <span>Zeit: {fmt(elapsedMin)} vergangen</span>
            {remainMin !== null && <span>~{fmt(remainMin)} verbleibend</span>}
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-white/30 transition-all duration-700"
              style={{ width: `${timePct}%` }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
