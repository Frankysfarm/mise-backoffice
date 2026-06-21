'use client';

import { useEffect, useState } from 'react';
import { MapPin, Navigation, Phone, Clock, Package, CheckCircle2, ChevronRight, Home, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type TourStop = {
  id: string;
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
  };
};

function NavButton({
  href,
  icon: Icon,
  label,
  primary,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  primary?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all active:scale-95 shadow-sm',
        primary
          ? 'bg-matcha-600 text-white hover:bg-matcha-700'
          : 'bg-white border-2 border-matcha-300 text-matcha-700 hover:bg-matcha-50',
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {label}
    </a>
  );
}

export function TourStoppNavV2({
  stops,
  startedAt,
}: {
  stops: TourStop[];
  startedAt?: string | null;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!stops || stops.length === 0) return null;

  const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const done = sorted.filter(s => s.geliefert_am);
  const remaining = sorted.filter(s => !s.geliefert_am);
  const current = remaining[0];
  const next = remaining[1];

  if (!current) {
    return (
      <div className="rounded-2xl border-2 border-matcha-300 bg-matcha-50 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-matcha-600" />
          <span className="font-bold text-matcha-700">Alle Stopps abgeschlossen!</span>
        </div>
        <div className="text-sm text-matcha-600">{done.length} von {sorted.length} Lieferungen abgeschlossen.</div>
      </div>
    );
  }

  const addr = current.order.kunde_adresse;
  const plz = current.order.kunde_plz;
  const fullAddr = [addr, plz].filter(Boolean).join(', ');
  const mapsQuery = encodeURIComponent(fullAddr || current.order.kunde_name);
  const googleMapsUrl = `https://maps.google.com/?q=${mapsQuery}`;
  const appleMapsUrl = `https://maps.apple.com/?q=${mapsQuery}`;
  const wazeUrl = `https://waze.com/ul?q=${mapsQuery}&navigate=yes`;

  const distM = current.distanz_zum_vorgaenger_m;
  const distStr = distM != null
    ? distM >= 1000 ? `${(distM / 1000).toFixed(1)} km` : `${Math.round(distM)} m`
    : null;

  const elapsedMin = startedAt ? Math.floor((now - new Date(startedAt).getTime()) / 60_000) : null;

  const isPaid = current.order.gesamtbetrag === 0;
  const zahlungLabel = isPaid ? 'Bezahlt' : `Bar/Karte ${current.order.gesamtbetrag.toFixed(2).replace('.', ',')} €`;

  return (
    <div className="space-y-2">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 px-1">
        <div className="flex gap-1">
          {sorted.map((s, i) => (
            <div key={s.id} className={cn(
              'h-2 rounded-full transition-all duration-300',
              s.geliefert_am ? 'bg-matcha-500 w-6' :
              s.id === current.id ? 'bg-orange-500 w-6 animate-pulse' :
              'bg-muted w-3',
            )} />
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground font-bold ml-auto">
          {done.length}/{sorted.length} abgeschlossen
        </span>
      </div>

      {/* Current Stop Card */}
      <div className="rounded-2xl border-2 border-orange-400 bg-orange-50 p-3 space-y-3">
        {/* Badge + Reihenfolge */}
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-black shrink-0">
            {current.reihenfolge}
          </div>
          <span className="text-xs font-black text-orange-800">Aktueller Stopp</span>
          {distStr && (
            <span className="ml-auto text-[10px] font-bold text-orange-600 bg-orange-100 rounded-full px-2 py-0.5">
              {distStr} entfernt
            </span>
          )}
        </div>

        {/* Customer Info */}
        <div className="space-y-1">
          <div className="flex items-start gap-2">
            <MapPin className="h-3.5 w-3.5 text-orange-600 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-black">{current.order.kunde_name}</div>
              <div className="text-xs text-muted-foreground">{fullAddr || 'Adresse fehlt'}</div>
              <div className="text-[10px] text-muted-foreground">#{current.order.bestellnummer}</div>
            </div>
          </div>

          {current.order.kunde_telefon && (
            <a
              href={`tel:${current.order.kunde_telefon}`}
              className="flex items-center gap-1.5 text-xs font-bold text-matcha-700 hover:text-matcha-900"
            >
              <Phone className="h-3 w-3" />
              {current.order.kunde_telefon}
            </a>
          )}

          <div className="flex items-center gap-1 text-xs font-bold text-matcha-700">
            <Package className="h-3 w-3" />
            <span>{zahlungLabel}</span>
          </div>
        </div>

        {/* Notes */}
        {current.order.kunde_notiz && (
          <div className="rounded-lg bg-amber-100 border border-amber-300 px-2 py-1.5 text-[10px] text-amber-800">
            <strong>Kundennotiz:</strong> {current.order.kunde_notiz}
          </div>
        )}
        {current.order.kunde_lieferhinweis && (
          <div className="rounded-lg bg-blue-100 border border-blue-300 px-2 py-1.5 text-[10px] text-blue-800">
            <strong>Lieferhinweis:</strong> {current.order.kunde_lieferhinweis}
          </div>
        )}

        {/* Nav Buttons */}
        <div className="flex gap-2 flex-wrap">
          <NavButton href={googleMapsUrl} icon={Navigation} label="Google Maps" primary />
          <NavButton href={wazeUrl} icon={Navigation} label="Waze" />
          <NavButton href={appleMapsUrl} icon={Navigation} label="Apple Maps" />
        </div>
      </div>

      {/* Next Stop Preview */}
      {next && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-2.5 flex items-center gap-2">
          <div className="h-5 w-5 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center text-[9px] font-black shrink-0">
            {next.reihenfolge}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-black text-muted-foreground uppercase tracking-wide">Nächster Stopp</div>
            <div className="text-xs font-bold truncate">{next.order.kunde_name}</div>
            <div className="text-[9px] text-muted-foreground truncate">{next.order.kunde_adresse ?? ''}</div>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </div>
      )}

      {/* Remaining count */}
      {remaining.length > 1 && (
        <div className="text-center text-[10px] text-muted-foreground">
          {remaining.length - 1} weiterer Stopp{remaining.length > 2 ? 'ps' : ''} nach diesem
        </div>
      )}

      {/* Elapsed time */}
      {elapsedMin != null && elapsedMin > 0 && (
        <div className="flex items-center gap-1 justify-center text-[9px] text-muted-foreground">
          <Clock className="h-2.5 w-2.5" />
          Tour läuft seit {elapsedMin} Min
        </div>
      )}
    </div>
  );
}
