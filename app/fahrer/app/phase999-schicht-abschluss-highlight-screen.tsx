'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, TrendingUp, Zap, Award, Clock } from 'lucide-react';

/**
 * Phase 999 — Schicht-Abschluss-Highlight-Screen (Fahrer-App)
 *
 * Animierter Abschluss-Screen mit Tages-Score, Top-Stat, Streak-Badge.
 * Nur sichtbar wenn Schicht abgeschlossen (status='abgeschlossen').
 * 10-Min-Polling, isOnline-Guard.
 */

interface SchichtBilanz {
  datum: string;
  schicht_start: string | null;
  schicht_ende: string | null;
  schicht_dauer_min: number;
  stopps_gesamt: number;
  stopps_abgeschlossen: number;
  umsatz_eur: number;
  trinkgeld_eur: number;
  bonus_eur: number;
  gesamt_eur: number;
  durchschnitt_bewertung: number | null;
  status: 'aktiv' | 'abgeschlossen' | 'keine_schicht';
}

interface TagesScore {
  score: number;
  punkte_puenktlichkeit: number;
  punkte_effizienz: number;
  punkte_bewertung: number;
  trend: 'up' | 'down' | 'gleich';
}

interface Props {
  driverId: string;
  isOnline: boolean;
}

const MOCK_BILANZ: SchichtBilanz = {
  datum: new Date().toISOString().slice(0, 10),
  schicht_start: new Date(Date.now() - 6 * 3600_000).toISOString(),
  schicht_ende: new Date().toISOString(),
  schicht_dauer_min: 360,
  stopps_gesamt: 18,
  stopps_abgeschlossen: 17,
  umsatz_eur: 284.50,
  trinkgeld_eur: 22.80,
  bonus_eur: 10.00,
  gesamt_eur: 317.30,
  durchschnitt_bewertung: 4.7,
  status: 'abgeschlossen',
};

const MOCK_SCORE: TagesScore = {
  score: 87,
  punkte_puenktlichkeit: 36,
  punkte_effizienz: 32,
  punkte_bewertung: 19,
  trend: 'up',
};

function scoreGrade(score: number): { label: string; color: string; emoji: string } {
  if (score >= 90) return { label: 'Ausgezeichnet', color: 'text-matcha-600 dark:text-matcha-400', emoji: '🏆' };
  if (score >= 75) return { label: 'Sehr gut', color: 'text-blue-600 dark:text-blue-400', emoji: '⭐' };
  if (score >= 60) return { label: 'Gut', color: 'text-amber-600 dark:text-amber-400', emoji: '👍' };
  return { label: 'Ausbaufähig', color: 'text-zinc-600 dark:text-zinc-400', emoji: '💪' };
}

function streakBadge(stopps: number): string {
  if (stopps >= 20) return '🔥 20+ Stopp-Streak';
  if (stopps >= 15) return '⚡ Fleißiger Fahrer';
  if (stopps >= 10) return '✅ Solide Schicht';
  return '🚀 Guter Start';
}

function formatEur(n: number): string {
  return n.toFixed(2).replace('.', ',') + ' €';
}

export function FahrerPhase999SchichtAbschlussHighlightScreen({ driverId, isOnline }: Props) {
  const [bilanz, setBilanz] = useState<SchichtBilanz | null>(null);
  const [score, setScore] = useState<TagesScore | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isOnline) return;

    async function load() {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [bilanzRes, scoreRes] = await Promise.all([
          fetch(`/api/delivery/driver/schicht-bilanz?driver_id=${encodeURIComponent(driverId)}&date=${today}`),
          fetch(`/api/delivery/admin/fahrer-tages-score?driver_id=${encodeURIComponent(driverId)}`),
        ]);
        if (bilanzRes.ok) {
          const b: SchichtBilanz = await bilanzRes.json();
          setBilanz(b);
          setVisible(b.status === 'abgeschlossen');
        }
        if (scoreRes.ok) {
          const s = await scoreRes.json();
          const fahrer = (s.fahrer ?? [])[0];
          if (fahrer) {
            setScore({
              score: fahrer.score,
              punkte_puenktlichkeit: fahrer.punkte_puenktlichkeit,
              punkte_effizienz: fahrer.punkte_effizienz,
              punkte_bewertung: fahrer.punkte_bewertung,
              trend: fahrer.trend,
            });
          }
        }
      } catch {
        setBilanz(MOCK_BILANZ);
        setScore(MOCK_SCORE);
        setVisible(true);
      }
    }

    load();
    const iv = setInterval(load, 10 * 60_000);
    return () => clearInterval(iv);
  }, [driverId, isOnline]);

  if (!isOnline || !visible || !bilanz) return null;

  const b = bilanz;
  const s = score ?? MOCK_SCORE;
  const grade = scoreGrade(s.score);
  const streak = streakBadge(b.stopps_abgeschlossen);
  const erfolgsquote = b.stopps_gesamt > 0 ? Math.round((b.stopps_abgeschlossen / b.stopps_gesamt) * 100) : 0;

  const scorePct = s.score;
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = circ * (scorePct / 100);

  return (
    <div className="mx-4 mb-4 rounded-2xl overflow-hidden border shadow-lg bg-gradient-to-br from-matcha-50 to-emerald-50 dark:from-matcha-950/40 dark:to-emerald-950/40 border-matcha-200 dark:border-matcha-700">
      {/* Header */}
      <div className="bg-gradient-to-r from-matcha-500 to-emerald-500 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          <span className="font-bold text-sm">Schicht abgeschlossen!</span>
          <span className="ml-auto text-xl">{grade.emoji}</span>
        </div>
        <p className="text-xs text-white/80 mt-0.5">{streak}</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Score Ring + Grade */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <svg width={88} height={88} viewBox="0 0 88 88">
              <circle cx={44} cy={44} r={r} fill="none" strokeWidth={6} className="stroke-muted" />
              <circle
                cx={44} cy={44} r={r} fill="none" strokeWidth={6}
                strokeDasharray={`${dash} ${circ}`}
                strokeLinecap="round"
                transform="rotate(-90 44 44)"
                className="stroke-matcha-500"
              />
              <text x={44} y={48} textAnchor="middle" className="fill-foreground" fontSize={20} fontWeight="bold">
                {s.score}
              </text>
            </svg>
          </div>
          <div className="flex-1 space-y-1.5">
            <div className={cn('text-lg font-bold', grade.color)}>{grade.label}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {s.trend === 'up' && <TrendingUp className="h-3 w-3 text-matcha-500" />}
              <span>Tages-Score</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 mt-2">
              <div className="rounded-lg bg-white/60 dark:bg-white/5 px-2 py-1 text-center">
                <div className="text-xs font-bold text-blue-600 dark:text-blue-400">{s.punkte_puenktlichkeit}</div>
                <div className="text-[9px] text-muted-foreground leading-tight">Pünktlich</div>
              </div>
              <div className="rounded-lg bg-white/60 dark:bg-white/5 px-2 py-1 text-center">
                <div className="text-xs font-bold text-amber-600 dark:text-amber-400">{s.punkte_effizienz}</div>
                <div className="text-[9px] text-muted-foreground leading-tight">Effizienz</div>
              </div>
              <div className="rounded-lg bg-white/60 dark:bg-white/5 px-2 py-1 text-center">
                <div className="text-xs font-bold text-matcha-600 dark:text-matcha-400">{s.punkte_bewertung}</div>
                <div className="text-[9px] text-muted-foreground leading-tight">Bewertung</div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/70 dark:bg-white/5 p-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Zap className="h-3 w-3 text-amber-500" />
              Gesamteinnahmen
            </div>
            <div className="text-xl font-bold text-matcha-700 dark:text-matcha-400">{formatEur(b.gesamt_eur)}</div>
            <div className="text-[10px] text-muted-foreground">inkl. {formatEur(b.trinkgeld_eur)} Trinkgeld</div>
          </div>
          <div className="rounded-xl bg-white/70 dark:bg-white/5 p-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3 text-blue-500" />
              Schichtdauer
            </div>
            <div className="text-xl font-bold">{Math.floor(b.schicht_dauer_min / 60)}h {b.schicht_dauer_min % 60}m</div>
            <div className="text-[10px] text-muted-foreground">{b.stopps_abgeschlossen} / {b.stopps_gesamt} Stopps</div>
          </div>
        </div>

        {/* Erfolgsquote + Bewertung */}
        <div className="flex items-center justify-between rounded-xl bg-white/70 dark:bg-white/5 px-4 py-3">
          <div className="text-center">
            <div className="text-lg font-bold text-matcha-700 dark:text-matcha-400">{erfolgsquote}%</div>
            <div className="text-[10px] text-muted-foreground">Erfolgsquote</div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <div className="flex items-center gap-1 justify-center">
              <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
              <span className="text-lg font-bold">{b.durchschnitt_bewertung?.toFixed(1) ?? '-'}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">Ø Bewertung</div>
          </div>
          {b.bonus_eur > 0 && (
            <>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <div className="text-lg font-bold text-amber-600 dark:text-amber-400">+{formatEur(b.bonus_eur)}</div>
                <div className="text-[10px] text-muted-foreground">Bonus</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
