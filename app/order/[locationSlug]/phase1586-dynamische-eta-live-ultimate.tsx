'use client';

import React, { useEffect, useState } from 'react';

interface Props {
  orderId?: string | null;
  bestellnummer?: string | null;
  estimatedMin?: number | null;
  currentStatus?: string | null;
  driverName?: string | null;
  distanceKm?: number | null;
}

type Phase = 'angenommen' | 'zubereitung' | 'unterwegs' | 'nah' | 'geliefert';

const PHASES: { key: Phase; label: string; icon: string }[] = [
  { key: 'angenommen', label: 'Angenommen',   icon: '✓' },
  { key: 'zubereitung', label: 'Zubereitung', icon: '👨‍🍳' },
  { key: 'unterwegs',  label: 'Unterwegs',    icon: '🚴' },
  { key: 'nah',        label: 'Fast da',      icon: '📍' },
  { key: 'geliefert',  label: 'Geliefert',    icon: '🎉' },
];

function statusToPhase(status?: string | null): Phase {
  if (!status) return 'angenommen';
  if (['neu', 'angenommen', 'accepted'].includes(status)) return 'angenommen';
  if (['in_zubereitung', 'preparing', 'in_kitchen'].includes(status)) return 'zubereitung';
  if (status === 'fertig') return 'unterwegs';
  if (['unterwegs', 'on_route', 'dispatched'].includes(status)) return 'unterwegs';
  if (status === 'nah') return 'nah';
  if (['geliefert', 'delivered', 'abgeschlossen'].includes(status)) return 'geliefert';
  return 'angenommen';
}

export function StorefrontPhase1586DynamischeEtaLiveUltimate({
  estimatedMin = 28,
  currentStatus,
  driverName,
  distanceKm,
}: Props) {
  const [remainMin, setRemainMin] = useState<number>(estimatedMin ?? 28);
  const [open, setOpen] = useState(true);
  const [pulse, setPulse] = useState(false);

  const phase = statusToPhase(currentStatus);

  useEffect(() => {
    setRemainMin(estimatedMin ?? 28);
  }, [estimatedMin]);

  useEffect(() => {
    if (phase === 'geliefert') return;
    const iv = setInterval(() => {
      setRemainMin((m) => Math.max(0, m - 1 / 60));
    }, 1000);
    return () => clearInterval(iv);
  }, [phase]);

  useEffect(() => {
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 800);
    return () => clearTimeout(t);
  }, [currentStatus]);

  if (!open) return null;

  const currentIdx = PHASES.findIndex((p) => p.key === phase);
  const isDelivered = phase === 'geliefert';
  const isNear = phase === 'nah' || (phase === 'unterwegs' && remainMin <= 5);

  const barColor =
    isDelivered ? 'bg-emerald-500' :
    isNear      ? 'bg-matcha-500 animate-pulse' :
    'bg-matcha-500';

  const barPct = isDelivered ? 100 : Math.max(5, Math.round(((PHASES.length - 1 - Math.max(0, currentIdx)) / (PHASES.length - 1)) * 100));

  return (
    <div className={`rounded-2xl border overflow-hidden shadow-sm transition-all duration-500 ${isNear && !isDelivered ? 'border-matcha-400 bg-matcha-50' : 'border-border bg-white'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-2.5 ${isDelivered ? 'bg-emerald-500 text-white' : 'bg-matcha-600 text-white'}`}>
        <span className="text-sm font-bold">
          {isDelivered ? '🎉 Geliefert!' : isNear ? '📍 Fahrer ist fast da!' : '🚴 Live-Tracking'}
        </span>
        <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white text-base leading-none">×</button>
      </div>

      {/* ETA */}
      {!isDelivered && (
        <div className={`text-center px-4 py-4 ${pulse ? 'scale-105' : ''} transition-transform duration-200`}>
          <div className="text-[10px] font-bold uppercase text-muted-foreground mb-0.5">Voraussichtliche Lieferzeit</div>
          <div className="text-4xl font-black tabular-nums text-foreground">
            {Math.ceil(remainMin)} Min
          </div>
          {driverName && (
            <div className="text-xs text-muted-foreground mt-1">
              Fahrer: <span className="font-bold text-foreground">{driverName}</span>
            </div>
          )}
          {distanceKm != null && (
            <div className="text-xs text-muted-foreground">
              ~{distanceKm.toFixed(1)} km entfernt
            </div>
          )}
        </div>
      )}

      {/* Progress bar */}
      <div className="px-4 pb-2">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
            style={{ width: `${barPct}%` }}
          />
        </div>
      </div>

      {/* Phase stepper */}
      <div className="px-4 pb-4 flex items-center justify-between">
        {PHASES.map((p, i) => {
          const done = i < currentIdx || isDelivered;
          const active = i === currentIdx && !isDelivered;
          return (
            <React.Fragment key={p.key}>
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 ${
                    done    ? 'bg-emerald-500 text-white' :
                    active  ? 'bg-matcha-600 text-white ring-2 ring-matcha-300' :
                              'bg-muted text-muted-foreground'
                  } ${active ? 'scale-110' : ''}`}
                >
                  {p.icon}
                </div>
                <span className={`text-[8px] font-bold leading-tight text-center max-w-[48px] ${
                  active ? 'text-matcha-700' : done ? 'text-emerald-600' : 'text-muted-foreground'
                }`}>
                  {p.label}
                </span>
              </div>
              {i < PHASES.length - 1 && (
                <div className={`flex-1 h-0.5 mx-0.5 rounded-full transition-all duration-700 ${i < currentIdx || isDelivered ? 'bg-emerald-400' : 'bg-muted'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
