'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Battery, Coffee, Zap, AlertTriangle, Check, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1408 — Schicht-Energie-Check (Fahrer-App)
 *
 * Alle 2h: Energielevel 1-5 Eingabe + Empfehlung (Pause / Weiter / Schicht-Ende).
 * isOnline-Guard. POST /api/delivery/driver/energie-check (best-effort).
 */

type EnergieStufe = 1 | 2 | 3 | 4 | 5;

const STUFE_CONFIG: Record<EnergieStufe, { label: string; emoji: string; empfehlung: string; icon: typeof Zap; color: string; bg: string; border: string }> = {
  5: { label: 'Top-Form', emoji: '⚡', empfehlung: 'Alles läuft super — weiter so!', icon: Zap, color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-300 dark:border-emerald-700' },
  4: { label: 'Gut', emoji: '😊', empfehlung: 'Gute Energie — ein kleines Trinken empfohlen.', icon: Battery, color: 'text-sky-700 dark:text-sky-300', bg: 'bg-sky-50 dark:bg-sky-950/20', border: 'border-sky-300 dark:border-sky-700' },
  3: { label: 'Okay', emoji: '😐', empfehlung: 'Kurze 10-Min-Pause würde gut tun.', icon: Coffee, color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-300 dark:border-amber-700' },
  2: { label: 'Müde', emoji: '😴', empfehlung: 'Bitte jetzt 15-Min-Pause einlegen!', icon: AlertTriangle, color: 'text-orange-700 dark:text-orange-300', bg: 'bg-orange-50 dark:bg-orange-950/20', border: 'border-orange-300 dark:border-orange-700' },
  1: { label: 'Erschöpft', emoji: '🛑', empfehlung: 'Schicht sicher beenden — deine Gesundheit geht vor!', icon: AlertTriangle, color: 'text-rose-700 dark:text-rose-300', bg: 'bg-rose-50 dark:bg-rose-950/20', border: 'border-rose-300 dark:border-rose-700' },
};

interface Props {
  driverId: string;
  isOnline: boolean;
}

const CHECK_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2h
const STORAGE_KEY = (id: string) => `energie_check_${id}`;

export function FahrerPhase1408SchichtEnergieCheck({ driverId, isOnline }: Props) {
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState<EnergieStufe | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shouldShow = useCallback(() => {
    if (!isOnline) return false;
    const stored = localStorage.getItem(STORAGE_KEY(driverId));
    if (!stored) return true;
    const lastMs = Number(stored);
    return Date.now() - lastMs >= CHECK_INTERVAL_MS;
  }, [driverId, isOnline]);

  const scheduleNext = useCallback(() => {
    const stored = localStorage.getItem(STORAGE_KEY(driverId));
    const lastMs = stored ? Number(stored) : Date.now();
    const delay = Math.max(0, CHECK_INTERVAL_MS - (Date.now() - lastMs));
    timerRef.current = setTimeout(() => {
      setVisible(true);
      setSubmitted(false);
      setSelected(null);
    }, delay);
  }, [driverId]);

  useEffect(() => {
    if (!isOnline) return;
    if (shouldShow()) {
      setVisible(true);
    } else {
      scheduleNext();
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isOnline, shouldShow, scheduleNext]);

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    localStorage.setItem(STORAGE_KEY(driverId), String(Date.now()));
    try {
      await fetch('/api/delivery/driver/energie-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId, energie_stufe: selected, gemessen_am: new Date().toISOString() }),
      });
    } catch {
      // best-effort
    }
    setSubmitting(false);
    setSubmitted(true);
    scheduleNext();
    setTimeout(() => setVisible(false), 4000);
  };

  if (!visible || !isOnline) return null;

  const cfg = selected ? STUFE_CONFIG[selected] : null;

  if (submitted && cfg) {
    return (
      <div className={cn('rounded-xl border p-3 mb-2', cfg.border, cfg.bg)}>
        <div className="flex items-center gap-2">
          <Check className={cn('h-5 w-5', cfg.color)} />
          <span className={cn('text-sm font-bold', cfg.color)}>Energie gespeichert</span>
        </div>
        <p className={cn('text-xs mt-1', cfg.color)}>{cfg.empfehlung}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-violet-200 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/20 p-3 mb-2">
      <div className="flex items-center gap-2 mb-3">
        <Battery className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        <span className="text-sm font-bold text-violet-700 dark:text-violet-300">Energie-Check</span>
        <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
          <Clock className="h-3 w-3" />alle 2h
        </span>
      </div>

      <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">Wie fühlst du dich gerade?</p>

      <div className="flex gap-1.5 mb-3">
        {([5, 4, 3, 2, 1] as EnergieStufe[]).map((lvl) => {
          const c = STUFE_CONFIG[lvl];
          return (
            <button
              key={lvl}
              onClick={() => setSelected(lvl)}
              className={cn(
                'flex-1 flex flex-col items-center gap-0.5 rounded-lg border py-2 text-xs font-semibold transition-all',
                selected === lvl ? cn(c.border, c.bg, c.color) : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-400'
              )}
            >
              <span className="text-base">{c.emoji}</span>
              <span>{lvl}</span>
            </button>
          );
        })}
      </div>

      {selected && (
        <p className={cn('text-xs font-medium mb-2', STUFE_CONFIG[selected].color)}>
          {STUFE_CONFIG[selected].empfehlung}
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!selected || submitting}
        className={cn(
          'w-full py-2 rounded-lg text-xs font-bold transition-all',
          selected
            ? 'bg-violet-600 hover:bg-violet-700 text-white'
            : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
        )}
      >
        {submitting ? 'Speichern…' : 'Bestätigen'}
      </button>
    </div>
  );
}
