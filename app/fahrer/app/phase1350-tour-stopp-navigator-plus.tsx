'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  CheckCircle2, Clock, MapPin, Navigation, Package, Phone, Route, Timer, Zap,
} from 'lucide-react';

/**
 * Phase 1350 — Tour-Stopp-Navigator-Plus (Fahrer-App)
 *
 * Vollständiger Tour-Navigator mit:
 * — Liste aller Stopps mit Status-Ampel (ausstehend/aktiv/geliefert)
 * — Nächster Stopp prominent hervorgehoben
 * — Countdown bis erwartete Ankunft
 * — Kunden-Telefon-Button
 * — Navigation-App-Link (Google Maps / Waze / Apple Maps)
 * — Fortschrittsbalken der Gesamttour
 * — Fallback-Mock wenn keine Props
 */

interface Stop {
  id: string;
  position?: number | null;
  status?: string | null;
  kunde_name?: string | null;
  kunde_adresse?: string | null;
  kunde_plz?: string | null;
  kunde_lat?: number | null;
  kunde_lng?: number | null;
  kunde_telefon?: string | null;
  eta?: string | null;
  delivered_at?: string | null;
  bestellnummer?: string | null;
  gesamtbetrag?: number | null;
  zahlungsart?: string | null;
  notiz?: string | null;
}

interface Props {
  stops?: Stop[];
  batchId?: string | null;
  onStopComplete?: (stopId: string) => void;
}

// Mock data for development
const MOCK_STOPS: Stop[] = [
  {
    id: 'stop-1', position: 1, status: 'geliefert',
    kunde_name: 'Maria Huber', kunde_adresse: 'Hauptstraße 12', kunde_plz: '80331',
    bestellnummer: '#1042', gesamtbetrag: 23.50, zahlungsart: 'karte',
  },
  {
    id: 'stop-2', position: 2, status: 'unterwegs',
    kunde_name: 'Klaus Steinmann', kunde_adresse: 'Leopoldstraße 45', kunde_plz: '80802',
    kunde_telefon: '+49 89 12345678',
    bestellnummer: '#1043', gesamtbetrag: 18.90, zahlungsart: 'bar',
    eta: new Date(Date.now() + 7 * 60_000).toISOString(),
    notiz: 'Klingeln 2x — Wohnung 3.OG',
  },
  {
    id: 'stop-3', position: 3, status: 'ausstehend',
    kunde_name: 'Sandra Vogel', kunde_adresse: 'Schillerstraße 8', kunde_plz: '80336',
    bestellnummer: '#1044', gesamtbetrag: 31.20, zahlungsart: 'online',
    eta: new Date(Date.now() + 22 * 60_000).toISOString(),
  },
];

function fmtCountdown(etaStr: string | null | undefined): string | null {
  if (!etaStr) return null;
  const diffSec = Math.round((new Date(etaStr).getTime() - Date.now()) / 1000);
  if (diffSec < 0) return 'überfällig';
  const m = Math.floor(diffSec / 60);
  const s = diffSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function buildNavUrl(stop: Stop): string {
  const q = [stop.kunde_adresse, stop.kunde_plz].filter(Boolean).join(' ');
  if (stop.kunde_lat && stop.kunde_lng) {
    return `https://maps.google.com/?q=${stop.kunde_lat},${stop.kunde_lng}`;
  }
  return `https://maps.google.com/?q=${encodeURIComponent(q)}`;
}

const STATUS_CFG: Record<string, { bg: string; badge: string; label: string; dot: string }> = {
  geliefert:   { bg: 'bg-matcha-50/80',  badge: 'bg-matcha-500 text-white', label: 'Geliefert', dot: 'bg-matcha-400' },
  unterwegs:   { bg: 'bg-blue-50',       badge: 'bg-blue-600 text-white',   label: 'Aktiv',     dot: 'bg-blue-500 animate-pulse' },
  ausstehend:  { bg: 'bg-white',         badge: 'bg-stone-200 text-stone-600', label: 'Warten', dot: 'bg-stone-300' },
};

export function FahrerPhase1350TourStoppNavigatorPlus({ stops, batchId, onStopComplete }: Props) {
  const [tick, setTick] = useState(0);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    ivRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, []);

  const displayStops = (stops && stops.length > 0 ? stops : MOCK_STOPS);
  const isMock = !stops || stops.length === 0;

  const sorted = [...displayStops].sort((a, b) => (a.position ?? 99) - (b.position ?? 99));

  const delivered = sorted.filter((s) => s.status === 'geliefert' || completedIds.has(s.id));
  const active = sorted.find((s) => s.status === 'unterwegs' && !completedIds.has(s.id));
  const pending = sorted.filter((s) => s.status === 'ausstehend' && !completedIds.has(s.id));
  const progressPct = sorted.length > 0 ? Math.round((delivered.length / sorted.length) * 100) : 0;

  function handleComplete(stopId: string) {
    setCompletedIds((prev) => new Set([...prev, stopId]));
    onStopComplete?.(stopId);
  }

  return (
    <div className="rounded-2xl border border-border bg-background overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-background">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-sm font-bold">
            Tour-Navigator{isMock ? ' (Demo)' : ''}
          </span>
          <span className="ml-auto text-xs font-bold text-matcha-700 tabular-nums">
            {delivered.length}/{sorted.length} Stopps
          </span>
        </div>

        {/* Overall progress */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-matcha-500 transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="shrink-0 text-[11px] font-black tabular-nums text-matcha-700">
            {progressPct}%
          </span>
        </div>
      </div>

      {/* Active stop — highlighted */}
      {active && !completedIds.has(active.id) && (
        <div className="px-4 py-4 bg-blue-50 border-b border-blue-100">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-black text-white">
              <Zap className="h-3 w-3" />
              JETZT LIEFERN
            </span>
            <span className="text-[11px] font-bold text-blue-700">
              Stopp {active.position}
            </span>
            {active.eta && (
              <span className="ml-auto text-xs font-black tabular-nums text-blue-600 inline-flex items-center gap-1">
                <Timer className="h-3 w-3" />
                {fmtCountdown(active.eta)}
              </span>
            )}
          </div>

          <div className="text-base font-black text-foreground">{active.kunde_name}</div>
          {active.kunde_adresse && (
            <div className="flex items-center gap-1 mt-0.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {active.kunde_adresse}{active.kunde_plz ? `, ${active.kunde_plz}` : ''}
            </div>
          )}
          {active.notiz && (
            <div className="mt-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs text-amber-700 font-medium">
              📝 {active.notiz}
            </div>
          )}

          {/* Payment info */}
          {active.gesamtbetrag != null && (
            <div className="mt-2 flex items-center gap-3">
              <span className="text-sm font-black text-foreground">
                {active.gesamtbetrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
              </span>
              {active.zahlungsart && (
                <span className="rounded-full bg-white border border-border px-2 py-0.5 text-[10px] font-bold uppercase">
                  {active.zahlungsart === 'bar' ? '💶 Bar' : active.zahlungsart === 'karte' ? '💳 Karte' : '✅ Bezahlt'}
                </span>
              )}
              {active.bestellnummer && (
                <span className="text-[11px] text-muted-foreground">{active.bestellnummer}</span>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-3 flex gap-2">
            <a
              href={buildNavUrl(active)}
              target="_blank"
              rel="noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white active:scale-95 transition-transform"
            >
              <Navigation className="h-3.5 w-3.5" />
              Navigation
            </a>
            {active.kunde_telefon && (
              <a
                href={`tel:${active.kunde_telefon}`}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-matcha-600 px-3 py-2 text-xs font-bold text-white active:scale-95 transition-transform"
              >
                <Phone className="h-3.5 w-3.5" />
                Anrufen
              </a>
            )}
            <button
              onClick={() => handleComplete(active.id)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-matcha-500 px-3 py-2 text-xs font-bold text-white active:scale-95 transition-transform"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Geliefert
            </button>
          </div>
        </div>
      )}

      {/* All stops list */}
      <div className="divide-y divide-border/50">
        {sorted.map((stop) => {
          const isDone = stop.status === 'geliefert' || completedIds.has(stop.id);
          const isActive = stop.id === active?.id && !completedIds.has(stop.id);
          const statusKey = isDone ? 'geliefert' : isActive ? 'unterwegs' : 'ausstehend';
          const cfg = STATUS_CFG[statusKey] ?? STATUS_CFG.ausstehend;
          const countdown = fmtCountdown(stop.eta);

          return (
            <div key={stop.id} className={cn('px-4 py-2.5 flex items-center gap-3', cfg.bg)}>
              {/* Position + dot */}
              <div className="shrink-0 flex flex-col items-center gap-1">
                <span className={cn('h-2.5 w-2.5 rounded-full', cfg.dot)} />
                <span className="text-[10px] font-bold text-muted-foreground">{stop.position ?? '—'}</span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs font-bold truncate', isDone && 'line-through text-muted-foreground')}>
                    {stop.kunde_name ?? '—'}
                  </span>
                  <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold', cfg.badge)}>
                    {cfg.label}
                  </span>
                </div>
                {stop.kunde_adresse && (
                  <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                    <MapPin className="h-2.5 w-2.5 shrink-0" />
                    {stop.kunde_adresse}
                  </div>
                )}
              </div>

              {/* ETA / time */}
              <div className="shrink-0 text-right">
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 text-matcha-500 ml-auto" />
                ) : countdown ? (
                  <div>
                    <div className="text-xs font-black tabular-nums text-foreground">{countdown}</div>
                    <div className="text-[9px] text-muted-foreground">ETA</div>
                  </div>
                ) : (
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {sorted.length === 0 && (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          <Package className="h-5 w-5 mx-auto mb-1 text-matcha-400" />
          Keine Stopps in dieser Tour
        </div>
      )}
    </div>
  );
}
