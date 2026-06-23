'use client';

import { useEffect, useState } from 'react';
import { MapPin, Navigation, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stop {
  id: string;
  kunde_name: string | null;
  kunde_adresse: string | null;
  geplante_ankunft?: string | null;
  geliefert_am: string | null;
  sequence?: number | null;
}

interface Props {
  stops: Stop[];
  currentStopId?: string | null;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '—';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min >= 60) return `${Math.floor(min / 60)}h ${min % 60}m`;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export function NaechsterStoppEtaRing({ stops, currentStopId }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(iv);
  }, []);

  const pending = stops
    .filter((s) => !s.geliefert_am)
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));

  if (pending.length === 0) return null;

  const nextStop = currentStopId
    ? pending.find((s) => s.id === currentStopId) ?? pending[0]
    : pending[0];

  const etaMs = nextStop.geplante_ankunft
    ? new Date(nextStop.geplante_ankunft).getTime() - now
    : null;

  const isLate = etaMs !== null && etaMs < 0;
  const isUrgent = etaMs !== null && etaMs < 3 * 60 * 1000 && etaMs >= 0;

  const ringColor = isLate ? '#ef4444' : isUrgent ? '#f59e0b' : '#4a7c59';
  const radius = 36;
  const circ = 2 * Math.PI * radius;
  const etaTotalMs = etaMs !== null ? Math.abs(etaMs) + 5 * 60_000 : 5 * 60_000;
  const remainPct = etaMs !== null ? Math.max(0, Math.min(1, Math.abs(etaMs) / etaTotalMs)) : 0;
  const dashOffset = circ * remainPct;

  return (
    <div className={cn(
      'rounded-2xl border-2 p-4',
      isLate ? 'border-red-500 bg-red-900/20' :
      isUrgent ? 'border-amber-400 bg-amber-900/20' : 'border-white/20 bg-white/10',
    )}>
      <div className="flex items-center gap-2 mb-3">
        <Navigation className="h-4 w-4 text-white/80 shrink-0" />
        <span className="text-xs font-bold text-white">Nächster Stopp</span>
        <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-bold text-white">
          {pending.length} übrig
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* ETA Ring */}
        {etaMs !== null && (
          <div className="relative shrink-0">
            <svg width="88" height="88" viewBox="0 0 88 88">
              <circle cx="44" cy="44" r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="7" />
              <circle
                cx="44" cy="44" r={radius}
                fill="none"
                stroke={ringColor}
                strokeWidth="7"
                strokeDasharray={circ}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                transform="rotate(-90 44 44)"
                style={{ transition: 'stroke-dashoffset 1s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-black text-lg tabular-nums leading-none text-white" style={{ color: ringColor }}>
                {isLate ? '+' : ''}{formatCountdown(Math.abs(etaMs ?? 0))}
              </span>
              <span className="text-[8px] text-white/60 mt-0.5">
                {isLate ? 'überfällig' : 'ETA'}
              </span>
            </div>
          </div>
        )}

        {/* Stop info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-1.5 mb-1">
            <MapPin className="h-3.5 w-3.5 text-white/70 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-white truncate">
                {nextStop.kunde_name ?? 'Kunde'}
              </div>
              {nextStop.kunde_adresse && (
                <div className="text-[10px] text-white/60 truncate mt-0.5">
                  {nextStop.kunde_adresse}
                </div>
              )}
            </div>
          </div>

          {nextStop.geplante_ankunft && (
            <div className="flex items-center gap-1 mt-2">
              <Clock className="h-3 w-3 text-white/50" />
              <span className="text-[10px] text-white/60">
                Ziel: {new Date(nextStop.geplante_ankunft).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
              </span>
            </div>
          )}

          {pending.length > 1 && (
            <div className="mt-2 text-[10px] text-white/50">
              Danach: {pending[1]?.kunde_name ?? `Stop ${(pending[1]?.sequence ?? 0) + 1}`}
            </div>
          )}
        </div>
      </div>

      {isLate && (
        <div className="mt-3 rounded-xl bg-red-500/30 border border-red-400/40 px-3 py-2 text-center">
          <span className="text-xs font-bold text-red-200">Lieferfenster überschritten</span>
        </div>
      )}
    </div>
  );
}
