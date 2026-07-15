'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChefHat, Clock, MapPin, Package, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

type TrackStatus =
  | 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig'
  | 'unterwegs' | 'geliefert' | 'abgeholt';

type TrackData = {
  status: TrackStatus;
  eta_earliest: string | null;
  eta_latest: string | null;
  fahrer_vorname: string | null;
  fahrer_fahrzeug: string | null;
  gesamtbetrag: number | null;
};

const PHASES: { statuses: TrackStatus[]; label: string; icon: React.ElementType; doneLabel: string }[] = [
  { statuses: ['neu', 'bestätigt'],        label: 'Bestätigt',    icon: CheckCircle2, doneLabel: 'Bestätigt' },
  { statuses: ['in_zubereitung'],          label: 'Zubereitung',  icon: ChefHat,      doneLabel: 'Zubereitet' },
  { statuses: ['fertig'],                  label: 'Bereit',       icon: Package,      doneLabel: 'Abholbereit' },
  { statuses: ['unterwegs'],               label: 'Unterwegs',    icon: Truck,        doneLabel: 'Unterwegs' },
  { statuses: ['geliefert', 'abgeholt'],   label: 'Geliefert',    icon: MapPin,       doneLabel: 'Geliefert ✓' },
];

function phaseIndex(status: TrackStatus): number {
  return PHASES.findIndex(p => p.statuses.includes(status));
}

function EtaCountdown({ iso }: { iso: string }) {
  const [secs, setSecs] = useState(() => Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000)));
  useEffect(() => {
    const iv = setInterval(() =>
      setSecs(Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000))),
    1000);
    return () => clearInterval(iv);
  }, [iso]);
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  if (secs === 0) return <span className="text-saffron font-black">Jeden Moment!</span>;
  return (
    <span className="font-mono font-black tabular-nums text-saffron">
      {mm}:{String(ss).padStart(2, '0')}
    </span>
  );
}

export function StorefrontPhase1666EtaLiveCustomerTracking({
  orderId,
  initialData,
}: {
  orderId: string | null;
  initialData?: TrackData | null;
}) {
  const [data, setData] = useState<TrackData | null>(initialData ?? null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const r = await fetch(`/api/delivery/customer/track?order_id=${orderId}`, { cache: 'no-store' });
        if (r.ok && !cancelled) setData(await r.json());
      } catch {}
    };

    poll();
    // Poll every 15s while in active states; slower once delivered
    const iv = setInterval(() => {
      if (data?.status && ['geliefert', 'abgeholt'].includes(data.status)) return;
      poll();
    }, 15_000);

    return () => { cancelled = true; clearInterval(iv); };
  }, [orderId]);

  if (!data) return null;

  const currentPhaseIdx = phaseIndex(data.status);
  const isDelivered = ['geliefert', 'abgeholt'].includes(data.status);

  const etaDate = data.eta_earliest ? new Date(data.eta_earliest) : null;
  const etaMin = etaDate ? Math.max(0, Math.floor((etaDate.getTime() - Date.now()) / 60_000)) : null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className={cn(
        'px-4 py-3 border-b',
        isDelivered ? 'bg-matcha-500' : 'bg-saffron',
      )}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-white/80">
              {isDelivered ? 'Zugestellt' : 'Live-Tracking'}
            </div>
            <div className="text-lg font-black text-white leading-tight">
              {isDelivered
                ? '🎉 Guten Appetit!'
                : etaMin !== null
                  ? `~${etaMin} Min verbleibend`
                  : PHASES[Math.max(0, currentPhaseIdx)]?.label ?? 'In Bearbeitung'
              }
            </div>
          </div>
          {data.eta_earliest && !isDelivered && (
            <div className="text-right">
              <div className="text-[10px] font-bold text-white/70">Ankunft in</div>
              <EtaCountdown iso={data.eta_earliest} />
            </div>
          )}
          {isDelivered && (
            <CheckCircle2 className="h-8 w-8 text-white/90" />
          )}
        </div>
      </div>

      {/* Progress steps */}
      <div className="px-4 py-4">
        <div className="relative">
          {/* Connector line */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-stone-100 z-0">
            <div
              className={cn('h-full transition-all duration-1000', isDelivered ? 'bg-matcha-500' : 'bg-saffron')}
              style={{ width: `${currentPhaseIdx >= 0 ? (currentPhaseIdx / (PHASES.length - 1)) * 100 : 0}%` }}
            />
          </div>

          <div className="relative z-10 flex justify-between">
            {PHASES.map((phase, i) => {
              const Icon = phase.icon;
              const isDone = i < currentPhaseIdx;
              const isCurrent = i === currentPhaseIdx;
              return (
                <div key={i} className="flex flex-col items-center gap-1.5 w-16">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 border-2',
                    isDone
                      ? 'bg-matcha-500 border-matcha-500 text-white'
                      : isCurrent
                        ? 'bg-saffron border-saffron text-white shadow-lg shadow-saffron/30 scale-110'
                        : 'bg-white border-stone-200 text-stone-300',
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className={cn(
                    'text-center text-[9px] font-bold leading-tight',
                    isDone ? 'text-matcha-600' : isCurrent ? 'text-saffron' : 'text-stone-300',
                  )}>
                    {isDone ? phase.doneLabel : phase.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Driver info (when on route) */}
      {data.status === 'unterwegs' && data.fahrer_vorname && (
        <div className="flex items-center gap-3 px-4 py-3 bg-stone-50 border-t border-stone-100">
          <div className="w-9 h-9 rounded-full bg-saffron/15 flex items-center justify-center text-saffron font-black text-sm">
            {data.fahrer_vorname[0]}
          </div>
          <div>
            <div className="text-xs font-bold text-stone-700">{data.fahrer_vorname} ist unterwegs</div>
            <div className="text-[10px] text-stone-400">{data.fahrer_fahrzeug === 'bike' ? '🚲 Fahrrad' : '🚗 Auto'}</div>
          </div>
          <div className="ml-auto">
            <Clock className="h-4 w-4 text-saffron animate-pulse" />
          </div>
        </div>
      )}

      {/* ETA range */}
      {data.eta_earliest && data.eta_latest && !isDelivered && (
        <div className="px-4 py-2.5 border-t border-stone-100 bg-white">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-stone-400">Voraussichtliche Ankunft</span>
            <span className="font-bold text-stone-700">
              {new Date(data.eta_earliest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              {' – '}
              {new Date(data.eta_latest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
