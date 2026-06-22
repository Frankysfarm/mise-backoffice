'use client';

/**
 * Phase 423 – EtaLiveProximityBanner
 * Customer-facing live ETA banner that shows driver proximity and countdown.
 * Polls the tracking API every 30s and shows:
 *  - Animated countdown (minutes remaining)
 *  - Driver proximity indicator
 *  - "Almost there" pulse when < 5 min
 *  - Color-coded urgency
 */

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Bike, Clock, MapPin, CheckCircle2, Loader2, Navigation } from 'lucide-react';

interface TrackingData {
  status: string;
  eta_label: string | null;
  eta_earliest: string | null;
  eta_latest: string | null;
  stops_before: number;
  driver: {
    lat: number;
    lng: number;
    seconds_stale: number;
  } | null;
  driver_name: string | null;
  fahrer_fahrzeug: string | null;
}

interface Props {
  bestellnummer: string;
  className?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Bike }> = {
  neu: { label: 'Bestellung eingegangen', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: Clock },
  bestätigt: { label: 'Bestätigt — Küche bereitet vor', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Clock },
  in_zubereitung: { label: 'Wird zubereitet', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Clock },
  fertig: { label: 'Fertig — wartet auf Fahrer', color: 'text-matcha-700', bg: 'bg-matcha-50 border-matcha-200', icon: Bike },
  unterwegs: { label: 'Fahrer ist unterwegs', color: 'text-matcha-700', bg: 'bg-matcha-50 border-matcha-200', icon: Bike },
  geliefert: { label: 'Zugestellt!', color: 'text-matcha-700', bg: 'bg-matcha-50 border-matcha-200', icon: CheckCircle2 },
};

function calcEtaMinutes(earliest: string | null, latest: string | null): number | null {
  const t = earliest ?? latest;
  if (!t) return null;
  const diff = Math.round((new Date(t).getTime() - Date.now()) / 60_000);
  return Math.max(0, diff);
}

export function EtaLiveProximityBanner({ bestellnummer, className }: Props) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [etaMin, setEtaMin] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/tracking/${encodeURIComponent(bestellnummer)}`);
      if (!res.ok) { setError(true); return; }
      const json: TrackingData = await res.json();
      setData(json);
      setEtaMin(calcEtaMinutes(json.eta_earliest, json.eta_latest));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [bestellnummer]);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 30_000);
    return () => clearInterval(interval);
  }, [poll]);

  // Countdown tick every minute
  useEffect(() => {
    const t = setInterval(() => {
      setTick((n) => n + 1);
      if (data) setEtaMin(calcEtaMinutes(data.eta_earliest, data.eta_latest));
    }, 60_000);
    return () => clearInterval(t);
  }, [data]);

  if (loading) {
    return (
      <div className={cn('rounded-2xl border border-stone-200 bg-white p-4 flex items-center gap-3', className)}>
        <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
        <span className="text-sm text-stone-500">Lieferstatus wird geladen…</span>
      </div>
    );
  }

  if (error || !data) return null;

  if (data.status === 'geliefert') {
    return (
      <div className={cn('rounded-2xl border bg-matcha-50 border-matcha-200 p-4 flex items-center gap-3', className)}>
        <CheckCircle2 className="h-6 w-6 text-matcha-600 shrink-0" />
        <div>
          <div className="text-base font-bold text-matcha-800">Zugestellt!</div>
          <div className="text-sm text-matcha-600">Deine Bestellung wurde geliefert. Guten Appetit!</div>
        </div>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[data.status] ?? STATUS_CONFIG['bestätigt'];
  const Icon = cfg.icon;
  const isDelivering = ['unterwegs', 'fertig'].includes(data.status);
  const isAlmostHere = etaMin !== null && etaMin <= 5 && isDelivering;

  return (
    <div className={cn('rounded-2xl border overflow-hidden', cfg.bg, className)}>
      {/* Main ETA display */}
      <div className="flex items-center gap-4 p-4">
        {/* Animated icon */}
        <div
          className={cn(
            'shrink-0 flex h-12 w-12 items-center justify-center rounded-full',
            isAlmostHere
              ? 'bg-matcha-500 text-white animate-pulse shadow-lg shadow-matcha-200'
              : isDelivering
              ? 'bg-matcha-100 text-matcha-700'
              : 'bg-stone-100 text-stone-500',
          )}
        >
          <Icon className="h-6 w-6" />
        </div>

        {/* ETA countdown */}
        <div className="flex-1 min-w-0">
          {etaMin !== null && isDelivering ? (
            <>
              <div className={cn('text-3xl font-black tabular-nums leading-none', cfg.color)}>
                {etaMin === 0 ? 'jetzt' : `${etaMin} Min`}
              </div>
              <div className="text-sm text-stone-500 mt-0.5">
                {isAlmostHere ? '🚀 Fast da!' : 'geschätzte Lieferzeit'}
              </div>
            </>
          ) : data.eta_label ? (
            <>
              <div className={cn('text-lg font-bold', cfg.color)}>{data.eta_label}</div>
              <div className="text-sm text-stone-500">{cfg.label}</div>
            </>
          ) : (
            <div className={cn('text-base font-bold', cfg.color)}>{cfg.label}</div>
          )}
        </div>

        {/* Driver info */}
        {data.driver_name && isDelivering && (
          <div className="shrink-0 text-right">
            <div className="text-xs text-stone-500">Dein Fahrer</div>
            <div className="text-sm font-bold text-stone-700">{data.driver_name}</div>
            {data.fahrer_fahrzeug && (
              <div className="text-[10px] text-stone-400 mt-0.5">{data.fahrer_fahrzeug}</div>
            )}
          </div>
        )}
      </div>

      {/* Stops before indicator */}
      {data.stops_before > 0 && isDelivering && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-current/10 bg-white/40">
          <MapPin className="h-3.5 w-3.5 text-stone-500 shrink-0" />
          <span className="text-xs text-stone-600">
            {data.stops_before === 1
              ? '1 Stop vor dir'
              : `${data.stops_before} Stops vor dir`}
          </span>
          {/* Visual stop dots */}
          <div className="flex gap-1">
            {Array.from({ length: Math.min(data.stops_before + 1, 6) }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-2 w-2 rounded-full',
                  i < data.stops_before ? 'bg-amber-400' : 'bg-matcha-400',
                )}
              />
            ))}
          </div>
        </div>
      )}

      {/* Driver freshness indicator */}
      {data.driver && data.driver.seconds_stale > 60 && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-50/80 border-t border-amber-200/50 text-xs text-amber-600">
          <Navigation className="h-3 w-3" />
          Position vor {Math.round(data.driver.seconds_stale / 60)} Min aktualisiert
        </div>
      )}
    </div>
  );
}
