'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChefHat, CheckCircle2, Clock, Flame, Timer, Zap } from 'lucide-react';

type Level = 'gruen' | 'gelb' | 'rot' | 'kritisch';

function getLevel(remainSec: number | null, status: string): Level {
  if (status === 'fertig') return 'gruen';
  if (remainSec === null) return 'gelb';
  if (remainSec > 240) return 'gruen';
  if (remainSec > 60) return 'gelb';
  if (remainSec > 0) return 'rot';
  return 'kritisch';
}

const LEVEL_STYLE: Record<Level, { bg: string; border: string; text: string; bar: string; pulse?: boolean }> = {
  gruen:    { bg: 'bg-matcha-50',  border: 'border-matcha-300',  text: 'text-matcha-700',  bar: 'bg-matcha-500' },
  gelb:     { bg: 'bg-amber-50',   border: 'border-amber-300',   text: 'text-amber-700',   bar: 'bg-amber-500' },
  rot:      { bg: 'bg-rose-50',    border: 'border-rose-400',    text: 'text-rose-700',    bar: 'bg-rose-500' },
  kritisch: { bg: 'bg-red-900',    border: 'border-red-600',     text: 'text-red-100',     bar: 'bg-red-400', pulse: true },
};

function fmtSec(sec: number) {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60).toString().padStart(2, '0');
  const s = (abs % 60).toString().padStart(2, '0');
  return (sec < 0 ? '-' : '') + `${m}:${s}`;
}

function KochstartEmpfehlung({ remainSec, prepMin }: { remainSec: number | null; prepMin: number | null }) {
  if (!prepMin || remainSec === null) return null;
  const startInMin = Math.round((remainSec - prepMin * 60) / 60);
  if (startInMin > 5) return null;
  const urgency = startInMin <= 0 ? 'Jetzt kochen!' : `Kochstart in ${startInMin} Min`;
  return (
    <div className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5">
      <Zap className="h-3 w-3 text-amber-600" />
      <span className="text-[9px] font-black text-amber-700">{urgency}</span>
    </div>
  );
}

export function KitchenPhase2876SmartTimingKochstartFarbkodierungsCockpit({
  orders,
  timings,
}: {
  orders: Array<{ id: string; bestellnummer: string; kunde_name: string; status: string; created_at: string }>;
  timings: Array<{ id: string; order_id: string; cook_start_at: string | null; ready_target: string | null; prep_min: number | null; status: string }>;
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();

  const activeOrders = orders.filter(o =>
    ['neu', 'bestätigt', 'in_zubereitung', 'fertig'].includes(o.status)
  );

  type Row = {
    id: string;
    nr: string;
    name: string;
    status: string;
    remainSec: number | null;
    progressPct: number;
    level: Level;
    prepMin: number | null;
    cookStartAt: string | null;
    waitSec: number;
  };

  const rows: Row[] = activeOrders.map(o => {
    const t = timings.find(x => x.order_id === o.id);
    let remainSec: number | null = null;
    let progressPct = 0;

    if (t?.ready_target) {
      remainSec = Math.round((new Date(t.ready_target).getTime() - now) / 1000);
    }
    if (t?.cook_start_at && t.prep_min) {
      const elapsed = now - new Date(t.cook_start_at).getTime();
      progressPct = Math.min(100, Math.max(0, (elapsed / (t.prep_min * 60_000)) * 100));
    }

    const waitSec = Math.round((now - new Date(o.created_at).getTime()) / 1000);
    const level = getLevel(remainSec, o.status);

    return {
      id: o.id, nr: o.bestellnummer, name: o.kunde_name, status: o.status,
      remainSec, progressPct, level, prepMin: t?.prep_min ?? null,
      cookStartAt: t?.cook_start_at ?? null, waitSec,
    };
  }).sort((a, b) => {
    const ord: Record<Level, number> = { kritisch: 0, rot: 1, gelb: 2, gruen: 3 };
    return ord[a.level] - ord[b.level];
  });

  if (rows.length === 0) return null;

  const overdueCount = rows.filter(r => r.remainSec !== null && r.remainSec < 0).length;
  const cookingCount = rows.filter(r => r.status === 'in_zubereitung').length;
  const readyCount = rows.filter(r => r.status === 'fertig').length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-gradient-to-r from-stone-50 to-white">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-matcha-100">
            <Timer className="h-3.5 w-3.5 text-matcha-700" />
          </div>
          <div>
            <div className="text-xs font-black tracking-wide uppercase text-char">Kochstart · Farbkodierung</div>
            <div className="text-[10px] text-stone-400">{rows.length} Bestellungen</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {cookingCount > 0 && (
            <div className="flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5">
              <Flame className="h-2.5 w-2.5 text-amber-600" />
              <span className="text-[9px] font-bold text-amber-700">{cookingCount} kocht</span>
            </div>
          )}
          {readyCount > 0 && (
            <div className="flex items-center gap-0.5 rounded-full bg-matcha-100 px-2 py-0.5">
              <CheckCircle2 className="h-2.5 w-2.5 text-matcha-600" />
              <span className="text-[9px] font-bold text-matcha-700">{readyCount} fertig</span>
            </div>
          )}
          {overdueCount > 0 && (
            <div className="flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5">
              <AlertTriangle className="h-2.5 w-2.5 text-red-600" />
              <span className="text-[9px] font-bold text-red-600">{overdueCount} überfällig</span>
            </div>
          )}
        </div>
      </div>

      {/* Order-Rows */}
      <div className="divide-y divide-stone-100">
        {rows.slice(0, 10).map(r => {
          const s = LEVEL_STYLE[r.level];
          return (
            <div
              key={r.id}
              className={cn(
                'px-4 py-2.5 transition-all',
                s.bg,
                s.pulse && 'animate-pulse',
              )}
            >
              <div className="flex items-center justify-between gap-3">
                {/* Left: ID + Name + badges */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-black text-stone-400">#{r.nr}</span>
                    <span className={cn('text-[10px] font-semibold truncate max-w-[80px]', s.text)}>{r.name}</span>
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
                    {r.status === 'neu' && (
                      <KochstartEmpfehlung remainSec={r.remainSec} prepMin={r.prepMin} />
                    )}
                  </div>

                  {/* Prep-Fortschrittsbalken */}
                  {r.progressPct > 0 && (
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-stone-200 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-1000', s.bar)}
                        style={{ width: `${r.progressPct}%` }}
                      />
                    </div>
                  )}

                  {/* Wartezeit */}
                  <div className="mt-0.5 text-[9px] text-stone-400">
                    Wartet {Math.floor(r.waitSec / 60)} Min
                    {r.prepMin ? ` · Prep ${r.prepMin} Min` : ''}
                  </div>
                </div>

                {/* Right: Countdown */}
                <div className="text-right shrink-0">
                  <div className={cn('text-xl font-black tabular-nums leading-none', s.text)}>
                    {r.remainSec !== null ? fmtSec(r.remainSec) : '—'}
                  </div>
                  <div className={cn('text-[9px] font-semibold mt-0.5', s.text)}>
                    {r.remainSec === null
                      ? 'kein Timing'
                      : r.remainSec < 0
                      ? 'überfällig'
                      : 'bis fertig'}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {rows.length > 10 && (
        <div className="px-4 py-2 text-center text-[10px] text-stone-400 border-t border-stone-100 bg-stone-50">
          +{rows.length - 10} weitere Bestellungen
        </div>
      )}

      {/* Legende */}
      <div className="px-4 py-2 border-t border-stone-100 bg-stone-50 flex items-center gap-3 flex-wrap">
        {(['gruen', 'gelb', 'rot', 'kritisch'] as Level[]).map(l => {
          const s = LEVEL_STYLE[l];
          const labels: Record<Level, string> = { gruen: '>4 Min', gelb: '1–4 Min', rot: '<1 Min', kritisch: 'Überfällig' };
          return (
            <div key={l} className="flex items-center gap-1">
              <div className={cn('h-2 w-2 rounded-full', s.bar)} />
              <span className="text-[9px] text-stone-500">{labels[l]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
