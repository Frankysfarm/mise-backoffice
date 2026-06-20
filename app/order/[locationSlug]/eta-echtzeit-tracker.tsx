'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, MapPin, Bike, CheckCircle2, Package } from 'lucide-react';

interface Props {
  orderId: string;
  etaMin: number;
  orderType: 'lieferung' | 'abholung';
  bestellnummer: string;
}

type Phase = 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

type StatusInfo = {
  label: string;
  desc: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
};

const STATUS_MAP: Record<Phase, StatusInfo> = {
  bestätigt:    { label: 'Bestätigt',       desc: 'Deine Bestellung wurde angenommen',  icon: Package,       color: 'text-blue-600',    bgColor: 'bg-blue-50'    },
  in_zubereitung:{ label: 'In Zubereitung', desc: 'Küche bereitet deine Bestellung vor', icon: Clock,         color: 'text-amber-600',   bgColor: 'bg-amber-50'   },
  fertig:       { label: 'Fertig',          desc: 'Bestellung bereit zur Abholung',      icon: CheckCircle2,  color: 'text-matcha-600',  bgColor: 'bg-matcha-50'  },
  unterwegs:    { label: 'Unterwegs',       desc: 'Fahrer ist auf dem Weg zu dir',       icon: Bike,          color: 'text-purple-600',  bgColor: 'bg-purple-50'  },
  geliefert:    { label: 'Geliefert',       desc: 'Bestellung wurde zugestellt',         icon: CheckCircle2,  color: 'text-matcha-700',  bgColor: 'bg-matcha-100' },
};

const PHASES: Phase[] = ['bestätigt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert'];

export function EtaEchtzeitTracker({ orderId, etaMin, orderType, bestellnummer }: Props) {
  const [currentPhase, setCurrentPhase] = useState<Phase>('bestätigt');
  const [secondsLeft, setSecondsLeft] = useState(etaMin * 60);
  const [loading, setLoading] = useState(false);

  // Poll order status every 30 seconds
  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/tracking?order_id=${encodeURIComponent(orderId)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.status && PHASES.includes(data.status as Phase)) {
          setCurrentPhase(data.status as Phase);
        }
        if (data.eta_seconds && typeof data.eta_seconds === 'number') {
          setSecondsLeft(Math.max(0, data.eta_seconds));
        }
      } catch {
        // Network error — keep last known state
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    poll();
    const iv = setInterval(poll, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [orderId]);

  // Countdown tick
  useEffect(() => {
    if (secondsLeft <= 0 || currentPhase === 'geliefert') return;
    const t = setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1_000);
    return () => clearInterval(t);
  }, [secondsLeft, currentPhase]);

  const currentIdx = PHASES.indexOf(currentPhase);
  const info = STATUS_MAP[currentPhase];
  const IconComp = info.icon;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const showDelivery = orderType === 'lieferung';

  // Progress percentage for the ring
  const totalSec = etaMin * 60;
  const elapsedSec = totalSec - secondsLeft;
  const progressPct = Math.min(100, Math.max(0, (elapsedSec / totalSec) * 100));
  const r = 40;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ - (progressPct / 100) * circ;

  return (
    <div className={cn('rounded-2xl border p-4 space-y-4', info.bgColor, 'border-border')}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-full', info.bgColor)}>
          <IconComp size={18} className={info.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn('text-sm font-bold', info.color)}>{info.label}</div>
          <div className="text-[11px] text-muted-foreground">{info.desc}</div>
        </div>
        <div className="text-[10px] text-muted-foreground">#{bestellnummer}</div>
      </div>

      {/* ETA Countdown (nur bei Lieferung und wenn noch nicht geliefert) */}
      {showDelivery && currentPhase !== 'geliefert' && secondsLeft > 0 && (
        <div className="flex items-center gap-4">
          {/* SVG Ring */}
          <div className="relative shrink-0">
            <svg width={96} height={96} viewBox="0 0 96 96" className="rotate-[-90deg]">
              <circle cx={48} cy={48} r={r} fill="none" stroke="currentColor" strokeWidth={6} className="text-border" />
              <circle
                cx={48} cy={48} r={r} fill="none"
                stroke="currentColor" strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={dashOffset}
                className={info.color}
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className={cn('text-xl font-black tabular-nums leading-none', info.color)}>
                {mins}:{String(secs).padStart(2, '0')}
              </div>
              <div className="text-[8px] text-muted-foreground font-medium">verbleibend</div>
            </div>
          </div>

          {/* Text detail */}
          <div className="space-y-1">
            <div className={cn('text-2xl font-black tabular-nums', info.color)}>
              ~{mins} Min
            </div>
            <div className="text-xs text-muted-foreground">Geschätzte Lieferzeit</div>
            {currentPhase === 'unterwegs' && (
              <div className="flex items-center gap-1 text-[11px] text-purple-600 font-semibold">
                <Bike size={11} />
                Fahrer ist unterwegs
              </div>
            )}
          </div>
        </div>
      )}

      {currentPhase === 'geliefert' && (
        <div className="flex items-center gap-3 rounded-xl bg-matcha-100 border border-matcha-200 px-4 py-3">
          <CheckCircle2 size={20} className="text-matcha-600 shrink-0" />
          <div>
            <div className="text-sm font-bold text-matcha-700">Zugestellt!</div>
            <div className="text-[11px] text-matcha-600">Guten Appetit</div>
          </div>
        </div>
      )}

      {/* Step indicators */}
      <div className="flex items-center gap-1">
        {(showDelivery ? PHASES : PHASES.filter(p => p !== 'unterwegs')).map((p, i, arr) => {
          const idx = PHASES.indexOf(p);
          const done = idx <= currentIdx;
          const active = p === currentPhase;
          return (
            <div key={p} className="flex items-center gap-1 flex-1">
              <div className={cn(
                'h-1.5 w-1.5 rounded-full shrink-0',
                active ? info.color.replace('text-', 'bg-') :
                done   ? 'bg-matcha-400' :
                         'bg-muted',
              )} />
              {i < arr.length - 1 && (
                <div className={cn('flex-1 h-0.5 rounded-full', done ? 'bg-matcha-400' : 'bg-muted')} />
              )}
            </div>
          );
        })}
      </div>

      <div className="text-[9px] text-muted-foreground text-center">
        {loading ? 'Aktualisiere…' : 'Live-Status · alle 30 Sek aktualisiert'}
      </div>
    </div>
  );
}
