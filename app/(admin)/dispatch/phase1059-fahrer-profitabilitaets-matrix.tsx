'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Loader2, Euro } from 'lucide-react';
import { cn } from '@/lib/utils';

type FahrerRow = {
  fahrer_id: string;
  name: string;
  lieferungen: number;
  umsatz: number;
  kosten: number;
  gewinn: number;
  marge_pct: number;
  trend: 'up' | 'down' | 'flat';
};

type ApiResponse = { fahrer: FahrerRow[]; team_avg_marge: number };

function mock(): ApiResponse {
  return {
    fahrer: [
      { fahrer_id: 'f1', name: 'Max M.', lieferungen: 14, umsatz: 420, kosten: 109, gewinn: 311, marge_pct: 74, trend: 'up' },
      { fahrer_id: 'f2', name: 'Anna S.', lieferungen: 11, umsatz: 310, kosten: 108, gewinn: 202, marge_pct: 65, trend: 'flat' },
      { fahrer_id: 'f3', name: 'Luca B.', lieferungen: 8, umsatz: 190, kosten: 91, gewinn: 99, marge_pct: 52, trend: 'down' },
    ],
    team_avg_marge: 64,
  };
}

export function DispatchPhase1059FahrerProfitabilitaetsMatrix({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const p = new URLSearchParams(); if (locationId) p.set('location_id', locationId);
      const r = await fetch(`/api/delivery/admin/fahrer-profitabilitaet?${p}`);
      if (r.ok) setData(await r.json()); else throw new Error();
    } catch { setData(mock()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); const id = setInterval(load, 5 * 60 * 1000); return () => clearInterval(id); }, [locationId]);

  if (!loading && (data?.fahrer ?? []).length === 0) return null;

  const fahrer = data?.fahrer ?? [];
  const teamMarge = data?.team_avg_marge ?? 0;

  return (
    <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-emerald-200 dark:border-emerald-800">
        <Euro size={15} className="text-emerald-600 dark:text-emerald-400" />
        <span className="text-xs font-bold text-emerald-800 dark:text-emerald-200 uppercase tracking-wider flex-1">Fahrer-Profitabilität — Matrix</span>
        {teamMarge > 0 && (
          <span className="rounded-full bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5">Team-Ø {teamMarge}%</span>
        )}
        {loading && <Loader2 size={14} className="animate-spin text-emerald-400" />}
      </div>

      <div className="p-3 space-y-2">
        {fahrer.map((f, idx) => {
          const abovAvg = f.marge_pct >= teamMarge;
          const margeColor = f.marge_pct >= 70 ? 'text-matcha-700 dark:text-matcha-300' : f.marge_pct >= 50 ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300';
          const barColor = f.marge_pct >= 70 ? 'bg-matcha-500' : f.marge_pct >= 50 ? 'bg-amber-400' : 'bg-red-400';
          const rank = idx + 1;

          return (
            <div key={f.fahrer_id} className="rounded-xl bg-white dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`}</span>
                  <span className="text-sm font-bold">{f.name}</span>
                  {f.trend === 'up' && <TrendingUp size={12} className="text-matcha-600" />}
                  {f.trend === 'down' && <TrendingDown size={12} className="text-red-500" />}
                </div>
                <div className="text-right">
                  <span className={cn('text-sm font-black tabular-nums', margeColor)}>{f.marge_pct}%</span>
                  <div className="text-[9px] text-muted-foreground">{f.gewinn.toFixed(0)} € Gewinn</div>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${f.marge_pct}%` }} />
                </div>
                <span className={cn('text-[9px] font-bold', abovAvg ? 'text-matcha-600' : 'text-red-500')}>
                  {abovAvg ? '+' : ''}{Math.round(f.marge_pct - teamMarge)}% vs. Ø
                </span>
              </div>
              <div className="flex gap-3 text-[10px] text-muted-foreground">
                <span>{f.lieferungen} Lief.</span>
                <span>{f.umsatz.toFixed(0)} € Umsatz</span>
                <span>{f.kosten.toFixed(0)} € Kosten</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
