'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, CheckCircle2, AlertTriangle } from 'lucide-react';

interface Props {
  arrivedAt: string | null;
  expectedDwellSec?: number;
  stopLabel?: string;
  onComplete?: () => void;
}

const R = 26;
const CIRC = 2 * Math.PI * R;

export function StopTimerRing({ arrivedAt, expectedDwellSec = 120, stopLabel, onComplete }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!arrivedAt) return;
    const start = new Date(arrivedAt).getTime();
    const update = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [arrivedAt]);

  useEffect(() => {
    if (elapsed >= expectedDwellSec && onComplete) onComplete();
  }, [elapsed, expectedDwellSec, onComplete]);

  if (!arrivedAt) return null;

  const progress = Math.min(1, elapsed / expectedDwellSec);
  const isOverdue = elapsed > expectedDwellSec;
  const overtime = isOverdue ? elapsed - expectedDwellSec : 0;

  const min = Math.floor(elapsed / 60);
  const sec = elapsed % 60;
  const dash = CIRC * (1 - progress);

  const ringColor = isOverdue ? '#ef4444' : progress > 0.75 ? '#f97316' : '#22c55e';

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border p-3 transition-colors',
      isOverdue
        ? 'border-red-200 bg-red-50 animate-pulse'
        : progress > 0.75
        ? 'border-orange-200 bg-orange-50'
        : 'border-matcha-200 bg-matcha-50',
    )}>
      {/* SVG Ring */}
      <div className="relative h-14 w-14 shrink-0 flex items-center justify-center">
        <svg className="-rotate-90 absolute inset-0" width="56" height="56" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r={R} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="4" />
          <circle
            cx="28" cy="28" r={R} fill="none"
            stroke={ringColor}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={String(CIRC)}
            strokeDashoffset={String(dash)}
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
          />
        </svg>
        <div className="relative text-center leading-none">
          <div className="font-mono text-xs font-black tabular-nums" style={{ color: ringColor }}>
            {min}:{String(sec).padStart(2, '0')}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <MapPin size={11} className="text-muted-foreground shrink-0" />
          <span className="text-[11px] font-bold text-foreground truncate">
            {stopLabel ?? 'Aktueller Stop'}
          </span>
        </div>
        {isOverdue ? (
          <div className="flex items-center gap-1 text-[10px] text-red-600 font-semibold">
            <AlertTriangle size={9} />
            +{Math.floor(overtime / 60)}:{String(overtime % 60).padStart(2, '0')} über Zielzeit
          </div>
        ) : (
          <div className="text-[10px] text-muted-foreground">
            Ziel: {Math.floor(expectedDwellSec / 60)} Min · noch{' '}
            <span className="font-bold tabular-nums" style={{ color: ringColor }}>
              {Math.floor((expectedDwellSec - elapsed) / 60)}:{String(Math.max(0, expectedDwellSec - elapsed) % 60).padStart(2, '0')}
            </span>
          </div>
        )}
        {isOverdue && (
          <div className="flex items-center gap-1 mt-1 text-[9px] text-red-500 font-bold">
            <CheckCircle2 size={9} />
            Bestellung abgeschlossen?
          </div>
        )}
      </div>
    </div>
  );
}
