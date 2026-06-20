'use client';

import { cn } from '@/lib/utils';
import { MapPin, Phone, StickyNote, Euro, Navigation, Package, ChevronRight } from 'lucide-react';

type Stop = {
  id: string;
  order_id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  order?: {
    bestellnummer?: string;
    kunde_name?: string;
    kunde_adresse?: string | null;
    kunde_plz?: string | null;
    kunde_stadt?: string | null;
    kunde_lat?: number | null;
    kunde_lng?: number | null;
    kunde_notiz?: string | null;
    kunde_lieferhinweis?: string | null;
    kunde_telefon?: string | null;
    gesamtbetrag?: number;
    zahlungsart?: string | null;
  } | null;
};

interface Props {
  stops: Stop[];
  locationLat?: number | null;
  locationLng?: number | null;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function TourNaechsterStoppInfo({ stops, locationLat, locationLng }: Props) {
  const sortedOpen = stops
    .filter((s) => !s.geliefert_am)
    .sort((a, b) => a.reihenfolge - b.reihenfolge);

  if (sortedOpen.length === 0) return null;

  const nextStop = sortedOpen[0];
  const o = nextStop.order;
  if (!o) return null;

  const isAtStop = !!nextStop.angekommen_am && !nextStop.geliefert_am;

  const address = [o.kunde_adresse, o.kunde_plz, o.kunde_stadt].filter(Boolean).join(', ');

  // Distance
  let distKm: number | null = null;
  if (locationLat && locationLng && o.kunde_lat && o.kunde_lng) {
    distKm = haversineKm(locationLat, locationLng, o.kunde_lat, o.kunde_lng);
  }

  const openNavigation = () => {
    if (o.kunde_lat && o.kunde_lng) {
      window.open(`https://maps.google.com/?daddr=${o.kunde_lat},${o.kunde_lng}`, '_blank');
    } else if (address) {
      window.open(`https://maps.google.com/?daddr=${encodeURIComponent(address)}`, '_blank');
    }
  };

  const callCustomer = () => {
    if (o.kunde_telefon) window.open(`tel:${o.kunde_telefon}`, '_self');
  };

  const isCash = o.zahlungsart === 'bar' || o.zahlungsart === 'cash';

  return (
    <div className={cn(
      'rounded-2xl overflow-hidden',
      isAtStop
        ? 'bg-gradient-to-br from-amber-900/90 to-amber-800/90 border border-amber-600/60'
        : 'bg-gradient-to-br from-matcha-900/90 to-matcha-800/90 border border-matcha-600/50',
    )}>
      {/* Header */}
      <div className={cn(
        'flex items-center gap-2 px-4 py-2.5 border-b',
        isAtStop ? 'border-amber-700/50' : 'border-matcha-700/50',
      )}>
        <Package size={13} className={isAtStop ? 'text-amber-300' : 'text-matcha-300'} />
        <span className={cn(
          'text-[10px] font-bold uppercase tracking-wider',
          isAtStop ? 'text-amber-300' : 'text-matcha-300',
        )}>
          {isAtStop ? 'Am Ziel — Lieferung übergeben' : `Nächster Stopp · #${sortedOpen.indexOf(nextStop) + 1} von ${sortedOpen.length}`}
        </span>
        {o.bestellnummer && (
          <span className="ml-auto text-[9px] font-mono text-white/40">
            #{o.bestellnummer}
          </span>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Kunde + Adresse */}
        <div>
          <div className="text-white font-bold text-base leading-tight">
            {o.kunde_name ?? 'Kunde'}
          </div>
          {address && (
            <div className="flex items-start gap-1.5 mt-1">
              <MapPin size={11} className="text-white/50 mt-0.5 shrink-0" />
              <span className="text-white/70 text-xs leading-snug">{address}</span>
              {distKm !== null && (
                <span className={cn(
                  'ml-auto shrink-0 text-[10px] font-bold rounded-full px-1.5 py-0.5',
                  distKm < 1 ? 'bg-matcha-500/30 text-matcha-300' :
                  distKm < 3 ? 'bg-amber-500/30 text-amber-300' :
                  'bg-red-500/30 text-red-300',
                )}>
                  {distKm.toFixed(1)} km
                </span>
              )}
            </div>
          )}
        </div>

        {/* Notizen */}
        {(o.kunde_notiz || o.kunde_lieferhinweis) && (
          <div className="rounded-xl bg-white/10 px-3 py-2 flex items-start gap-2">
            <StickyNote size={11} className="text-white/50 mt-0.5 shrink-0" />
            <p className="text-white/80 text-[11px] leading-relaxed">
              {o.kunde_lieferhinweis || o.kunde_notiz}
            </p>
          </div>
        )}

        {/* Betrag + Zahlungsart */}
        {(o.gesamtbetrag != null) && (
          <div className="flex items-center gap-2">
            <Euro size={11} className="text-white/50 shrink-0" />
            <span className="text-white font-bold text-sm tabular-nums">
              {fmtEur(o.gesamtbetrag)}
            </span>
            {isCash && (
              <span className="ml-1 rounded-full bg-amber-500/30 text-amber-300 text-[9px] font-bold px-2 py-0.5">
                BARGELD
              </span>
            )}
            {!isCash && (
              <span className="ml-1 rounded-full bg-matcha-500/20 text-matcha-300 text-[9px] font-bold px-2 py-0.5">
                BEZAHLT
              </span>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={openNavigation}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition-colors',
              isAtStop
                ? 'bg-amber-500 hover:bg-amber-400 text-white'
                : 'bg-matcha-500 hover:bg-matcha-400 text-white',
            )}
          >
            <Navigation size={14} />
            Navigieren
          </button>
          {o.kunde_telefon && (
            <button
              onClick={callCustomer}
              className="w-12 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
            >
              <Phone size={14} />
            </button>
          )}
        </div>

        {/* Weitere Stops vorschau */}
        {sortedOpen.length > 1 && (
          <div className="border-t border-white/10 pt-2">
            <div className="text-[9px] font-bold uppercase tracking-wider text-white/40 mb-1.5">
              Danach
            </div>
            {sortedOpen.slice(1, 3).map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 text-white/50 text-[10px] py-0.5">
                <ChevronRight size={10} />
                <span className="truncate">{s.order?.kunde_name ?? 'Kunde'}</span>
                {s.order?.kunde_adresse && (
                  <span className="truncate text-white/30">{s.order.kunde_adresse}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
