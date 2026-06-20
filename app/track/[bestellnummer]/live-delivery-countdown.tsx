'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, ChefHat, Clock, Package, Truck } from 'lucide-react';

interface Props {
  status: string;
  etaEarliest: string | null;
  etaLatest: string | null;
  bestellt_am: string | null;
  fertig_am: string | null;
  geliefert_am: string | null;
  driverName?: string | null;
  stopsMeta?: { current: number; total: number } | null;
}

function fmtMin(ms: number) {
  const m = Math.floor(ms / 60_000);
  return m <= 0 ? 'gleich' : `${m} Min`;
}

function CountdownRing({ pct, color, label, sublabel }: { pct: number; color: string; label: string; sublabel: string }) {
  const r = 44; const circ = 2 * Math.PI * r;
  const dash = circ * Math.max(0, Math.min(1, pct));
  return (
    <div className="relative flex items-center justify-center">
      <svg width={104} height={104}>
        <circle cx={52} cy={52} r={r} fill="none" stroke="#e5e7eb" strokeWidth={6} />
        <circle
          cx={52} cy={52} r={r} fill="none"
          stroke={color} strokeWidth={6}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 52 52)"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-xl font-black leading-none" style={{ color }}>{label}</span>
        <span className="text-[10px] text-gray-500 mt-0.5 font-medium">{sublabel}</span>
      </div>
    </div>
  );
}

const STEPS = [
  { key: 'bestätigt', label: 'Angenommen', icon: Package },
  { key: 'in_zubereitung', label: 'In Zubereitung', icon: ChefHat },
  { key: 'fertig', label: 'Bereit', icon: Package },
  { key: 'unterwegs', label: 'Unterwegs', icon: Truck },
  { key: 'geliefert', label: 'Geliefert', icon: CheckCircle2 },
] as const;

function getStepIndex(status: string) {
  const idx = STEPS.findIndex(s => s.key === status);
  return idx === -1 ? 0 : idx;
}

export function LiveDeliveryCountdown({ status, etaEarliest, etaLatest, bestellt_am, fertig_am, geliefert_am, driverName, stopsMeta }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => { const iv = setInterval(() => setTick(n => n + 1), 1000); return () => clearInterval(iv); }, []);
  const now = Date.now();

  const stepIdx = getStepIndex(status);
  const isDelivered = status === 'geliefert';

  // Countdown logic
  let countdownLabel = '';
  let countdownSub = '';
  let ringPct = 0;
  let ringColor = '#6b9c5a';

  if (status === 'geliefert' && geliefert_am) {
    countdownLabel = '✓';
    countdownSub = new Date(geliefert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    ringPct = 1;
    ringColor = '#22c55e';
  } else if (status === 'unterwegs' && etaLatest) {
    const msLeft = new Date(etaLatest).getTime() - now;
    const msTotal = etaLatest && bestellt_am ? new Date(etaLatest).getTime() - new Date(bestellt_am).getTime() : 1;
    const msElapsed = msTotal - msLeft;
    ringPct = Math.max(0, Math.min(1, msElapsed / msTotal));
    countdownLabel = fmtMin(Math.max(0, msLeft));
    countdownSub = 'noch';
    ringColor = msLeft < 300_000 ? '#f59e0b' : '#6b9c5a';
  } else if (status === 'fertig') {
    countdownLabel = '👨‍🍳';
    countdownSub = 'Fahrer kommt';
    ringPct = 0.85;
    ringColor = '#3b82f6';
  } else if (status === 'in_zubereitung') {
    countdownLabel = '🍳';
    countdownSub = 'wird gekocht';
    ringPct = 0.5;
    ringColor = '#f59e0b';
  } else {
    countdownLabel = '⏳';
    countdownSub = 'wartet';
    ringPct = 0.15;
    ringColor = '#9ca3af';
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Main countdown */}
      <div className={cn(
        'flex flex-col items-center py-6 px-4',
        isDelivered ? 'bg-green-50' : '',
      )}>
        {isDelivered ? (
          <div className="text-center">
            <div className="text-4xl mb-2">🎉</div>
            <div className="text-lg font-black text-green-700">Guten Appetit!</div>
            <div className="text-sm text-green-600 mt-1">
              Geliefert um {geliefert_am ? new Date(geliefert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
            </div>
          </div>
        ) : (
          <>
            <CountdownRing pct={ringPct} color={ringColor} label={countdownLabel} sublabel={countdownSub} />
            {status === 'unterwegs' && etaEarliest && etaLatest && (
              <div className="mt-3 text-center">
                <div className="text-xs font-bold text-gray-500">Ankunft zwischen</div>
                <div className="text-base font-black text-gray-800">
                  {new Date(etaEarliest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  {' – '}
                  {new Date(etaLatest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                </div>
                {driverName && (
                  <div className="mt-1.5 text-xs text-gray-500">
                    🚴 Fahrer: <span className="font-bold text-gray-700">{driverName}</span>
                  </div>
                )}
                {stopsMeta && stopsMeta.total > 1 && (
                  <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1">
                    <Clock size={10} className="text-blue-500" />
                    <span className="text-[10px] font-bold text-blue-600">
                      {stopsMeta.current > 0
                        ? `${stopsMeta.current} ${stopsMeta.current === 1 ? 'Lieferung' : 'Lieferungen'} vor dir`
                        : 'Du bist als nächstes dran!'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Status stepper */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex items-center justify-between">
          {STEPS.map((step, i) => {
            const done = i <= stepIdx;
            const active = i === stepIdx;
            const Icon = step.icon;
            return (
              <div key={step.key} className="flex flex-col items-center gap-1 flex-1">
                <div className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center transition-all',
                  done
                    ? active
                      ? 'bg-matcha-500 text-white ring-2 ring-matcha-300 ring-offset-1'
                      : 'bg-matcha-400 text-white'
                    : 'bg-gray-100 text-gray-300',
                )}>
                  {done && !active
                    ? <CheckCircle2 size={14} />
                    : <Icon size={13} />
                  }
                </div>
                <span className={cn(
                  'text-[9px] font-bold text-center leading-tight',
                  active ? 'text-matcha-600' : done ? 'text-matcha-400' : 'text-gray-300',
                )}>
                  {step.label}
                </span>
                {i < STEPS.length - 1 && (
                  <div className={cn(
                    'absolute h-0.5 w-[calc(20%-8px)]',
                    done ? 'bg-matcha-400' : 'bg-gray-200',
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
