'use client';

import { useEffect, useRef, useState } from 'react';
import { Navigation, Clock, Zap, MapPin, Loader2, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SseFrame {
  type: 'tracking_update' | 'heartbeat' | 'closed';
  ts: string;
  status?: string;
  eta_label?: string | null;
  eta_earliest?: string | null;
  eta_latest?: string | null;
  stops_before?: number | null;
  driver?: {
    lat: number;
    lng: number;
    heading: number | null;
    speed_kmh: number | null;
    seconds_stale: number;
  } | null;
  driver_name?: string | null;
  geo?: {
    distance_m: number | null;
    almost_there: boolean;
    eta_min_remaining: number | null;
    bearing_deg: number | null;
  };
  close_reason?: string;
}

interface Props {
  bestellnummer: string;
  initialStatus: string;
  onUpdate?: (frame: SseFrame) => void;
}

export function SseTrackingLive({ bestellnummer, initialStatus, onUpdate }: Props) {
  const [lastFrame, setLastFrame] = useState<SseFrame | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(false);
  const [closed, setClosed] = useState(false);
  const [, setTick] = useState(0);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const TERMINAL = ['geliefert', 'storniert', 'abgebrochen'];
  const isTerminal = TERMINAL.includes(initialStatus) || (lastFrame?.status && TERMINAL.includes(lastFrame.status));

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isTerminal) return;

    function connect() {
      if (!mountedRef.current) return;

      const ua = /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
      const es = new EventSource(`/api/delivery/tracking/${bestellnummer}/stream?ua=${ua}`);
      esRef.current = es;

      es.addEventListener('tracking_update', (e: MessageEvent) => {
        if (!mountedRef.current) return;
        try {
          const frame: SseFrame = JSON.parse(e.data as string);
          setLastFrame(frame);
          setConnected(true);
          setError(false);
          onUpdate?.(frame);
        } catch {}
      });

      es.addEventListener('heartbeat', () => {
        if (mountedRef.current) setConnected(true);
      });

      es.addEventListener('closed', (e: MessageEvent) => {
        if (!mountedRef.current) return;
        try {
          const frame: SseFrame = JSON.parse(e.data as string);
          setLastFrame(frame);
        } catch {}
        setClosed(true);
        es.close();
      });

      es.onerror = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        setError(true);
        es.close();
        // Reconnect after 8s
        reconnectTimeoutRef.current = setTimeout(connect, 8_000);
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      esRef.current?.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bestellnummer]);

  // Tick for live countdown
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (isTerminal || closed) return null;

  const geo = lastFrame?.geo;
  const driver = lastFrame?.driver;
  const etaMin = geo?.eta_min_remaining ?? null;
  const distM = geo?.distance_m ?? null;
  const almostThere = geo?.almost_there ?? false;

  // Format distance
  function fmtDist(m: number | null): string {
    if (m === null) return '';
    if (m < 1000) return `${Math.round(m)} m`;
    return `${(m / 1000).toFixed(1)} km`;
  }

  // Format ETA countdown from eta_latest
  function etaCountdown(): string | null {
    const etaLatest = lastFrame?.eta_latest;
    if (!etaLatest) return null;
    const diffSec = Math.round((new Date(etaLatest).getTime() - Date.now()) / 1000);
    if (diffSec <= 0) return 'Gleich da';
    const min = Math.floor(diffSec / 60);
    const sec = diffSec % 60;
    return min > 0 ? `${min} Min ${sec} Sek` : `${sec} Sek`;
  }

  const countdown = etaCountdown();

  return (
    <div
      className={cn(
        'rounded-xl border p-3 shadow-sm transition-all',
        almostThere ? 'border-green-300 bg-green-50' : 'border-blue-200 bg-blue-50',
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {!connected && !error && (
            <Loader2 size={14} className="animate-spin text-blue-500 shrink-0" />
          )}
          {connected && (
            <Zap size={14} className={cn('shrink-0', almostThere ? 'text-green-600' : 'text-blue-600')} />
          )}
          {error && <WifiOff size={14} className="text-gray-400 shrink-0" />}
          <span className={cn(
            'text-xs font-semibold',
            almostThere ? 'text-green-700' : 'text-blue-700',
          )}>
            {almostThere ? 'Fahrer ist fast da!' : 'Live-Tracking aktiv'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className={cn(
            'h-1.5 w-1.5 rounded-full',
            connected ? (almostThere ? 'bg-green-500' : 'bg-blue-500') : 'bg-gray-300',
            connected && 'animate-pulse',
          )} />
          <span className="text-[10px] text-gray-400">{connected ? 'verbunden' : error ? 'Verbindung unterbrochen' : 'verbinde...'}</span>
        </div>
      </div>

      {lastFrame && (
        <div className="flex items-center gap-4 flex-wrap">
          {etaMin !== null && (
            <div className="flex items-center gap-1">
              <Clock size={12} className="text-gray-500" />
              <span className="text-sm font-bold text-gray-800 tabular-nums">
                {etaMin <= 1 ? '< 1 Min' : `~${etaMin} Min`}
              </span>
            </div>
          )}

          {countdown && !etaMin && (
            <div className="flex items-center gap-1">
              <Clock size={12} className="text-gray-500" />
              <span className="text-sm font-bold text-gray-800 tabular-nums">{countdown}</span>
            </div>
          )}

          {distM !== null && (
            <div className="flex items-center gap-1">
              <MapPin size={12} className="text-gray-500" />
              <span className="text-xs text-gray-600">{fmtDist(distM)} entfernt</span>
            </div>
          )}

          {driver?.speed_kmh != null && driver.speed_kmh > 0 && (
            <div className="flex items-center gap-1">
              <Navigation size={12} className="text-gray-500" />
              <span className="text-xs text-gray-600">{Math.round(driver.speed_kmh)} km/h</span>
            </div>
          )}

          {lastFrame.stops_before != null && lastFrame.stops_before > 0 && (
            <div className="text-xs text-gray-500">
              noch {lastFrame.stops_before} {lastFrame.stops_before === 1 ? 'Stopp' : 'Stopps'} vor dir
            </div>
          )}
        </div>
      )}

      {!lastFrame && connected && (
        <p className="text-xs text-gray-500">Fahrer-Position wird übertragen …</p>
      )}
    </div>
  );
}
