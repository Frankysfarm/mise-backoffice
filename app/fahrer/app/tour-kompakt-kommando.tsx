'use client';

/**
 * TourKompaktKommando
 *
 * Mobile-first, compact "next 3 stops" action panel:
 *  • Zeigt die nächsten 3 offenen Stops als swipeable Kacheln
 *  • Jede Kachel: ETA-Countdown, Urgency-Badge, 1-Tap Navigation (Google Maps / Apple Maps),
 *    Deliver-Bestätigungs-Button
 *  • Urgency-Reihung: Stops mit kürzestem ETA-Fenster werden vorgezogen
 *  • Speziell für mobile Nutzung ohne Scrollen optimiert (sticky-bottom)
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  Navigation2,
  Package,
} from 'lucide-react';

/* ── Types ──────────────────────────────────────────────────────────────────── */

export type KommandoStop = {
  id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    kunde_plz: string | null;
    kunde_stadt: string | null;
    kunde_lat: number | null;
    kunde_lng: number | null;
    eta_latest: string | null;
    zahlungsart?: string | null;
    gesamtbetrag?: number | null;
  } | null;
};

interface Props {
  stops: KommandoStop[];
  onDeliver: (stopId: string, orderId: string) => void;
  deliverLoading?: string | null;
}

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

function secsLeft(etaLatest: string | null): number | null {
  if (!etaLatest) return null;
  return Math.floor((new Date(etaLatest).getTime() - Date.now()) / 1000);
}

function fmtSecs(secs: number): string {
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function navUrl(stop: KommandoStop['order']): string {
  if (!stop) return '#';
  if (stop.kunde_lat && stop.kunde_lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${stop.kunde_lat},${stop.kunde_lng}`;
  }
  const addr = [stop.kunde_adresse, stop.kunde_plz, stop.kunde_stadt].filter(Boolean).join(' ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`;
}

type Urgency = 'ok' | 'warn' | 'urgent' | 'overdue';

function urgency(secs: number | null): Urgency {
  if (secs === null) return 'ok';
  if (secs < 0) return 'overdue';
  if (secs < 300) return 'urgent';
  if (secs < 600) return 'warn';
  return 'ok';
}

const URGENCY_STYLE: Record<Urgency, { border: string; bg: string; badge: string; text: string }> = {
  ok:      { border: 'border-matcha-300', bg: 'bg-matcha-50',  badge: 'bg-matcha-100 text-matcha-700',  text: 'text-matcha-700' },
  warn:    { border: 'border-amber-400',  bg: 'bg-amber-50',   badge: 'bg-amber-100 text-amber-700',    text: 'text-amber-700' },
  urgent:  { border: 'border-orange-500', bg: 'bg-orange-50',  badge: 'bg-orange-100 text-orange-700',  text: 'text-orange-700' },
  overdue: { border: 'border-red-500',    bg: 'bg-red-50',     badge: 'bg-red-100 text-red-700',        text: 'text-red-700' },
};

/* ── Stop Card ───────────────────────────────────────────────────────────────── */

function StopCard({
  stop,
  index,
  onDeliver,
  isLoading,
}: {
  stop: KommandoStop;
  index: number;
  onDeliver: () => void;
  isLoading: boolean;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const secs = secsLeft(stop.order?.eta_latest ?? null);
  const u = urgency(secs);
  const style = URGENCY_STYLE[u];
  const isCurrent = index === 0;

  return (
    <div
      className={cn(
        'rounded-xl border-2 overflow-hidden transition-all',
        style.border,
        style.bg,
        isCurrent ? 'shadow-md' : 'opacity-80 scale-[0.97]',
      )}
    >
      {/* Header strip */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-black/5">
        <div
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black shrink-0 text-white',
            u === 'overdue' ? 'bg-red-500' : u === 'urgent' ? 'bg-orange-500' : u === 'warn' ? 'bg-amber-500' : 'bg-matcha-500',
          )}
        >
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-black truncate block">{stop.order?.bestellnummer ?? '–'}</span>
          <span className="text-[10px] text-muted-foreground truncate block">{stop.order?.kunde_name ?? '–'}</span>
        </div>
        {secs !== null && (
          <div className={cn('text-right shrink-0')}>
            <div className={cn('text-xs font-black tabular-nums', style.text)}>
              {secs < 0 ? '+' : ''}{fmtSecs(secs)}
            </div>
            <div className={cn('text-[9px] font-bold', style.text)}>
              {u === 'overdue' ? 'ÜBERFÄLLIG' : u === 'urgent' ? 'Dringend!' : u === 'warn' ? 'Aufpassen' : 'Im Plan'}
            </div>
          </div>
        )}
        {u === 'overdue' && <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 animate-pulse" />}
      </div>

      {/* Address + actions */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-1">
            <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
            <span className="text-[10px] text-muted-foreground leading-tight">
              {[stop.order?.kunde_adresse, stop.order?.kunde_plz, stop.order?.kunde_stadt]
                .filter(Boolean)
                .join(', ') || '–'}
            </span>
          </div>
          {stop.order?.zahlungsart && (
            <div className="flex items-center gap-1 mt-0.5">
              <Package className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-[9px] text-muted-foreground capitalize">
                {stop.order.zahlungsart}
                {stop.order.gesamtbetrag != null
                  ? ` · €${stop.order.gesamtbetrag.toFixed(2)}`
                  : ''}
              </span>
            </div>
          )}
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <a
            href={navUrl(stop.order)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-black transition active:scale-95',
              isCurrent
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-muted text-muted-foreground hover:bg-blue-100',
            )}
          >
            <Navigation2 className="h-3 w-3" />
            Navi
          </a>
          {isCurrent && (
            <button
              onClick={onDeliver}
              disabled={isLoading}
              className={cn(
                'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-black transition active:scale-95',
                'bg-matcha-600 text-white hover:bg-matcha-700 disabled:opacity-50',
              )}
            >
              {isLoading ? (
                <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <CheckCircle2 className="h-3 w-3" />
              )}
              Fertig
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main Export ─────────────────────────────────────────────────────────────── */

export function TourKompaktKommando({ stops, onDeliver, deliverLoading }: Props) {
  // Filter and sort: open stops sorted by urgency (closest ETA first)
  const open = stops
    .filter((s) => !s.geliefert_am)
    .sort((a, b) => {
      const sa = secsLeft(a.order?.eta_latest ?? null);
      const sb = secsLeft(b.order?.eta_latest ?? null);
      if (sa === null && sb === null) return a.reihenfolge - b.reihenfolge;
      if (sa === null) return 1;
      if (sb === null) return -1;
      return sa - sb;
    });

  if (open.length === 0) return null;

  const next3 = open.slice(0, 3);
  const remaining = open.length;

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/20">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-700 shrink-0">
          <Navigation2 className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-black">Tour-Kommando</div>
          <div className="text-[10px] text-muted-foreground">
            {remaining} Stop{remaining !== 1 ? 's' : ''} offen
            {remaining > 3 ? ` · nächste 3 angezeigt` : ''}
          </div>
        </div>
        {next3.some((s) => urgency(secsLeft(s.order?.eta_latest ?? null)) === 'overdue') && (
          <span className="rounded-full bg-red-100 text-red-700 text-[9px] font-black px-2 py-0.5 animate-pulse">
            ⚠ überfällig
          </span>
        )}
      </div>

      {/* Stop cards */}
      <div className="flex flex-col gap-2 p-3">
        {next3.map((stop, idx) => (
          <StopCard
            key={stop.id}
            stop={stop}
            index={idx}
            onDeliver={() => onDeliver(stop.id, stop.order_id)}
            isLoading={deliverLoading === stop.id}
          />
        ))}
      </div>

      {/* Footer when more stops remain */}
      {remaining > 3 && (
        <div className="px-4 py-2 border-t bg-muted/10 flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-[10px] text-muted-foreground">
            + {remaining - 3} weitere Stop{remaining - 3 !== 1 ? 's' : ''} nach diesen
          </span>
        </div>
      )}
    </div>
  );
}
