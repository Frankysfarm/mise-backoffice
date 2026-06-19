'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Navigation,
  MapPin,
  Clock,
  CheckCircle2,
  Banknote,
  CreditCard,
  AlertTriangle,
  Route,
  Package,
} from 'lucide-react';
import { cn, euro } from '@/lib/utils';

interface Props {
  stops: {
    id: string;
    reihenfolge: number;
    geliefert_am: string | null;
    angekommen_am: string | null;
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
      eta_earliest: string | null;
      eta_latest: string | null;
      zahlungsart?: string | null;
      bezahlt?: boolean | null;
    };
  }[];
  totalEtaMin?: number | null;
  totalDistanceKm?: number | null;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatDist(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function openMaps(lat: number, lng: number): void {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const url = isIOS
    ? `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`
    : `https://maps.google.com/maps?daddr=${lat},${lng}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function openMapsAddress(address: string): void {
  const enc = encodeURIComponent(address);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const url = isIOS
    ? `maps://maps.apple.com/?daddr=${enc}&dirflg=d`
    : `https://maps.google.com/maps?daddr=${enc}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ─── component ───────────────────────────────────────────────────────────────

export function TourNaviHUD({ stops, totalEtaMin, totalDistanceKm }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const sortedStops = useMemo(
    () => [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge),
    [stops],
  );

  const deliveredCount = useMemo(
    () => sortedStops.filter(s => s.geliefert_am !== null).length,
    [sortedStops],
  );

  const nextStop = useMemo(
    () => sortedStops.find(s => s.geliefert_am === null) ?? null,
    [sortedStops],
  );

  const totalCount = sortedStops.length;
  const remainingCount = totalCount - deliveredCount;
  const progressPct = totalCount > 0 ? (deliveredCount / totalCount) * 100 : 0;

  // ── countdown ──────────────────────────────────────────────────────────────
  const etaLatestMs = nextStop?.order.eta_latest
    ? new Date(nextStop.order.eta_latest).getTime()
    : null;

  const msRemaining = etaLatestMs !== null ? etaLatestMs - now : null;
  const isOverdue = msRemaining !== null && msRemaining <= 0;
  const isUrgent = msRemaining !== null && msRemaining > 0 && msRemaining < 5 * 60 * 1000;

  const countdownLabel =
    msRemaining === null
      ? null
      : isOverdue
        ? 'Überfällig!'
        : formatCountdown(msRemaining);

  const countdownClass = isOverdue || isUrgent ? 'text-red-400' : 'text-matcha-50';

  // ── payment status ─────────────────────────────────────────────────────────
  const showPaymentWarning =
    nextStop !== null &&
    nextStop.order.bezahlt !== true &&
    (nextStop.order.zahlungsart === 'bar' || nextStop.order.zahlungsart === 'cash');

  const isCash =
    nextStop?.order.zahlungsart === 'bar' ||
    nextStop?.order.zahlungsart === 'cash';

  // ── navigation handler ─────────────────────────────────────────────────────
  const handleNavigation = () => {
    if (!nextStop) return;
    const { kunde_lat, kunde_lng, kunde_adresse, kunde_plz } = nextStop.order;
    if (kunde_lat !== null && kunde_lng !== null) {
      openMaps(kunde_lat, kunde_lng);
    } else {
      const addr = [kunde_adresse, kunde_plz].filter(Boolean).join(', ');
      if (addr) openMapsAddress(addr);
    }
  };

  // ── all done ───────────────────────────────────────────────────────────────
  if (totalCount === 0) return null;

  if (!nextStop) {
    return (
      <div className="rounded-2xl bg-matcha-900 border border-matcha-700/50 p-4 space-y-3">
        <div className="flex items-center gap-2 text-matcha-50">
          <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
          <span className="font-bold text-sm">Alle Stopps erledigt!</span>
        </div>
        <_ProgressBar pct={100} delivered={totalCount} total={totalCount} />
      </div>
    );
  }

  const { order } = nextStop;
  const fullAddress = [order.kunde_adresse, order.kunde_plz].filter(Boolean).join(', ');

  return (
    <div className="rounded-2xl bg-matcha-900 border border-matcha-700/40 overflow-hidden">
      {/* ── header strip ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 bg-matcha-800/60 border-b border-matcha-700/40">
        <div className="flex items-center gap-1.5 text-matcha-400 text-[11px] font-semibold uppercase tracking-wider">
          <Route className="h-3.5 w-3.5" />
          <span>Nächster Stopp</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="bg-accent text-matcha-900 text-[11px] font-black px-2 py-0.5 rounded-full leading-tight">
            #{nextStop.reihenfolge}
          </span>
          <span className="text-matcha-400 text-[11px]">{order.bestellnummer}</span>
        </div>
      </div>

      {/* ── main body ───────────────────────────────────────────────────────── */}
      <div className="p-4 space-y-3">
        {/* customer name + payment badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-matcha-50 text-xl font-black leading-tight truncate">
              {order.kunde_name}
            </p>
            {fullAddress && (
              <div className="flex items-start gap-1 mt-1">
                <MapPin className="h-3.5 w-3.5 text-matcha-400 shrink-0 mt-0.5" />
                <p className="text-matcha-400 text-[12px] leading-snug">{fullAddress}</p>
              </div>
            )}
          </div>

          {showPaymentWarning && (
            <div className="shrink-0 flex items-center gap-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold px-2 py-1 rounded-xl">
              <AlertTriangle className="h-3 w-3" />
              <span>Bar</span>
            </div>
          )}
        </div>

        {/* distance + countdown row */}
        <div className="grid grid-cols-2 gap-2">
          {/* distance */}
          <div className="rounded-xl bg-matcha-800/60 px-3 py-2.5">
            <div className="text-matcha-400 text-[10px] font-semibold uppercase tracking-wide mb-0.5 flex items-center gap-1">
              <Package className="h-3 w-3" />
              Distanz
            </div>
            <p className="text-matcha-50 font-black text-base tabular-nums">
              {nextStop.distanz_zum_vorgaenger_m != null
                ? formatDist(nextStop.distanz_zum_vorgaenger_m)
                : '—'}
            </p>
          </div>

          {/* countdown */}
          <div
            className={cn(
              'rounded-xl px-3 py-2.5',
              isOverdue
                ? 'bg-red-900/40 border border-red-500/40'
                : isUrgent
                  ? 'bg-red-900/20 border border-red-500/20'
                  : 'bg-matcha-800/60',
            )}
          >
            <div className="text-matcha-400 text-[10px] font-semibold uppercase tracking-wide mb-0.5 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              ETA
            </div>
            {countdownLabel !== null ? (
              <p
                className={cn(
                  'font-black text-base tabular-nums font-mono',
                  countdownClass,
                  isOverdue && 'animate-pulse',
                )}
              >
                {countdownLabel}
              </p>
            ) : (
              <p className="text-matcha-400 font-black text-base">—</p>
            )}
          </div>
        </div>

        {/* payment info */}
        {showPaymentWarning && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2">
            {isCash ? (
              <Banknote className="h-4 w-4 text-amber-400 shrink-0" />
            ) : (
              <CreditCard className="h-4 w-4 text-amber-400 shrink-0" />
            )}
            <span className="text-amber-300 text-[12px] font-semibold">
              Noch nicht bezahlt —{' '}
              <span className="font-black">{euro(order.gesamtbetrag)}</span> kassieren
            </span>
          </div>
        )}

        {/* navigation button */}
        <button
          onClick={handleNavigation}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-accent text-matcha-900 font-black text-sm py-3 transition active:scale-95 hover:brightness-105"
        >
          <Navigation className="h-4 w-4" />
          Navigation öffnen
        </button>

        {/* tour summary footer */}
        <div className="flex items-center justify-between pt-1 border-t border-matcha-700/40">
          {/* remaining stops */}
          <div className="flex items-center gap-1.5 text-matcha-400 text-[11px]">
            <MapPin className="h-3 w-3 shrink-0" />
            <span>
              <span className="text-matcha-50 font-bold">{remainingCount}</span>{' '}
              {remainingCount === 1 ? 'Stopp' : 'Stopps'} verbleibend
            </span>
          </div>

          {/* tour ETA + distance */}
          {(totalEtaMin != null || totalDistanceKm != null) && (
            <div className="flex items-center gap-1 text-matcha-400 text-[11px]">
              <Clock className="h-3 w-3 shrink-0" />
              <span>
                Tour:{' '}
                {totalEtaMin != null && (
                  <span className="text-matcha-50 font-bold">~{totalEtaMin} min</span>
                )}
                {totalEtaMin != null && totalDistanceKm != null && (
                  <span className="text-matcha-600"> · </span>
                )}
                {totalDistanceKm != null && (
                  <span className="text-matcha-50 font-bold">{totalDistanceKm.toFixed(1)} km</span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* progress bar */}
        <_ProgressBar pct={progressPct} delivered={deliveredCount} total={totalCount} />
      </div>
    </div>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function _ProgressBar({
  pct,
  delivered,
  total,
}: {
  pct: number;
  delivered: number;
  total: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-matcha-400">
        <div className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-accent" />
          <span>
            <span className="text-matcha-50 font-bold">{delivered}</span>/{total} geliefert
          </span>
        </div>
        <span className="font-bold text-matcha-50">{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-matcha-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
