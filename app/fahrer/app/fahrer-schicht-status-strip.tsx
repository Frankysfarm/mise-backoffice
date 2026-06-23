'use client';

/**
 * FahrerSchichtStatusStrip — Phase 457
 * Kompakter Schicht-Status-Streifen: Start/Ende + verbleibende Zeit + Fortschrittsbalken.
 * Zeigt aktive Schicht (status=active) oder nächste geplante Schicht.
 * Lädt optional Pausen-Zusammenfassung wenn Schicht aktiv.
 */

import { useEffect, useState, useCallback } from 'react';
import { Clock, Calendar, Coffee } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UpcomingShift {
  id: string;
  planned_start: string;
  planned_end: string;
  status: string;
}

interface ShiftHistoryEntry {
  id: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string | null;
  status: string;
}

interface BreakSummary {
  totalBreakMin: number;
  breakCount: number;
  isOnBreak: boolean;
}

interface Props {
  upcomingShifts?: UpcomingShift[];
}

function useTick(ms = 60_000) {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), ms);
    return () => clearInterval(iv);
  }, [ms]);
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function FahrerSchichtStatusStrip({ upcomingShifts = [] }: Props) {
  useTick(30_000);

  const [activeShift, setActiveShift] = useState<ShiftHistoryEntry | null>(null);
  const [breakSummary, setBreakSummary] = useState<BreakSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadShift = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/driver/shifts?limit=5');
      if (!res.ok) return;
      const data = await res.json();
      const found = (data.shifts ?? []).find(
        (s: ShiftHistoryEntry) => s.status === 'active',
      ) as ShiftHistoryEntry | undefined;
      setActiveShift(found ?? null);

      if (found?.id) {
        const bRes = await fetch(`/api/delivery/driver/shift/break?shift_id=${found.id}`);
        if (bRes.ok) {
          const bData = await bRes.json();
          const summary = bData.summary as {
            totalBreakMinutes?: number;
            breakCount?: number;
          } | null;
          const active = bData.activeBreak as { id?: string } | null;
          setBreakSummary({
            totalBreakMin: summary?.totalBreakMinutes ?? 0,
            breakCount: summary?.breakCount ?? 0,
            isOnBreak: !!active?.id,
          });
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShift();
    const iv = setInterval(loadShift, 5 * 60_000);
    return () => clearInterval(iv);
  }, [loadShift]);

  const now = Date.now();

  // Resolve display shift: prefer active from API, fallback to upcoming from props
  const displayShift: { id: string; plannedStart: string; plannedEnd: string; isActive: boolean } | null =
    activeShift
      ? {
          id: activeShift.id,
          plannedStart: activeShift.plannedStart,
          plannedEnd: activeShift.plannedEnd,
          isActive: true,
        }
      : upcomingShifts.length > 0
      ? {
          id: upcomingShifts[0].id,
          plannedStart: upcomingShifts[0].planned_start,
          plannedEnd: upcomingShifts[0].planned_end,
          isActive: upcomingShifts[0].status === 'active',
        }
      : null;

  if (loading || !displayShift) return null;

  const startMs  = new Date(displayShift.plannedStart).getTime();
  const endMs    = new Date(displayShift.plannedEnd).getTime();
  const totalMs  = endMs - startMs;
  const elapsedMs = Math.max(0, now - startMs);
  const remainMs  = Math.max(0, endMs - now);

  const progressPct = totalMs > 0 ? Math.min(100, (elapsedMs / totalMs) * 100) : 0;
  const isFuture = now < startMs;
  const isOver   = now > endMs;

  const progressColor = progressPct >= 90
    ? 'bg-red-500'
    : progressPct >= 70
    ? 'bg-amber-500'
    : 'bg-matcha-500';

  return (
    <div className={cn(
      'rounded-xl border px-4 py-3',
      displayShift.isActive
        ? 'bg-matcha-900/60 border-matcha-600/40'
        : 'bg-stone-800/60 border-stone-600/40',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {displayShift.isActive && !isFuture
            ? <Clock className="h-3.5 w-3.5 text-matcha-400" />
            : <Calendar className="h-3.5 w-3.5 text-stone-400" />}
          <span className="text-[10px] font-bold uppercase tracking-widest text-matcha-300">
            {displayShift.isActive && !isFuture ? 'Aktive Schicht' : 'Nächste Schicht'}
          </span>
        </div>
        {breakSummary?.isOnBreak && (
          <span className="flex items-center gap-1 text-[10px] text-amber-300 font-bold">
            <Coffee className="h-3 w-3" />
            Pause läuft
          </span>
        )}
      </div>

      {/* Time row */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-white font-black tabular-nums text-sm">
          {fmtTime(displayShift.plannedStart)}
        </span>
        <div className="flex-1 mx-3 relative h-1.5 rounded-full bg-matcha-800/60 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', progressColor)}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-white font-black tabular-nums text-sm">
          {fmtTime(displayShift.plannedEnd)}
        </span>
      </div>

      {/* Status row */}
      <div className="flex items-center gap-3 text-[11px]">
        {isFuture ? (
          <span className="text-stone-400">
            Beginnt in <span className="text-white font-bold">{fmtDuration(startMs - now)}</span>
          </span>
        ) : isOver ? (
          <span className="text-stone-400">Schicht beendet</span>
        ) : (
          <>
            <span className="text-matcha-300">
              Noch <span className="text-white font-bold tabular-nums">{fmtDuration(remainMs)}</span>
            </span>
            <span className="text-stone-500">·</span>
            <span className="text-stone-400 tabular-nums">
              {Math.round(progressPct)}% abgeschlossen
            </span>
          </>
        )}
        {breakSummary && breakSummary.breakCount > 0 && (
          <>
            <span className="text-stone-500 ml-auto">·</span>
            <span className="text-stone-400 flex items-center gap-1">
              <Coffee className="h-3 w-3" />
              {breakSummary.totalBreakMin}min Pause
            </span>
          </>
        )}
      </div>
    </div>
  );
}
