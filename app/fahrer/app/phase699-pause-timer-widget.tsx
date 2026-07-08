'use client';

import { useEffect, useRef, useState } from 'react';
import { Coffee, Play, Square, Clock } from 'lucide-react';

interface Props {
  driverId: string;
  isOnPause?: boolean;
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const PAUSE_ZIEL_MS = 15 * 60_000;

export function FahrerPhase699PauseTimerWidget({ driverId, isOnPause = false }: Props) {
  const [aktiv, setAktiv] = useState(false);
  const [startTs, setStartTs] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (aktiv && startTs !== null) {
      intervalRef.current = setInterval(() => {
        setElapsed(Date.now() - startTs);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [aktiv, startTs]);

  function startPause() {
    const ts = Date.now();
    setStartTs(ts);
    setElapsed(0);
    setAktiv(true);
  }

  function stopPause() {
    setAktiv(false);
  }

  const remaining = PAUSE_ZIEL_MS - elapsed;
  const overTime = elapsed > PAUSE_ZIEL_MS;
  const pct = Math.min(100, (elapsed / PAUSE_ZIEL_MS) * 100);

  if (!aktiv && elapsed === 0) {
    return (
      <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <Coffee className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm font-semibold">Pause-Timer</span>
          <span className="text-[10px] text-muted-foreground">15 Min empfohlen</span>
        </div>
        <button
          onClick={startPause}
          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition"
        >
          <Play className="h-3.5 w-3.5" />
          Pause starten
        </button>
      </div>
    );
  }

  if (!aktiv && elapsed > 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/10 px-4 py-3">
        <Coffee className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <div className="flex-1">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            Pause beendet — {Math.floor(elapsed / 60_000)} Min {Math.floor((elapsed % 60_000) / 1000)} Sek
          </p>
        </div>
        <button
          onClick={() => { setElapsed(0); setStartTs(null); }}
          className="text-[10px] text-muted-foreground underline"
        >
          neu starten
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Coffee className={`h-4 w-4 ${overTime ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`} />
          <span className="text-sm font-semibold">Pause läuft</span>
        </div>
        <button
          onClick={stopPause}
          className="flex items-center gap-1 rounded-lg border border-red-300 dark:border-red-800 px-2.5 py-1 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition"
        >
          <Square className="h-3 w-3" />
          Beenden
        </button>
      </div>

      <div className="flex items-end gap-3 mb-3">
        <div className="flex flex-col">
          <span className="text-[10px] text-muted-foreground">Vergangen</span>
          <span className="text-3xl font-bold tabular-nums leading-none">
            {formatCountdown(elapsed)}
          </span>
        </div>
        {!overTime && (
          <div className="flex flex-col pb-0.5">
            <span className="text-[10px] text-muted-foreground">Verbleibend</span>
            <span className="text-lg font-semibold tabular-nums text-muted-foreground leading-none">
              {formatCountdown(remaining)}
            </span>
          </div>
        )}
        {overTime && (
          <span className="text-xs font-bold text-red-600 dark:text-red-400 pb-1">
            Pause überzogen!
          </span>
        )}
      </div>

      <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full rounded-full transition-all ${
            overTime ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-muted-foreground">0</span>
        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
          <Clock className="h-2.5 w-2.5" />
          Ziel: 15 Min
        </span>
      </div>
    </div>
  );
}
