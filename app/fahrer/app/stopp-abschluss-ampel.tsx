'use client';

/**
 * StoppAbschlussAmpel — Phase 421
 *
 * Kompakte Ampel für den Fahrer: Zeigt ob der aktuelle Stopp
 * im Zeitfenster liegt (grün/gelb/rot) und zählt die Sekunden.
 * Erscheint nur wenn ein aktiver Stopp mit ETA-Fenster vorhanden ist.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  etaLatest: string | null;
  etaEarliest?: string | null;
  stoppeAdresse?: string | null;
  onArrived?: () => void;
  onDelivered?: () => void;
}

type Ampel = 'gruen' | 'gelb' | 'rot';

function calcAmpel(etaLatest: string | null): { ampel: Ampel; diffSec: number } {
  if (!etaLatest) return { ampel: 'gruen', diffSec: 0 };
  const diffSec = Math.round((new Date(etaLatest).getTime() - Date.now()) / 1000);
  if (diffSec < 0) return { ampel: 'rot', diffSec };
  if (diffSec < 300) return { ampel: 'gelb', diffSec };
  return { ampel: 'gruen', diffSec };
}

function formatZeit(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = sec < 0 ? '-' : '';
  if (abs >= 3600) return `${sign}${Math.floor(abs / 3600)}h ${String(m % 60).padStart(2, '0')}m`;
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

const STYLE: Record<Ampel, { bg: string; border: string; text: string; subtext: string; icon: typeof CheckCircle2; label: string }> = {
  gruen: {
    bg: 'bg-matcha-950',
    border: 'border-matcha-700',
    text: 'text-matcha-300',
    subtext: 'text-matcha-500',
    icon: CheckCircle2,
    label: 'Im Zeitfenster',
  },
  gelb: {
    bg: 'bg-amber-950',
    border: 'border-amber-700',
    text: 'text-amber-300',
    subtext: 'text-amber-500',
    icon: Clock,
    label: 'Zeitfenster knapp',
  },
  rot: {
    bg: 'bg-red-950',
    border: 'border-red-700',
    text: 'text-red-300',
    subtext: 'text-red-500',
    icon: AlertTriangle,
    label: 'Zeitfenster überschritten',
  },
};

export function StoppAbschlussAmpel({ etaLatest, stoppeAdresse, onArrived, onDelivered }: Props) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 1_000);
    return () => clearInterval(iv);
  }, []);

  if (!etaLatest) return null;

  const { ampel, diffSec } = calcAmpel(etaLatest);
  const s = STYLE[ampel];
  const Icon = s.icon;

  return (
    <div className={cn('rounded-2xl border p-4', s.bg, s.border)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Icon className={cn('h-4 w-4 shrink-0', s.text)} />
        <span className={cn('text-xs font-bold uppercase tracking-wider', s.subtext)}>
          {s.label}
        </span>
      </div>

      {/* Countdown */}
      <div className="text-center mb-3">
        <div className={cn('font-mono text-4xl font-black tabular-nums', s.text,
          ampel === 'rot' && 'animate-pulse'
        )}>
          {diffSec < 0 ? '−' : ''}{formatZeit(Math.abs(diffSec))}
        </div>
        <div className={cn('text-xs mt-1', s.subtext)}>
          {diffSec < 0 ? `${Math.abs(Math.round(diffSec / 60))} Min überfällig` : 'bis Ablauf Zeitfenster'}
        </div>
      </div>

      {/* Adresse */}
      {stoppeAdresse && (
        <div className={cn('text-xs text-center mb-3 truncate', s.subtext)}>
          {stoppeAdresse}
        </div>
      )}

      {/* Aktions-Buttons */}
      {(onArrived || onDelivered) && (
        <div className="flex gap-2">
          {onArrived && (
            <button
              onClick={onArrived}
              className={cn(
                'flex-1 rounded-xl py-2 text-xs font-bold transition',
                ampel === 'gruen' ? 'bg-matcha-700 text-white hover:bg-matcha-600' :
                ampel === 'gelb'  ? 'bg-amber-700 text-white hover:bg-amber-600' :
                                    'bg-red-700 text-white hover:bg-red-600',
              )}
            >
              Angekommen
            </button>
          )}
          {onDelivered && (
            <button
              onClick={onDelivered}
              className="flex-1 rounded-xl bg-white/10 py-2 text-xs font-bold text-white/80 hover:bg-white/20 transition"
            >
              Zugestellt
            </button>
          )}
        </div>
      )}
    </div>
  );
}
