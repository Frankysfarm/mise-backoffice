'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, Star, Loader2, Award } from 'lucide-react';

/**
 * Phase 934 — Tour-Lernkurve (Fahrer-App)
 *
 * Effizienz-Wachstum über 4 Wochen: Stopps/h + Pünktlichkeit% + Level.
 * Nur sichtbar wenn isOnline=true. 10-Min-Polling.
 */

interface Props {
  driverId: string;
  isOnline: boolean;
}

interface WocheData {
  woche: number;
  label: string;
  stopps_pro_h: number;
  puenktlichkeit_pct: number;
  score: number;
  touren: number;
}

interface LernData {
  wochen: WocheData[];
  level: string;
  delta_score: number;
  wachstum_pct: number;
  aktueller_score: number;
  driver_id: string;
  generatedAt: string;
}

const MOCK: LernData = {
  wochen: [
    { woche: 1, label: 'Vor 4 Wochen', stopps_pro_h: 4.2, puenktlichkeit_pct: 74, score: 63, touren: 18 },
    { woche: 2, label: 'Vor 3 Wochen', stopps_pro_h: 4.7, puenktlichkeit_pct: 79, score: 69, touren: 22 },
    { woche: 3, label: 'Vor 2 Wochen', stopps_pro_h: 5.1, puenktlichkeit_pct: 85, score: 76, touren: 24 },
    { woche: 4, label: 'Diese Woche', stopps_pro_h: 5.5, puenktlichkeit_pct: 89, score: 83, touren: 26 },
  ],
  level: 'Profi',
  delta_score: 20,
  wachstum_pct: 32,
  aktueller_score: 83,
  driver_id: '',
  generatedAt: new Date().toISOString(),
};

const LEVEL_CONFIG: Record<string, { color: string; icon: string }> = {
  'Einsteiger': { color: 'text-stone-600 bg-stone-100 border-stone-300', icon: '🌱' },
  'Aufsteiger': { color: 'text-sky-700 bg-sky-50 border-sky-200', icon: '⚡' },
  'Profi': { color: 'text-matcha-700 bg-matcha-50 border-matcha-200', icon: '🏆' },
  'Experte': { color: 'text-amber-700 bg-amber-50 border-amber-200', icon: '⭐' },
};

const POLL_MS = 10 * 60 * 1000;

export function FahrerPhase934TourLernkurve({ driverId, isOnline }: Props) {
  const [data, setData] = useState<LernData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!driverId || !isOnline) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/delivery/driver/lernkurve?driver_id=${driverId}`);
      if (res.ok) setData(await res.json());
      else setData({ ...MOCK, driver_id: driverId });
    } catch {
      setData({ ...MOCK, driver_id: driverId });
    } finally {
      setLoading(false);
    }
  }, [driverId, isOnline]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  if (!isOnline) return null;

  const d = data ?? MOCK;
  const maxScore = Math.max(...d.wochen.map((w) => w.score), 1);
  const levelCfg = LEVEL_CONFIG[d.level] ?? LEVEL_CONFIG['Aufsteiger'];

  return (
    <div className="rounded-xl border border-stone-700/40 bg-stone-800/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-matcha-400" />
          <span className="text-sm font-semibold text-white">Meine Lernkurve</span>
        </div>
        {loading && <Loader2 className="w-3 h-3 animate-spin text-stone-400" />}
        {!loading && (
          <span className={cn(
            'text-[11px] font-bold px-2 py-0.5 rounded-full border',
            levelCfg.color,
          )}>
            {levelCfg.icon} {d.level}
          </span>
        )}
      </div>

      {/* Score Wachstum */}
      <div className="flex items-center gap-3 rounded-lg bg-stone-900/50 px-3 py-2">
        <Award className="w-5 h-5 text-amber-400 shrink-0" />
        <div>
          <div className="text-white font-bold text-sm">
            Score {d.aktueller_score}/100
          </div>
          <div className="text-[11px] text-stone-400">
            +{d.delta_score} Punkte in 4 Wochen ({d.wachstum_pct > 0 ? '+' : ''}{d.wachstum_pct}%)
          </div>
        </div>
      </div>

      {/* Wochenbalken */}
      <div className="space-y-2">
        {d.wochen.map((w) => (
          <div key={w.woche} className="space-y-0.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className={cn('text-stone-400', w.woche === 4 && 'text-white font-semibold')}>
                {w.label}
              </span>
              <div className="flex items-center gap-2 text-stone-400">
                <span>{w.stopps_pro_h} St/h</span>
                <span>{w.puenktlichkeit_pct}% pünktl.</span>
                <span className={cn(
                  'font-bold',
                  w.woche === 4 ? 'text-matcha-400' : 'text-stone-400',
                )}>{w.score}</span>
              </div>
            </div>
            <div className="h-2 rounded-full bg-stone-700/50">
              <div
                className={cn(
                  'h-2 rounded-full transition-all duration-500',
                  w.woche === 4 ? 'bg-matcha-400' : 'bg-stone-500',
                )}
                style={{ width: `${(w.score / maxScore) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Motivations-Hinweis */}
      <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
        <Star className="w-3 h-3 text-amber-400" />
        {d.delta_score > 0
          ? `Super! Dein Score ist in 4 Wochen um ${d.delta_score} Punkte gewachsen.`
          : d.delta_score < 0
            ? `Tipp: Achte auf Pünktlichkeit und Stopps/h — das verbessert deinen Score.`
            : 'Halte dein Niveau — du bist auf gutem Weg!'}
      </div>
    </div>
  );
}
