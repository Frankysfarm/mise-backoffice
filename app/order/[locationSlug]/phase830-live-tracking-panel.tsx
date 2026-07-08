'use client';

import { useEffect, useState } from 'react';
import { Bike, MapPin, Clock, Radio, Package, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  orderId: string;
  status?: string | null;
  fahrerName?: string | null;
  etaMin?: number | null;
}

interface TrackingData {
  fahrerName: string;
  fahrerInitiale: string;
  status: 'zubereitung' | 'abgeholt' | 'unterwegs' | 'fast_da' | 'geliefert';
  etaMin: number;
  distanceKm: number;
  letzteAktualisierung: string;
  online: boolean;
}

const STATUS_LABELS: Record<TrackingData['status'], string> = {
  zubereitung: 'Wird zubereitet',
  abgeholt: 'Vom Fahrer abgeholt',
  unterwegs: 'Unterwegs zu dir',
  fast_da: 'Fast da!',
  geliefert: 'Geliefert',
};

const STATUS_ORDER: TrackingData['status'][] = ['zubereitung', 'abgeholt', 'unterwegs', 'fast_da', 'geliefert'];

export function StorefrontPhase830LiveTrackingPanel({ orderId, status, fahrerName, etaMin }: Props) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [pulse, setPulse] = useState(false);

  const load = async () => {
    try {
      const res = await fetch(`/api/delivery/orders?id=${orderId}&tracking=true`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json.tracking) {
        setData(json.tracking);
        setPulse(true);
        setTimeout(() => setPulse(false), 500);
        return;
      }
    } catch { /* noop */ }
    // Mock fallback
    const mappedStatus: TrackingData['status'] =
      status === 'unterwegs' ? 'unterwegs' :
      status === 'fertig' ? 'abgeholt' :
      status === 'geliefert' ? 'geliefert' : 'zubereitung';
    setData({
      fahrerName: fahrerName ?? 'Dein Fahrer',
      fahrerInitiale: (fahrerName?.[0] ?? 'F'),
      status: mappedStatus,
      etaMin: etaMin ?? 18,
      distanceKm: 2.4,
      letzteAktualisierung: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      online: true,
    });
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [orderId, status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return null;
  if (data.status === 'geliefert') return (
    <div className="rounded-2xl border border-matcha-200 bg-matcha-50 px-5 py-5 text-center">
      <CheckCircle2 className="h-10 w-10 text-matcha-600 mx-auto mb-2" />
      <div className="text-base font-black text-matcha-800">Geliefert!</div>
      <div className="text-sm text-matcha-600 mt-1">Guten Appetit!</div>
    </div>
  );

  const statusIdx = STATUS_ORDER.indexOf(data.status);
  const isNearby = data.status === 'fast_da';

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden',
      isNearby ? 'border-matcha-300' : 'border-stone-200'
    )}>
      {/* Header */}
      <div className={cn(
        'px-4 py-3 flex items-center gap-3',
        isNearby ? 'bg-matcha-500 text-white' : 'bg-white border-b border-stone-100'
      )}>
        <div className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0',
          isNearby ? 'bg-white text-matcha-700' : 'bg-stone-100 text-stone-700'
        )}>
          {data.fahrerInitiale}
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn('text-sm font-bold truncate', !isNearby && 'text-stone-800')}>
            {data.fahrerName}
          </div>
          <div className={cn('text-[10px]', isNearby ? 'text-matcha-100' : 'text-stone-400')}>
            {STATUS_LABELS[data.status]}
          </div>
        </div>
        {data.online && (
          <div className="flex items-center gap-1 shrink-0">
            <Radio className={cn('h-3 w-3', isNearby ? 'text-white' : 'text-matcha-500', pulse && 'animate-ping')} />
            <span className={cn('text-[10px] font-medium', isNearby ? 'text-white' : 'text-matcha-600')}>Live</span>
          </div>
        )}
      </div>

      {/* ETA + Distanz */}
      {(data.status as string) !== 'geliefert' && (
        <div className="grid grid-cols-2 divide-x divide-stone-100 border-b border-stone-100 bg-white">
          <div className="px-4 py-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Clock className="h-3 w-3 text-stone-400" />
              <span className="text-[9px] text-stone-400">ETA</span>
            </div>
            <div className="text-2xl font-black tabular-nums text-stone-800">{data.etaMin}</div>
            <div className="text-[9px] text-stone-400">Minuten</div>
          </div>
          <div className="px-4 py-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <MapPin className="h-3 w-3 text-stone-400" />
              <span className="text-[9px] text-stone-400">Entfernung</span>
            </div>
            <div className="text-2xl font-black tabular-nums text-stone-800">
              {data.distanceKm.toFixed(1)}
            </div>
            <div className="text-[9px] text-stone-400">km</div>
          </div>
        </div>
      )}

      {/* Fortschritts-Timeline */}
      <div className="px-4 py-3 bg-white">
        <div className="flex items-center justify-between">
          {STATUS_ORDER.filter((s) => s !== 'geliefert').map((s, idx) => {
            const done = STATUS_ORDER.indexOf(s) < statusIdx;
            const active = s === data.status;
            const Icon = idx === 0 ? Package : idx === 1 ? Bike : idx === 2 ? Bike : MapPin;
            return (
              <div key={s} className="flex-1 flex flex-col items-center gap-1">
                {idx > 0 && (
                  <div className={cn(
                    'absolute hidden'
                  )} />
                )}
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all',
                  done ? 'bg-matcha-500' :
                  active ? 'bg-blue-500 ring-2 ring-blue-100 shadow' :
                  'bg-stone-100'
                )}>
                  <Icon className={cn('h-3.5 w-3.5', done || active ? 'text-white' : 'text-stone-400')} />
                </div>
                <span className={cn(
                  'text-[8px] text-center leading-tight max-w-[50px]',
                  done ? 'text-matcha-600 font-bold' :
                  active ? 'text-blue-600 font-bold' : 'text-stone-400'
                )}>
                  {STATUS_LABELS[s].split(' ')[0]}
                </span>
              </div>
            );
          })}
        </div>
        {/* Verbindungslinie */}
        <div className="relative -mt-8 mb-6 mx-3.5">
          <div className="h-0.5 bg-stone-100 absolute top-3.5 left-0 right-0" />
          <div
            className="h-0.5 bg-matcha-400 absolute top-3.5 left-0 transition-all duration-500"
            style={{ width: `${Math.min(100, (statusIdx / (STATUS_ORDER.length - 2)) * 100)}%` }}
          />
        </div>
      </div>

      <div className="px-4 py-2 border-t border-stone-100 bg-stone-50">
        <span className="text-[9px] text-stone-400">
          Aktualisiert {data.letzteAktualisierung} · alle 20s
        </span>
      </div>
    </div>
  );
}
