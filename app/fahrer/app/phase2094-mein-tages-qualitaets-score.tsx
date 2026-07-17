'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Award, ChevronDown, ChevronUp, Loader2, TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

interface ScoreData {
  qualitaets_score: number;
  puenktlichkeits_pct: number;
  bewertung_avg: number;
  storno_pct: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  touren: number;
  team_score: number;
}

const MOCK: ScoreData = {
  qualitaets_score: 88,
  puenktlichkeits_pct: 91,
  bewertung_avg: 4.7,
  storno_pct: 3,
  trend: 'besser',
  touren: 10,
  team_score: 80,
};

function scoreColor(s: number): { ring: string; text: string; bg: string } {
  if (s >= 85) return { ring: 'stroke-matcha-500', text: 'text-matcha-700', bg: 'bg-matcha-50' };
  if (s >= 70) return { ring: 'stroke-amber-400', text: 'text-amber-700', bg: 'bg-amber-50' };
  return { ring: 'stroke-red-400', text: 'text-red-700', bg: 'bg-red-50' };
}

function TrendLabel({ trend }: { trend: string }) {
  if (trend === 'besser') return <span className="flex items-center gap-0.5 text-matcha-600 text-[11px] font-bold"><TrendingUp className="h-3 w-3" /> Verbessert</span>;
  if (trend === 'schlechter') return <span className="flex items-center gap-0.5 text-red-500 text-[11px] font-bold"><TrendingDown className="h-3 w-3" /> Gefallen</span>;
  return <span className="flex items-center gap-0.5 text-muted-foreground text-[11px]"><Minus className="h-3 w-3" /> Stabil</span>;
}

export function FahrerPhase2094MeinTagesQualitaetsScore({ driverId, locationId, isOnline }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ScoreData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!driverId || !locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/tages-qualitaets-score?location_id=${locationId}`);
      if (res.ok) {
        const json = await res.json();
        const me = (json.fahrer ?? []).find((f: { driver_id: string }) => f.driver_id === driverId);
        if (me) setData({ ...me, team_score: json.team_score ?? MOCK.team_score });
      }
    } finally {
      setLoading(false);
    }
  }, [driverId, locationId]);

  useEffect(() => {
    if (!isOnline) return;
    load();
    const t = setInterval(load, 15 * 60_000);
    return () => clearInterval(t);
  }, [isOnline, load]);

  if (!isOnline) return null;

  const sc = scoreColor(data.qualitaets_score);
  const r = 26;
  const circ = 2 * Math.PI * r;
  const dash = (data.qualitaets_score / 100) * circ;

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 border-b hover:bg-muted/30 transition-colors"
      >
        <Award className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Mein Qualitäts-Score</span>
        <span className={cn('ml-1 rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums', sc.bg, sc.text)}>
          {data.qualitaets_score} Pkt
        </span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        <span className="ml-auto">
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </span>
      </button>

      {open && (
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0 h-16 w-16">
              <svg viewBox="0 0 64 64" className="rotate-[-90deg] h-16 w-16">
                <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
                <circle
                  cx="32" cy="32" r={r} fill="none" strokeWidth="6"
                  strokeDasharray={`${dash} ${circ}`}
                  strokeLinecap="round"
                  className={cn('transition-all duration-700', sc.ring)}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn('text-[15px] font-black tabular-nums', sc.text)}>{data.qualitaets_score}</span>
              </div>
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Pünktlichkeit</span>
                <span className="font-bold tabular-nums">{data.puenktlichkeits_pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-matcha-400 transition-all duration-500" style={{ width: `${data.puenktlichkeits_pct}%` }} />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Bewertung</span>
                <span className="font-bold tabular-nums">★ {data.bewertung_avg.toFixed(1)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-yellow-400 transition-all duration-500" style={{ width: `${(data.bewertung_avg / 5) * 100}%` }} />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Stornofreiheit</span>
                <span className="font-bold tabular-nums">{100 - data.storno_pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-blue-400 transition-all duration-500" style={{ width: `${100 - data.storno_pct}%` }} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-muted/30 px-3 py-2 text-[11px]">
            <TrendLabel trend={data.trend} />
            <span className="text-muted-foreground">Team-Ø: <strong className="text-foreground">{data.team_score}</strong></span>
            <span className="text-muted-foreground">{data.touren} Touren heute</span>
          </div>
        </div>
      )}
    </div>
  );
}
