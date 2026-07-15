'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, AlertCircle, Star } from 'lucide-react';

/**
 * Phase 1648 — Tour-Score-Live-Kommando (Dispatch)
 *
 * Echtzeit-Tour-Score je aktivem Fahrer: Gesamt-Score (0-100),
 * Pünktlichkeit, Effizienz, SLA-Ampel. 60s-Polling.
 */

interface TourScore {
  driver_id: string;
  driver_name: string;
  score: number;
  pünktlichkeit: number;
  effizienz: number;
  aktive_stops: number;
  fertige_stops: number;
  sla_status: 'ok' | 'warnung' | 'kritisch';
  trend: 'steigend' | 'fallend' | 'stabil';
}

interface ApiResponse {
  scores: TourScore[];
  avg_score: number;
  generiert_am: string;
}

const MOCK: ApiResponse = {
  scores: [
    { driver_id: '1', driver_name: 'Max M.', score: 87, pünktlichkeit: 92, effizienz: 83, aktive_stops: 3, fertige_stops: 2, sla_status: 'ok', trend: 'steigend' },
    { driver_id: '2', driver_name: 'Lisa K.', score: 74, pünktlichkeit: 71, effizienz: 77, aktive_stops: 4, fertige_stops: 1, sla_status: 'warnung', trend: 'stabil' },
    { driver_id: '3', driver_name: 'Tom B.', score: 55, pünktlichkeit: 48, effizienz: 62, aktive_stops: 5, fertige_stops: 0, sla_status: 'kritisch', trend: 'fallend' },
  ],
  avg_score: 72,
  generiert_am: new Date().toISOString(),
};

function scoreStyle(score: number): { bar: string; text: string; bg: string } {
  if (score >= 80) return { bar: 'bg-matcha-500', text: 'text-matcha-700 dark:text-matcha-300', bg: 'bg-matcha-50 dark:bg-matcha-900/20 border-matcha-200 dark:border-matcha-700' };
  if (score >= 60) return { bar: 'bg-yellow-400', text: 'text-yellow-700 dark:text-yellow-300', bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700' };
  return { bar: 'bg-red-500', text: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700' };
}

function TrendIcon({ trend }: { trend: TourScore['trend'] }) {
  if (trend === 'steigend') return <TrendingUp className="h-3 w-3 text-matcha-500" />;
  if (trend === 'fallend') return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-zinc-400" />;
}

const SLA_BADGE: Record<TourScore['sla_status'], string> = {
  ok:       'bg-matcha-100 dark:bg-matcha-900/30 text-matcha-700 dark:text-matcha-300 border-matcha-300',
  warnung:  'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300',
  kritisch: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 animate-pulse',
};
const SLA_LABEL: Record<TourScore['sla_status'], string> = { ok: 'SLA OK', warnung: 'SLA ⚠', kritisch: 'SLA!' };

interface Props {
  locationId: string | null;
}

export function DispatchPhase1648TourScoreLiveKommando({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const url = locationId
          ? `/api/delivery/admin/driver-score-board?location_id=${locationId}`
          : '/api/delivery/admin/driver-score-board';
        const res = await fetch(url);
        if (!res.ok) throw new Error();
        const raw = await res.json();
        const scores: TourScore[] = (raw.drivers ?? raw.scores ?? []).map((d: {
          driver_id?: string; id?: string;
          driver_name?: string; name?: string; vorname?: string; nachname?: string;
          score?: number; gesamt_score?: number;
          pünktlichkeit_score?: number; effizienz_score?: number;
          aktive_stops?: number; fertige_stops?: number; erledigte_stops?: number;
          sla_status?: string; trend?: string;
        }) => ({
          driver_id: d.driver_id ?? d.id ?? '?',
          driver_name: d.driver_name ?? d.name ?? `${d.vorname ?? ''} ${d.nachname?.[0] ?? ''}.`.trim(),
          score: d.score ?? d.gesamt_score ?? 70,
          pünktlichkeit: d.pünktlichkeit_score ?? 70,
          effizienz: d.effizienz_score ?? 70,
          aktive_stops: d.aktive_stops ?? 0,
          fertige_stops: d.fertige_stops ?? d.erledigte_stops ?? 0,
          sla_status: (d.sla_status ?? 'ok') as TourScore['sla_status'],
          trend: (d.trend ?? 'stabil') as TourScore['trend'],
        }));
        const avg = scores.length ? Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length) : 0;
        setData({ scores, avg_score: avg, generiert_am: new Date().toISOString() });
      } catch {
        setData(MOCK);
      }
    }
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const d = data ?? MOCK;
  const kritischCount = d.scores.filter(s => s.sla_status === 'kritisch').length;
  const topScore = d.scores.reduce((best, s) => s.score > best ? s.score : best, 0);

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-sm font-semibold">Tour-Score-Kommando</span>
          {kritischCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 border border-red-300 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300 animate-pulse">
              <AlertCircle className="h-3 w-3" />
              {kritischCount}× SLA-Risiko
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">Ø Score: {d.avg_score}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {d.scores.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Keine aktiven Touren.</p>
          )}
          {d.scores.map(s => {
            const style = scoreStyle(s.score);
            const isTop = s.score === topScore && d.scores.length > 1;
            return (
              <div key={s.driver_id} className={cn('rounded-lg border p-3 space-y-2', style.bg)}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isTop && <Star className="h-3 w-3 text-amber-500 shrink-0" />}
                    <span className="text-xs font-bold truncate">{s.driver_name}</span>
                    <TrendIcon trend={s.trend} />
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={cn('rounded-full border px-1.5 py-0.5 text-[9px] font-bold', SLA_BADGE[s.sla_status])}>
                      {SLA_LABEL[s.sla_status]}
                    </span>
                    <span className={cn('text-lg font-black tabular-nums', style.text)}>{s.score}</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', style.bar)}
                    style={{ width: `${s.score}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-1 text-[9px] text-muted-foreground">
                  <span>⏱ {s.pünktlichkeit}% pünktl.</span>
                  <span className="text-center">⚡ {s.effizienz}% effiz.</span>
                  <span className="text-right">{s.fertige_stops}/{s.fertige_stops + s.aktive_stops} Stops</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
