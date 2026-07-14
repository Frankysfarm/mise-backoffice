'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Coffee, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

// Phase 1520 — Schicht-Pausen-Empfehlung (Fahrer-App)
// Empfehlung wann Pause einzuplanen basierend auf Schichtdauer/letzter Pause/Peak-Prognose;
// isOnline-Guard; lokale Logik; nach Phase1515.

interface Props {
  isOnline: boolean;
  schichtStartIso?: string | null;
  letztePauseIso?: string | null;
  aktiveTours?: number;
  prognoseNaechsteStunde?: 'niedrig' | 'normal' | 'hoch' | 'kritisch';
  className?: string;
}

type EmpfehlungsLevel = 'empfohlen' | 'bald' | 'gut';

interface Empfehlung {
  level: EmpfehlungsLevel;
  titel: string;
  text: string;
  pauseDauerMin: number;
}

const MIN_PAUSE_ABSTAND_MIN = 120;
const OPTIMALE_PAUSE_NACH_MIN = 180;

function minutenSeit(isoString: string | null | undefined): number {
  if (!isoString) return Infinity;
  return Math.round((Date.now() - new Date(isoString).getTime()) / 60_000);
}

function berechneEmpfehlung(
  minutenInSchicht: number,
  minutenSeitPause: number,
  aktiveTours: number,
  prognose: 'niedrig' | 'normal' | 'hoch' | 'kritisch',
): Empfehlung {
  const peakBald = prognose === 'hoch' || prognose === 'kritisch';
  const pauseFaellig = minutenSeitPause >= OPTIMALE_PAUSE_NACH_MIN;
  const pauseMoeglich = !peakBald && aktiveTours === 0;

  if (pauseFaellig && pauseMoeglich) {
    return {
      level: 'empfohlen',
      titel: 'Pause jetzt empfohlen',
      text: `Du bist seit ${Math.round(minutenSeitPause / 60 * 10) / 10}h ohne Pause. Niedriges Aufkommen — guter Zeitpunkt für ${pauseFaellig ? '20' : '15'} Minuten Pause.`,
      pauseDauerMin: 20,
    };
  }
  if (pauseFaellig && peakBald) {
    return {
      level: 'bald',
      titel: 'Pause nach Peak einplanen',
      text: 'Peak-Prognose für nächste Stunde — plane deine Pause danach ein.',
      pauseDauerMin: 15,
    };
  }
  const naechstePauseIn = Math.max(0, MIN_PAUSE_ABSTAND_MIN - minutenSeitPause);
  return {
    level: 'gut',
    titel: 'Gut versorgt',
    text: naechstePauseIn > 0
      ? `Nächste Pause in ca. ${naechstePauseIn} Min empfohlen.`
      : 'Wenn es passt, kurz durchatmen.',
    pauseDauerMin: 10,
  };
}

const LEVEL_CONFIG: Record<EmpfehlungsLevel, {
  bg: string; border: string; icon: React.ReactNode; titleColor: string; badgeBg: string;
}> = {
  empfohlen: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/20',
    border: 'border-emerald-200 dark:border-emerald-800',
    icon: <Coffee className="w-4 h-4 text-emerald-500" />,
    titleColor: 'text-emerald-700 dark:text-emerald-300',
    badgeBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  bald: {
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    border: 'border-amber-200 dark:border-amber-800',
    icon: <AlertCircle className="w-4 h-4 text-amber-500" />,
    titleColor: 'text-amber-700 dark:text-amber-300',
    badgeBg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  gut: {
    bg: 'bg-slate-50 dark:bg-slate-800/30',
    border: 'border-slate-200 dark:border-slate-700',
    icon: <CheckCircle2 className="w-4 h-4 text-slate-400" />,
    titleColor: 'text-slate-700 dark:text-slate-300',
    badgeBg: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  },
};

export function FahrerPhase1520SchichtPausenEmpfehlung({
  isOnline,
  schichtStartIso,
  letztePauseIso,
  aktiveTours = 0,
  prognoseNaechsteStunde = 'normal',
  className,
}: Props) {
  const minutenInSchicht = useMemo(() => minutenSeit(schichtStartIso), [schichtStartIso]);
  const minutenSeitPause = useMemo(
    () => letztePauseIso ? minutenSeit(letztePauseIso) : minutenInSchicht,
    [letztePauseIso, minutenInSchicht],
  );

  const empfehlung = useMemo(
    () => berechneEmpfehlung(minutenInSchicht, minutenSeitPause, aktiveTours, prognoseNaechsteStunde),
    [minutenInSchicht, minutenSeitPause, aktiveTours, prognoseNaechsteStunde],
  );

  if (!isOnline) return null;

  const cfg = LEVEL_CONFIG[empfehlung.level];
  const schichtStundenLabel = minutenInSchicht === Infinity
    ? '–'
    : `${Math.floor(minutenInSchicht / 60)}h ${minutenInSchicht % 60}min`;
  const letztePauseLabel = minutenSeitPause === Infinity || minutenSeitPause > 60 * 12
    ? 'Noch keine'
    : `vor ${Math.round(minutenSeitPause)} Min`;

  return (
    <div className={cn('rounded-xl border p-4', cfg.bg, cfg.border, className)}>
      <div className="flex items-center gap-2 mb-2">
        {cfg.icon}
        <span className={cn('text-sm font-semibold flex-1', cfg.titleColor)}>
          {empfehlung.titel}
        </span>
        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', cfg.badgeBg)}>
          {empfehlung.pauseDauerMin} Min
        </span>
      </div>

      <p className="text-xs text-slate-600 dark:text-slate-300 mb-3 leading-relaxed">
        {empfehlung.text}
      </p>

      <div className="flex gap-4 text-[10px] text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Schicht: {schichtStundenLabel}
        </span>
        <span className="flex items-center gap-1">
          <Coffee className="w-3 h-3" />
          Letzte Pause: {letztePauseLabel}
        </span>
      </div>
    </div>
  );
}
