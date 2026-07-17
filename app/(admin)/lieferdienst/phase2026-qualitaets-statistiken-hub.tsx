'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Award, ChevronDown, ChevronUp, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerQualitaet {
  driver_id: string;
  name: string;
  puenktlichkeits_pct: number;
  bewertung_avg: number;
  storno_pct: number;
  qualitaets_score: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  touren: number;
}

interface ApiData {
  fahrer: FahrerQualitaet[];
  team_score: number;
  top_fahrer: string;
  alert_niedriger_score: boolean;
}

interface Props {
  locationId: string | null;
}

const MOCK: ApiData = {
  fahrer: [
    { driver_id: '1', name: 'Lukas M.', puenktlichkeits_pct: 94, bewertung_avg: 4.8, storno_pct: 2, qualitaets_score: 93, trend: 'besser', touren: 12 },
    { driver_id: '2', name: 'Sara K.', puenktlichkeits_pct: 87, bewertung_avg: 4.6, storno_pct: 5, qualitaets_score: 86, trend: 'gleich', touren: 9 },
    { driver_id: '3', name: 'Tom H.', puenktlichkeits_pct: 71, bewertung_avg: 4.1, storno_pct: 11, qualitaets_score: 74, trend: 'schlechter', touren: 7 },
  ],
  team_score: 84,
  top_fahrer: 'Lukas M.',
  alert_niedriger_score: false,
};

function scoreBar(pct: number, color: string) {
  return (
    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
      <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function TrendChip({ trend }: { trend: string }) {
  if (trend === 'besser') return <span className="flex items-center gap-0.5 text-[10px] text-matcha-600 font-bold"><TrendingUp className="h-3 w-3" />↑</span>;
  if (trend === 'schlechter') return <span className="flex items-center gap-0.5 text-[10px] text-red-500 font-bold"><TrendingDown className="h-3 w-3" />↓</span>;
  return <span className="text-[10px] text-muted-foreground"><Minus className="h-3 w-3" /></span>;
}

export function LieferdienstPhase2026QualitaetsStatistikenHub({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/tages-qualitaets-score?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { load(); const t = setInterval(load, 15 * 60_000); return () => clearInterval(t); }, [load]);

  const sorted = [...data.fahrer].sort((a, b) => b.qualitaets_score - a.qualitaets_score);
  const scoreAvgPuenkt = data.fahrer.length > 0 ? Math.round(data.fahrer.reduce((s, f) => s + f.puenktlichkeits_pct, 0) / data.fahrer.length) : 0;
  const scoreAvgBew = data.fahrer.length > 0 ? (data.fahrer.reduce((s, f) => s + f.bewertung_avg, 0) / data.fahrer.length).toFixed(1) : '–';

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 border-b hover:bg-muted/30 transition-colors"
      >
        <Award className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Qualitäts-Statistiken Heute</span>
        <span className={cn(
          'ml-1 rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums',
          data.team_score >= 85 ? 'bg-matcha-100 text-matcha-700' : data.team_score >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700',
        )}>
          Score {data.team_score}
        </span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        <span className="ml-auto">
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </span>
      </button>

      {open && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-matcha-50 border border-matcha-100 px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground">Team-Score</div>
              <div className={cn('text-2xl font-black tabular-nums', data.team_score >= 80 ? 'text-matcha-700' : 'text-amber-700')}>{data.team_score}</div>
            </div>
            <div className="rounded-xl bg-muted/30 px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground">Ø Pünktlichkeit</div>
              <div className="text-2xl font-black tabular-nums text-foreground">{scoreAvgPuenkt}%</div>
            </div>
            <div className="rounded-xl bg-muted/30 px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground">Ø Bewertung</div>
              <div className="text-2xl font-black tabular-nums text-foreground">★ {scoreAvgBew}</div>
            </div>
          </div>

          {data.top_fahrer && (
            <div className="rounded-xl bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs font-semibold text-yellow-800">
              🏆 Bester Fahrer heute: {data.top_fahrer}
            </div>
          )}

          <div className="space-y-2">
            {sorted.map((f, idx) => (
              <div key={f.driver_id} className="space-y-1 rounded-xl border bg-muted/10 px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black text-muted-foreground w-5">#{idx + 1}</span>
                    <span className="text-[12px] font-bold">{f.name}</span>
                    <TrendChip trend={f.trend} />
                  </div>
                  <span className={cn(
                    'rounded-lg px-2 py-0.5 text-[13px] font-black tabular-nums',
                    f.qualitaets_score >= 85 ? 'bg-matcha-100 text-matcha-700' : f.qualitaets_score >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700',
                  )}>{f.qualitaets_score}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="w-16 shrink-0">Pünktlich</span>
                  {scoreBar(f.puenktlichkeits_pct, 'bg-matcha-400')}
                  <span className="w-8 shrink-0 text-right tabular-nums">{f.puenktlichkeits_pct}%</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="w-16 shrink-0">Bewertung</span>
                  {scoreBar((f.bewertung_avg / 5) * 100, 'bg-yellow-400')}
                  <span className="w-8 shrink-0 text-right tabular-nums">★{f.bewertung_avg.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="text-[10px] text-muted-foreground text-right">15-Min-Update · Qualitätsindex = 40% Pünktlichkeit + 40% Bewertung + 20% Stornofreiheit</div>
        </div>
      )}
    </div>
  );
}
