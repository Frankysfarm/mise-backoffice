'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Navigation, MapPin, CheckCircle2, Clock, Phone,
  AlertTriangle, ChevronRight, Loader2, Route,
} from 'lucide-react';

interface Stop {
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  distanz_zum_vorgaenger_m?: number | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    kunde_plz: string | null;
    kunde_lat: number | null;
    kunde_lng: number | null;
    kunde_telefon: string | null;
    eta_earliest: string | null;
    eta_latest: string | null;
    zahlungsart: string | null;
    bezahlt: boolean | null;
  };
}

interface Props {
  batchId: string;
  driverId: string;
}

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(iv);
  }, []);
  return now;
}

function mapsUrl(lat: number | null, lng: number | null, addr: string | null): string {
  const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (lat != null && lng != null) {
    return isIos
      ? `maps://maps.apple.com/?daddr=${lat},${lng}`
      : `https://maps.google.com/?daddr=${lat},${lng}`;
  }
  if (addr) return `https://maps.google.com/?q=${encodeURIComponent(addr)}`;
  return '#';
}

function formatDist(m: number | null | undefined): string {
  if (!m) return '';
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export function TourNavigationsKompass({ batchId, driverId }: Props) {
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const now = useNow();

  const load = useCallback(() => {
    fetch(`/api/delivery/tours/${batchId}/stops`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const list: Stop[] = Array.isArray(d?.stops) ? d.stops : Array.isArray(d) ? d : [];
        setStops(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [batchId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 25_000);
    return () => clearInterval(iv);
  }, [load]);

  const pending = stops.filter(s => !s.geliefert_am);
  const done    = stops.filter(s => !!s.geliefert_am);
  const current = pending[0] ?? null;
  const next    = pending[1] ?? null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-zinc-900 px-4 py-3 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Lade Tour-Stops…
      </div>
    );
  }

  if (!current) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-matcha-600/20 border border-matcha-500/30 px-4 py-3">
        <CheckCircle2 className="h-5 w-5 text-matcha-400" />
        <span className="text-sm font-bold text-matcha-200">Alle Stopps erledigt! 🎉</span>
      </div>
    );
  }

  const etaIso = current.order.eta_latest ?? current.order.eta_earliest;
  const etaSecs = etaIso ? Math.floor((new Date(etaIso).getTime() - now) / 1000) : null;
  const etaMin  = etaSecs != null ? Math.floor(Math.abs(etaSecs) / 60) : null;
  const isLate  = etaSecs != null && etaSecs < 0;
  const isTight = etaSecs != null && etaSecs < 300;

  const navUrl = mapsUrl(current.order.kunde_lat, current.order.kunde_lng, current.order.kunde_adresse);

  return (
    <div className="space-y-3">
      {/* Aktueller Stop — groß */}
      <div className={cn(
        'rounded-2xl border-2 overflow-hidden',
        isLate  ? 'border-red-500/60 bg-red-950/30'
        : isTight ? 'border-amber-400/60 bg-amber-950/20'
        : 'border-matcha-500/40 bg-zinc-900',
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-400">
            <Navigation size={10} className="text-matcha-400" />
            Nächster Stopp · {current.reihenfolge}/{stops.length}
          </div>
          <div className="flex items-center gap-1.5">
            {done.length > 0 && (
              <span className="rounded-full bg-matcha-600/30 px-2 py-0.5 text-[9px] font-black text-matcha-300">
                {done.length} ✓
              </span>
            )}
            {pending.length > 1 && (
              <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-[9px] font-black text-zinc-300">
                +{pending.length - 1} weiter
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-4 pt-3 pb-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-base font-black text-white truncate">{current.order.kunde_name}</div>
              {current.order.kunde_adresse && (
                <div className="text-xs text-zinc-400 mt-0.5 leading-snug">{current.order.kunde_adresse}</div>
              )}
              <div className="flex items-center gap-2 mt-1.5">
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-black text-zinc-300">
                  {current.order.bestellnummer}
                </span>
                {current.order.distanz_zum_vorgaenger_m && (
                  <span className="text-[10px] text-zinc-400">
                    {formatDist(current.order.distanz_zum_vorgaenger_m)}
                  </span>
                )}
                {current.order.zahlungsart && !current.order.bezahlt && (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-black text-amber-400">
                    Bar {current.order.zahlungsart}
                  </span>
                )}
              </div>
            </div>
            {/* ETA Badge */}
            {etaMin != null && (
              <div className={cn(
                'shrink-0 flex flex-col items-center justify-center rounded-xl px-3 py-2',
                isLate ? 'bg-red-500/20 border border-red-500/40' : isTight ? 'bg-amber-500/20 border border-amber-400/30' : 'bg-matcha-600/20 border border-matcha-500/30',
              )}>
                <span className={cn('text-2xl font-black tabular-nums font-mono leading-none', isLate ? 'text-red-400' : isTight ? 'text-amber-400' : 'text-matcha-400')}>
                  {isLate ? `-${etaMin}` : etaMin}
                </span>
                <span className="text-[9px] font-bold text-zinc-500 mt-0.5">{isLate ? 'überfällig' : 'Min ETA'}</span>
              </div>
            )}
          </div>

          {/* Aktionszeile */}
          <div className="flex gap-2">
            <a
              href={navUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-matcha-600 py-2.5 text-sm font-bold text-white active:scale-95 transition"
            >
              <Navigation size={14} />
              Navigation starten
            </a>
            {current.order.kunde_telefon && (
              <a
                href={`tel:${current.order.kunde_telefon}`}
                className="flex items-center justify-center gap-1 rounded-xl bg-zinc-800 px-3 py-2.5 text-sm font-bold text-zinc-200 active:scale-95 transition"
              >
                <Phone size={14} />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Nächster Stop — kompakt */}
      {next && (
        <div className="flex items-center gap-3 rounded-xl bg-zinc-800/60 border border-zinc-700/50 px-4 py-3">
          <MapPin size={14} className="text-zinc-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold text-zinc-300 truncate">{next.order.kunde_name}</span>
            <div className="text-[10px] text-zinc-500 mt-0.5 truncate">{next.order.bestellnummer}</div>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-zinc-400 shrink-0">
            <Route size={10} />
            Danach
            <ChevronRight size={10} />
          </div>
        </div>
      )}

      {/* Fortschrittsbalken */}
      {stops.length > 0 && (
        <div className="rounded-xl bg-zinc-800/40 px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Tour-Fortschritt</span>
            <span className="text-[10px] font-black text-zinc-400">{done.length}/{stops.length}</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-matcha-500 transition-all duration-500"
              style={{ width: `${(done.length / stops.length) * 100}%` }}
            />
          </div>
          <div className="flex gap-1 mt-2">
            {stops.map(s => (
              <div
                key={s.reihenfolge}
                className={cn(
                  'flex-1 h-1.5 rounded-full',
                  s.geliefert_am ? 'bg-matcha-500' : s.reihenfolge === current.reihenfolge ? 'bg-amber-400 animate-pulse' : 'bg-zinc-700',
                )}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
