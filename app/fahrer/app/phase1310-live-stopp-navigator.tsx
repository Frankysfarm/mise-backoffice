'use client';

// Phase 1310 — Live-Stopp-Navigator (Fahrer-App)
// Nächster & alle Tour-Stopps mit GPS-Links + Lieferzeit-Countdown + Ankunfts-Aktionen.
// Props-basiert · isOnline-Guard · keine API nötig (kommt aus activeBatch.stops)

import { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Phone, CheckCircle2, Clock, ChevronDown, ChevronUp, ExternalLink, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LiveStop {
  id: string;
  stop_nummer: number;
  kunde_name: string;
  adresse: string;
  plz?: string | null;
  stadt?: string | null;
  lat?: number | null;
  lng?: number | null;
  telefon?: string | null;
  eta_min?: number | null;
  gesamtbetrag?: number | null;
  zahlungsart?: string | null;
  bezahlt?: boolean | null;
  status?: 'pending' | 'arrived' | 'delivered' | null;
}

interface Props {
  stops: LiveStop[];
  driverId: string;
  isOnline: boolean;
  batchStartedAt?: string | null;
  onArrived?: (stopId: string) => void;
  onDelivered?: (stopId: string) => void;
}

function buildGoogleMapsUrl(stop: LiveStop): string {
  if (stop.lat && stop.lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`;
  }
  const q = encodeURIComponent(`${stop.adresse}, ${stop.plz ?? ''} ${stop.stadt ?? ''}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

function buildWazeUrl(stop: LiveStop): string {
  if (stop.lat && stop.lng) {
    return `https://waze.com/ul?ll=${stop.lat},${stop.lng}&navigate=yes`;
  }
  const q = encodeURIComponent(`${stop.adresse}, ${stop.plz ?? ''} ${stop.stadt ?? ''}`);
  return `https://waze.com/ul?q=${q}&navigate=yes`;
}

function CountdownTimer({ targetMs }: { targetMs: number }) {
  const [restSek, setRestSek] = useState(Math.max(0, Math.round((targetMs - Date.now()) / 1000)));
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    ref.current = setInterval(() => {
      setRestSek(Math.max(0, Math.round((targetMs - Date.now()) / 1000)));
    }, 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [targetMs]);

  const m = Math.floor(restSek / 60);
  const s = restSek % 60;
  const isLate = restSek === 0;

  return (
    <span className={cn('font-mono font-black text-sm tabular-nums', isLate ? 'text-red-600 animate-pulse' : 'text-amber-600 dark:text-amber-400')}>
      {isLate ? 'jetzt!' : `${m}:${s.toString().padStart(2, '0')}`}
    </span>
  );
}

export function FahrerPhase1310LiveStoppNavigator({ stops, driverId, isOnline, batchStartedAt, onArrived, onDelivered }: Props) {
  const [open, setOpen] = useState(true);
  const [localStatus, setLocalStatus] = useState<Record<string, 'pending' | 'arrived' | 'delivered'>>({});

  if (!isOnline || stops.length === 0) return null;

  const getStatus = (stop: LiveStop): 'pending' | 'arrived' | 'delivered' =>
    localStatus[stop.id] ?? (stop.status as 'pending' | 'arrived' | 'delivered') ?? 'pending';

  const naechster = stops.find(s => getStatus(s) !== 'delivered') ?? null;
  const abgeschlossen = stops.filter(s => getStatus(s) === 'delivered').length;

  const startMs = batchStartedAt ? new Date(batchStartedAt).getTime() : Date.now();

  const handleArrived = (stopId: string) => {
    setLocalStatus(prev => ({ ...prev, [stopId]: 'arrived' }));
    onArrived?.(stopId);
  };

  const handleDelivered = (stopId: string) => {
    setLocalStatus(prev => ({ ...prev, [stopId]: 'delivered' }));
    onDelivered?.(stopId);
  };

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white"
      >
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4" />
          <span className="text-sm font-bold">Tour-Navigator</span>
          <span className="text-[10px] bg-white/20 rounded-full px-2 py-0.5">
            {abgeschlossen}/{stops.length} erledigt
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {/* Fortschrittsbalken */}
      <div className="h-1.5 bg-blue-100 dark:bg-blue-900/30">
        <div
          className="h-1.5 bg-blue-500 transition-all duration-500"
          style={{ width: `${Math.round((abgeschlossen / stops.length) * 100)}%` }}
        />
      </div>

      {open && (
        <div className="divide-y divide-stone-100 dark:divide-stone-800">
          {stops.map((stop, idx) => {
            const status = getStatus(stop);
            const isNaechster = stop.id === naechster?.id;
            const etaMs = startMs + (stop.eta_min ?? (idx + 1) * 15) * 60_000;
            const isDelivered = status === 'delivered';
            const isArrived = status === 'arrived';

            return (
              <div
                key={stop.id}
                className={cn(
                  'p-3',
                  isDelivered && 'opacity-50',
                  isNaechster && 'bg-blue-50 dark:bg-blue-900/20',
                )}
              >
                {/* Stop-Header */}
                <div className="flex items-start gap-2 mb-2">
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black flex-shrink-0 mt-0.5',
                    isDelivered ? 'bg-emerald-500 text-white' : isNaechster ? 'bg-blue-600 text-white' : 'bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300',
                  )}>
                    {isDelivered ? <CheckCircle2 className="h-3.5 w-3.5" /> : stop.stop_nummer}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate">{stop.kunde_name}</span>
                      {!isDelivered && (
                        <CountdownTimer targetMs={etaMs} />
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{stop.adresse}{stop.plz ? `, ${stop.plz}` : ''}</span>
                    </div>
                  </div>
                </div>

                {/* Details */}
                {!isDelivered && (
                  <div className="ml-8 space-y-2">
                    {/* Bezahlung */}
                    {stop.gesamtbetrag != null && (
                      <div className="flex items-center gap-3 text-[11px]">
                        <Package className="h-3 w-3 text-stone-400 flex-shrink-0" />
                        <span className="text-stone-600 dark:text-stone-300">
                          {stop.gesamtbetrag.toFixed(2)} € · {stop.zahlungsart ?? 'Bar'}
                          {stop.bezahlt && ' · ✓ bezahlt'}
                        </span>
                      </div>
                    )}

                    {/* Aktionen */}
                    <div className="flex gap-1.5 flex-wrap">
                      {/* Navigation */}
                      <a
                        href={buildGoogleMapsUrl(stop)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[11px] font-semibold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                      >
                        <Navigation className="h-3 w-3" />
                        Google
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                      <a
                        href={buildWazeUrl(stop)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[11px] font-semibold hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                      >
                        Waze
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>

                      {/* Telefon */}
                      {stop.telefon && (
                        <a
                          href={`tel:${stop.telefon}`}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-[11px] font-semibold hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                        >
                          <Phone className="h-3 w-3" />
                          Anrufen
                        </a>
                      )}

                      {/* Angekommen */}
                      {!isArrived && (
                        <button
                          onClick={() => handleArrived(stop.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[11px] font-semibold hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                        >
                          <MapPin className="h-3 w-3" />
                          Angekommen
                        </button>
                      )}

                      {/* Geliefert */}
                      <button
                        onClick={() => handleDelivered(stop.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Geliefert
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Abgeschlossen-Footer */}
      {abgeschlossen === stops.length && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border-t border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Alle Stopps erledigt!</span>
        </div>
      )}
    </div>
  );
}
