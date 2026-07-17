'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, CheckCircle2, ChefHat, Clock, MapPin, Package, RefreshCw, Zap, Navigation } from 'lucide-react';

type OrderStatus =
  | 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig'
  | 'abgeholt' | 'unterwegs' | 'geliefert' | 'cancelled';

interface Props {
  orderId?: string | null;
  locationId?: string | null;
  initialStatus?: OrderStatus;
  initialEtaMin?: number | null;
  driverName?: string | null;
  bestellnummer?: string | null;
}

interface TrackData {
  status: OrderStatus;
  etaMin: number | null;
  etaLatestMin: number | null;
  driverName: string | null;
  driverDistanceKm: number | null;
  driverLat: number | null;
  driverLng: number | null;
  prepRemainMin: number | null;
}

const STEPS = [
  { keys: ['neu', 'bestätigt'] as OrderStatus[],        label: 'Bestätigt',    Icon: CheckCircle2 },
  { keys: ['in_zubereitung', 'fertig'] as OrderStatus[], label: 'Zubereitung',  Icon: ChefHat },
  { keys: ['abgeholt', 'unterwegs'] as OrderStatus[],    label: 'Unterwegs',    Icon: Bike },
  { keys: ['geliefert'] as OrderStatus[],                label: 'Geliefert',    Icon: Package },
];

function stepIndex(s: OrderStatus) {
  for (let i = 0; i < STEPS.length; i++) if (STEPS[i].keys.includes(s)) return i;
  return 0;
}

function fmtCountdown(totalSec: number) {
  const m = Math.floor(Math.abs(totalSec) / 60).toString().padStart(2, '0');
  const s = (Math.abs(totalSec) % 60).toString().padStart(2, '0');
  return { m, s };
}

const MOCK: TrackData = {
  status: 'unterwegs',
  etaMin: 12,
  etaLatestMin: 17,
  driverName: 'Tom H.',
  driverDistanceKm: 1.4,
  driverLat: null,
  driverLng: null,
  prepRemainMin: null,
};

export function Phase1000EtaLiveTrackingUltraPro({
  orderId, locationId, initialStatus, initialEtaMin, driverName, bestellnummer,
}: Props) {
  const [data, setData] = useState<TrackData>({
    ...MOCK,
    status: initialStatus ?? 'bestätigt',
    etaMin: initialEtaMin ?? MOCK.etaMin,
    driverName: driverName ?? MOCK.driverName,
  });
  const [secondsLeft, setSecondsLeft] = useState((initialEtaMin ?? MOCK.etaMin ?? 20) * 60);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(Date.now());

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/customer/tracking?order_id=${orderId}`, { cache: 'no-store' });
      if (r.ok) {
        const d: TrackData = await r.json();
        setData(d);
        if (d.etaMin !== null) setSecondsLeft(d.etaMin * 60);
        setLastUpdated(Date.now());
      }
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); const t = setInterval(fetchData, 30_000); return () => clearInterval(t); }, [orderId]);

  useEffect(() => {
    intervalRef.current = setInterval(() => setSecondsLeft(s => Math.max(-3600, s - 1)), 1_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const step = stepIndex(data.status);
  const isDelivered = data.status === 'geliefert';
  const isOnRoute = ['abgeholt', 'unterwegs'].includes(data.status);
  const isLate = secondsLeft < 0 && !isDelivered;
  const { m, s } = fmtCountdown(secondsLeft);

  return (
    <div className="rounded-2xl border border-saffron/20 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-saffron/8 border-b border-saffron/15">
        <Navigation className="h-4 w-4 text-saffron shrink-0" />
        <span className="text-xs font-bold text-saffron/90">
          {bestellnummer ? `Bestellung ${bestellnummer}` : 'Live-Tracking'}
        </span>
        {loading && <RefreshCw className="h-3 w-3 animate-spin text-saffron/60 ml-1" />}
        {isOnRoute && data.driverDistanceKm !== null && (
          <span className="ml-auto text-[10px] font-mono tabular-nums text-saffron/80 font-bold">
            ~{data.driverDistanceKm.toFixed(1)} km entfernt
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Step progress */}
        <div className="flex items-center gap-0">
          {STEPS.map((st, i) => {
            const done = i < step;
            const active = i === step;
            const future = i > step;
            return (
              <React.Fragment key={st.label}>
                <div className="flex flex-col items-center gap-1">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all',
                    done ? 'bg-matcha-500 border-matcha-500 text-white' :
                    active ? 'bg-saffron border-saffron text-white ring-2 ring-saffron/30 ring-offset-1' :
                    'bg-gray-100 border-gray-200 text-gray-400',
                  )}>
                    <st.Icon className="h-3.5 w-3.5" />
                  </div>
                  <span className={cn(
                    'text-[9px] font-bold text-center leading-tight',
                    done ? 'text-matcha-600' : active ? 'text-saffron' : 'text-gray-400',
                  )}>
                    {st.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn('flex-1 h-0.5 mb-4 transition-all', i < step ? 'bg-matcha-400' : 'bg-gray-200')} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* ETA Countdown */}
        {!isDelivered && (
          <div className={cn(
            'flex flex-col items-center rounded-2xl py-4 border',
            isLate ? 'bg-red-50 border-red-200' : 'bg-saffron/5 border-saffron/20',
          )}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              {isLate ? 'Verzögerung' : 'Lieferung in'}
            </div>
            <div className={cn(
              'font-mono text-4xl font-black tabular-nums leading-none',
              isLate ? 'text-red-600' : 'text-saffron',
            )}>
              {isLate && '+'}{m}:{s}
            </div>
            {data.etaLatestMin !== null && data.etaMin !== null && (
              <div className="text-[10px] text-muted-foreground mt-1 tabular-nums">
                Fenster: {data.etaMin}–{data.etaLatestMin} Min
              </div>
            )}
          </div>
        )}

        {/* Delivered success */}
        {isDelivered && (
          <div className="flex flex-col items-center rounded-2xl py-4 bg-matcha-50 border border-matcha-200">
            <CheckCircle2 className="h-8 w-8 text-matcha-500 mb-1" />
            <div className="text-sm font-bold text-matcha-700">Geliefert!</div>
            <div className="text-[10px] text-matcha-600">Guten Appetit</div>
          </div>
        )}

        {/* Driver info */}
        {isOnRoute && data.driverName && (
          <div className="flex items-center gap-2 rounded-xl bg-muted/30 border border-border px-3 py-2">
            <Bike className="h-4 w-4 text-matcha-600 shrink-0" />
            <div className="flex-1">
              <div className="text-[11px] font-bold">{data.driverName}</div>
              <div className="text-[9px] text-muted-foreground">Ist auf dem Weg</div>
            </div>
            {data.driverDistanceKm !== null && (
              <div className="text-right">
                <div className="text-[11px] font-mono tabular-nums font-bold">{data.driverDistanceKm.toFixed(1)} km</div>
                <div className="text-[9px] text-muted-foreground">entfernt</div>
              </div>
            )}
          </div>
        )}

        {/* Prep remaining */}
        {data.prepRemainMin !== null && data.prepRemainMin > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-orange-50 border border-orange-200 px-3 py-2">
            <ChefHat className="h-4 w-4 text-orange-600 shrink-0" />
            <span className="text-[11px] font-bold text-orange-700">
              Noch ~{Math.ceil(data.prepRemainMin)} Min in der Küche
            </span>
          </div>
        )}

        <div className="flex items-center justify-between text-[9px] text-muted-foreground">
          <span>Auto-Update alle 30s</span>
          <span>{new Date(lastUpdated).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
      </div>
    </div>
  );
}
