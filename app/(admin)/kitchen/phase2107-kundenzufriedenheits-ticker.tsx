'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Star, ChevronDown, ChevronUp, AlertTriangle, Smile } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerRow {
  driver_id: string;
  name: string;
  avg_score: number;
  kommentare_count: number;
  bewertungen_heute: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  trend_delta: number;
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_score: number;
  alert_niedriger_score: boolean;
}

const MOCK: ApiData = {
  team_avg_score: 4.4,
  alert_niedriger_score: true,
  fahrer: [
    { driver_id: 'd1', name: 'Max M.',   avg_score: 4.8, kommentare_count: 12, bewertungen_heute: 14, trend: 'besser',      trend_delta: 0.2,  alert: false },
    { driver_id: 'd2', name: 'Sarah K.', avg_score: 4.5, kommentare_count: 8,  bewertungen_heute: 11, trend: 'gleich',      trend_delta: 0.0,  alert: false },
    { driver_id: 'd3', name: 'Tom B.',   avg_score: 3.7, kommentare_count: 5,  bewertungen_heute: 9,  trend: 'schlechter', trend_delta: -0.4, alert: true  },
    { driver_id: 'd4', name: 'Anna L.',  avg_score: 4.6, kommentare_count: 10, bewertungen_heute: 13, trend: 'besser',      trend_delta: 0.3,  alert: false },
  ],
};

function StarRating({ score }: { score: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={cn('h-2.5 w-2.5', i <= Math.round(score) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
      ))}
    </span>
  );
}

interface Props { locationId?: string | null }

export function KitchenPhase2107KundenzufriedenheitsTicker({ locationId }: Props) {
  const [open, setOpen]         = useState(true);
  const [data, setData]         = useState<ApiData>(MOCK);
  const [prevScore, setPrevScore] = useState<number | null>(null);
  const [loading, setLoading]   = useState(false);
  const prevRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/kunden-feedback-score?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) {
        const d: ApiData = await r.json();
        setPrevScore(prevRef.current);
        prevRef.current = d.team_avg_score;
        setData(d);
      }
    } catch { /* use mock */ } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const scoreFell = prevScore !== null && data.team_avg_score < prevScore;
  const alertCount = data.fahrer.filter(f => f.alert).length;
  const top5 = [...data.fahrer].sort((a, b) => b.avg_score - a.avg_score).slice(0, 5);

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Smile className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">
          Kundenzufriedenheit
        </span>
        {scoreFell && (
          <span className="flex items-center gap-1 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5">
            <AlertTriangle className="h-3 w-3" /> Score gesunken
          </span>
        )}
        {alertCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5">
            {alertCount} &lt; 4,0
          </span>
        )}
        {loading && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {/* Score fallen alert */}
          {scoreFell && (
            <div className="rounded-lg bg-orange-50 border border-orange-200 px-3 py-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
              <p className="text-xs text-orange-700 font-medium">
                Team-Score gesunken ({prevScore?.toFixed(1)} → {data.team_avg_score.toFixed(1)}) — Fahrer informieren
              </p>
            </div>
          )}

          {/* Team score */}
          <div className="flex items-center gap-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <div>
              <div className="text-[10px] text-amber-600 font-semibold uppercase tracking-wide">Team-Ø heute</div>
              <div className={cn('text-2xl font-black', data.team_avg_score < 4.0 ? 'text-red-600' : 'text-amber-700')}>
                {data.team_avg_score.toFixed(1)} ★
              </div>
            </div>
            <StarRating score={data.team_avg_score} />
          </div>

          {/* Top 5 live-feed */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Live-Feed — Top 5 Fahrer</p>
            {top5.map((f) => (
              <div key={f.driver_id} className={cn('flex items-center gap-2 rounded-lg border px-2.5 py-1.5', f.alert ? 'bg-red-50 border-red-200' : 'bg-muted/20')}>
                <StarRating score={f.avg_score} />
                <span className="text-xs font-bold flex-1">{f.name}</span>
                <span className={cn('text-xs font-black tabular-nums', f.alert ? 'text-red-600' : 'text-amber-700')}>
                  {f.avg_score.toFixed(1)}
                </span>
                <span className="text-[9px] text-muted-foreground">{f.bewertungen_heute}×</span>
              </div>
            ))}
          </div>

          <p className="text-[9px] text-muted-foreground text-right">10-Min-Polling · Heute</p>
        </div>
      )}
    </div>
  );
}
