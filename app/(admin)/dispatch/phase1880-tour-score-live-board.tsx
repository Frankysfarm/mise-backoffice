'use client';

/**
 * Phase 1880 — Tour-Score Live-Board
 *
 * Zeigt alle aktiven Touren in einem übersichtlichen Score-Board:
 * - Score 0–100 als farbiger Arc-Indikator
 * - Stopps-Fortschritt + verbleibende Zeit
 * - Trends: vorwärts / neutral / verzögert
 * - Sortiert nach Score (schlechtester zuerst)
 *
 * Score-Formel: (erledigte_stopps/gesamt) / (verstrichene_zeit/eta) × 100
 * Kein API-Fetch nötig — berechnet aus Batch-Daten.
 */

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, TrendingUp, TrendingDown, Minus, Bike, Clock, CheckCircle2, ChevronDown, ChevronUp, Zap, Target } from 'lucide-react';

type Stop = {
  id: string;
  geliefert_am?: string | null;
  angekommen_am?: string | null;
  reihenfolge?: number;
};

type Batch = {
  id: string;
  status?: string;
  total_eta_min?: number | null;
  startzeit?: string | null;
  started_at?: string | null;
  zone?: string | null;
  fahrer?: { vorname?: string; nachname?: string } | null;
  driver?: { name?: string } | null;
  stops?: Stop[];
};

interface Props {
  batches: Batch[];
  className?: string;
}

type Grade = 'S' | 'A' | 'B' | 'C' | 'D';
type Trend = 'ahead' | 'on-time' | 'behind';

interface ScoreRow {
  id: string;
  driverName: string;
  zone: string | null;
  score: number;
  grade: Grade;
  trend: Trend;
  completedStops: number;
  totalStops: number;
  remainMin: number | null;
  elapsedMin: number;
  eta: number | null;
  progressPct: number;
  timePct: number;
}

function grade(score: number): Grade {
  if (score >= 90) return 'S';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  if (score >= 45) return 'C';
  return 'D';
}

const GRADE_STYLE: Record<Grade, { bg: string; text: string; border: string }> = {
  S: { bg: 'bg-matcha-500', text: 'text-white', border: 'border-matcha-400' },
  A: { bg: 'bg-matcha-400', text: 'text-white', border: 'border-matcha-300' },
  B: { bg: 'bg-amber-400',  text: 'text-white', border: 'border-amber-300'  },
  C: { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-400' },
  D: { bg: 'bg-red-500',    text: 'text-white', border: 'border-red-400'    },
};

const ARC_COLOR: Record<Grade, string> = {
  S: '#4CAF50',
  A: '#81C784',
  B: '#FFB300',
  C: '#FF7043',
  D: '#E53935',
};

function ScoreArc({ score, grade }: { score: number; grade: Grade }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className="shrink-0">
      <circle cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/30" />
      <circle
        cx="24" cy="24" r={r}
        fill="none"
        stroke={ARC_COLOR[grade]}
        strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 24 24)"
        className="transition-all duration-700"
      />
      <text x="24" y="29" textAnchor="middle" fontSize="11" fontWeight="800" fill={ARC_COLOR[grade]}>
        {score}
      </text>
    </svg>
  );
}

export function DispatchPhase1880TourScoreLiveBoard({ batches, className }: Props) {
  const [open, setOpen] = useState(true);
  const now = Date.now();

  const rows = useMemo<ScoreRow[]>(() => {
    const active = batches.filter((b) => b.status === 'active' || b.status === 'in_progress' || b.status === 'on_tour');
    return active.map((b): ScoreRow => {
      const startMs = b.startzeit ?? b.started_at
        ? new Date((b.startzeit ?? b.started_at)!).getTime() : null;
      const elapsedMin = startMs ? (now - startMs) / 60_000 : 0;
      const eta = b.total_eta_min ?? null;
      const remainMin = eta !== null ? Math.max(0, eta - elapsedMin) : null;
      const timePct = eta && eta > 0 ? Math.min(1, elapsedMin / eta) : 0;

      const stops = b.stops ?? [];
      const totalStops = stops.length;
      const completedStops = stops.filter((s) => s.geliefert_am).length;
      const progressPct = totalStops > 0 ? completedStops / totalStops : 0;

      const rawScore = timePct > 0 ? Math.min(100, Math.round((progressPct / timePct) * 100)) : (progressPct === 1 ? 100 : 50);
      const g = grade(rawScore);
      const diff = progressPct - timePct;
      const trend: Trend = diff > 0.1 ? 'ahead' : diff < -0.1 ? 'behind' : 'on-time';

      const driverName = b.fahrer
        ? `${b.fahrer.vorname ?? ''} ${(b.fahrer.nachname ?? '')[0] ?? ''}.`.trim()
        : b.driver?.name ?? 'Fahrer';

      return {
        id: b.id,
        driverName,
        zone: b.zone ?? null,
        score: rawScore,
        grade: g,
        trend,
        completedStops,
        totalStops,
        remainMin,
        elapsedMin: Math.floor(elapsedMin),
        eta,
        progressPct: Math.round(progressPct * 100),
        timePct: Math.round(timePct * 100),
      };
    }).sort((a, b) => a.score - b.score);
  }, [batches, now]);

  if (rows.length === 0) return null;

  const avgScore = Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length);
  const hinter = rows.filter((r) => r.trend === 'behind').length;

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Trophy className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Tour-Score Live-Board</span>
        <span className={cn(
          'ml-1 rounded-full px-2 py-0.5 text-[10px] font-black',
          avgScore >= 75 ? 'bg-matcha-100 dark:bg-matcha-900/30 text-matcha-700 dark:text-matcha-300'
            : avgScore >= 55 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
        )}>
          Ø {avgScore}
        </span>
        {hinter > 0 && (
          <span className="rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
            {hinter} verzögert
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">{rows.length} Touren</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="divide-y">
          {rows.map((row) => {
            const gs = GRADE_STYLE[row.grade];
            return (
              <div key={row.id} className="px-4 py-3 flex items-center gap-3">
                {/* Score Arc */}
                <ScoreArc score={row.score} grade={row.grade} />

                {/* Infos */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold truncate">{row.driverName}</span>
                    {row.zone && (
                      <span className="text-[9px] rounded-full border bg-background px-1.5 py-0.5 font-bold">
                        Zone {row.zone}
                      </span>
                    )}
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-black', gs.bg, gs.text)}>
                      {row.grade}
                    </span>
                    {/* Trend */}
                    {row.trend === 'ahead'   && <TrendingUp   className="h-3 w-3 text-matcha-500" />}
                    {row.trend === 'behind'  && <TrendingDown  className="h-3 w-3 text-red-500" />}
                    {row.trend === 'on-time' && <Minus         className="h-3 w-3 text-muted-foreground" />}
                  </div>

                  {/* Fortschrittsbalken */}
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>{row.completedStops}/{row.totalStops} Stopps</span>
                      {row.remainMin !== null && (
                        <>
                          <Clock className="h-3 w-3 ml-1" />
                          <span className="font-bold text-foreground tabular-nums">~{Math.ceil(row.remainMin)} Min verbleibend</span>
                        </>
                      )}
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', row.score >= 75 ? 'bg-matcha-500' : row.score >= 55 ? 'bg-amber-400' : 'bg-red-500')}
                        style={{ width: `${row.progressPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="px-4 py-2 bg-muted/20">
            <p className="text-[9px] text-muted-foreground">
              Score = (Stopps-Fortschritt / Zeit-Fortschritt) × 100 · S≥90 · A≥75 · B≥60 · C≥45 · D&lt;45
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
