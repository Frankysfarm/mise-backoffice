'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

type StufeConfig = {
  label: string;
  farbe: string;
  bg: string;
  Icon: React.ElementType;
  pulse: boolean;
  empfehlung: string;
};

const STUFEN: Record<'viel' | 'wenig' | 'gleich' | 'abgelaufen', StufeConfig> = {
  viel: {
    label: 'Schicht läuft',
    farbe: 'text-matcha-700',
    bg: 'bg-matcha-50 border-matcha-200',
    Icon: Clock,
    pulse: false,
    empfehlung: 'Du hast noch Zeit für weitere Touren.',
  },
  wenig: {
    label: 'Fast vorbei',
    farbe: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
    Icon: AlertTriangle,
    pulse: false,
    empfehlung: 'Noch eine kurze Tour möglich — dann Schicht beenden.',
  },
  gleich: {
    label: 'Schicht endet bald',
    farbe: 'text-red-700',
    bg: 'bg-red-50 border-red-300',
    Icon: AlertTriangle,
    pulse: true,
    empfehlung: 'Keine neue Tour mehr annehmen!',
  },
  abgelaufen: {
    label: 'Schicht abgelaufen',
    farbe: 'text-red-800',
    bg: 'bg-red-100 border-red-400',
    Icon: Moon,
    pulse: true,
    empfehlung: 'Bitte Schicht jetzt beenden.',
  },
};

function fmt(secs: number): string {
  const abs = Math.abs(secs);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}h`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function FahrerPhase1670SchichtEndeCountdownTimer({
  onlineSeit,
  schichtDauerMin = 480,
  isOnline,
}: {
  onlineSeit: string | null;
  schichtDauerMin?: number;
  isOnline: boolean;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const { restSecs, stufe } = useMemo(() => {
    if (!onlineSeit) return { restSecs: 0, stufe: 'abgelaufen' as const };
    const start = new Date(onlineSeit).getTime();
    const schichtEndMs = start + schichtDauerMin * 60 * 1000;
    const restSecs = Math.floor((schichtEndMs - now) / 1000);
    const stufe =
      restSecs < 0   ? 'abgelaufen' :
      restSecs < 900  ? 'gleich' :
      restSecs < 1800 ? 'wenig' : 'viel';
    return { restSecs, stufe };
  }, [onlineSeit, schichtDauerMin, now]);

  if (!isOnline || !onlineSeit) return null;
  if (stufe === 'viel' && Math.abs(restSecs) > 2 * 3600) return null; // nur zeigen wenn <2h verbleiben

  const cfg = STUFEN[stufe];
  const Icon = cfg.Icon;
  const gelaufen = Math.floor((now - new Date(onlineSeit).getTime()) / 60_000);
  const ringPct = Math.min(100, (gelaufen / schichtDauerMin) * 100);
  const r = 24;
  const circ = 2 * Math.PI * r;
  const dash = (ringPct / 100) * circ;

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden shadow-sm',
      cfg.bg,
      cfg.pulse && 'animate-pulse',
    )}>
      <div className="flex items-center gap-4 px-4 py-3">
        {/* SVG ring */}
        <div className="relative shrink-0 w-14 h-14">
          <svg width={56} height={56} className="-rotate-90" aria-hidden>
            <circle cx={28} cy={28} r={r} fill="none" strokeWidth={5} className="stroke-stone-200" />
            <circle
              cx={28} cy={28} r={r} fill="none" strokeWidth={5}
              strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
              className={cn(
                'transition-all duration-1000',
                stufe === 'abgelaufen' || stufe === 'gleich' ? 'stroke-red-500' :
                stufe === 'wenig' ? 'stroke-amber-500' : 'stroke-matcha-500',
              )}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon className={cn('h-5 w-5', cfg.farbe)} />
          </div>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className={cn('text-xs font-black uppercase tracking-wide mb-0.5', cfg.farbe)}>
            {cfg.label}
          </div>
          <div className={cn('text-2xl font-black tabular-nums font-mono leading-none', cfg.farbe)}>
            {stufe === 'abgelaufen'
              ? `+${fmt(restSecs)}`
              : fmt(restSecs)
            }
          </div>
          <div className="text-[10px] text-stone-500 mt-1">{cfg.empfehlung}</div>
        </div>

        {/* Stats */}
        <div className="shrink-0 text-right">
          <div className="text-xs font-bold text-stone-600">{gelaufen} Min</div>
          <div className="text-[9px] text-stone-400">gearbeitet</div>
          <div className="text-[9px] text-stone-400 mt-1">von {schichtDauerMin} Min</div>
        </div>
      </div>
    </div>
  );
}
