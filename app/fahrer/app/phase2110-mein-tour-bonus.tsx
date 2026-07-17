'use client';

import { useCallback, useEffect, useState } from 'react';
import { Flame, Trophy, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DriverRow {
  driver_id: string;
  name: string;
  touren_abgeschlossen: number;
  bonus_punkte: number;
  streak_count: number;
  multiplikator: number;
}

interface ApiData {
  fahrer: DriverRow[];
  team_gesamt_bonus: number;
}

const MOCK: ApiData = {
  team_gesamt_bonus: 260,
  fahrer: [
    { driver_id: 'me',  name: 'Ich',      touren_abgeschlossen: 3, bonus_punkte: 90, streak_count: 3, multiplikator: 1.5 },
    { driver_id: 'd2', name: 'Sarah K.', touren_abgeschlossen: 3, bonus_punkte: 90, streak_count: 3, multiplikator: 1.5 },
  ],
};

const TIPS: Record<string, string> = {
  high:   '🔥 Großartig! Weiter so — ×2 Multiplikator bei 5 Touren!',
  mid:    '💪 Noch 2 Touren bis zum ×2,0-Multiplikator!',
  low:    '🚀 Erste Tour abschließen und Streak starten!',
};

interface Props { driverId: string | null; locationId: string | null; isOnline: boolean }

export function FahrerPhase2110MeinTourBonus({ driverId, locationId, isOnline }: Props) {
  const [open, setOpen]   = useState(true);
  const [data, setData]   = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId || !isOnline) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/tour-abschluss-bonus?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ } finally {
      setLoading(false);
    }
  }, [locationId, isOnline]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline) return null;

  const me = data.fahrer.find(f => f.driver_id === driverId) ?? data.fahrer[0];
  if (!me) return null;

  const tipKey = me.touren_abgeschlossen >= 5 ? 'high' : me.touren_abgeschlossen >= 1 ? 'mid' : 'low';
  const tip = TIPS[tipKey];
  const ringPct = Math.min(100, (me.touren_abgeschlossen / 5) * 100);
  const ringColor = me.touren_abgeschlossen >= 5 ? 'text-orange-500' : me.touren_abgeschlossen >= 3 ? 'text-amber-500' : 'text-matcha-500';

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Mein Tour-Bonus</span>
        {me.streak_count >= 3 && (
          <span className="flex items-center gap-1 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5">
            <Flame className="h-3 w-3" />{me.streak_count}-Streak
          </span>
        )}
        {loading && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* Score hero */}
          <div className="flex items-center gap-4">
            {/* Ring gauge */}
            <div className="relative h-16 w-16 shrink-0">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-muted" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  className={cn('transition-all duration-700', ringColor)}
                  strokeWidth="3"
                  strokeDasharray={`${ringPct} ${100 - ringPct}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn('text-xs font-black tabular-nums', ringColor)}>{me.touren_abgeschlossen}/5</span>
              </div>
            </div>

            <div className="flex-1">
              <div className="text-2xl font-black tabular-nums text-amber-700">{me.bonus_punkte} Pkt</div>
              <div className="text-[10px] text-muted-foreground">Multiplikator</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={cn('text-sm font-black', me.multiplikator >= 2.0 ? 'text-orange-600' : me.multiplikator >= 1.5 ? 'text-amber-600' : 'text-matcha-600')}>
                  ×{me.multiplikator.toFixed(1)}
                </span>
                {me.streak_count >= 3 && (
                  <span className="flex items-center gap-0.5 text-orange-600 text-[10px] font-bold">
                    <Flame className="h-3 w-3" />{me.streak_count}-Tour-Streak
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-muted/40 border px-2 py-1.5 text-center">
              <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Touren</div>
              <div className="text-base font-black tabular-nums">{me.touren_abgeschlossen}</div>
            </div>
            <div className="rounded-lg bg-muted/40 border px-2 py-1.5 text-center">
              <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Streak</div>
              <div className="text-base font-black tabular-nums text-orange-600">{me.streak_count}</div>
            </div>
            <div className="rounded-lg bg-muted/40 border px-2 py-1.5 text-center">
              <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Team-Ges.</div>
              <div className="text-base font-black tabular-nums">{data.team_gesamt_bonus}</div>
            </div>
          </div>

          {/* Tip */}
          <div className="rounded-lg bg-matcha-50 border border-matcha-200 px-3 py-2 flex items-start gap-2">
            <Zap className="h-4 w-4 text-matcha-600 shrink-0 mt-0.5" />
            <p className="text-xs text-matcha-700">{tip}</p>
          </div>

          <p className="text-[9px] text-muted-foreground text-right">30-Min-Polling · Heute</p>
        </div>
      )}
    </div>
  );
}
