'use client';

import { useCallback, useEffect, useState } from 'react';
import { Star, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, MessageSquare, Lightbulb, WifiOff } from 'lucide-react';
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
}

const MOCK: ApiData = {
  team_avg_score: 4.4,
  fahrer: [
    { driver_id: 'd1', name: 'Max M.',   avg_score: 4.8, kommentare_count: 12, bewertungen_heute: 14, trend: 'besser',      trend_delta: 0.2,  alert: false },
    { driver_id: 'd2', name: 'Sarah K.', avg_score: 4.5, kommentare_count: 8,  bewertungen_heute: 11, trend: 'gleich',      trend_delta: 0.0,  alert: false },
    { driver_id: 'd3', name: 'Tom B.',   avg_score: 3.7, kommentare_count: 5,  bewertungen_heute: 9,  trend: 'schlechter', trend_delta: -0.4, alert: true  },
    { driver_id: 'd4', name: 'Anna L.',  avg_score: 4.6, kommentare_count: 10, bewertungen_heute: 13, trend: 'besser',      trend_delta: 0.3,  alert: false },
  ],
};

const TIPPS: Record<FahrerRow['trend'], string> = {
  besser:      'Super — weiter so! Deine Kunden sind begeistert.',
  gleich:      'Solides Niveau. Kleines Extra (Lächeln, pünktlich) hebt dich ab!',
  schlechter:  'Score gefallen — freundlicher Gruß beim Übergeben kann viel bewirken.',
};

function StarRating({ score, size = 'sm' }: { score: number; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'h-5 w-5' : 'h-3 w-3';
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={cn(cls, i <= Math.round(score) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
      ))}
    </span>
  );
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2105MeineKundenbewertung({ driverId, locationId, isOnline }: Props) {
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

  if (!isOnline) {
    return (
      <div className="rounded-xl border bg-card shadow-sm px-4 py-3 flex items-center gap-2 text-muted-foreground">
        <WifiOff className="h-4 w-4 shrink-0" />
        <span className="text-xs">Meine Kundenbewertung — offline nicht verfügbar</span>
      </div>
    );
  }

  const myRow = driverId ? data.fahrer.find(f => f.driver_id === driverId) : data.fahrer[0];
  const myScore  = myRow?.avg_score  ?? data.team_avg_score;
  const myTrend  = myRow?.trend      ?? 'gleich';
  const myKomm   = myRow?.kommentare_count ?? 0;
  const myBew    = myRow?.bewertungen_heute ?? 0;
  const teamAvg  = data.team_avg_score;
  const diffStr  = (myScore - teamAvg).toFixed(1);
  const diffSign = myScore >= teamAvg ? '+' : '';

  const TrendIcon = () => {
    if (myTrend === 'besser')     return <TrendingUp   className="h-3.5 w-3.5 text-matcha-600" />;
    if (myTrend === 'schlechter') return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Star className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">
          Meine Kundenbewertung
        </span>
        {myRow?.alert && (
          <span className="rounded-full bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5">unter 4,0</span>
        )}
        {loading && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* Score hero */}
          <div className={cn('rounded-xl border p-4 text-center', myRow?.alert ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200')}>
            <div className={cn('text-4xl font-black tabular-nums', myRow?.alert ? 'text-red-600' : 'text-amber-700')}>
              {myScore.toFixed(1)}
            </div>
            <StarRating score={myScore} size="lg" />
            <div className="flex items-center justify-center gap-1 mt-2 text-xs text-muted-foreground">
              <TrendIcon />
              <span>vs. Team-Ø {teamAvg.toFixed(1)} (</span>
              <span className={cn('font-bold', myScore >= teamAvg ? 'text-matcha-600' : 'text-red-500')}>
                {diffSign}{diffStr}
              </span>
              <span>)</span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-muted/40 border px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Bewertungen</div>
              <div className="text-lg font-black text-foreground">{myBew}</div>
            </div>
            <div className="rounded-lg bg-muted/40 border px-3 py-2 text-center flex flex-col items-center">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Kommentare</div>
              <div className="flex items-center gap-1 text-lg font-black text-foreground">
                <MessageSquare className="h-4 w-4 text-blue-500" />{myKomm}
              </div>
            </div>
          </div>

          {/* Motivations-Tipp */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">{TIPPS[myTrend]}</p>
          </div>

          <p className="text-[9px] text-muted-foreground text-right">30-Min-Update · Heute</p>
        </div>
      )}
    </div>
  );
}
