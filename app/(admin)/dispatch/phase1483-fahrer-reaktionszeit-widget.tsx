'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, TrendingDown, TrendingUp, Minus, Target } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { FahrerReaktionszeitResponse, FahrerReaktionszeitEintrag } from '@/app/api/delivery/admin/fahrer-reaktionszeit/route';

// Phase 1483 — Fahrer-Reaktionszeit-Widget (Dispatch)
// Phase1476-API: Rangliste + 7-Tage-Sparklines + Team-Ø vs. SLA-Ziel; 30-Min-Polling.
// Nach Phase 1478.

interface Props {
  locationId: string | null;
}

const POLL_MS = 30 * 60_000;

const MOCK: FahrerReaktionszeitResponse = {
  fahrer: [
    {
      fahrer_id: 'f1', name: 'Max M.', avg_reaktionszeit_min: 3.2, anzahl: 42, rang: 1, trend: 'besser',
      tage: [
        { datum: '2026-07-08', avg_min: 4.1 }, { datum: '2026-07-09', avg_min: 3.8 },
        { datum: '2026-07-10', avg_min: 3.5 }, { datum: '2026-07-11', avg_min: 3.6 },
        { datum: '2026-07-12', avg_min: 3.2 }, { datum: '2026-07-13', avg_min: 3.0 },
        { datum: '2026-07-14', avg_min: 3.2 },
      ],
    },
    {
      fahrer_id: 'f2', name: 'Anna S.', avg_reaktionszeit_min: 4.7, anzahl: 35, rang: 2, trend: 'gleich',
      tage: [
        { datum: '2026-07-08', avg_min: 4.5 }, { datum: '2026-07-09', avg_min: 4.6 },
        { datum: '2026-07-10', avg_min: 4.8 }, { datum: '2026-07-11', avg_min: 4.7 },
        { datum: '2026-07-12', avg_min: 4.9 }, { datum: '2026-07-13', avg_min: 4.6 },
        { datum: '2026-07-14', avg_min: 4.7 },
      ],
    },
    {
      fahrer_id: 'f3', name: 'Tom B.', avg_reaktionszeit_min: 6.8, anzahl: 28, rang: 3, trend: 'schlechter',
      tage: [
        { datum: '2026-07-08', avg_min: 5.9 }, { datum: '2026-07-09', avg_min: 6.1 },
        { datum: '2026-07-10', avg_min: 6.3 }, { datum: '2026-07-11', avg_min: 6.5 },
        { datum: '2026-07-12', avg_min: 6.8 }, { datum: '2026-07-13', avg_min: 7.0 },
        { datum: '2026-07-14', avg_min: 6.8 },
      ],
    },
  ],
  team_avg_min: 4.9,
  sla_ziel_min: 5,
  location_id: 'mock',
  generiert_am: new Date().toISOString(),
};

function Sparkline({ tage, slaMin }: { tage: FahrerReaktionszeitEintrag['tage']; slaMin: number }) {
  if (tage.length < 2) return null;
  const vals = tage.map((t) => t.avg_min);
  const min = Math.min(...vals, 0);
  const max = Math.max(...vals, slaMin) + 0.5;
  const W = 60;
  const H = 22;
  const xStep = W / (vals.length - 1);
  const yScale = (v: number) => H - ((v - min) / (max - min)) * H;
  const points = vals.map((v, i) => `${i * xStep},${yScale(v)}`).join(' ');
  const slaY = yScale(slaMin);
  return (
    <svg width={W} height={H} className="overflow-visible">
      <line x1={0} y1={slaY} x2={W} y2={slaY} stroke="currentColor" strokeDasharray="2 2" strokeWidth={0.8} className="text-muted-foreground/40" />
      <polyline fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" points={points} className="text-sky-400" />
      <circle cx={(vals.length - 1) * xStep} cy={yScale(vals[vals.length - 1])} r={2.5} fill="currentColor" className="text-sky-400" />
    </svg>
  );
}

function TrendIcon({ trend }: { trend: FahrerReaktionszeitEintrag['trend'] }) {
  if (trend === 'besser') return <TrendingDown className="h-3.5 w-3.5 text-emerald-500 shrink-0" />;
  if (trend === 'schlechter') return <TrendingUp className="h-3.5 w-3.5 text-rose-500 shrink-0" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
}

export function DispatchPhase1483FahrerReaktionszeitWidget({ locationId }: Props) {
  const [data, setData] = useState<FahrerReaktionszeitResponse>(MOCK);

  useEffect(() => {
    if (!locationId) return;

    async function fetch_() {
      try {
        const res = await fetch(
          `/api/delivery/admin/fahrer-reaktionszeit?location_id=${locationId}`,
          { cache: 'no-store' },
        );
        if (res.ok) {
          const json = await res.json();
          if (json?.fahrer?.length) setData(json as FahrerReaktionszeitResponse);
        }
      } catch {}
    }

    fetch_();
    const iv = setInterval(fetch_, POLL_MS);
    return () => clearInterval(iv);
  }, [locationId]);

  const teamBesserAlsSla = data.team_avg_min <= data.sla_ziel_min;

  return (
    <Card className="overflow-hidden border border-sky-200 dark:border-sky-800">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-sky-50 dark:bg-sky-900/20 border-b border-sky-200 dark:border-sky-800">
        <Clock className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-sky-800 dark:text-sky-200">
          Fahrer-Reaktionszeit
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-sky-400" />
          <span className={cn('text-[10px] font-bold', teamBesserAlsSla ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
            Team-Ø {data.team_avg_min} Min
          </span>
          <span className="text-[10px] text-muted-foreground">/ Ziel {data.sla_ziel_min} Min</span>
        </div>
      </div>

      <div className="divide-y divide-border">
        {data.fahrer.map((f) => {
          const ueberSla = f.avg_reaktionszeit_min > data.sla_ziel_min;
          return (
            <div key={f.fahrer_id} className="flex items-center gap-3 px-4 py-2.5">
              {/* Rang */}
              <span className="text-[11px] font-black text-muted-foreground w-4 text-center shrink-0">
                {f.rang}
              </span>
              {/* Name + Aufträge */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-foreground truncate">{f.name}</span>
                  <TrendIcon trend={f.trend} />
                </div>
                <div className="text-[10px] text-muted-foreground">{f.anzahl} Aufträge</div>
              </div>
              {/* Sparkline */}
              <Sparkline tage={f.tage} slaMin={data.sla_ziel_min} />
              {/* Ø Zeit */}
              <div className="text-right shrink-0">
                <div className={cn('text-sm font-black tabular-nums', ueberSla ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>
                  {f.avg_reaktionszeit_min}
                </div>
                <div className="text-[9px] text-muted-foreground uppercase">Min</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={cn('flex items-center justify-between px-4 py-2 border-t text-[11px]', teamBesserAlsSla ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400')}>
        <span className="font-semibold">{teamBesserAlsSla ? '✓ Team im SLA-Ziel' : '⚠ Team über SLA-Ziel'}</span>
        <span className="text-muted-foreground text-[10px]">SLA: ≤ {data.sla_ziel_min} Min</span>
      </div>
    </Card>
  );
}
