'use client';

import { useCallback, useEffect, useState } from 'react';
import { Flame } from 'lucide-react';

interface Props {
  driverId: string;
}

interface StreakData {
  streak_tage: number;
  gesamt_touren: number;
  naechster_meilenstein: number | null;
  bis_meilenstein: number;
  meilensteine_erreicht: number[];
}

const MOCK: StreakData = {
  streak_tage: 5,
  gesamt_touren: 47,
  naechster_meilenstein: 50,
  bis_meilenstein: 3,
  meilensteine_erreicht: [10, 25],
};

function flameFarbe(tage: number) {
  if (tage >= 7) return 'text-orange-500';
  if (tage >= 3) return 'text-amber-500';
  return 'text-slate-400';
}

export function FahrerPhase734StreakAnzeige({ driverId }: Props) {
  const [data, setData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);

  const laden = useCallback(async () => {
    if (!driverId) { setData(MOCK); setLoading(false); return; }
    try {
      const res = await fetch(
        `/api/delivery/driver/fahrer-streak?driver_id=${driverId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (typeof json.streak_tage === 'number') {
          setData(json);
          return;
        }
      }
    } catch { /* fallback */ }
    setData(MOCK);
  }, [driverId]);

  useEffect(() => {
    laden().finally(() => setLoading(false));
  }, [laden]);

  if (loading || !data) return null;

  const fortschritt = data.naechster_meilenstein
    ? Math.round(((data.gesamt_touren - (data.naechster_meilenstein - data.bis_meilenstein)) / data.bis_meilenstein + (data.naechster_meilenstein - data.bis_meilenstein === 0 ? 0 : 0)) * 100)
    : 100;
  const pct = data.naechster_meilenstein
    ? Math.min(100, Math.round(((data.gesamt_touren % (data.naechster_meilenstein === 500 ? 500 : (data.naechster_meilenstein))) / data.naechster_meilenstein) * 100))
    : 100;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Flame className={`h-8 w-8 ${flameFarbe(data.streak_tage)}`} />
          {data.streak_tage >= 7 && (
            <span className="absolute -top-1 -right-1 text-[9px] font-bold text-orange-500">🔥</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black tabular-nums">{data.streak_tage}</span>
            <span className="text-xs text-muted-foreground">Tage in Folge</span>
          </div>
          <p className="text-[11px] text-muted-foreground">{data.gesamt_touren} Touren gesamt</p>
        </div>
        {data.meilensteine_erreicht.length > 0 && (
          <div className="flex gap-0.5 flex-wrap justify-end max-w-[80px]">
            {data.meilensteine_erreicht.map((m) => (
              <span key={m} className="text-[9px] bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded px-1 py-0.5 font-bold">
                {m}✓
              </span>
            ))}
          </div>
        )}
      </div>

      {data.naechster_meilenstein && (
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>Nächster Meilenstein: {data.naechster_meilenstein} Touren</span>
            <span>Noch {data.bis_meilenstein}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-500"
              style={{ width: `${Math.max(2, Math.min(100, 100 - Math.round((data.bis_meilenstein / data.naechster_meilenstein) * 100)))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
