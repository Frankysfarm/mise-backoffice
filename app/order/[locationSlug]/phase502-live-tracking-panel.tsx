'use client';

/**
 * Phase 502 — Live Tracking Panel (Storefront / Tracking)
 *
 * Kompakter Echtzeit-Tracking-Panel für Kunden:
 * - Live-Countdown mit dynamischer ETA
 * - Farbkodierte Lieferphasen-Anzeige
 * - Fahrer-Nähe-Indikator
 * - Aktualisierungsimpuls für maximales Vertrauen
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, MapPin, Package, Truck, CheckCircle2, ChefHat, Bike, Home } from 'lucide-react';

type OrderStatus = 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert' | 'storniert';

interface Phase {
  key: OrderStatus[];
  icon: React.ElementType;
  label: string;
  sublabel: string;
}

const PHASES: Phase[] = [
  { key: ['neu', 'bestätigt'],  icon: CheckCircle2, label: 'Bestätigt',     sublabel: 'Deine Bestellung wurde angenommen' },
  { key: ['in_zubereitung'],    icon: ChefHat,      label: 'Wird zubereitet', sublabel: 'Die Küche bereitet dein Essen vor' },
  { key: ['fertig'],            icon: Package,      label: 'Bereit',          sublabel: 'Dein Essen wartet auf den Fahrer' },
  { key: ['unterwegs'],         icon: Bike,         label: 'Unterwegs',       sublabel: 'Dein Fahrer ist auf dem Weg' },
  { key: ['geliefert'],         icon: Home,         label: 'Geliefert!',      sublabel: 'Guten Appetit!' },
];

function getCurrentPhaseIndex(status: OrderStatus): number {
  return PHASES.findIndex(p => p.key.includes(status));
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface Props {
  orderId: string;
  status: OrderStatus;
  etaLatest: string | null;
  etaEarliest?: string | null;
  driverName?: string | null;
  bestellnummer?: string;
}

export function Phase502LiveTrackingPanel({
  orderId,
  status,
  etaLatest,
  etaEarliest,
  driverName,
  bestellnummer,
}: Props) {
  const [, setTick] = useState(0);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 600);
    return () => clearTimeout(t);
  }, [status]);

  const now = Date.now();
  const etaMs = etaLatest ? new Date(etaLatest).getTime() - now : null;
  const etaMins = etaMs != null ? Math.max(0, Math.ceil(etaMs / 60000)) : null;
  const isLate = etaMs != null && etaMs < 0;
  const isDelivered = status === 'geliefert';

  const phaseIdx = getCurrentPhaseIndex(status);

  const etaColor = isDelivered
    ? 'text-emerald-600'
    : isLate ? 'text-red-600'
    : etaMins != null && etaMins <= 5 ? 'text-orange-600'
    : 'text-emerald-600';

  const bgColor = isDelivered
    ? 'from-emerald-50 to-teal-50 border-emerald-200'
    : isLate ? 'from-red-50 to-orange-50 border-red-200'
    : status === 'unterwegs' ? 'from-blue-50 to-indigo-50 border-blue-200'
    : 'from-gray-50 to-white border-gray-200';

  if (status === 'storniert') return null;

  return (
    <div className={cn(
      'rounded-2xl border bg-gradient-to-br p-4 transition-all',
      bgColor,
      pulse && 'scale-[1.01]',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Truck size={16} className={cn('transition-colors', etaColor)} />
          <div>
            <div className="text-xs font-bold text-gray-900">
              Live-Tracking{bestellnummer ? ` · #${bestellnummer}` : ''}
            </div>
            {driverName && status === 'unterwegs' && (
              <div className="text-[10px] text-gray-500">Fahrer: {driverName}</div>
            )}
          </div>
        </div>

        {/* ETA Display */}
        {!isDelivered && etaMins != null && (
          <div className="text-right">
            <div className={cn('text-2xl font-black tabular-nums font-mono', etaColor)}>
              {isLate ? 'gleich' : etaMins <= 0 ? 'sofort' : `${etaMins}'`}
            </div>
            <div className="text-[9px] text-gray-400">
              {isLate ? 'unterwegs' : 'noch ca.'}
            </div>
          </div>
        )}
        {isDelivered && (
          <div className="flex items-center gap-1 text-emerald-600">
            <CheckCircle2 size={18} className="text-emerald-500" />
            <span className="text-sm font-bold">Geliefert!</span>
          </div>
        )}
      </div>

      {/* Phase Stepper */}
      <div className="relative mb-3">
        {/* Progress line */}
        <div className="absolute top-3 left-3 right-3 h-0.5 bg-gray-100">
          <div
            className="h-full bg-emerald-400 transition-all duration-700"
            style={{ width: phaseIdx >= 0 ? `${(phaseIdx / (PHASES.length - 1)) * 100}%` : '0%' }}
          />
        </div>

        {/* Phase dots */}
        <div className="relative flex justify-between">
          {PHASES.map((phase, i) => {
            const Icon = phase.icon;
            const isActive = i === phaseIdx;
            const isDone = i < phaseIdx;
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center z-10 transition-all',
                  isDone ? 'bg-emerald-500 text-white' :
                  isActive ? 'bg-emerald-600 text-white ring-2 ring-emerald-200 scale-110' :
                  'bg-gray-100 text-gray-300',
                )}>
                  <Icon size={11} />
                </div>
                <div className={cn(
                  'text-[8px] font-medium text-center max-w-[44px] leading-tight',
                  isActive ? 'text-emerald-700 font-bold' :
                  isDone ? 'text-emerald-500' : 'text-gray-300',
                )}>
                  {phase.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Status */}
      {phaseIdx >= 0 && (
        <div className={cn(
          'text-[11px] text-center font-medium',
          isDelivered ? 'text-emerald-700' : 'text-gray-600',
        )}>
          {PHASES[phaseIdx].sublabel}
        </div>
      )}

      {/* ETA Time Window */}
      {etaEarliest && etaLatest && !isDelivered && (
        <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-gray-400">
          <Clock size={10} />
          <span>
            {new Date(etaEarliest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            {' – '}
            {new Date(etaLatest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
          </span>
        </div>
      )}

      {/* Live pulse indicator */}
      {!isDelivered && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          <div className="relative flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping absolute" />
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </div>
          <span className="text-[9px] text-gray-400">Live</span>
        </div>
      )}
    </div>
  );
}
