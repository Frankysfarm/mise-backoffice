'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Coffee, Clock, Battery } from 'lucide-react';

/**
 * Phase 1010 — Pausen-Empfehlung-Optimierer (Fahrer-App)
 *
 * Empfiehlt optimale Pausenzeit basierend auf Schichtdauer + Energie-Score.
 * Rein client-seitig, keine API.
 */

interface Props {
  schichtDauerMin: number;
  stoppsHeute: number;
  isOnline: boolean;
}

interface Empfehlung {
  typ: 'pause' | 'kurz' | 'keine';
  dauer: number;
  grund: string;
  icon: string;
  urgency: 'hoch' | 'mittel' | 'niedrig';
}

function berechnePause(schichtMin: number, stopps: number): Empfehlung {
  const energieScore = Math.max(0, 100 - (schichtMin / 480) * 60 - stopps * 3);

  if (schichtMin >= 360 && energieScore < 40) {
    return {
      typ: 'pause',
      dauer: 30,
      grund: 'Lange Schicht + niedriger Energie-Score — 30 Min Pause empfohlen',
      icon: '🛑',
      urgency: 'hoch',
    };
  }
  if (schichtMin >= 240 && energieScore < 60) {
    return {
      typ: 'pause',
      dauer: 15,
      grund: 'Du bist seit 4+ Stunden aktiv — 15 Min Erholungspause',
      icon: '☕',
      urgency: 'mittel',
    };
  }
  if (stopps >= 8 && energieScore < 70) {
    return {
      typ: 'kurz',
      dauer: 5,
      grund: `${stopps} Stopps absolviert — kurze 5-Min-Pause hilft`,
      icon: '💧',
      urgency: 'niedrig',
    };
  }
  return {
    typ: 'keine',
    dauer: 0,
    grund: 'Energie noch gut — weiter so!',
    icon: '⚡',
    urgency: 'niedrig',
  };
}

function energieBalken(schichtMin: number, stopps: number): number {
  return Math.max(0, Math.min(100, 100 - (schichtMin / 480) * 60 - stopps * 3));
}

export function FahrerPhase1010PausenEmpfehlung({ schichtDauerMin, stoppsHeute, isOnline }: Props) {
  const emp = useMemo(() => berechnePause(schichtDauerMin, stoppsHeute), [schichtDauerMin, stoppsHeute]);
  const energie = useMemo(() => energieBalken(schichtDauerMin, stoppsHeute), [schichtDauerMin, stoppsHeute]);

  if (!isOnline || emp.typ === 'keine') return null;

  const urgencyBg: Record<string, string> = {
    hoch: 'bg-red-50 border-red-300',
    mittel: 'bg-amber-50 border-amber-300',
    niedrig: 'bg-blue-50 border-blue-200',
  };
  const urgencyText: Record<string, string> = {
    hoch: 'text-red-700',
    mittel: 'text-amber-700',
    niedrig: 'text-blue-700',
  };
  const barColor = energie >= 60 ? 'bg-matcha-500' : energie >= 30 ? 'bg-amber-400' : 'bg-red-500';

  return (
    <div className={cn('rounded-xl border p-4 shadow-sm', urgencyBg[emp.urgency])}>
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0">{emp.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Coffee className={cn('h-4 w-4 shrink-0', urgencyText[emp.urgency])} />
            <span className={cn('text-sm font-black', urgencyText[emp.urgency])}>
              {emp.typ === 'pause' ? `${emp.dauer} Min Pause empfohlen` : `${emp.dauer} Min Trinkpause`}
            </span>
          </div>
          <p className={cn('text-xs', urgencyText[emp.urgency])}>{emp.grund}</p>

          {/* Energie-Balken */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <Battery className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground font-medium">Energie-Score</span>
              </div>
              <span className="text-[10px] font-black tabular-nums text-muted-foreground">{Math.round(energie)}%</span>
            </div>
            <div className="h-2 rounded-full bg-black/10 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700', barColor)}
                style={{ width: `${energie}%` }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="mt-2 flex items-center gap-3">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              {Math.floor(schichtDauerMin / 60)}h {schichtDauerMin % 60}min Schicht
            </div>
            <div className="text-[10px] text-muted-foreground">·</div>
            <div className="text-[10px] text-muted-foreground">{stoppsHeute} Stopps heute</div>
          </div>
        </div>
      </div>
    </div>
  );
}
