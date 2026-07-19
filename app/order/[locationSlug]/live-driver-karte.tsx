'use client';

/**
 * Dynamische ETA + Live-Fahrer-Positionsindikator (Storefront)
 *
 * Zeigt Fahrer-Nähe als Kompass-Ring mit Pulsanimation an.
 * Gibt Live-ETA-Countdown (Sekunden) mit Farbkodierung aus.
 * Keine externen Karten-APIs – rein CSS-basiert.
 */

import { cn } from '@/lib/utils';
import { Bike, MapPin, Navigation2, Zap } from 'lucide-react';

interface Props {
  driverLat: number | null;
  driverLng: number | null;
  customerLat?: number | null;
  customerLng?: number | null;
  driverName: string | null;
  etaEarliest: string | null;
  etaLatest: string | null;
  secRemain: number | null;
  isOnTheWay: boolean;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180);
  const x = Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180)
    - Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function fmtMmSs(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatEta(earliest: string | null, latest: string | null): string {
  if (!earliest) return '';
  const e = new Date(earliest);
  const l = latest ? new Date(latest) : null;
  const fmt = (d: Date) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return l ? `${fmt(e)} – ${fmt(l)}` : fmt(e);
}

export function LiveDriverKarte({
  driverLat, driverLng, customerLat, customerLng,
  driverName, etaEarliest, etaLatest, secRemain, isOnTheWay,
}: Props) {
  if (!isOnTheWay || !driverLat || !driverLng) return null;

  const distKm = customerLat && customerLng
    ? haversineKm(driverLat, driverLng, customerLat, customerLng)
    : null;
  const bearing = customerLat && customerLng
    ? bearingDeg(driverLat, driverLng, customerLat, customerLng)
    : null;

  const isClose = distKm !== null && distKm < 0.5;
  const isVeryClose = distKm !== null && distKm < 0.2;
  const isCountdown = secRemain !== null && secRemain <= 15 * 60;

  const countdownColor = secRemain !== null
    ? secRemain <= 120 ? 'text-red-600 dark:text-red-400'
      : secRemain <= 300 ? 'text-amber-600 dark:text-amber-400'
      : 'text-matcha-700 dark:text-matcha-300'
    : 'text-matcha-700 dark:text-matcha-300';

  return (
    <div className={cn(
      'rounded-2xl border p-4 transition-all duration-500',
      isVeryClose
        ? 'border-matcha-400 bg-matcha-50 dark:bg-matcha-950/20 shadow-md shadow-matcha-100/50'
        : isClose
        ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/10'
        : 'border-border bg-card',
    )}>
      <div className="flex items-center gap-4">
        {/* Kompass-Ring mit Fahrer-Dot */}
        <div className="relative shrink-0 h-16 w-16">
          {/* Pulsierende Ringe wenn nah */}
          {isClose && (
            <>
              <span className="absolute inset-0 rounded-full bg-matcha-400/20 animate-ping" />
              {isVeryClose && <span className="absolute inset-2 rounded-full bg-matcha-400/30 animate-ping" style={{ animationDelay: '0.4s' }} />}
            </>
          )}

          {/* Kompass-Hintergrund */}
          <div className="relative h-16 w-16 rounded-full border-2 border-border bg-background flex items-center justify-center">
            {/* Bearing-Pfeil */}
            {bearing !== null && (
              <Navigation2
                className={cn('h-6 w-6 transition-transform duration-1000', isClose ? 'text-matcha-600' : 'text-muted-foreground')}
                style={{ transform: `rotate(${bearing}deg)` }}
              />
            )}
            {bearing === null && <Bike className="h-6 w-6 text-matcha-600" />}

            {/* Fahrer-Dot am Rand basierend auf Bearing */}
            {bearing !== null && (
              <div
                className={cn('absolute h-3 w-3 rounded-full border-2 border-background transition-all', isClose ? 'bg-matcha-500' : 'bg-amber-400')}
                style={{
                  top: `calc(50% - 6px + ${Math.cos((bearing * Math.PI) / 180) * -24}px)`,
                  left: `calc(50% - 6px + ${Math.sin((bearing * Math.PI) / 180) * 24}px)`,
                }}
              />
            )}
          </div>

          {/* MapPin Ziel-Marker */}
          <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-background border border-border flex items-center justify-center">
            <MapPin className="h-3 w-3 text-matcha-600" />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Bike className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
            <span className="text-sm font-semibold text-foreground truncate">
              {driverName ?? 'Dein Fahrer'}
            </span>
            {isVeryClose && (
              <span className="flex items-center gap-0.5 text-[10px] font-semibold text-matcha-600 bg-matcha-100 dark:bg-matcha-900/40 px-1.5 py-0.5 rounded-full">
                <Zap className="h-2.5 w-2.5" />
                Fast da!
              </span>
            )}
          </div>

          {distKm !== null && (
            <p className="text-xs text-muted-foreground mb-1">
              {distKm < 1
                ? `${Math.round(distKm * 1000)} m entfernt`
                : `${distKm.toFixed(1)} km entfernt`}
            </p>
          )}

          {/* ETA / Countdown */}
          {isCountdown && secRemain !== null ? (
            <div className="flex items-baseline gap-1.5">
              <span className={cn('text-lg font-black tabular-nums font-mono leading-none', countdownColor)}>
                {fmtMmSs(secRemain)}
              </span>
              <span className="text-[10px] text-muted-foreground">Echtzeit</span>
            </div>
          ) : etaEarliest ? (
            <div className="text-xs text-muted-foreground">
              ETA: <span className="font-semibold text-foreground">{formatEta(etaEarliest, etaLatest)}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
