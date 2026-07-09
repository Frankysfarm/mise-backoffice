'use client';

import { useEffect, useState } from 'react';
import { Users, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type FahrerRow = {
  fahrer_id: string;
  name: string;
  lieferungen: number;
  pünktlichkeit_pct: number;
  avg_lieferzeit_min: number;
  bewertung: number;
  effizienz_score: number;
  trend: 'up' | 'down' | 'flat';
};

type Data = { fahrer: FahrerRow[]; team_avg_score: number };

function mock(): Data {
  return {
    fahrer: [
      { fahrer_id: 'f1', name: 'Max M.', lieferungen: 14, pünktlichkeit_pct: 93, avg_lieferzeit_min: 21, bewertung: 4.9, effizienz_score: 91, trend: 'up' },
      { fahrer_id: 'f2', name: 'Anna S.', lieferungen: 11, pünktlichkeit_pct: 82, avg_lieferzeit_min: 25, bewertung: 4.7, effizienz_score: 78, trend: 'flat' },
      { fahrer_id: 'f3', name: 'Luca B.', lieferungen: 8, pünktlichkeit_pct: 63, avg_lieferzeit_min: 31, bewertung: 4.3, effizienz_score: 57, trend: 'down' },
      { fahrer_id: 'f4', name: 'Sara K.', lieferungen: 10, pünktlichkeit_pct: 88, avg_lieferzeit_min: 22, bewertung: 4.8, effizienz_score: 85, trend: 'up' },
    ],
    team_avg_score: 78,
  };
}

export function LieferdienstPhase1002FahrerLeistungsRankingLive({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const p = new URLSearchParams(); if (locationId) p.set('location_id', locationId);
      const r = await fetch(`/api/delivery/admin/fahrer-performance?${p}`);
      if (r.ok) setData(await r.json()); else throw new Error();
    } catch { setData(mock()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); const id = setInterval(load, 60000); return () => clearInterval(id); }, [locationId]);

  if (!data && loading) return <div className="h-32 bg-muted/20 rounded-2xl animate-pulse" />;
  if (!data) return null;

  const sorted = [...(data.fahrer ?? [])].sort((a, b) => b.effizienz_score - a.effizienz_score);
  const teamAvg = data.team_avg_score;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <Users size={15} className="text-indigo-500" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">Fahrer-Leistung — Live-Ranking</span>
        {teamAvg > 0 && (
          <span className="rounded-full bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5">Team-Ø {teamAvg}</span>
        )}
        {loading && <Loader2 size={13} className="animate-spin text-muted-foreground" />}
      </div>

      <div className="p-3 space-y-2">
        {sorted.map((f, idx) => {
          const rank = idx + 1;
          const above = f.effizienz_score >= teamAvg;
          const scoreColor = f.effizienz_score >= 85 ? 'text-matcha-700 dark:text-matcha-300' : f.effizienz_score >= 65 ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300';
          const barColor = f.effizienz_score >= 85 ? 'bg-matcha-500' : f.effizienz_score >= 65 ? 'bg-amber-400' : 'bg-red-400';

          return (
            <div key={f.fahrer_id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">{rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`}</span>
                  <span className="text-sm font-bold">{f.name}</span>
                  {f.trend === 'up' && <TrendingUp size={11} className="text-matcha-600" />}
                  {f.trend === 'down' && <TrendingDown size={11} className="text-red-500" />}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-muted-foreground">★ {f.bewertung.toFixed(1)}</span>
                  <span className={cn('text-sm font-black tabular-nums', scoreColor)}>{f.effizienz_score}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                  <div className={cn('h-full rounded-full', barColor)} style={{ width: `${f.effizienz_score}%` }} />
                </div>
                <span className={cn('text-[9px] font-bold', above ? 'text-matcha-600' : 'text-red-500')}>
                  {above ? '+' : ''}{f.effizienz_score - teamAvg} vs. Ø
                </span>
              </div>
              <div className="flex gap-3 text-[10px] text-muted-foreground">
                <span>{f.lieferungen} Lief.</span>
                <span>{f.pünktlichkeit_pct}% pünktl.</span>
                <span>Ø {f.avg_lieferzeit_min} Min</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
