'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChefHat, Truck, MapPin, CheckCircle2, Clock, Loader2, RefreshCw, Zap } from 'lucide-react';

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

type Phase = 'bestellt' | 'in_zubereitung' | 'unterwegs' | 'zugestellt';
type Confidence = 'sehr_genau' | 'schaetzung' | 'ungefaehr';

interface OrderStatus {
  phase: Phase;
  eta_min: number;
  confidence: Confidence;
}

interface Props {
  orderId: string;
  bestellnummer: string;
  initialEtaMin?: number;
}

const PHASES: { key: Phase; label: string; icon: React.ReactNode }[] = [
  { key: 'bestellt',        label: 'Bestellt',          icon: <Zap className="w-4 h-4" /> },
  { key: 'in_zubereitung',  label: 'In Zubereitung',    icon: <ChefHat className="w-4 h-4" /> },
  { key: 'unterwegs',       label: 'Fahrer unterwegs',  icon: <Truck className="w-4 h-4" /> },
  { key: 'zugestellt',      label: 'Zugestellt',        icon: <CheckCircle2 className="w-4 h-4" /> },
];

const PHASE_INDEX: Record<Phase, number> = {
  bestellt: 0, in_zubereitung: 1, unterwegs: 2, zugestellt: 3,
};

const CONFIDENCE_LABELS: Record<Confidence, { label: string; color: string }> = {
  sehr_genau:  { label: 'Sehr genau',  color: 'bg-emerald-100 text-emerald-700' },
  schaetzung:  { label: 'Schätzung',   color: 'bg-amber-100 text-amber-700' },
  ungefaehr:   { label: 'Ungefähr',    color: 'bg-gray-100 text-gray-600' },
};

function formatCountdown(min: number): string {
  if (min <= 0) return 'Jeden Moment';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h} Std ${m} Min` : `${m} Min`;
}

const PHASE_ICONS_ANIMATED: Record<Phase, React.ReactNode> = {
  bestellt:       <Zap className="w-8 h-8 text-emerald-600 animate-bounce" />,
  in_zubereitung: <ChefHat className="w-8 h-8 text-amber-500 animate-pulse" />,
  unterwegs:      <Truck className="w-8 h-8 text-blue-500 animate-bounce" />,
  zugestellt:     <CheckCircle2 className="w-8 h-8 text-emerald-500" />,
};

export function OrderLiveStatusPanel({ orderId, bestellnummer, initialEtaMin = 30 }: Props) {
  const [status, setStatus] = useState<OrderStatus>({
    phase: 'in_zubereitung',
    eta_min: initialEtaMin,
    confidence: 'schaetzung',
  });
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [countdown, setCountdown] = useState(initialEtaMin);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/orders/${orderId}`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setCountdown(data.eta_min);
      }
    } catch {
      // keep current state on error
    } finally {
      setLoading(false);
      setLastRefresh(Date.now());
    }
  }, [orderId]);

  useEffect(() => {
    const id = setInterval(fetchStatus, 30000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  useEffect(() => {
    if (status.phase === 'zugestellt') return;
    const id = setInterval(() => {
      setCountdown(c => Math.max(0, c - 1 / 60));
    }, 1000);
    return () => clearInterval(id);
  }, [status.phase]);

  const currentIdx = PHASE_INDEX[status.phase];
  const conf = CONFIDENCE_LABELS[status.confidence];

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden max-w-sm mx-auto">
      <div className="bg-emerald-600 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-emerald-100 text-xs">Bestellung</p>
            <p className="text-white font-bold text-lg">{bestellnummer}</p>
          </div>
          <button onClick={fetchStatus} disabled={loading} className="text-emerald-200 hover:text-white transition-colors p-1">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className="px-5 py-6 text-center border-b border-gray-100">
        <div className="flex justify-center mb-3">
          {PHASE_ICONS_ANIMATED[status.phase]}
        </div>
        {status.phase !== 'zugestellt' ? (
          <>
            <p className="text-3xl font-bold text-gray-900">{formatCountdown(countdown)}</p>
            <p className="text-gray-500 text-sm mt-1">Geschätzte Lieferzeit</p>
            <span className={cn('inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium', conf.color)}>
              {conf.label}
            </span>
          </>
        ) : (
          <>
            <p className="text-2xl font-bold text-emerald-600">Zugestellt!</p>
            <p className="text-gray-500 text-sm mt-1">Guten Appetit!</p>
          </>
        )}
      </div>

      <div className="px-5 py-4">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 right-0 top-4 h-0.5 bg-gray-200 mx-4 z-0" />
          <div
            className="absolute left-4 top-4 h-0.5 bg-emerald-500 z-0 transition-all duration-700"
            style={{ width: `${currentIdx > 0 ? (currentIdx / (PHASES.length - 1)) * 100 : 0}%`, maxWidth: 'calc(100% - 2rem)' }}
          />
          {PHASES.map((phase, idx) => {
            const done = idx < currentIdx;
            const active = idx === currentIdx;
            return (
              <div key={phase.key} className="relative z-10 flex flex-col items-center gap-1 flex-1">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all',
                  done  && 'bg-emerald-500 border-emerald-500 text-white',
                  active && 'bg-white border-emerald-500 text-emerald-600 shadow-md',
                  !done && !active && 'bg-white border-gray-200 text-gray-300'
                )}>
                  {phase.icon}
                </div>
                <span className={cn(
                  'text-xs text-center leading-tight max-w-[56px]',
                  (done || active) ? 'text-gray-700 font-medium' : 'text-gray-400'
                )}>
                  {phase.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-5 pb-4 text-center">
        <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
          <Clock className="w-3 h-3" />
          Zuletzt aktualisiert: {new Date(lastRefresh).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
        </p>
      </div>
    </div>
  );
}
