'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Flame, Trophy, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

// Phase 1452 — Liefer-Streak-Anzeige (Fahrer-App)
// Aktuelle Streak-Tage (X Tage in Folge geliefert) + Highscore
// isOnline-Guard; localStorage + API; nach Phase1447

const STORAGE_KEY_STREAK = 'fahrer_streak_data';
const POLL_MS = 30 * 60 * 1000;

interface StreakData {
  streak_tage: number;
  highscore_tage: number;
  letzte_lieferung_datum: string | null;
  gesamt_liefertage: number;
}

interface Props {
  driverId: string;
  isOnline: boolean;
}

function buildMock(driverId: string): StreakData {
  const seed = driverId.charCodeAt(0) % 7;
  return {
    streak_tage: 3 + seed,
    highscore_tage: 12 + seed * 2,
    letzte_lieferung_datum: new Date().toISOString().slice(0, 10),
    gesamt_liefertage: 45 + seed * 5,
  };
}

function loadFromStorage(driverId: string): StreakData | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_STREAK}_${driverId}`);
    if (!raw) return null;
    return JSON.parse(raw) as StreakData;
  } catch {
    return null;
  }
}

function saveToStorage(driverId: string, data: StreakData): void {
  try {
    localStorage.setItem(`${STORAGE_KEY_STREAK}_${driverId}`, JSON.stringify(data));
  } catch {}
}

function flammeFarbe(streak: number): string {
  if (streak >= 14) return 'text-red-500';
  if (streak >= 7)  return 'text-orange-500';
  if (streak >= 3)  return 'text-amber-500';
  return 'text-yellow-400';
}

export function FahrerPhase1452LieferStreakAnzeige({ driverId, isOnline }: Props) {
  const [data, setData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!isOnline) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-streak?driver_id=${driverId}`);
      if (res.ok) {
        const json: StreakData = await res.json();
        setData(json);
        saveToStorage(driverId, json);
        return;
      }
    } catch {
      // fallthrough
    } finally {
      setLoading(false);
    }
    // localStorage-Fallback
    const cached = loadFromStorage(driverId);
    setData(cached ?? buildMock(driverId));
  }, [driverId, isOnline]);

  useEffect(() => {
    const cached = loadFromStorage(driverId);
    if (cached) setData(cached);
    load();
    timerRef.current = setInterval(load, POLL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load, driverId]);

  if (!isOnline) return null;

  const d = data ?? buildMock(driverId);
  const streakBreite = Math.min(100, Math.round((d.streak_tage / Math.max(d.highscore_tage, 1)) * 100));
  const istNeuHighscore = d.streak_tage >= d.highscore_tage && d.highscore_tage > 0;

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden transition-colors',
      d.streak_tage >= 7
        ? 'border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/20'
        : 'border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20',
    )}>
      {/* Header */}
      <button
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/30 dark:hover:bg-black/10 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <Flame className={cn('w-4 h-4 shrink-0', flammeFarbe(d.streak_tage))} />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1 text-left">
          Liefer-Streak
        </span>
        {loading && <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />}
        <span className={cn('text-lg font-black tabular-nums shrink-0', flammeFarbe(d.streak_tage))}>
          {d.streak_tage} Tage
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-amber-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-amber-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Aktuelle Streak + Fortschritt */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-amber-700 dark:text-amber-300 font-semibold">
                Rekord: {d.highscore_tage} Tage
              </span>
              <span className="font-bold text-amber-700 dark:text-amber-300">{streakBreite}%</span>
            </div>
            <div className="h-3 rounded-full bg-amber-200 dark:bg-amber-900/40 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700',
                  istNeuHighscore ? 'bg-emerald-500' :
                  d.streak_tage >= 7 ? 'bg-orange-500 dark:bg-orange-400' : 'bg-amber-400 dark:bg-amber-500',
                )}
                style={{ width: `${streakBreite}%` }}
              />
            </div>
            {istNeuHighscore && (
              <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                <Trophy className="w-3 h-3" /> Neuer Rekord!
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white/70 dark:bg-slate-800/50 border border-amber-100 dark:border-amber-800/50 px-3 py-2 text-center">
              <div className={cn('text-2xl font-black tabular-nums', flammeFarbe(d.streak_tage))}>
                {d.streak_tage}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Aktuell</div>
            </div>
            <div className="rounded-lg bg-white/70 dark:bg-slate-800/50 border border-amber-100 dark:border-amber-800/50 px-3 py-2 text-center">
              <div className="text-2xl font-black tabular-nums text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1">
                <Trophy className="w-4 h-4 text-amber-400" />
                {d.highscore_tage}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Highscore</div>
            </div>
          </div>

          <div className="text-center">
            <span className="text-[10px] text-slate-400">
              Gesamt: {d.gesamt_liefertage} Liefertage
            </span>
          </div>

          {d.streak_tage >= 7 && (
            <p className="text-[10px] text-center font-bold text-orange-600 dark:text-orange-400">
              🔥 {d.streak_tage} Tage am Stück — weiter so!
            </p>
          )}
        </div>
      )}
    </div>
  );
}
