'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Award, ChevronDown, ChevronUp, Star, TrendingDown, TrendingUp, Minus } from 'lucide-react';

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
  className?: string;
}

const MOCK: ApiData = {
  fahrer: [
    { driver_id: '1', name: 'Lukas M.', puenktlichkeits_pct: 94, bewertung_avg: 4.8, storno_pct: 2, qualitaets_score: 93, trend: 'besser', touren: 12 },
    { driver_id: '2', name: 'Sara K.', puenktlichkeits_pct: 87, bewertung_avg: 4.6, storno_pct: 5, qualitaets_score: 86, trend: 'gleich', touren: 9 },
    { driver_id: '3', name: 'Tom H.', puenktlichkeits_pct: 71, bewertung_avg: 4.1, storno_pct: 11, qualitaets_score: 74, trend: 'schlechter', touren: 7 },
    { driver_id: '4', name: 'Jana R.', puenktlichkeits_pct: 65, bewertung_avg: 3.9, storno_pct: 14, qualitaets_score: 67, trend: 'gleich', touren: 6 },
  ],
  team_score: 80,
  top_fahrer: 'Lukas M.',
  alert_niedriger_score: false,
};

function scoreColor(s: number) {
  if (s >= 85) return 'text-matcha-700 bg-matcha-100';
  if (s >= 70) return 'text-amber-700 bg-amber-100';
  return 'text-red-700 bg-red-100';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'besser') return <TrendingUp className="h-3.5 w-3.5 text-matcha-600" />;
  if (trend === 'schlechter') return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

export function DispatchPhase2093TagesQualitaetsBoard({ locationId, className }: Props) {
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

  return (
    <div className={cn('rounded-2xl border bg-card overflow-hidden', className)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 border-b hover:bg-muted/30 transition-colors"
      >
        <Award className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Tages-Qualitäts-Score</span>
        <span className={cn('ml-1 rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums', scoreColor(data.team_score))}>
          Team Ø {data.team_score}
        </span>
        {loading && <span className="ml-auto text-[10px] text-muted-foreground animate-pulse">lädt…</span>}
        <span className="ml-auto">
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </span>
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {data.alert_niedriger_score && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="font-semibold">Team-Qualität unter 70% — Coaching empfohlen</span>
            </div>
          )}

          {data.top_fahrer && (
            <div className="flex items-center gap-2 rounded-xl bg-matcha-50 border border-matcha-200 px-3 py-2 text-xs">
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-400 shrink-0" />
              <span className="font-bold text-matcha-700">Bester Fahrer heute: {data.top_fahrer}</span>
            </div>
          )}

          <div className="space-y-2">
            {sorted.map((f, idx) => (
              <div key={f.driver_id} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5">
                <span className="w-5 text-[11px] font-black text-muted-foreground shrink-0">#{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-bold truncate">{f.name}</span>
                    <TrendIcon trend={f.trend} />
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                    <span>⏱ {f.puenktlichkeits_pct}%</span>
                    <span>★ {f.bewertung_avg.toFixed(1)}</span>
                    <span>✗ {f.storno_pct}% Storno</span>
                    <span>{f.touren} Touren</span>
                  </div>
                </div>
                <span className={cn('rounded-lg px-2.5 py-1 text-[13px] font-black tabular-nums shrink-0', scoreColor(f.qualitaets_score))}>
                  {f.qualitaets_score}
                </span>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-muted/30 px-3 py-2 text-[10px] text-muted-foreground">
            Score = 40% Pünktlichkeit + 40% Bewertung + 20% Stornofreiheit · 15-Min-Update
          </div>
        </div>
      )}
    </div>
  );
}
