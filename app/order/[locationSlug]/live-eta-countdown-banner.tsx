'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, ChefHat, CheckCircle2, Clock, MapPin, Package, Truck } from 'lucide-react';

type Status = 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert' | 'abgeholt' | 'storniert';

interface Props {
  status: Status;
  etaEarliest: string | null;
  etaLatest: string | null;
  geschaetzteZubereitungMin: number | null;
  geschaetztelieferungMin: number | null;
  fahrerVorname: string | null;
  fahrerFahrzeug: string | null;
  typ: 'lieferung' | 'abholung';
}

function useCountdown(targetIso: string | null) {
  const [secs, setSecs] = useState<number | null>(() => {
    if (!targetIso) return null;
    return Math.max(0, Math.floor((new Date(targetIso).getTime() - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!targetIso) return;
    const update = () => setSecs(Math.max(0, Math.floor((new Date(targetIso).getTime() - Date.now()) / 1000)));
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [targetIso]);

  return secs;
}

function formatCountdown(secs: number): string {
  if (secs === 0) return 'Jeden Moment';
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')} Min`;
}

export function LiveEtaCountdownBanner({
  status, etaEarliest, etaLatest, geschaetzteZubereitungMin,
  geschaetztelieferungMin, fahrerVorname, fahrerFahrzeug, typ,
}: Props) {
  const target = etaLatest ?? etaEarliest;
  const countdown = useCountdown(target);

  if (status === 'geliefert' || status === 'abgeholt' || status === 'storniert') return null;

  const progress = (() => {
    if (status === 'neu' || status === 'bestätigt') return 10;
    if (status === 'in_zubereitung') return 35;
    if (status === 'fertig') return 65;
    if (status === 'unterwegs') return 85;
    return 0;
  })();

  const steps: { label: string; icon: React.ElementType; done: boolean; active: boolean }[] = [
    {
      label: 'Eingegangen',
      icon: Package,
      done: ['bestätigt', 'in_zubereitung', 'fertig', 'unterwegs'].includes(status),
      active: status === 'neu',
    },
    {
      label: 'Zubereitung',
      icon: ChefHat,
      done: ['fertig', 'unterwegs'].includes(status),
      active: status === 'in_zubereitung',
    },
    ...(typ === 'lieferung' ? [{
      label: 'Unterwegs',
      icon: Truck,
      done: false,
      active: status === 'unterwegs',
    }] : [{
      label: 'Bereit',
      icon: CheckCircle2,
      done: false,
      active: status === 'fertig',
    }]),
  ];

  const etaDisplay = (() => {
    if (!target) {
      if (status === 'in_zubereitung' && geschaetzteZubereitungMin) {
        return `ca. ${geschaetzteZubereitungMin} Min`;
      }
      if (status === 'unterwegs' && geschaetztelieferungMin) {
        return `ca. ${geschaetztelieferungMin} Min`;
      }
      return null;
    }
    const fmt = new Date(target).toLocaleTimeString('de-DE', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin',
    });
    return `ca. ${fmt} Uhr`;
  })();

  const headlineText = (() => {
    if (status === 'unterwegs') {
      return fahrerVorname ? `${fahrerVorname} ist unterwegs` : 'Fahrer ist unterwegs';
    }
    if (status === 'fertig') {
      return typ === 'lieferung' ? 'Wartet auf Fahrer' : 'Bereit zur Abholung';
    }
    if (status === 'in_zubereitung') return 'Wird frisch zubereitet';
    return 'Bestellung eingegangen';
  })();

  const vehicleEmoji = (() => {
    switch (fahrerFahrzeug) {
      case 'ebike': return '🛵';
      case 'scooter': return '🛴';
      case 'auto': return '🚗';
      default: return '🚲';
    }
  })();

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* Progress bar */}
      <div className="bg-stone-100 h-1">
        <div
          className="bg-matcha-500 h-full transition-all duration-1000 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Main content */}
      <div className="p-4">
        {/* Headline */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {status === 'unterwegs' ? (
              <span className="text-lg">{vehicleEmoji}</span>
            ) : status === 'in_zubereitung' ? (
              <ChefHat className="h-5 w-5 text-amber-600" />
            ) : (
              <Package className="h-5 w-5 text-matcha-600" />
            )}
            <span className="text-sm font-bold text-stone-800">{headlineText}</span>
          </div>

          {/* Countdown or ETA */}
          {countdown !== null && countdown > 0 && countdown <= 90 * 60 ? (
            <div className="flex flex-col items-end">
              <span className="text-lg font-black text-matcha-700 tabular-nums leading-none">
                {formatCountdown(countdown)}
              </span>
              <span className="text-[9px] text-stone-400">verbleibend</span>
            </div>
          ) : etaDisplay ? (
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-stone-400" />
                <span className="text-xs font-bold text-stone-600">{etaDisplay}</span>
              </div>
              <span className="text-[9px] text-stone-400">geschätzte Ankunft</span>
            </div>
          ) : null}
        </div>

        {/* Steps */}
        <div className="flex items-center gap-1">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.label} className="flex items-center gap-1 flex-1">
                <div className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-500',
                      step.done
                        ? 'bg-matcha-500 border-matcha-500 text-white'
                        : step.active
                        ? 'bg-white border-matcha-400 text-matcha-600 ring-4 ring-matcha-100'
                        : 'bg-stone-100 border-stone-200 text-stone-300',
                    )}
                  >
                    {step.done ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-center text-[9px] font-semibold leading-tight',
                      step.active ? 'text-matcha-700' : step.done ? 'text-stone-500' : 'text-stone-300',
                    )}
                  >
                    {step.label}
                  </span>
                </div>

                {i < steps.length - 1 && (
                  <div
                    className={cn(
                      'h-0.5 flex-1 rounded mb-4',
                      steps[i + 1].done || steps[i + 1].active || step.done
                        ? 'bg-matcha-400'
                        : 'bg-stone-200',
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
