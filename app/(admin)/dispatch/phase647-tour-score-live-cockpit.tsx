'use client';

import { useEffect, useMemo, useState } from 'react';
import { Trophy, Clock, Route, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Stop {
  geliefert_am?: string | null;
}

interface Batch {
  id: string;
  status?: string | null;
  fahrer?: { vorname?: string; nachname?: string } | null;
  fahrer_id?: string | null;
  startzeit?: string | null;
  total_eta_min?: number | null;
  zone?: string | null;
  stops?: Stop[];
}

interface Props {
  batches: Batch[];
}

type ScoreLevel = 'A' | 'B' | 'C' | 'D';

function calcScore(batch: Batch, now: number): { level: ScoreLevel; score: number; pct: number } {
  const total = batch.stops?.length ?? 0;
  const done = batch.stops?.filter((s) => s.geliefert_am).length ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const startMs = batch.startzeit ? new Date(batch.startzeit).getTime() : null;
  const elapsedMin = startMs ? Math.floor((now - startMs) / 60_000) : 0;
  const etaMin = batch.total_eta_min ?? 40;
  const timeUsedPct = elapsedMin / etaMin;
  const donePct = total > 0 ? done / total : 0;

  const efficiency = donePct > 0 ? donePct / Math.max(0.01, timeUsedPct) : 0.5;
  const score = Math.min(100, Math.round(efficiency * 100));

  const level: ScoreLevel =
    score >= 85 ? 'A' :
    score >= 65 ? 'B' :
    score >= 45 ? 'C' : 'D';

  return { level, score, pct };
}

const LEVEL_CFG: Record<ScoreLevel, { bg: string; text: string; border: string; badge: string }> = {
  A: { bg: 'bg-matcha-50 dark:bg-matcha-950/20', text: 'text-matcha-700 dark:text-matcha-300', border: 'border-matcha-200 dark:border-matcha-800', badge: 'bg-matcha-500 text-white' },
  B: { bg: 'bg-blue-50 dark:bg-blue-950/20',     text: 'text-blue-700 dark:text-blue-300',     border: 'border-blue-200 dark:border-blue-800',     badge: 'bg-blue-500 text-white'   },
  C: { bg: 'bg-amber-50 dark:bg-amber-950/20',   text: 'text-amber-700 dark:text-amber-300',   border: 'border-amber-200 dark:border-amber-800',   badge: 'bg-amber-400 text-white'  },
  D: { bg: 'bg-red-50 dark:bg-red-950/20',       text: 'text-red-700 dark:text-red-300',       border: 'border-red-200 dark:border-red-800',       badge: 'bg-red-500 text-white'    },
};

export function DispatchPhase647TourScoreLiveCockpit({ batches }: Props) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const aktiv = useMemo(() => {
    return batches
      .filter((b) => ['unterwegs', 'on_route', 'gestartet', 'in_delivery'].includes(b.status ?? ''))
      .map((b) => {
        const { level, score, pct } = calcScore(b, now);
        const driverName = b.fahrer
          ? `${b.fahrer.vorname ?? ''} ${(b.fahrer.nachname ?? '').charAt(0)}.`.trim()
          : 'Fahrer';
        const total = b.stops?.length ?? 0;
        const done = b.stops?.filter((s) => s.geliefert_am).length ?? 0;
        const startMs = b.startzeit ? new Date(b.startzeit).getTime() : null;
        const elapsedMin = startMs ? Math.floor((now - startMs) / 60_000) : 0;
        const remainMin = b.total_eta_min ? Math.max(0, b.total_eta_min - elapsedMin) : null;
        return { batch: b, level, score, pct, driverName, total, done, elapsedMin, remainMin };
      })
      .sort((a, b) => b.score - a.score);
  }, [batches, now]);

  if (aktiv.length === 0) return null;

  const avgScore = aktiv.length > 0
    ? Math.round(aktiv.reduce((sum, t) => sum + t.score, 0) / aktiv.length)
    : 0;

  const aCount = aktiv.filter((t) => t.level === 'A').length;
  const dCount = aktiv.filter((t) => t.level === 'D').length;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Tour-Score · Live-Cockpit
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs font-black tabular-nums text-foreground">Ø {avgScore}</span>
          <span className="text-[9px] text-muted-foreground">/ 100</span>
          {dCount > 0 && (
            <span className="rounded-full bg-red-100 text-red-700 text-[9px] font-bold px-1.5 py-0.5">
              {dCount}× D
            </span>
          )}
        </div>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {aktiv.map((t, i) => {
          const cfg = LEVEL_CFG[t.level];
          return (
            <div key={t.batch.id} className={`flex items-center gap-3 px-4 py-2.5 ${cfg.bg}`}>
              <span className="shrink-0 text-xs font-black text-muted-foreground w-4">{i + 1}</span>

              <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black ${cfg.badge}`}>
                {t.level}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground truncate">{t.driverName}</span>
                  {t.batch.zone && (
                    <span className="text-[9px] rounded bg-white/60 dark:bg-black/20 border px-1 py-0.5 font-bold shrink-0">
                      Zone {t.batch.zone}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        t.level === 'A' ? 'bg-matcha-500' :
                        t.level === 'B' ? 'bg-blue-500' :
                        t.level === 'C' ? 'bg-amber-400' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${t.pct}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground shrink-0 tabular-nums">
                    {t.done}/{t.total} Stopps
                  </span>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className={`text-sm font-black tabular-nums ${cfg.text}`}>{t.score}</div>
                {t.remainMin !== null && (
                  <div className="text-[9px] text-muted-foreground tabular-nums">
                    ~{t.remainMin}m
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-4 divide-x divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800">
        {(['A', 'B', 'C', 'D'] as ScoreLevel[]).map((level) => {
          const count = aktiv.filter((t) => t.level === level).length;
          const cfg = LEVEL_CFG[level];
          return (
            <div key={level} className="px-3 py-2 text-center">
              <div className={`text-lg font-black tabular-nums ${cfg.text}`}>{count}</div>
              <div className="text-[9px] text-muted-foreground font-bold">Score {level}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
