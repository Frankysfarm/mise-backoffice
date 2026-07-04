'use client';

/**
 * Phase 551 — Aktueller-Stopp-Fokus
 *
 * Ultra-fokussierte Karte für den nächsten unerledigten Stopp:
 * - Adresse groß angezeigt, Etage + Klingeltext
 * - Kundennummer + Notiz
 * - Zahlungsstatus (bar / online)
 * - Navigations-Button (Google Maps / Apple Maps)
 * - ETA-Countdown (amber/rot wenn spät)
 * - Stopp-Abschluss-Button
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';
import {
  CheckCircle2, Clock, ExternalLink, MapPin, Navigation, Phone, Banknote, CreditCard,
} from 'lucide-react';

interface Stop {
  id: string;
  batch_id: string;
  order_id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
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
    zahlungsart?: string;
    bezahlt?: boolean;
  };
}

interface ActiveBatch {
  id: string;
  status: string;
  started_at: string | null;
  total_eta_min?: number | null;
  stops: Stop[];
}

interface Props {
  activeBatch: ActiveBatch | null;
  onMarkDelivered?: (stopId: string, orderId: string) => Promise<void>;
}

function formatAddress(stop: Stop): string {
  const o = stop.order;
  const parts = [o.kunde_adresse, o.kunde_plz].filter(Boolean);
  return parts.join(', ') || 'Adresse unbekannt';
}

function mapsUrl(stop: Stop): string {
  const o = stop.order;
  if (o.kunde_lat && o.kunde_lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${o.kunde_lat},${o.kunde_lng}`;
  }
  const addr = encodeURIComponent(formatAddress(stop));
  return `https://www.google.com/maps/dir/?api=1&destination=${addr}`;
}

export function FahrerPhase551AktuellerStoppFokus({ activeBatch, onMarkDelivered }: Props) {
  const [nowMs, setNowMs] = useState(Date.now);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setNowMs(Date.now()), 10_000);
    return () => clearInterval(iv);
  }, []);

  if (!activeBatch) return null;
  if (!['on_route', 'unterwegs', 'assigned', 'pickup'].includes(activeBatch.status)) return null;

  const nextStop = activeBatch.stops
    .filter(s => !s.geliefert_am)
    .sort((a, b) => a.reihenfolge - b.reihenfolge)[0];

  if (!nextStop) return null;

  const o = nextStop.order;
  const isCash = o.zahlungsart === 'bar' && !o.bezahlt;
  const isOnline = o.bezahlt || o.zahlungsart !== 'bar';

  const totalStops = activeBatch.stops.length;
  const doneStops = activeBatch.stops.filter(s => s.geliefert_am).length;
  const stopNum = doneStops + 1;

  const elapsedMin = activeBatch.started_at
    ? Math.floor((nowMs - new Date(activeBatch.started_at).getTime()) / 60_000)
    : null;
  const etaMin = activeBatch.total_eta_min ?? null;
  const remainMin = etaMin !== null && elapsedMin !== null ? etaMin - elapsedMin : null;
  const isLate = remainMin !== null && remainMin < 0;
  const isTight = remainMin !== null && remainMin >= 0 && remainMin < 5;

  async function handleDeliver() {
    if (!onMarkDelivered) return;
    setBusy(true);
    try {
      await onMarkDelivered(nextStop.id, nextStop.order_id);
    } catch {}
    finally { setBusy(false); }
  }

  return (
    <div className={cn(
      'rounded-2xl border-2 overflow-hidden bg-card',
      isLate ? 'border-red-400' : isTight ? 'border-amber-400' : 'border-matcha-400',
    )}>
      {/* Header */}
      <div className={cn(
        'flex items-center justify-between px-4 py-2.5',
        isLate ? 'bg-red-500 text-white' : isTight ? 'bg-amber-400 text-amber-950' : 'bg-matcha-600 text-white',
      )}>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0" />
          <span className="text-xs font-black uppercase tracking-wider">
            Stopp {stopNum} / {totalStops}
          </span>
        </div>
        {remainMin !== null && (
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-xs font-black tabular-nums">
              {isLate ? `${Math.abs(remainMin)} Min überfällig` : `~${remainMin} Min verbleibend`}
            </span>
          </div>
        )}
      </div>

      <div className="px-4 py-4 space-y-3">
        {/* Customer + order number */}
        <div>
          <div className="text-lg font-black text-foreground leading-tight">{o.kunde_name}</div>
          <div className="text-[11px] text-muted-foreground font-mono">#{o.bestellnummer}</div>
        </div>

        {/* Address */}
        <div className="rounded-xl bg-muted/50 px-3 py-2.5 space-y-1">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-matcha-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold leading-snug">{formatAddress(nextStop)}</div>
              {o.kunde_lieferhinweis && (
                <div className="text-xs text-muted-foreground mt-0.5">📍 {o.kunde_lieferhinweis}</div>
              )}
              {o.kunde_notiz && (
                <div className="text-xs text-amber-700 font-medium mt-0.5">💬 {o.kunde_notiz}</div>
              )}
            </div>
          </div>
        </div>

        {/* Payment + phone row */}
        <div className="flex items-center gap-2 flex-wrap">
          {isCash && (
            <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5">
              <Banknote className="h-4 w-4 text-amber-600" />
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-amber-600">Bar einziehen</div>
                <div className="text-sm font-black text-amber-800 tabular-nums">{euro(o.gesamtbetrag)}</div>
              </div>
            </div>
          )}
          {isOnline && (
            <div className="flex items-center gap-1.5 rounded-lg bg-matcha-50 border border-matcha-200 px-2.5 py-1.5">
              <CreditCard className="h-4 w-4 text-matcha-600" />
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-matcha-600">Bereits bezahlt</div>
                <div className="text-sm font-black text-matcha-800 tabular-nums">{euro(o.gesamtbetrag)}</div>
              </div>
            </div>
          )}
          {o.kunde_telefon && (
            <a
              href={`tel:${o.kunde_telefon}`}
              className="flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-1.5"
            >
              <Phone className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-bold text-blue-700">{o.kunde_telefon}</span>
            </a>
          )}
        </div>

        {/* Navigation + delivery buttons */}
        <div className="flex gap-2">
          <a
            href={mapsUrl(nextStop)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-3 text-sm font-bold text-white hover:bg-blue-700 transition active:scale-95"
          >
            <Navigation className="h-4 w-4" />
            Navigieren
          </a>
          <button
            onClick={handleDeliver}
            disabled={busy}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 rounded-xl px-3 py-3 text-sm font-bold transition active:scale-95',
              busy ? 'bg-muted text-muted-foreground' : 'bg-matcha-600 text-white hover:bg-matcha-700',
            )}
          >
            <CheckCircle2 className="h-4 w-4" />
            {busy ? 'Wird gespeichert…' : 'Geliefert ✓'}
          </button>
        </div>
      </div>
    </div>
  );
}
