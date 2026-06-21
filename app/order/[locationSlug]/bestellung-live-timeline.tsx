'use client';

/**
 * BestellungLiveTimeline
 * Echtzeit-Timeline für Bestellstatus: Von Bestellung bis Lieferung.
 * Zeigt alle Phasen mit Zeitstempeln und Live-ETA-Countdown.
 */

import { useEffect, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  ShoppingBag, ChefHat, Bike, CheckCircle2, Clock,
  MapPin, AlertTriangle, Package,
} from 'lucide-react';

type Phase = {
  key: string;
  label: string;
  icon: React.ElementType;
  doneStatuses: string[];
  activeStatuses: string[];
};

const PHASES: Phase[] = [
  {
    key: 'bestellt',
    label: 'Bestellt',
    icon: ShoppingBag,
    doneStatuses: ['bestätigt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert'],
    activeStatuses: ['neu'],
  },
  {
    key: 'kueche',
    label: 'In der Küche',
    icon: ChefHat,
    doneStatuses: ['fertig', 'unterwegs', 'geliefert'],
    activeStatuses: ['bestätigt', 'in_zubereitung'],
  },
  {
    key: 'unterwegs',
    label: 'Unterwegs',
    icon: Bike,
    doneStatuses: ['geliefert'],
    activeStatuses: ['fertig', 'unterwegs'],
  },
  {
    key: 'geliefert',
    label: 'Geliefert!',
    icon: CheckCircle2,
    doneStatuses: ['geliefert'],
    activeStatuses: [],
  },
];

interface Props {
  orderId: string;
  initialStatus: string;
  bestelltAm: string | null;
  etaEarliest: string | null;
  etaLatest: string | null;
  kundeAdresse?: string | null;
  driverName?: string | null;
}

function useTick() {
  const [, setN] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setN(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
}

function EtaCountdown({ iso, label }: { iso: string; label?: string }) {
  useTick();
  const secs = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
  const isOverdue = secs < -60;
  const isUrgent = !isOverdue && secs < 300;
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const display = `${secs < 0 ? '-' : ''}${m}:${String(s).padStart(2, '0')}`;

  return (
    <div className="flex flex-col items-center">
      {label && <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">{label}</span>}
      <div className={cn(
        'font-display text-4xl font-black tabular-nums',
        isOverdue ? 'text-red-500 animate-pulse' : isUrgent ? 'text-amber-500' : 'text-matcha-600',
      )}>
        {display}
      </div>
      <div className="text-xs text-muted-foreground">
        {isOverdue ? 'Überfällig' : isUrgent ? 'Gleich da!' : 'Minuten'}
      </div>
    </div>
  );
}

export function BestellungLiveTimeline({
  orderId,
  initialStatus,
  bestelltAm,
  etaEarliest,
  etaLatest,
  kundeAdresse,
  driverName,
}: Props) {
  const [status, setStatus] = useState(initialStatus);

  // Poll for status updates every 15 seconds
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch(`/api/orders/${orderId}/status`);
        if (r.ok && !cancelled) {
          const d = await r.json();
          if (d.status) setStatus(d.status);
        }
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 15_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [orderId]);

  const isDelivered = status === 'geliefert';
  const showEta = ['fertig', 'unterwegs'].includes(status) && etaEarliest;

  return (
    <div className="w-full rounded-2xl bg-white border shadow-sm overflow-hidden">
      {/* ETA countdown (only when driver is on the way) */}
      {showEta && etaEarliest && (
        <div className="bg-gradient-to-r from-matcha-600 to-matcha-500 px-4 py-5 text-center">
          <EtaCountdown iso={etaEarliest} label="Ankunft in" />
          {kundeAdresse && (
            <div className="mt-2 flex items-center justify-center gap-1 text-[11px] text-matcha-100">
              <MapPin size={10} />
              <span className="truncate">{kundeAdresse}</span>
            </div>
          )}
          {driverName && (
            <div className="mt-1 flex items-center justify-center gap-1 text-[11px] text-matcha-100">
              <Bike size={10} />
              <span>{driverName} ist unterwegs</span>
            </div>
          )}
        </div>
      )}

      {/* Delivered success state */}
      {isDelivered && (
        <div className="bg-gradient-to-r from-matcha-600 to-matcha-500 px-4 py-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-white" />
          <div className="mt-2 font-display text-xl font-black text-white">Geliefert! 🎉</div>
          <div className="mt-0.5 text-sm text-matcha-100">Guten Appetit!</div>
        </div>
      )}

      {/* Timeline */}
      <div className="px-4 py-4">
        <div className="relative space-y-0">
          {PHASES.map((phase, idx) => {
            const isDone = phase.doneStatuses.includes(status);
            const isActive = phase.activeStatuses.includes(status);
            const isLast = idx === PHASES.length - 1;
            const Icon = phase.icon;

            return (
              <div key={phase.key} className="relative flex items-start gap-4">
                {/* Connector line */}
                {!isLast && (
                  <div className={cn(
                    'absolute left-[19px] top-[38px] h-[calc(100%-10px)] w-0.5',
                    isDone ? 'bg-matcha-400' : 'bg-gray-200',
                  )} />
                )}

                {/* Icon bubble */}
                <div className={cn(
                  'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                  isDone
                    ? 'border-matcha-500 bg-matcha-500 text-white'
                    : isActive
                    ? 'border-matcha-400 bg-matcha-50 text-matcha-600 shadow-md shadow-matcha-100'
                    : 'border-gray-200 bg-gray-50 text-gray-300',
                )}>
                  <Icon className={cn('h-5 w-5', isActive && 'animate-pulse')} />
                </div>

                {/* Text */}
                <div className={cn('flex-1 pb-6', isLast && 'pb-0')}>
                  <div className={cn(
                    'font-display text-sm font-bold leading-none',
                    isDone ? 'text-matcha-700' : isActive ? 'text-gray-900' : 'text-gray-300',
                  )}>
                    {phase.label}
                    {isActive && (
                      <span className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-matcha-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                      </span>
                    )}
                  </div>

                  {/* Timestamps for key phases */}
                  {phase.key === 'bestellt' && bestelltAm && (
                    <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock size={9} />
                      {new Date(bestelltAm).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                    </div>
                  )}
                  {phase.key === 'unterwegs' && driverName && isActive && (
                    <div className="mt-0.5 text-[10px] text-matcha-600 font-medium">
                      {driverName} liefert gerade
                    </div>
                  )}
                  {phase.key === 'geliefert' && isDone && (
                    <div className="mt-0.5 text-[10px] text-matcha-600 font-medium">
                      Guten Appetit! 🍽️
                    </div>
                  )}
                  {phase.key === 'unterwegs' && isActive && etaEarliest && !showEta && (
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      ETA: {new Date(etaEarliest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
