'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChefHat, Package, Bike, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type TrackingStatus = 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

const STATUS_STEPS: { key: TrackingStatus; label: string; icon: React.ElementType }[] = [
  { key: 'bestätigt',      label: 'Bestätigt',      icon: CheckCircle2 },
  { key: 'in_zubereitung', label: 'In Zubereitung', icon: ChefHat },
  { key: 'fertig',         label: 'Bereit',          icon: Package },
  { key: 'unterwegs',      label: 'Unterwegs',       icon: Bike },
  { key: 'geliefert',      label: 'Geliefert!',      icon: CheckCircle2 },
];

const STATUS_ORDER: TrackingStatus[] = ['bestätigt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert'];

function getStepIndex(status: string): number {
  const i = STATUS_ORDER.indexOf(status as TrackingStatus);
  return i < 0 ? 0 : i;
}

interface SSEPayload {
  status?: string;
  eta_min?: number | null;
  driver_lat?: number | null;
  driver_lng?: number | null;
  driver_name?: string | null;
}

interface Props {
  bestellnummer: string;
  initialStatus?: string;
}

export function BestellungLiveSSETracker({ bestellnummer, initialStatus }: Props) {
  const [status, setStatus] = useState<string>(initialStatus ?? 'bestätigt');
  const [etaMin, setEtaMin] = useState<number | null>(null);
  const [driverName, setDriverName] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const [loading, setLoading] = useState(!initialStatus);
  const [countdown, setCountdown] = useState<number | null>(null);

  const etaSetAt = useRef<number | null>(null);
  const etaSnapshot = useRef<number | null>(null);

  // SSE connection
  useEffect(() => {
    let es: EventSource | null = null;
    let cancelled = false;

    const connect = () => {
      try {
        es = new EventSource(`/api/delivery/tracking/${encodeURIComponent(bestellnummer)}/stream`);
        es.addEventListener('tracking_update', (e: MessageEvent) => {
          if (cancelled) return;
          try {
            const d: SSEPayload = JSON.parse(e.data);
            if (d.status) setStatus(d.status);
            if (d.driver_name !== undefined) setDriverName(d.driver_name);
            if (d.eta_min !== undefined && d.eta_min !== null) {
              setEtaMin(d.eta_min);
              etaSetAt.current = Date.now();
              etaSnapshot.current = d.eta_min;
              setCountdown(d.eta_min);
            }
          } catch { /* ignore parse errors */ }
        });
        es.onopen = () => { if (!cancelled) setSseConnected(true); };
        es.onerror = () => { if (!cancelled) setSseConnected(false); };
      } catch { /* EventSource not available */ }
    };

    connect();
    return () => {
      cancelled = true;
      es?.close();
    };
  }, [bestellnummer]);

  // Polling fallback every 30s
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/delivery/tracking/${encodeURIComponent(bestellnummer)}`, { cache: 'no-store' });
        if (res.ok && !cancelled) {
          const d = await res.json();
          if (d.status) setStatus(d.status);
          if (d.driver_name !== undefined) setDriverName(d.driver_name ?? null);
          if (d.eta_min != null && !sseConnected) {
            setEtaMin(d.eta_min);
            etaSetAt.current = Date.now();
            etaSnapshot.current = d.eta_min;
            setCountdown(d.eta_min);
          }
          setLoading(false);
        }
      } catch { /* ignore */ }
    };
    poll();
    const iv = setInterval(poll, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bestellnummer]);

  // ETA countdown decrement every second
  useEffect(() => {
    if (etaMin === null) return;
    const iv = setInterval(() => {
      if (etaSetAt.current !== null && etaSnapshot.current !== null) {
        const elapsed = (Date.now() - etaSetAt.current) / 60000;
        const remaining = Math.max(0, etaSnapshot.current - elapsed);
        setCountdown(Math.ceil(remaining));
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [etaMin]);

  if (loading) {
    return (
      <div className="rounded-2xl border bg-white p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Bestellstatus wird geladen…
      </div>
    );
  }

  const stepIdx = getStepIndex(status);
  const isDelivered = status === 'geliefert';
  const isOnTheWay = status === 'unterwegs';

  return (
    <div className={cn(
      'rounded-2xl border-2 p-4 space-y-4 transition-all w-full',
      isDelivered ? 'border-green-400 bg-green-50' :
      isOnTheWay  ? 'border-blue-400 bg-blue-50' :
      'border-gray-200 bg-white',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground font-medium">Bestellung #{bestellnummer}</div>
          <div className={cn(
            'text-sm font-bold',
            isDelivered ? 'text-green-700' : isOnTheWay ? 'text-blue-700' : 'text-foreground',
          )}>
            {isDelivered ? '🎉 Zugestellt!' :
             isOnTheWay  ? '🛵 Fahrer ist unterwegs' :
             status === 'in_zubereitung' ? '👨‍🍳 Wird zubereitet' :
             status === 'fertig' ? '📦 Bereit zur Abholung' :
             '✅ Bestätigt'}
          </div>
        </div>

        {/* ETA countdown when unterwegs */}
        {isOnTheWay && countdown !== null && (
          <div className="flex flex-col items-center justify-center rounded-xl bg-white border-2 border-blue-400 px-3 py-2 min-w-[60px]">
            <div className="font-mono text-2xl font-black tabular-nums leading-none text-blue-700">
              {countdown}
            </div>
            <div className="text-[8px] text-muted-foreground mt-0.5">Min</div>
          </div>
        )}
      </div>

      {/* "Noch X Min" big display */}
      {isOnTheWay && countdown !== null && (
        <div className="rounded-xl bg-blue-100 border border-blue-200 px-4 py-3 text-center">
          <div className="text-xs text-blue-600 font-medium">Ankunft in ca.</div>
          <div className="text-4xl font-black text-blue-800 leading-none mt-1">
            Noch {countdown} Min
          </div>
        </div>
      )}

      {/* Progress steps */}
      <div className="relative">
        <div className="absolute top-3 left-3 right-3 h-0.5 bg-gray-100">
          <div
            className="h-full bg-green-500 transition-all duration-700"
            style={{ width: `${Math.min(100, (stepIdx / (STATUS_STEPS.length - 1)) * 100)}%` }}
          />
        </div>
        <div className="relative grid grid-cols-5 gap-0">
          {STATUS_STEPS.map((step, i) => {
            const done = i < stepIdx;
            const active = i === stepIdx;
            const Icon = step.icon;
            return (
              <div key={step.key} className="flex flex-col items-center gap-1">
                <div className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center border-2 transition-all duration-300 z-10 bg-white',
                  done   ? 'bg-green-500 border-green-500 text-white' :
                  active ? 'border-green-500 bg-white text-green-600 scale-110' :
                  'border-gray-200 text-gray-300',
                )}>
                  {done ? <CheckCircle2 className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                </div>
                <div className={cn(
                  'text-[8px] text-center leading-tight',
                  done   ? 'text-green-600 font-bold' :
                  active ? 'text-green-700 font-black' :
                  'text-gray-400',
                )}>
                  {step.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Driver info */}
      {isOnTheWay && driverName && (
        <div className="flex items-center gap-2 rounded-xl bg-blue-100 border border-blue-200 px-3 py-2">
          <Bike className="h-4 w-4 text-blue-600 shrink-0" />
          <div className="text-xs font-bold text-blue-800">{driverName} ist unterwegs</div>
        </div>
      )}

      {/* Delivered celebration */}
      {isDelivered && (
        <div className="rounded-xl bg-green-100 border border-green-300 px-4 py-3 text-center">
          <div className="text-2xl">🎉</div>
          <div className="text-sm font-bold text-green-800 mt-1">Geliefert!</div>
          <div className="text-xs text-green-600">Guten Appetit!</div>
        </div>
      )}

      {/* SSE status dot */}
      <div className="flex items-center gap-1.5 justify-end">
        <span className={cn(
          'h-1.5 w-1.5 rounded-full',
          sseConnected ? 'bg-green-500' : 'bg-gray-300',
        )} />
        <span className="text-[10px] text-muted-foreground">
          {sseConnected ? 'Live' : 'Polling'}
        </span>
      </div>
    </div>
  );
}
