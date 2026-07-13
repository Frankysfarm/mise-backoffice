'use client';

// Phase 1224 — Schicht-Ende-Energie-Check (Fahrer-App)
// Abfrage wie erschöpft der Fahrer ist (1–5 Skala) + automatische Empfehlung für Pausendauer

import { useState } from 'react';
import { ChevronDown, ChevronUp, Battery, Coffee, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  driverId: string;
  isOnline: boolean;
}

type EnergieLevel = 1 | 2 | 3 | 4 | 5;

interface EnergieConfig {
  label: string;
  emoji: string;
  pauseMin: number;
  empfehlung: string;
  color: string;
  bg: string;
}

const ENERGIE_MAP: Record<EnergieLevel, EnergieConfig> = {
  5: {
    label: 'Topfit',
    emoji: '⚡',
    pauseMin: 0,
    empfehlung: 'Super! Keine Pause nötig — du kannst sofort weitermachen.',
    color: 'text-matcha-700 dark:text-matcha-300',
    bg: 'bg-matcha-50 dark:bg-matcha-900/30 border-matcha-300 dark:border-matcha-700',
  },
  4: {
    label: 'Gut',
    emoji: '😊',
    pauseMin: 5,
    empfehlung: 'Kleiner 5-Minuten-Stopp empfohlen — trink etwas und streck dich kurz.',
    color: 'text-green-700 dark:text-green-300',
    bg: 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700',
  },
  3: {
    label: 'Mittel',
    emoji: '😐',
    pauseMin: 15,
    empfehlung: '15-Minuten-Pause empfohlen. Snack essen, Wasser trinken, kurz ausruhen.',
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700',
  },
  2: {
    label: 'Müde',
    emoji: '😴',
    pauseMin: 30,
    empfehlung: '30 Minuten Pause dringend empfohlen. Sicherheit geht vor — ruh dich aus!',
    color: 'text-orange-700 dark:text-orange-300',
    bg: 'bg-orange-50 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700',
  },
  1: {
    label: 'Erschöpft',
    emoji: '🚨',
    pauseMin: 60,
    empfehlung: 'STOP: Mindestens 60 Minuten Pause erforderlich. Fahre nicht weiter — Sicherheit zuerst!',
    color: 'text-red-700 dark:text-red-300',
    bg: 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700',
  },
};

const SKALA_LABELS: Record<EnergieLevel, string> = {
  1: 'Erschöpft',
  2: 'Müde',
  3: 'Mittel',
  4: 'Gut',
  5: 'Topfit',
};

export function FahrerPhase1224SchichtEndeEnergieCheck({ driverId, isOnline }: Props) {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<EnergieLevel | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!isOnline) return null;

  async function handleSubmit(level: EnergieLevel) {
    setSelected(level);
    setSaving(true);
    try {
      await fetch('/api/delivery/driver/energie-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId, energie_level: level, timestamp: new Date().toISOString() }),
      });
    } catch {
      // best-effort
    } finally {
      setSaving(false);
      setSubmitted(true);
    }
  }

  const config = selected ? ENERGIE_MAP[selected] : null;

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
      >
        <Battery className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="font-bold text-sm text-foreground flex-1">
          Energie-Check
          {selected && !saving && (
            <span className="ml-2 text-base">{ENERGIE_MAP[selected].emoji}</span>
          )}
        </span>
        {submitted && <CheckCircle2 className="h-4 w-4 text-matcha-500 shrink-0" />}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {!submitted ? (
            <>
              <p className="text-sm text-muted-foreground">
                Wie fit bist du gerade? Bewerte ehrlich — deine Antwort bleibt anonym.
              </p>

              {/* Energie-Skala */}
              <div className="flex items-stretch gap-2">
                {([1, 2, 3, 4, 5] as EnergieLevel[]).map((level) => {
                  const cfg = ENERGIE_MAP[level];
                  const isActive = selected === level;
                  return (
                    <button
                      key={level}
                      onClick={() => setSelected(level)}
                      className={cn(
                        'flex-1 flex flex-col items-center gap-1 rounded-xl border-2 py-3 px-1 transition-all font-bold',
                        isActive
                          ? cn('border-current scale-105 shadow-md', cfg.color, cfg.bg)
                          : 'border-border bg-muted/20 hover:border-blue-300 dark:hover:border-blue-600',
                      )}
                    >
                      <span className="text-xl">{cfg.emoji}</span>
                      <span className="text-[9px] font-bold leading-tight text-center">{cfg.label}</span>
                      <span className={cn(
                        'text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center',
                        isActive ? 'bg-current text-white' : 'bg-muted text-muted-foreground',
                      )}>
                        {level}
                      </span>
                    </button>
                  );
                })}
              </div>

              {selected && (
                <div className={cn('rounded-lg border p-3', config!.bg)}>
                  <p className={cn('text-sm font-medium', config!.color)}>{config!.empfehlung}</p>
                  {config!.pauseMin > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <Coffee className={cn('h-4 w-4', config!.color)} />
                      <span className={cn('text-xs font-bold', config!.color)}>
                        Empfohlene Pause: {config!.pauseMin} Minuten
                      </span>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => selected && handleSubmit(selected)}
                disabled={!selected || saving}
                className="w-full rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white font-bold py-3 text-sm transition"
              >
                {saving ? 'Wird gespeichert…' : 'Energie-Level speichern'}
              </button>
            </>
          ) : (
            <div className={cn('rounded-xl border p-4 text-center space-y-2', config!.bg)}>
              <div className="text-3xl">{config!.emoji}</div>
              <div className={cn('font-bold text-base', config!.color)}>
                {SKALA_LABELS[selected!]} — Danke!
              </div>
              <p className={cn('text-sm', config!.color)}>{config!.empfehlung}</p>
              {config!.pauseMin > 0 && (
                <div className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold mt-1', config!.bg, 'border')}>
                  <Coffee className="h-3.5 w-3.5" />
                  {config!.pauseMin} Min Pause empfohlen
                </div>
              )}
              {selected === 1 && (
                <div className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700 px-3 py-2 text-xs font-bold text-red-700 dark:text-red-300">
                  <AlertTriangle className="h-4 w-4" />
                  Bitte melde dich beim Dispatcher — du solltest jetzt nicht fahren!
                </div>
              )}
              <button
                onClick={() => { setSubmitted(false); setSelected(null); }}
                className="mt-2 text-[11px] text-muted-foreground underline"
              >
                Erneut bewerten
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
