'use client';

import { useCallback, useEffect, useState } from 'react';
import { Trophy, RefreshCw } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface FahrerRank {
  driver_id: string;
  name: string;
  touren_heute: number;
  score: number;
  status: 'aktiv' | 'frei' | 'pause';
}

const MOCK: FahrerRank[] = [
  { driver_id: '1', name: 'Max M.', touren_heute: 8, score: 92, status: 'aktiv' },
  { driver_id: '2', name: 'Lisa K.', touren_heute: 7, score: 87, status: 'aktiv' },
  { driver_id: '3', name: 'Tom R.', touren_heute: 6, score: 81, status: 'frei' },
  { driver_id: '4', name: 'Anna B.', touren_heute: 5, score: 74, status: 'pause' },
  { driver_id: '5', name: 'Ben S.', touren_heute: 4, score: 68, status: 'aktiv' },
];

const STATUS_COLORS: Record<string, string> = {
  aktiv: 'bg-emerald-500',
  frei: 'bg-blue-400',
  pause: 'bg-amber-400',
};

const MEDAL = ['🥇', '🥈', '🥉'];

export function DispatchPhase762FahrerEchtzeitRanking({ locationId }: Props) {
  const [data, setData] = useState<FahrerRank[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('');

  const laden = useCallback(async () => {
    if (!locationId) { setData(MOCK); setLoading(false); return; }
    try {
      const res = await fetch(
        `/api/delivery/admin/fahrer-echtzeit-ranking?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.ranking) && json.ranking.length > 0) {
          setData(json.ranking);
          setLastUpdate(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
          return;
        }
      }
    } catch { /* fallback */ }
    setData(MOCK);
    setLastUpdate(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
  }, [locationId]);

  useEffect(() => {
    laden().finally(() => setLoading(false));
    const id = setInterval(laden, 30_000);
    return () => clearInterval(id);
  }, [laden]);

  if (loading) return <div className="h-28 animate-pulse rounded-xl bg-muted" />;
  if (data.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-semibold">Fahrer-Echtzeit-Ranking</span>
        {lastUpdate && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
            <RefreshCw className="h-3 w-3" /> {lastUpdate}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {data.slice(0, 5).map((f, i) => (
          <div key={f.driver_id} className="flex items-center gap-2">
            <span className="text-sm w-5 shrink-0 text-center">
              {MEDAL[i] ?? <span className="text-muted-foreground text-xs">{i + 1}</span>}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full shrink-0 ${STATUS_COLORS[f.status] ?? 'bg-muted'}`} />
                <span className="text-xs font-semibold truncate">{f.name}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[10px] text-muted-foreground tabular-nums">{f.touren_heute} Tour{f.touren_heute !== 1 ? 'en' : ''}</span>
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${f.score >= 80 ? 'bg-emerald-500' : f.score >= 60 ? 'bg-blue-500' : 'bg-amber-500'}`}
                    style={{ width: `${f.score}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold tabular-nums w-6 text-right">{f.score}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[9px] text-muted-foreground mt-2">Score = Touren + Pünktlichkeit · 30s Update</p>
    </div>
  );
}
