'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';

interface AbschlussData {
  ok: boolean;
  verlauf: { datum: string; gesamt: number; abgeschlossen: number; rate: number }[];
  schnitt7d: number;
  heutRate: number | null;
}

const MOCK: AbschlussData = {
  ok: true,
  verlauf: [
    { datum: '2026-07-10', gesamt: 8, abgeschlossen: 8, rate: 100 },
    { datum: '2026-07-11', gesamt: 9, abgeschlossen: 9, rate: 100 },
    { datum: '2026-07-12', gesamt: 7, abgeschlossen: 6, rate: 85.7 },
    { datum: '2026-07-13', gesamt: 10, abgeschlossen: 10, rate: 100 },
    { datum: '2026-07-14', gesamt: 8, abgeschlossen: 8, rate: 100 },
    { datum: '2026-07-15', gesamt: 9, abgeschlossen: 9, rate: 100 },
    { datum: '2026-07-16', gesamt: 6, abgeschlossen: 6, rate: 100 },
  ],
  schnitt7d: 97.5,
  heutRate: 100,
};

const TEAM_MOCK_AVG = 93.5;
const POLL_MS = 30 * 60 * 1000;

function motivationText(rate: number, vsTeam: number): string {
  if (rate >= 99) return 'Perfekte Woche! Du bist Klasse A — weiter so!';
  if (rate >= 95 && vsTeam > 0) return `${vsTeam.toFixed(1)}% über Team-Ø — starke Leistung!`;
  if (rate >= 90) return 'Solide Abschlussrate — du machst deinen Job sehr gut!';
  if (rate >= 85) return 'Noch Luft nach oben — jede Tour zählt!';
  return 'Heute war schwierig — morgen wird besser. Fokus auf Abschlüsse!';
}

export function FahrerPhase2033MeineTourAbschlussBilanz({
  locationId,
  isOnline,
  className,
}: {
  locationId: string | null;
  isOnline: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<AbschlussData | null>(null);

  useEffect(() => {
    if (!locationId || !isOnline) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/touren-abschluss-rate?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(MOCK);
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [locationId, isOnline]);

  if (!isOnline) return null;

  const d = data ?? MOCK;
  const myRate = d.heutRate ?? d.schnitt7d;
  const vsTeam = myRate - TEAM_MOCK_AVG;
  const trend = vsTeam > 2 ? 'up' : vsTeam < -2 ? 'down' : 'gleich';
  const rateColor = myRate >= 95 ? 'text-matcha-700 dark:text-matcha-400' : myRate >= 85 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className={cn('rounded-xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="font-semibold text-sm flex-1">Meine Tour-Abschluss-Bilanz</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Main KPI */}
          <div className="flex items-center gap-4">
            <div>
              <div className={cn('text-3xl font-black tabular-nums', rateColor)}>
                {myRate.toFixed(1)}%
              </div>
              <div className="text-[10px] text-muted-foreground">Abschlussrate (7 Tage)</div>
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-1 text-xs">
                {trend === 'up' && <TrendingUp className="h-4 w-4 text-matcha-600" />}
                {trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
                {trend === 'gleich' && <Minus className="h-4 w-4 text-muted-foreground" />}
                <span className={cn('font-semibold', trend === 'up' ? 'text-matcha-700 dark:text-matcha-400' : trend === 'down' ? 'text-red-600' : 'text-muted-foreground')}>
                  {vsTeam >= 0 ? '+' : ''}{vsTeam.toFixed(1)}% vs. Team-Ø
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Team-Ø: <span className="font-semibold text-foreground">{TEAM_MOCK_AVG}%</span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
              <span>Meine Rate</span>
              <span>{myRate.toFixed(1)}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', myRate >= 95 ? 'bg-matcha-500' : myRate >= 85 ? 'bg-amber-400' : 'bg-red-500')}
                style={{ width: `${Math.min(100, myRate)}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
              <span>0%</span>
              <span className="text-red-400">85%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Mini weekly bars */}
          <div>
            <div className="text-[10px] text-muted-foreground mb-1">Letzte 7 Tage</div>
            <div className="flex items-end gap-1 h-8">
              {d.verlauf.map((tag) => {
                const h = Math.max(4, (tag.rate / 100) * 32);
                const col = tag.rate >= 95 ? 'bg-matcha-500' : tag.rate >= 85 ? 'bg-amber-400' : 'bg-red-500';
                return (
                  <div key={tag.datum} className="flex-1 flex flex-col items-center justify-end">
                    <div title={`${tag.datum}: ${tag.rate.toFixed(1)}%`} className={cn('w-full rounded-t-sm', col)} style={{ height: h }} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Motivation */}
          <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground italic">
            {motivationText(myRate, vsTeam)}
          </div>
        </div>
      )}
    </div>
  );
}
