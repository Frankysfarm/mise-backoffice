'use client';

/**
 * DispatchSmartZuweisungsKommando — Phase 406
 *
 * Zeigt die Top-5-Fahrer nach Dispatch-Score mit Empfehlung für die nächste Zuweisung.
 * API: GET /api/delivery/dispatch/scores
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Target, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DriverScore {
  name: string;
  vehicle: string;
  score: number;
}

function vehicleEmoji(vehicle: string): string {
  const v = vehicle.toLowerCase();
  if (v.includes('bike') || v.includes('fahrrad')) return '🚲';
  if (v.includes('moped') || v.includes('mofa')) return '🛵';
  if (v.includes('car') || v.includes('auto')) return '🚗';
  return '📦';
}

function scoreBadgeClass(score: number): string {
  if (score >= 80) return 'bg-matcha-100 text-matcha-800 border-matcha-300';
  if (score >= 60) return 'bg-amber-50 text-amber-800 border-amber-300';
  return 'bg-red-50 text-red-800 border-red-300';
}

function scoreTextClass(score: number): string {
  if (score >= 80) return 'text-matcha-700';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

export function DispatchSmartZuweisungsKommando() {
  const [drivers, setDrivers] = useState<DriverScore[]>([]);
  const [open, setOpen] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/dispatch/scores', { cache: 'no-store' });
      if (!res.ok) return;
      const json: DriverScore[] = await res.json();
      const top5 = [...json]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      setDrivers(top5);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 25_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

  return (
    <div className="rounded-xl border border-matcha-200 bg-white overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-matcha-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-matcha-600" />
          <span className="font-semibold text-sm text-foreground">Zuweisungs-Score Board</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-matcha-200">
          {drivers.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              Keine aktiven Fahrer
            </div>
          ) : (
            <div className="divide-y divide-matcha-100">
              {drivers.map((driver, idx) => (
                <div key={driver.name + idx} className="flex items-center gap-3 px-4 py-3">
                  {/* Rank */}
                  <div className="shrink-0 w-5 text-center text-xs font-bold text-muted-foreground">
                    {idx + 1}
                  </div>

                  {/* Vehicle emoji */}
                  <div className="shrink-0 text-base">{vehicleEmoji(driver.vehicle)}</div>

                  {/* Name + subtitle */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{driver.name}</div>
                    {idx === 0 && (
                      <div className="text-[11px] text-matcha-600 font-medium">
                        Empfehlung für nächste Zuweisung
                      </div>
                    )}
                  </div>

                  {/* Score badge */}
                  <div
                    className={cn(
                      'shrink-0 inline-flex items-center justify-center rounded-lg border px-2.5 py-1 min-w-[48px]',
                      scoreBadgeClass(driver.score),
                    )}
                  >
                    <span className={cn('text-lg font-bold leading-none', scoreTextClass(driver.score))}>
                      {driver.score}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
