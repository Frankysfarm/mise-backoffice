'use client';

/**
 * NaechsterStoppCountdown — Phase 247
 * Kompakter Countdown-Widget für den nächsten unerledigten Stopp der aktiven Tour.
 * Zeigt ETA-Fenster, Distanz und Lieferhinweise des Kunden.
 */

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Clock, MapPin, Navigation, Phone } from 'lucide-react';

type Stop = {
  id: string;
  order_id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  distanz_zum_vorgaenger_m?: number | null;
  order: {
    id: string;
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    kunde_plz: string | null;
    kunde_lat: number | null;
    kunde_lng: number | null;
    gesamtbetrag: number;
    kunde_notiz?: string | null;
    kunde_lieferhinweis?: string | null;
    kunde_telefon?: string | null;
    eta_earliest?: string | null;
    eta_latest?: string | null;
  };
};

interface Props {
  stops: Stop[];
  currentLat?: number | null;
  currentLng?: number | null;
}

function useTick(interval = 1000) {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), interval);
    return () => clearInterval(iv);
  }, [interval]);
}

function formatDuration(sec: number): string {
  if (sec <= 0) return 'Jetzt!';
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 5) return `${m} Min`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDistKm(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function NaechsterStoppCountdown({ stops, currentLat, currentLng }: Props) {
  useTick();

  const nextStop = useMemo(() => {
    return stops
      .filter(s => !s.geliefert_am)
      .sort((a, b) => a.reihenfolge - b.reihenfolge)[0] ?? null;
  }, [stops]);

  if (!nextStop) return null;

  const { order } = nextStop;
  const now = Date.now();

  // ETA-Fenster
  const etaEarliestMs = order.eta_earliest ? new Date(order.eta_earliest).getTime() : null;
  const etaLatestMs   = order.eta_latest   ? new Date(order.eta_latest).getTime()   : null;
  const secsToEarliest = etaEarliestMs ? Math.max(0, Math.floor((etaEarliestMs - now) / 1000)) : null;
  const secsToLatest   = etaLatestMs   ? Math.max(0, Math.floor((etaLatestMs   - now) / 1000)) : null;

  const isUrgent = secsToLatest != null && secsToLatest < 5 * 60;
  const isNear   = secsToLatest != null && secsToLatest < 12 * 60;
  const isOverdue = etaLatestMs != null && etaLatestMs < now;

  // Luftlinien-Distanz (falls GPS-Position bekannt)
  let distM: number | null = null;
  if (currentLat && currentLng && order.kunde_lat && order.kunde_lng) {
    const R = 6371e3;
    const φ1 = currentLat * Math.PI / 180;
    const φ2 = order.kunde_lat * Math.PI / 180;
    const Δφ = (order.kunde_lat - currentLat) * Math.PI / 180;
    const Δλ = (order.kunde_lng - currentLng) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    distM = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  const openNavigation = () => {
    if (!order.kunde_lat || !order.kunde_lng) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${order.kunde_lat},${order.kunde_lng}`;
    window.open(url, '_blank');
  };

  const callCustomer = () => {
    if (!order.kunde_telefon) return;
    window.location.href = `tel:${order.kunde_telefon}`;
  };

  const borderColor =
    isOverdue ? 'border-red-500 bg-red-950/40' :
    isUrgent  ? 'border-orange-500 bg-orange-950/40' :
    isNear    ? 'border-amber-500 bg-amber-950/30' :
               'border-matcha-600/60 bg-matcha-900/40';

  const statusBadge =
    isOverdue ? { label: '⚠ Überfällig', cls: 'bg-red-500/20 text-red-300' } :
    isUrgent  ? { label: '🔥 Dringend', cls: 'bg-orange-500/20 text-orange-300' } :
    isNear    ? { label: '⏱ Bald fällig', cls: 'bg-amber-500/20 text-amber-300' } :
               { label: '▶ Nächster Stopp', cls: 'bg-matcha-500/20 text-matcha-300' };

  return (
    <div className={cn('rounded-2xl border-2 p-4 space-y-3 transition-colors', borderColor)}>
      {/* Badge + Name */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className={cn('text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full', statusBadge.cls)}>
            {statusBadge.label}
          </span>
          <div className="mt-1.5 text-base font-black text-white leading-tight">
            {order.kunde_name}
          </div>
          {order.kunde_adresse && (
            <div className="flex items-center gap-1 mt-0.5 text-[11px] text-matcha-300">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{order.kunde_adresse}{order.kunde_plz ? `, ${order.kunde_plz}` : ''}</span>
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-[9px] text-matcha-400 uppercase font-bold">Stopp {nextStop.reihenfolge}</div>
          <div className="text-[10px] font-mono text-matcha-300">#{order.bestellnummer}</div>
        </div>
      </div>

      {/* ETA-Countdown */}
      {(secsToEarliest != null || secsToLatest != null) && (
        <div className="grid grid-cols-2 gap-2">
          {secsToEarliest != null && (
            <div className={cn(
              'rounded-xl p-2.5 text-center',
              isOverdue ? 'bg-red-500/20' : 'bg-white/5',
            )}>
              <div className="text-[9px] text-matcha-400 uppercase font-bold mb-0.5">Früheste ETA</div>
              <div className={cn(
                'font-mono font-black text-xl tabular-nums',
                isOverdue ? 'text-red-300' : 'text-white',
              )}>
                {isOverdue && secsToEarliest === 0 ? '–' : formatDuration(secsToEarliest)}
              </div>
            </div>
          )}
          {secsToLatest != null && (
            <div className={cn(
              'rounded-xl p-2.5 text-center',
              isOverdue ? 'bg-red-500/30' : isUrgent ? 'bg-orange-500/20' : 'bg-white/5',
            )}>
              <div className="text-[9px] text-matcha-400 uppercase font-bold mb-0.5 flex items-center justify-center gap-0.5">
                {(isUrgent || isOverdue) && <AlertTriangle className="h-2.5 w-2.5" />}
                Späteste ETA
              </div>
              <div className={cn(
                'font-mono font-black text-xl tabular-nums',
                isOverdue ? 'text-red-300 animate-pulse' : isUrgent ? 'text-orange-300' : 'text-white',
              )}>
                {isOverdue ? 'Jetzt!' : formatDuration(secsToLatest)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Distanz-Badge */}
      {distM != null && (
        <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
          <Clock className="h-3.5 w-3.5 text-matcha-400 shrink-0" />
          <span className="text-[11px] text-matcha-300">
            Luftlinie: <strong className="text-white">{formatDistKm(distM)}</strong>
          </span>
          {nextStop.distanz_zum_vorgaenger_m && (
            <span className="text-[10px] text-matcha-500 ml-auto">
              +{formatDistKm(nextStop.distanz_zum_vorgaenger_m)} seit letztem Stopp
            </span>
          )}
        </div>
      )}

      {/* Lieferhinweis */}
      {(order.kunde_notiz || order.kunde_lieferhinweis) && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-[11px] text-amber-200 space-y-0.5">
          {order.kunde_lieferhinweis && (
            <div className="flex items-start gap-1.5">
              <span className="font-bold text-amber-300 shrink-0">📍</span>
              {order.kunde_lieferhinweis}
            </div>
          )}
          {order.kunde_notiz && (
            <div className="flex items-start gap-1.5">
              <span className="font-bold text-amber-300 shrink-0">📝</span>
              {order.kunde_notiz}
            </div>
          )}
        </div>
      )}

      {/* Aktions-Buttons */}
      <div className="flex gap-2">
        {order.kunde_lat && order.kunde_lng && (
          <button
            onClick={openNavigation}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-matcha-600 py-2.5 text-sm font-bold text-white transition hover:bg-matcha-500 active:scale-95"
          >
            <Navigation className="h-4 w-4" />
            Navigieren
          </button>
        )}
        {order.kunde_telefon && (
          <button
            onClick={callCustomer}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-white/20 active:scale-95"
          >
            <Phone className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
