'use client';

import { cn } from '@/lib/utils';
import { MapPin, Phone, Clock, Navigation, CreditCard, Banknote, CheckCircle2, AlertCircle } from 'lucide-react';

type Stop = {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  angekommen_am: string | null;
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
  };
  distanz_zum_vorgaenger_m?: number | null;
};

interface Props {
  stops: Stop[];
  driverLat?: number | null;
  driverLng?: number | null;
  zahlungsart?: string | null;
}

function nextStop(stops: Stop[]): Stop | null {
  const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  return sorted.find((s) => !s.geliefert_am) ?? null;
}

function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function etaMinFromDist(m: number): number {
  return Math.ceil(m / 400);
}

function mapsUrl(adresse: string, plz: string | null): string {
  const q = encodeURIComponent([adresse, plz].filter(Boolean).join(', '));
  return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}

export function NaechsterStoppVorschau({ stops, driverLat, driverLng, zahlungsart }: Props) {
  const stop = nextStop(stops);
  if (!stop) return null;

  const { order } = stop;
  const completedCount = stops.filter((s) => s.geliefert_am !== null).length;
  const totalCount = stops.length;
  const remaining = totalCount - completedCount;

  let distM: number | null = null;
  let etaMin: number | null = null;

  if (driverLat && driverLng && order.kunde_lat && order.kunde_lng) {
    distM = distanceM(driverLat, driverLng, order.kunde_lat, order.kunde_lng);
    etaMin = etaMinFromDist(distM);
  } else if (stop.distanz_zum_vorgaenger_m) {
    distM = stop.distanz_zum_vorgaenger_m;
    etaMin = etaMinFromDist(distM);
  }

  const isCash = !zahlungsart || zahlungsart === 'bar' || zahlungsart === 'cash';
  const betrag = (order.gesamtbetrag / 100).toFixed(2).replace('.', ',');

  return (
    <div className="rounded-2xl border border-matcha-200 bg-gradient-to-br from-matcha-50 to-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-matcha-600 text-white">
        <MapPin className="h-4 w-4 shrink-0" />
        <span className="text-sm font-bold">
          Nächster Stopp
          {remaining > 1 && (
            <span className="ml-2 text-xs font-normal opacity-80">({remaining - 1} weitere)</span>
          )}
        </span>
        <span className="ml-auto text-xs font-bold opacity-90">
          #{stop.reihenfolge} von {totalCount}
        </span>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Customer */}
        <div>
          <div className="text-base font-black text-foreground">{order.kunde_name}</div>
          {order.kunde_adresse && (
            <div className="text-sm text-muted-foreground mt-0.5">
              {order.kunde_adresse}
              {order.kunde_plz && <span className="ml-1">{order.kunde_plz}</span>}
            </div>
          )}
          <div className="text-[11px] text-muted-foreground mt-0.5">#{order.bestellnummer}</div>
        </div>

        {/* ETA + Distance */}
        {(etaMin !== null || distM !== null) && (
          <div className="flex items-center gap-3">
            {etaMin !== null && (
              <div className="flex items-center gap-1.5 rounded-lg bg-white border border-matcha-200 px-3 py-2">
                <Clock className="h-3.5 w-3.5 text-matcha-600" />
                <span className="text-sm font-black text-matcha-700">~{etaMin} Min</span>
              </div>
            )}
            {distM !== null && (
              <div className="flex items-center gap-1.5 rounded-lg bg-white border border-stone-200 px-3 py-2">
                <Navigation className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-bold text-foreground">
                  {distM >= 1000 ? `${(distM / 1000).toFixed(1)} km` : `${Math.round(distM)} m`}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Payment */}
        <div className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-2',
          isCash ? 'bg-amber-50 border border-amber-200' : 'bg-matcha-50 border border-matcha-200',
        )}>
          {isCash
            ? <Banknote className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            : <CreditCard className="h-3.5 w-3.5 text-matcha-600 shrink-0" />}
          <span className={cn('text-xs font-bold', isCash ? 'text-amber-700' : 'text-matcha-700')}>
            {isCash ? 'Bar kassieren' : 'Bereits bezahlt'}
          </span>
          <span className="ml-auto text-sm font-black tabular-nums">
            {betrag} €
          </span>
        </div>

        {/* Notes */}
        {order.kunde_lieferhinweis && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span className="text-xs text-amber-800">{order.kunde_lieferhinweis}</span>
          </div>
        )}
        {order.kunde_notiz && !order.kunde_lieferhinweis && (
          <div className="text-xs text-muted-foreground italic px-1">
            &ldquo;{order.kunde_notiz}&rdquo;
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {order.kunde_telefon && (
            <a
              href={`tel:${order.kunde_telefon}`}
              className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-foreground active:bg-stone-50"
            >
              <Phone className="h-3.5 w-3.5" />
              Anrufen
            </a>
          )}
          {order.kunde_adresse && (
            <a
              href={mapsUrl(order.kunde_adresse, order.kunde_plz)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-matcha-600 px-3 py-2 text-xs font-bold text-white active:bg-matcha-700"
            >
              <Navigation className="h-3.5 w-3.5" />
              Navigation starten
            </a>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground">Tour-Fortschritt</span>
          <span className="text-[10px] font-bold text-matcha-700">
            {completedCount}/{totalCount} Stopps
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-matcha-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-matcha-500 transition-all duration-700"
            style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      </div>
    </div>
  );
}
