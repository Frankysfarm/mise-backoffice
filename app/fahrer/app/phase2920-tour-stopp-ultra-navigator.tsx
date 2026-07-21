'use client';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  MapPin, Phone, Navigation, CheckCircle2, Clock, ChevronDown,
  ChevronUp, AlertCircle, Package, ExternalLink, Bike,
} from 'lucide-react';

/**
 * Phase 2920 — Tour-Stopp Ultra-Navigator
 *
 * Hero-Stopp prominent: ETA-Countdown + farbkodiert (grün/gelb/rot) +
 * One-Tap Google Maps + Waze + Anruf + Bestätigung.
 * Alle Stopps expandierbar mit Sequenz-Dots.
 * 1-Sek-Tick, 15-Sek-Polling.
 */

interface Order {
  id: string;
  bestellnummer?: string | null;
  kunde_name?: string | null;
  kunde_adresse?: string | null;
  kunde_plz?: string | null;
  kunde_lat?: number | null;
  kunde_lng?: number | null;
  kunde_telefon?: string | null;
  kunde_notiz?: string | null;
  kunde_lieferhinweis?: string | null;
  gesamtbetrag?: number | null;
  bezahlt?: boolean | null;
  zahlungsart?: string | null;
}

interface Stop {
  id: string;
  reihenfolge: number;
  geliefert_am?: string | null;
  angekommen_am?: string | null;
  eta_min?: number | null;
  type?: string | null;
  order?: Order | null;
}

interface Props {
  stops: Stop[];
  onMarkDelivered?: (stopId: string) => void;
  onMarkArrived?: (stopId: string) => void;
}

function gmapsUrl(stop: Stop): string {
  const o = stop.order;
  if (o?.kunde_lat && o.kunde_lng) return `https://maps.google.com/?q=${o.kunde_lat},${o.kunde_lng}`;
  const addr = o?.kunde_adresse ?? '';
  const plz  = o?.kunde_plz ?? '';
  if (addr) return `https://maps.google.com/?q=${encodeURIComponent(`${addr} ${plz}`.trim())}`;
  return 'https://maps.google.com/';
}

function wazeUrl(stop: Stop): string {
  const o = stop.order;
  if (o?.kunde_lat && o.kunde_lng) return `https://waze.com/ul?ll=${o.kunde_lat},${o.kunde_lng}&navigate=yes`;
  return 'https://waze.com/';
}

function etaColor(min: number | null | undefined, arrived: boolean): string {
  if (arrived) return 'border-green-400 bg-green-50 dark:bg-green-950/30';
  if (!min || min <= 0) return 'border-green-400 bg-green-50 dark:bg-green-950/30';
  if (min <= 5)  return 'border-green-400 bg-green-50 dark:bg-green-950/30';
  if (min <= 10) return 'border-amber-400 bg-amber-50 dark:bg-amber-950/30';
  return 'border-red-400 bg-red-50 dark:bg-red-950/30';
}

function etaBadgeColor(min: number | null | undefined): string {
  if (!min || min <= 5)  return 'bg-green-500 text-white';
  if (min <= 10) return 'bg-amber-500 text-white';
  return 'bg-red-500 text-white';
}

function fmtEta(secTotal: number): string {
  if (secTotal <= 0) return 'Jetzt';
  const m = Math.floor(secTotal / 60);
  const s = secTotal % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export function FahrerPhase2920TourStoppUltraNavigator({ stops, onMarkDelivered, onMarkArrived }: Props) {
  const [tick,     setTick]     = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [pending,  setPending]  = useState<string | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    tickRef.current = setInterval(() => setTick(t => t + 1), 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  const sorted   = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const pending_stops = sorted.filter(s => !s.geliefert_am);
  const done_stops    = sorted.filter(s =>  s.geliefert_am);
  const next          = pending_stops[0] ?? null;

  if (!next) {
    return (
      <div className="rounded-xl border border-green-300 bg-green-50 dark:bg-green-950/20 dark:border-green-700 p-5 text-center mb-4">
        <CheckCircle2 size={28} className="text-green-500 mx-auto mb-2" />
        <p className="font-semibold text-green-700 dark:text-green-300 text-sm">Alle Stopps erledigt!</p>
        <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">{done_stops.length} von {sorted.length} geliefert</p>
      </div>
    );
  }

  const etaSec = next.eta_min != null ? Math.max(0, next.eta_min * 60 - tick) : null;
  const arrived = !!next.angekommen_am;
  const o = next.order;

  const handleDelivered = async () => {
    if (!onMarkDelivered) return;
    setPending(next.id);
    try { await Promise.resolve(onMarkDelivered(next.id)); }
    finally { setPending(null); }
  };

  const handleArrived = async () => {
    if (!onMarkArrived) return;
    setPending(next.id);
    try { await Promise.resolve(onMarkArrived(next.id)); }
    finally { setPending(null); }
  };

  return (
    <div className="mb-4 space-y-2">
      {/* Hero: Nächster Stopp */}
      <div className={cn('rounded-xl border-2 shadow-sm overflow-hidden', etaColor(next.eta_min, arrived))}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="flex items-center gap-2">
            <MapPin size={15} className="text-gray-600 dark:text-gray-300" />
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
              Stopp {next.reihenfolge} · Nächstes Ziel
            </span>
          </div>
          {etaSec != null && (
            <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', etaBadgeColor(etaSec / 60))}>
              {fmtEta(etaSec)}
            </span>
          )}
        </div>

        {/* Kunde */}
        <div className="px-4 py-2">
          <p className="font-bold text-gray-900 dark:text-gray-100 text-base leading-tight">
            {o?.kunde_name ?? 'Kunde'}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
            {o?.kunde_adresse ?? '—'}{o?.kunde_plz ? `, ${o.kunde_plz}` : ''}
          </p>
          {o?.kunde_lieferhinweis && (
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 italic">
              ⚠ {o.kunde_lieferhinweis}
            </p>
          )}
          {o?.kunde_notiz && (
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5 italic">
              ℹ {o.kunde_notiz}
            </p>
          )}
          {o?.gesamtbetrag != null && !o.bezahlt && (
            <p className="text-xs text-red-600 font-medium mt-1">
              Barzahlung: {o.gesamtbetrag.toFixed(2)} €
            </p>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="grid grid-cols-2 gap-2 px-4 pb-2">
          <a
            href={gmapsUrl(next)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 transition-colors"
          >
            <ExternalLink size={14} />
            Google Maps
          </a>
          <a
            href={wazeUrl(next)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold py-2.5 transition-colors"
          >
            <Navigation size={14} />
            Waze
          </a>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 px-4 pb-3">
          {o?.kunde_telefon && (
            <a
              href={`tel:${o.kunde_telefon}`}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium py-2 px-3 hover:bg-gray-50 transition-colors"
            >
              <Phone size={14} />
              Anrufen
            </a>
          )}
          {!arrived ? (
            <button
              onClick={handleArrived}
              disabled={pending === next.id}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-sm font-semibold py-2 hover:bg-amber-100 transition-colors disabled:opacity-50"
            >
              <MapPin size={14} />
              Angekommen
            </button>
          ) : (
            <button
              onClick={handleDelivered}
              disabled={pending === next.id}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2 transition-colors disabled:opacity-50"
            >
              <CheckCircle2 size={14} />
              {pending === next.id ? 'Wird gespeichert…' : 'Zugestellt ✓'}
            </button>
          )}
        </div>
      </div>

      {/* Progress dots + weitere Stopps */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
        {/* Dot Progress */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
          {sorted.map((s, i) => (
            <div
              key={s.id}
              title={`Stopp ${s.reihenfolge}`}
              className={cn(
                'rounded-full transition-all',
                s.geliefert_am ? 'w-3 h-3 bg-green-500' :
                s.id === next.id ? 'w-4 h-4 bg-blue-500 ring-2 ring-blue-300' :
                'w-3 h-3 bg-gray-200 dark:bg-gray-600',
              )}
            />
          ))}
          <span className="ml-auto text-xs text-gray-400">
            {done_stops.length}/{sorted.length} erledigt
          </span>
        </div>

        {/* Toggle weitere Stopps */}
        {pending_stops.length > 1 && (
          <>
            <button
              onClick={() => setExpanded(e => !e)}
              className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Package size={12} />
                {pending_stops.length - 1} weitere Stopp{pending_stops.length > 2 ? 's' : ''}
              </span>
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {expanded && (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {pending_stops.slice(1).map(s => {
                  const ord = s.order;
                  return (
                    <div key={s.id} className="flex items-start gap-3 px-4 py-2.5">
                      <span className="text-xs font-bold text-gray-400 mt-0.5 w-4 shrink-0">{s.reihenfolge}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{ord?.kunde_name ?? '—'}</p>
                        <p className="text-xs text-gray-500 truncate">{ord?.kunde_adresse ?? '—'}</p>
                      </div>
                      {s.eta_min != null && (
                        <span className="text-xs text-gray-400 shrink-0">~{s.eta_min} Min</span>
                      )}
                      <a
                        href={gmapsUrl(s)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-blue-500 hover:text-blue-700"
                      >
                        <Navigation size={13} />
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
