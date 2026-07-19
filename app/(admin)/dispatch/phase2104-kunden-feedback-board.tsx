'use client';

import { useCallback, useEffect, useState } from 'react';
import { Star, TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
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
  top_fahrer: string | null;
  alert_niedriger_score: boolean;
}

const MOCK: ApiData = {
  team_avg_score: 4.4,
  top_fahrer: 'Max M.',
  alert_niedriger_score: true,
  fahrer: [
    { driver_id: 'd1', name: 'Max M.',   avg_score: 4.8, kommentare_count: 12, bewertungen_heute: 14, trend: 'besser',      trend_delta: 0.2,  alert: false },
    { driver_id: 'd2', name: 'Sarah K.', avg_score: 4.5, kommentare_count: 8,  bewertungen_heute: 11, trend: 'gleich',      trend_delta: 0.0,  alert: false },
    { driver_id: 'd3', name: 'Tom B.',   avg_score: 3.7, kommentare_count: 5,  bewertungen_heute: 9,  trend: 'schlechter', trend_delta: -0.4, alert: true  },
    { driver_id: 'd4', name: 'Anna L.',  avg_score: 4.6, kommentare_count: 10, bewertungen_heute: 13, trend: 'besser',      trend_delta: 0.3,  alert: false },
  ],
};

const THRESHOLD = 4.0;

function StarRating({ score }: { score: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={cn('h-3 w-3', i <= Math.round(score) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')}
        />
      ))}
    </span>
  );
}

interface Props { locationId: string | null }

export function DispatchPhase2104KundenFeedbackBoard({ locationId }: Props) {
  const [open, setOpen]       = useState(true);
  const [data, setData]       = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/kunden-feedback-score?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const TrendIcon = ({ trend, delta }: { trend: FahrerRow['trend']; delta: number }) => {
    if (trend === 'besser')      return <TrendingUp   className="h-3 w-3 text-matcha-600" aria-label={`+${delta}`} />;
    if (trend === 'schlechter')  return <TrendingDown className="h-3 w-3 text-red-500"    aria-label={`${delta}`} />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  const alertCount = data.fahrer.filter(f => f.alert).length;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Star className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">
          Kunden-Feedback
        </span>
        {alertCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5">
            <AlertTriangle className="h-3 w-3" /> {alertCount} unter 4,0
          </span>
        )}
        {loading && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-center">
              <div className="text-[10px] text-amber-600 font-semibold uppercase tracking-wide">Team-Ø</div>
              <div className={cn('text-xl font-black tabular-nums', data.team_avg_score < THRESHOLD ? 'text-red-600' : 'text-amber-700')}>
                {data.team_avg_score.toFixed(1)}<span className="text-xs font-normal ml-0.5">★</span>
              </div>
            </div>
            <div className="rounded-lg bg-muted/40 border px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Top Fahrer</div>
              <div className="text-xs font-bold text-foreground truncate mt-0.5">{data.top_fahrer ?? '–'}</div>
            </div>
            <div className="rounded-lg bg-muted/40 border px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Ziel</div>
              <div className="text-xl font-black text-matcha-700">&ge;{THRESHOLD}<span className="text-xs font-normal ml-0.5">★</span></div>
            </div>
          </div>

          {/* Alert banner */}
          {alertCount > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-700 font-medium">
                {alertCount} Fahrer unter {THRESHOLD} Sterne — Kundengespräch empfohlen
              </p>
            </div>
          )}

          {/* Driver ranking */}
          <div className="space-y-2">
            {data.fahrer.map((f, i) => (
              <div key={f.driver_id} className={cn('rounded-lg border px-3 py-2', f.alert ? 'bg-red-50 border-red-200' : 'bg-muted/20')}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn('text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shrink-0',
                    i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-amber-200 text-amber-900' : 'bg-muted text-muted-foreground',
                  )}>
                    {i + 1}
                  </span>
                  <span className="text-xs font-bold flex-1">{f.name}</span>
                  <TrendIcon trend={f.trend} delta={f.trend_delta} />
                  <span className={cn('text-sm font-black tabular-nums', f.alert ? 'text-red-600' : 'text-amber-700')}>
                    {f.avg_score.toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <StarRating score={f.avg_score} />
                  <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                    <MessageSquare className="h-2.5 w-2.5" />{f.kommentare_count}
                  </span>
                  <span className="text-[9px] text-muted-foreground ml-auto">{f.bewertungen_heute} Bewertungen</span>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[9px] text-muted-foreground text-right">30-Min-Polling · Heute</p>
        </div>
      )}
    </div>
  );
}
