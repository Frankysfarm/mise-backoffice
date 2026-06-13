'use client';

import { useEffect, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import {
  MapPin, Phone, CheckCircle2, Clock, Navigation,
  AlertTriangle, Banknote, CreditCard, MessageSquare,
  ChevronDown, ChevronUp, Route,
} from 'lucide-react';

type Stop = {
  id: string;
  batch_id: string;
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
    zahlungsart?: string | null;
    bezahlt?: boolean | null;
    eta_earliest?: string | null;
    eta_latest?: string | null;
    kunde_notiz?: string | null;
    kunde_lieferhinweis?: string | null;
    kunde_telefon?: string | null;
  };
};

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
}

function EtaCountdown({ iso }: { iso: string }) {
  useTick();
  const secs = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
  if (secs < -300) return <span className="text-red-400 font-black text-[10px]">Überfällig</span>;
  if (secs < 0) return <span className="text-orange-400 font-black text-[10px]">Jetzt!</span>;
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  const color = secs < 300 ? 'text-orange-400' : secs < 600 ? 'text-amber-400' : 'text-accent';
  return (
    <span className={cn('font-mono font-black text-[11px] tabular-nums', color)}>
      {mm}:{String(ss).padStart(2, '0')}
    </span>
  );
}

function mapsUrl(lat: number | null, lng: number | null, address: string | null): string {
  if (lat != null && lng != null) {
    const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) return `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
    return `https://maps.google.com/maps?daddr=${lat},${lng}`;
  }
  if (address) {
    const q = encodeURIComponent(address);
    return `https://maps.google.com/maps?daddr=${q}`;
  }
  return '#';
}

function StopCard({
  stop,
  index,
  isCurrent,
  isCompleted,
}: {
  stop: Stop;
  index: number;
  isCurrent: boolean;
  isCompleted: boolean;
}) {
  const [expanded, setExpanded] = useState(isCurrent);
  const o = stop.order;
  const navUrl = mapsUrl(o.kunde_lat, o.kunde_lng, [o.kunde_adresse, o.kunde_plz].filter(Boolean).join(', '));
  const needsPayment = !o.bezahlt && (o.zahlungsart === 'bar' || o.zahlungsart === 'ec');
  const etaEarliest = o.eta_earliest;
  const distM = stop.distanz_zum_vorgaenger_m;

  return (
    <div className={cn(
      'rounded-2xl border transition-all duration-200',
      isCompleted
        ? 'border-matcha-700/30 bg-matcha-900/20 opacity-60'
        : isCurrent
        ? 'border-accent/50 bg-accent/5 shadow-[0_0_16px_rgba(74,230,138,0.12)]'
        : 'border-white/10 bg-white/5',
    )}>
      {/* Header Row */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Stop Number */}
        <div className={cn(
          'h-9 w-9 rounded-xl flex items-center justify-center text-sm font-black shrink-0',
          isCompleted ? 'bg-matcha-700 text-matcha-300'
            : isCurrent ? 'bg-accent text-matcha-900'
            : 'bg-white/10 text-matcha-200',
        )}>
          {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
        </div>

        {/* Name + Address */}
        <div className="flex-1 min-w-0">
          <div className={cn(
            'font-bold text-sm truncate',
            isCompleted ? 'text-matcha-400 line-through' : 'text-matcha-50',
          )}>
            {o.kunde_name}
          </div>
          <div className="text-[10px] text-matcha-400 truncate">
            {o.kunde_adresse}{o.kunde_plz ? `, ${o.kunde_plz}` : ''}
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          {etaEarliest && !isCompleted && (
            <EtaCountdown iso={etaEarliest} />
          )}
          {needsPayment && !isCompleted && (
            <span className="text-[9px] font-bold text-amber-400 flex items-center gap-0.5">
              <Banknote className="h-2.5 w-2.5" />
              Zahlung
            </span>
          )}
          {isCompleted && (
            <span className="text-[9px] text-matcha-500">
              {stop.geliefert_am ? new Date(stop.geliefert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : 'Fertig'}
            </span>
          )}
        </div>

        {/* Expand icon */}
        {!isCompleted && (
          expanded
            ? <ChevronUp className="h-4 w-4 text-matcha-500 shrink-0" />
            : <ChevronDown className="h-4 w-4 text-matcha-500 shrink-0" />
        )}
      </button>

      {/* Expanded Details */}
      {expanded && !isCompleted && (
        <div className="px-4 pb-3 space-y-2 border-t border-white/5 pt-2">
          {/* Info row */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold text-matcha-200">{euro(o.gesamtbetrag)}</span>
            {o.zahlungsart && (
              <span className="flex items-center gap-1 text-[10px] text-matcha-400">
                {o.zahlungsart === 'bar' ? <Banknote className="h-3 w-3" /> : <CreditCard className="h-3 w-3" />}
                {o.zahlungsart === 'bar' ? 'Bar' : o.zahlungsart === 'online' ? 'Online ✓' : o.zahlungsart}
              </span>
            )}
            {distM != null && distM > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-matcha-400">
                <Route className="h-3 w-3" />
                {distM < 1000 ? `${Math.round(distM)} m` : `${(distM / 1000).toFixed(1)} km`}
              </span>
            )}
          </div>

          {/* Notes */}
          {(o.kunde_notiz || o.kunde_lieferhinweis) && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-400/20 px-2.5 py-1.5">
              <div className="flex items-start gap-1.5">
                <MessageSquare className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-[10px] text-amber-200 space-y-0.5">
                  {o.kunde_notiz && <div>{o.kunde_notiz}</div>}
                  {o.kunde_lieferhinweis && <div className="opacity-80">{o.kunde_lieferhinweis}</div>}
                </div>
              </div>
            </div>
          )}

          {/* Payment warning */}
          {needsPayment && (
            <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-400/20 px-2.5 py-1.5">
              <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
              <span className="text-[10px] font-bold text-amber-300">
                {o.zahlungsart === 'bar' ? `${euro(o.gesamtbetrag)} in Bar kassieren` : 'EC-Karte kassieren'}
              </span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <a
              href={navUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-accent text-matcha-900 font-bold text-xs active:scale-[0.97] transition"
            >
              <Navigation className="h-3.5 w-3.5" />
              Navigation
            </a>
            {o.kunde_telefon && (
              <a
                href={`tel:${o.kunde_telefon}`}
                className="flex items-center justify-center gap-1 h-9 w-12 rounded-xl bg-white/10 border border-white/10 text-matcha-200 active:scale-[0.97] transition"
                aria-label="Anrufen"
              >
                <Phone className="h-4 w-4" />
              </a>
            )}
          </div>

          {/* Bestellnummer */}
          <div className="text-[9px] text-matcha-600 text-right">{o.bestellnummer}</div>
        </div>
      )}
    </div>
  );
}

export function TourStopsPanel({
  stops,
  batchStartedAt,
  totalDistanceKm,
}: {
  stops: Stop[];
  batchStartedAt?: string | null;
  totalDistanceKm?: number | null;
}) {
  useTick();
  const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const completedCount = sorted.filter(s => !!s.geliefert_am).length;
  const nextPendingIndex = sorted.findIndex(s => !s.geliefert_am);
  const allDone = completedCount === sorted.length;
  const elapsedMin = batchStartedAt ? Math.floor((Date.now() - new Date(batchStartedAt).getTime()) / 60_000) : null;

  if (sorted.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <Route className="h-4 w-4 text-accent" />
        <span className="text-xs font-black uppercase tracking-wider text-accent">
          Tour · {sorted.length} {sorted.length === 1 ? 'Stopp' : 'Stopps'}
        </span>
        <div className="flex items-center gap-2 ml-auto text-[10px] text-matcha-400">
          {totalDistanceKm != null && totalDistanceKm > 0 && (
            <span className="flex items-center gap-1">
              <MapPin className="h-2.5 w-2.5" />
              {totalDistanceKm.toFixed(1)} km
            </span>
          )}
          {elapsedMin != null && elapsedMin > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {elapsedMin} Min
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all duration-700"
          style={{ width: `${sorted.length > 0 ? (completedCount / sorted.length) * 100 : 0}%` }}
        />
      </div>

      {/* Stops */}
      <div className="space-y-1.5">
        {sorted.map((stop, i) => (
          <StopCard
            key={stop.id}
            stop={stop}
            index={i}
            isCurrent={i === nextPendingIndex}
            isCompleted={!!stop.geliefert_am}
          />
        ))}
      </div>

      {allDone && (
        <div className="rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-accent shrink-0" />
          <div>
            <div className="font-bold text-accent text-sm">Alle Lieferungen abgeschlossen!</div>
            {elapsedMin != null && (
              <div className="text-[10px] text-matcha-400">in {elapsedMin} Minuten</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
