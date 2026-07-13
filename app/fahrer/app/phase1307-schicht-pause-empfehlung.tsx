'use client';

// Phase 1307 — Schicht-Pause-Empfehlung (Fahrer-App)
// Energie-Level basierend auf Schichtdauer + Stopps + Pausen-Timer mit Empfehlung
// Props-basiert + localStorage-Persistenz · nach Phase1302

import { useEffect, useMemo, useRef, useState } from 'react';
import { Battery, BatteryLow, CheckCircle2, Coffee, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  driverId: string;
  isOnline: boolean;
  schichtStartAt?: string | null; // ISO-String
  stoppsAbgeschlossen?: number;
}

const PAUSE_DAUER_MIN = 15;
const EMPFEHLUNG_NACH_STOPPS = 8;
const EMPFEHLUNG_NACH_STUNDEN = 3;

export function FahrerPhase1307SchichtPauseEmpfehlung({ driverId, isOnline, schichtStartAt, stoppsAbgeschlossen = 0 }: Props) {
  const [open, setOpen] = useState(false);
  const [pauseAktiv, setPauseAktiv] = useState(false);
  const [pauseStartAt, setPauseStartAt] = useState<number | null>(null);
  const [verbleibendSek, setVerbleibendSek] = useState(PAUSE_DAUER_MIN * 60);
  const [pauseAbgeschlossen, setPauseAbgeschlossen] = useState(false);
  const storageKey = `pause_${driverId}`;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Schichtdauer berechnen
  const schichtDauerH = useMemo(() => {
    if (!schichtStartAt) return 0;
    return (Date.now() - new Date(schichtStartAt).getTime()) / 3600000;
  }, [schichtStartAt]);

  const energiePct = useMemo(() => {
    const basisenergie = 100;
    const schichtAbzug = Math.min(40, schichtDauerH * 12);
    const stoppAbzug = Math.min(30, stoppsAbgeschlossen * 2.5);
    return Math.max(10, Math.round(basisenergie - schichtAbzug - stoppAbzug));
  }, [schichtDauerH, stoppsAbgeschlossen]);

  const empfiehltPause = energiePct < 50
    || stoppsAbgeschlossen >= EMPFEHLUNG_NACH_STOPPS
    || schichtDauerH >= EMPFEHLUNG_NACH_STUNDEN;

  // Pause-Timer laden
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const { startAt, done } = JSON.parse(saved);
        if (done) { setPauseAbgeschlossen(true); return; }
        if (startAt) {
          const elapsed = Math.floor((Date.now() - startAt) / 1000);
          const remaining = PAUSE_DAUER_MIN * 60 - elapsed;
          if (remaining > 0) {
            setPauseAktiv(true);
            setPauseStartAt(startAt);
            setVerbleibendSek(remaining);
          } else {
            setPauseAbgeschlossen(true);
            localStorage.setItem(storageKey, JSON.stringify({ done: true }));
          }
        }
      }
    } catch { /* ignore */ }
  }, [storageKey]);

  // Countdown
  useEffect(() => {
    if (!pauseAktiv) return;
    intervalRef.current = setInterval(() => {
      setVerbleibendSek(s => {
        if (s <= 1) {
          clearInterval(intervalRef.current!);
          setPauseAktiv(false);
          setPauseAbgeschlossen(true);
          try { localStorage.setItem(storageKey, JSON.stringify({ done: true })); } catch { /* ignore */ }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [pauseAktiv, storageKey]);

  const startePause = () => {
    const now = Date.now();
    setPauseStartAt(now);
    setPauseAktiv(true);
    setVerbleibendSek(PAUSE_DAUER_MIN * 60);
    try { localStorage.setItem(storageKey, JSON.stringify({ startAt: now })); } catch { /* ignore */ }
  };

  const formatSek = (s: number): string => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (!isOnline) return null;

  const energieColor = energiePct >= 70 ? 'text-emerald-600 dark:text-emerald-400'
    : energiePct >= 40 ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400';

  const energieBar = energiePct >= 70 ? 'bg-emerald-500'
    : energiePct >= 40 ? 'bg-amber-400'
    : 'bg-red-500';

  const headerBg = empfiehltPause && !pauseAbgeschlossen
    ? 'bg-amber-500 dark:bg-amber-600'
    : 'bg-slate-600 dark:bg-slate-700';

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn('w-full flex items-center justify-between px-4 py-3 text-white', headerBg)}
      >
        <div className="flex items-center gap-2">
          {energiePct < 40 ? <BatteryLow className="h-4 w-4" /> : <Battery className="h-4 w-4" />}
          <span className="text-sm font-semibold">Pause-Empfehlung</span>
          {empfiehltPause && !pauseAbgeschlossen && !pauseAktiv && (
            <span className="text-[10px] font-bold bg-white/20 rounded-full px-2 py-0.5 animate-pulse">
              EMPFOHLEN
            </span>
          )}
          {pauseAktiv && (
            <span className="text-[10px] bg-white/20 rounded-full px-2 py-0.5 font-mono">
              {formatSek(verbleibendSek)}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* Energie-Level */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                Energie-Level
              </span>
              <span className={cn('text-sm font-black', energieColor)}>{energiePct}%</span>
            </div>
            <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-3">
              <div
                className={cn('h-3 rounded-full transition-all duration-700', energieBar)}
                style={{ width: `${energiePct}%` }}
              />
            </div>
          </div>

          {/* Status-Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-stone-50 dark:bg-stone-800 p-2.5 text-center">
              <div className="text-lg font-black text-stone-700 dark:text-stone-200">{stoppsAbgeschlossen}</div>
              <div className="text-[9px] text-stone-400">Stopps heute</div>
            </div>
            <div className="rounded-xl bg-stone-50 dark:bg-stone-800 p-2.5 text-center">
              <div className="text-lg font-black text-stone-700 dark:text-stone-200">
                {schichtDauerH.toFixed(1)}h
              </div>
              <div className="text-[9px] text-stone-400">Schichtdauer</div>
            </div>
          </div>

          {/* Pause-Bereich */}
          {pauseAbgeschlossen ? (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 p-3 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <div>
                <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Pause abgeschlossen</div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400">Super! Weiter geht's.</div>
              </div>
            </div>
          ) : pauseAktiv ? (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-4 text-center">
              <Coffee className="h-8 w-8 text-amber-500 mx-auto mb-2" />
              <div className="text-3xl font-black text-amber-700 dark:text-amber-300 font-mono">
                {formatSek(verbleibendSek)}
              </div>
              <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">Pause läuft — entspann dich!</div>
            </div>
          ) : (
            <div className="space-y-2">
              {empfiehltPause && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Coffee className="h-4 w-4 text-amber-600" />
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Pause empfohlen</span>
                  </div>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    {schichtDauerH >= EMPFEHLUNG_NACH_STUNDEN
                      ? `Du bist seit ${schichtDauerH.toFixed(1)}h aktiv — eine Pause verbessert deine Leistung.`
                      : `Nach ${stoppsAbgeschlossen} Stopps ist eine kurze Erholung sinnvoll.`}
                  </p>
                </div>
              )}
              <button
                onClick={startePause}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 dark:bg-amber-600 text-white font-semibold hover:bg-amber-600 transition-colors"
              >
                <Clock className="h-4 w-4" />
                {PAUSE_DAUER_MIN}-Min-Pause starten
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
