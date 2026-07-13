'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, Coffee, Pause, Play, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1393 — Schicht-Pause-Timer (Fahrer-App)
 *
 * Pause starten/beenden + Zeitprotokoll aller Pausen der aktuellen Schicht.
 * REST-Aufruf an /api/driver-app/pause beim Start/Ende.
 * isOnline-Guard: Nur sichtbar wenn Fahrer online.
 * Nach Phase1388 in fahrer/app/client.tsx einbinden.
 */

interface PauseEintrag {
  start: string; // ISO
  ende: string | null; // ISO oder null wenn aktiv
  dauerSek: number | null;
}

interface Props {
  driverId: string;
  isOnline: boolean;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function sek2str(sek: number): string {
  const h = Math.floor(sek / 3600);
  const m = Math.floor((sek % 3600) / 60);
  const s = sek % 60;
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

const LS_KEY = (id: string) => `mise_pause_${id}`;

function loadState(driverId: string): { pausen: PauseEintrag[]; laufendSeit: string | null } {
  try {
    const raw = localStorage.getItem(LS_KEY(driverId));
    if (!raw) return { pausen: [], laufendSeit: null };
    return JSON.parse(raw);
  } catch {
    return { pausen: [], laufendSeit: null };
  }
}

function saveState(driverId: string, pausen: PauseEintrag[], laufendSeit: string | null) {
  try {
    localStorage.setItem(LS_KEY(driverId), JSON.stringify({ pausen, laufendSeit }));
  } catch { /* ignore */ }
}

export function FahrerPhase1393SchichtPauseTimer({ driverId, isOnline }: Props) {
  const [pausen, setPausen] = useState<PauseEintrag[]>([]);
  const [laufendSeit, setLaufendSeit] = useState<string | null>(null);
  const [laufendSek, setLaufendSek] = useState(0);
  const [collapsed, setCollapsed] = useState(true);
  const [apiError, setApiError] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Hydration
  useEffect(() => {
    const s = loadState(driverId);
    setPausen(s.pausen);
    setLaufendSeit(s.laufendSeit);
    if (s.laufendSeit) {
      const elapsed = Math.floor((Date.now() - new Date(s.laufendSeit).getTime()) / 1000);
      setLaufendSek(elapsed);
    }
  }, [driverId]);

  // Ticker für laufende Pause
  useEffect(() => {
    if (laufendSeit) {
      tickRef.current = setInterval(() => {
        setLaufendSek(Math.floor((Date.now() - new Date(laufendSeit).getTime()) / 1000));
      }, 1000);
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [laufendSeit]);

  const startPause = useCallback(async () => {
    const now = new Date().toISOString();
    setLaufendSeit(now);
    setLaufendSek(0);
    const newPausen: PauseEintrag[] = [...pausen, { start: now, ende: null, dauerSek: null }];
    setPausen(newPausen);
    saveState(driverId, newPausen, now);
    setApiError(false);
    try {
      await fetch('/api/driver-app/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId, action: 'start', timestamp: now }),
      });
    } catch { setApiError(true); }
  }, [driverId, pausen]);

  const endePause = useCallback(async () => {
    if (!laufendSeit) return;
    const now = new Date().toISOString();
    const dauer = Math.floor((new Date(now).getTime() - new Date(laufendSeit).getTime()) / 1000);
    const newPausen: PauseEintrag[] = pausen.map((p, i) =>
      i === pausen.length - 1 ? { ...p, ende: now, dauerSek: dauer } : p,
    );
    setPausen(newPausen);
    setLaufendSeit(null);
    setLaufendSek(0);
    saveState(driverId, newPausen, null);
    setApiError(false);
    try {
      await fetch('/api/driver-app/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId, action: 'end', timestamp: now, dauer_sek: dauer }),
      });
    } catch { setApiError(true); }
  }, [driverId, laufendSeit, pausen]);

  const resetSchicht = useCallback(() => {
    setPausen([]);
    setLaufendSeit(null);
    setLaufendSek(0);
    saveState(driverId, [], null);
  }, [driverId]);

  if (!isOnline) return null;

  const gesamtPause = pausen.reduce((acc, p) => acc + (p.dauerSek ?? 0), 0) + (laufendSeit ? laufendSek : 0);
  const istInPause = laufendSeit !== null;

  return (
    <div className={cn(
      'rounded-2xl border transition-colors',
      istInPause
        ? 'border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/20'
        : 'border-border bg-card',
    )}>
      {/* Header-Zeile */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <Coffee className={cn('h-4 w-4 flex-shrink-0', istInPause ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')} />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-foreground">Schicht-Pause</span>
          {istInPause && (
            <span className="ml-2 text-xs text-amber-700 dark:text-amber-400 font-mono">
              {sek2str(laufendSek)}
            </span>
          )}
        </div>
        {gesamtPause > 0 && !istInPause && (
          <span className="text-xs text-muted-foreground">
            Gesamt: {sek2str(gesamtPause)}
          </span>
        )}
        {pausen.length > 0 && (
          <span className="text-xs text-muted-foreground">{pausen.length}×</span>
        )}
      </button>

      {/* Expanded Body */}
      {!collapsed && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
          {/* Pause-Button */}
          <div className="flex items-center gap-2">
            {!istInPause ? (
              <button
                onClick={startPause}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 font-semibold text-sm hover:bg-amber-200 dark:hover:bg-amber-800/40 transition-colors"
              >
                <Pause className="h-4 w-4" />
                Pause starten
              </button>
            ) : (
              <button
                onClick={endePause}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 font-semibold text-sm hover:bg-green-200 dark:hover:bg-green-800/40 transition-colors"
              >
                <Play className="h-4 w-4" />
                Weiterfahren
              </button>
            )}
            {istInPause && (
              <div className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                <Clock className="h-3.5 w-3.5" />
                <span className="font-mono text-sm font-bold">{sek2str(laufendSek)}</span>
              </div>
            )}
          </div>

          {apiError && (
            <p className="text-xs text-red-600 dark:text-red-400">Netzwerkfehler — lokal gespeichert</p>
          )}

          {/* Protokoll */}
          {pausen.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Pausen-Protokoll</p>
              {pausen.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-foreground/80">
                  <span className="font-mono">
                    {new Date(p.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    {' – '}
                    {p.ende
                      ? new Date(p.ende).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                      : <span className="text-amber-600 dark:text-amber-400">läuft</span>
                    }
                  </span>
                  {p.dauerSek !== null && (
                    <span className="text-muted-foreground">{sek2str(p.dauerSek)}</span>
                  )}
                </div>
              ))}
              <div className="pt-1 flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  Gesamt-Pause: {sek2str(gesamtPause)}
                </span>
                <button
                  onClick={resetSchicht}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-3 w-3" /> Reset
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
