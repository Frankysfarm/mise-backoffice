'use client';

/**
 * TourStoppSofortKommando — fokussiertes Sofort-Kommando für den aktuellen Tour-Stopp.
 *
 * Zeigt genau EINEN Stopp im Fokus (den nächsten unerledigten) mit:
 *   - Kundename + Adresse groß
 *   - ETA-Ring (Minuten verbleibend)
 *   - Bestellwert + Zahlungsart
 *   - Kundenwunsch / Lieferhinweis
 *   - 1-Tap Aktionen: Navigation öffnen · Anrufen
 *   - Fortschritts-Pill: X von Y Stopps
 *
 * Designed für mobile Nutzung während der Fahrt — große Tap-Targets, kein Scrollen nötig.
 */

import { useMemo } from 'react';
import {
  MapPin, Phone, Navigation, Package, Euro, Clock,
  CheckCircle2, ChevronRight, Bike,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
    kunde_notiz?: string | null;
    kunde_lieferhinweis?: string | null;
    kunde_telefon?: string | null;
    zahlungsart?: string | null;
    bezahlt?: boolean | null;
  };
};

type ActiveBatch = {
  id: string;
  status: string;
  started_at: string | null;
  total_eta_min?: number | null;
  total_distance_km?: number | null;
  stops: Stop[];
};

function etaRingColor(remainMin: number | null): string {
  if (remainMin === null) return 'text-muted-foreground';
  if (remainMin <= 5) return 'text-red-600';
  if (remainMin <= 10) return 'text-amber-600';
  return 'text-matcha-600';
}

function etaRingBg(remainMin: number | null): string {
  if (remainMin === null) return 'bg-muted/30 border-border';
  if (remainMin <= 5) return 'bg-red-50 border-red-200';
  if (remainMin <= 10) return 'bg-amber-50 border-amber-200';
  return 'bg-matcha-50 border-matcha-200';
}

function openNavigation(lat: number | null, lng: number | null, address: string | null) {
  if (lat && lng) {
    window.open(`geo:${lat},${lng}?q=${lat},${lng}`, '_blank');
  } else if (address) {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  }
}

export function TourStoppSofortKommando({
  batch,
}: {
  batch: ActiveBatch | null;
}) {
  const currentStop = useMemo(() => {
    if (!batch) return null;
    return batch.stops
      .filter((s) => !s.geliefert_am)
      .sort((a, b) => a.reihenfolge - b.reihenfolge)[0] ?? null;
  }, [batch]);

  const completedCount = useMemo(() => {
    if (!batch) return 0;
    return batch.stops.filter((s) => s.geliefert_am).length;
  }, [batch]);

  const totalCount = batch?.stops.length ?? 0;

  const remainMin = useMemo(() => {
    if (!batch?.started_at || !batch.total_eta_min) return null;
    const elapsedMin = Math.floor((Date.now() - new Date(batch.started_at).getTime()) / 60_000);
    return Math.max(0, batch.total_eta_min - elapsedMin);
  }, [batch]);

  if (!batch || !currentStop) return null;

  const o = currentStop.order;
  const isPrepaid = o.bezahlt || o.zahlungsart === 'online';
  const needsCash = !isPrepaid && (o.zahlungsart === 'bar' || o.zahlungsart === 'cash');

  const nextStop = batch.stops
    .filter((s) => !s.geliefert_am && s.reihenfolge > currentStop.reihenfolge)
    .sort((a, b) => a.reihenfolge - b.reihenfolge)[0] ?? null;

  return (
    <div className="space-y-3">
      {/* Fortschritts-Pill */}
      <div className="flex items-center gap-2">
        <Bike className="h-4 w-4 text-matcha-600 shrink-0" />
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-matcha-500 transition-all duration-700"
            style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%' }}
          />
        </div>
        <span className="text-xs font-black tabular-nums text-foreground shrink-0">
          {completedCount}/{totalCount}
        </span>
      </div>

      {/* Haupt-Stopp-Karte */}
      <div className={cn(
        'rounded-2xl border-2 overflow-hidden transition-colors',
        etaRingBg(remainMin),
      )}>
        {/* Stopp-Header */}
        <div className="px-4 py-3 flex items-start gap-3">
          {/* ETA-Kreis */}
          <div className={cn(
            'flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full border-2',
            remainMin !== null && remainMin <= 5 ? 'border-red-300 bg-red-100' :
            remainMin !== null && remainMin <= 10 ? 'border-amber-300 bg-amber-100' :
            'border-matcha-300 bg-matcha-100',
          )}>
            {remainMin !== null ? (
              <>
                <span className={cn('font-mono text-xl font-black leading-none', etaRingColor(remainMin))}>
                  {remainMin}
                </span>
                <span className={cn('text-[9px] font-bold', etaRingColor(remainMin))}>
                  Min
                </span>
              </>
            ) : (
              <Clock className="h-6 w-6 text-muted-foreground" />
            )}
          </div>

          {/* Kundeninfo */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-display text-lg font-black text-foreground truncate">
                {o.kunde_name}
              </span>
              <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[9px] font-black text-foreground">
                #{currentStop.reihenfolge}
              </span>
            </div>
            {o.kunde_adresse && (
              <div className="flex items-start gap-1 mt-0.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-sm text-muted-foreground leading-snug">
                  {o.kunde_adresse}
                  {o.kunde_plz && `, ${o.kunde_plz}`}
                </span>
              </div>
            )}

            {/* Betrag + Zahlung */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <div className={cn(
                'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-black',
                needsCash ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-matcha-100 text-matcha-800 border border-matcha-200',
              )}>
                <Euro className="h-3 w-3" />
                {o.gesamtbetrag.toFixed(2)} €
                {needsCash && ' · Bar'}
                {isPrepaid && ' · Bezahlt'}
              </div>
              {o.bestellnummer && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  {o.bestellnummer}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Kunden-Notiz */}
        {(o.kunde_notiz || o.kunde_lieferhinweis) && (
          <div className="mx-4 mb-3 rounded-xl bg-white/70 border border-amber-200 px-3 py-2">
            <div className="text-[9px] font-bold uppercase tracking-wider text-amber-700 mb-0.5">
              Hinweis
            </div>
            <p className="text-xs text-amber-900 leading-snug">
              {o.kunde_lieferhinweis ?? o.kunde_notiz}
            </p>
          </div>
        )}

        {/* Aktions-Buttons */}
        <div className="grid grid-cols-2 gap-2 px-4 pb-4">
          <button
            onClick={() => openNavigation(o.kunde_lat, o.kunde_lng, o.kunde_adresse)}
            className="flex items-center justify-center gap-2 rounded-xl bg-foreground py-3 text-sm font-bold text-background active:scale-95 transition"
          >
            <Navigation className="h-4 w-4" />
            Navigation
          </button>
          {o.kunde_telefon ? (
            <a
              href={`tel:${o.kunde_telefon}`}
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-foreground/20 py-3 text-sm font-bold text-foreground active:scale-95 transition"
            >
              <Phone className="h-4 w-4" />
              Anrufen
            </a>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-foreground/10 py-3 text-sm font-bold text-muted-foreground">
              <Package className="h-4 w-4" />
              Kein Telefon
            </div>
          )}
        </div>
      </div>

      {/* Nächster Stopp (Vorschau) */}
      {nextStop && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-black text-muted-foreground">
            {nextStop.reihenfolge}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Nächster Stopp</div>
            <div className="text-sm font-bold text-foreground truncate">{nextStop.order.kunde_name}</div>
            {nextStop.order.kunde_adresse && (
              <div className="text-[11px] text-muted-foreground truncate">{nextStop.order.kunde_adresse}</div>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      )}

      {/* Alle Stopps erledigt */}
      {completedCount === totalCount && totalCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-matcha-200 bg-matcha-50 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-matcha-600 shrink-0" />
          <div>
            <div className="text-sm font-black text-matcha-800">Tour abgeschlossen!</div>
            <div className="text-[10px] text-matcha-600">{totalCount} Stopps · Zurück zum Depot</div>
          </div>
        </div>
      )}
    </div>
  );
}
