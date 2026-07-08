'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Navigation, MapPin, Phone, Clock, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';

type Stop = {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    kunde_plz: string | null;
    kunde_telefon?: string | null;
    kunde_lat: number | null;
    kunde_lng: number | null;
    gesamtbetrag: number;
    zahlungsart?: string | null;
    bezahlt?: boolean | null;
    eta_earliest?: string | null;
    eta_latest?: string | null;
  };
};

interface Props {
  stops: Stop[];
  driverLat?: number | null;
  driverLng?: number | null;
  batchStartedAt?: string | null;
}

function haversineM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const c = sinDLat * sinDLat + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinDLng * sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

function mapsUrl(lat: number | null, lng: number | null, address: string | null): string {
  if (lat && lng) return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  if (address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return '#';
}

function wazeUrl(lat: number | null, lng: number | null): string {
  if (lat && lng) return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  return '#';
}

export function TourNavFokusKarte({ stops, driverLat, driverLng, batchStartedAt }: Props) {
  const remaining = useMemo(
    () => stops.filter((s) => !s.geliefert_am).sort((a, b) => a.reihenfolge - b.reihenfolge),
    [stops],
  );

  const done = stops.filter((s) => s.geliefert_am).length;
  const total = stops.length;

  const current = remaining[0] ?? null;
  const next = remaining[1] ?? null;

  if (!current) {
    return (
      <div className="rounded-2xl border border-matcha-400/40 bg-matcha-900/30 p-4 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-matcha-400 mb-2" />
        <div className="text-sm font-bold text-matcha-200">Alle Stopps abgeschlossen</div>
        <div className="text-xs text-matcha-400 mt-0.5">{done}/{total} geliefert</div>
      </div>
    );
  }

  const distM = driverLat && driverLng && current.order.kunde_lat && current.order.kunde_lng
    ? haversineM(
        { lat: driverLat, lng: driverLng },
        { lat: current.order.kunde_lat, lng: current.order.kunde_lng },
      )
    : null;

  const distStr = distM != null
    ? distM < 1000 ? `${Math.round(distM)} m` : `${(distM / 1000).toFixed(1)} km`
    : null;

  const etaEarliest = current.order.eta_earliest ? new Date(current.order.eta_earliest) : null;
  const etaLatest = current.order.eta_latest ? new Date(current.order.eta_latest) : null;
  const nowMs = Date.now();
  const etaOverdue = etaLatest && etaLatest.getTime() < nowMs;
  const etaTight = !etaOverdue && etaLatest && (etaLatest.getTime() - nowMs) < 5 * 60_000;

  const cashDue = !current.order.bezahlt && current.order.zahlungsart === 'bar';

  return (
    <div className="rounded-2xl border border-white/10 bg-matcha-900/50 overflow-hidden">
      {/* Progress header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/10">
        <Navigation className="h-4 w-4 text-matcha-300 shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider text-matcha-200">
          Nächster Stopp
        </span>
        <span className="ml-auto text-[10px] font-bold text-matcha-400 tabular-nums">
          {done}/{total} geliefert
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/10">
        <div
          className="h-full bg-matcha-400 transition-all duration-700"
          style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
        />
      </div>

      {/* Current stop */}
      <div className="px-4 py-4">
        <div className="flex items-start gap-3 mb-3">
          <div className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black text-sm',
            etaOverdue ? 'bg-red-500 text-white animate-pulse' :
            etaTight   ? 'bg-amber-400 text-white' :
            'bg-matcha-500 text-white',
          )}>
            {etaOverdue ? <AlertCircle className="h-5 w-5" /> : current.reihenfolge}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-white text-sm leading-tight">
              {current.order.kunde_name}
            </div>
            <div className="text-xs text-matcha-300 mt-0.5 leading-snug">
              {current.order.kunde_adresse}
              {current.order.kunde_plz && `, ${current.order.kunde_plz}`}
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {distStr && (
                <span className="flex items-center gap-1 text-[11px] text-matcha-300 font-semibold">
                  <MapPin className="h-3 w-3" />
                  {distStr}
                </span>
              )}
              {etaEarliest && (
                <span className={cn(
                  'flex items-center gap-1 text-[11px] font-bold',
                  etaOverdue ? 'text-red-400' : etaTight ? 'text-amber-300' : 'text-matcha-300',
                )}>
                  <Clock className="h-3 w-3" />
                  {etaEarliest.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                </span>
              )}
              {cashDue && (
                <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black text-black">
                  BAR {current.order.gesamtbetrag.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Navigation buttons */}
        <div className="grid grid-cols-3 gap-2">
          <a
            href={mapsUrl(current.order.kunde_lat, current.order.kunde_lng, current.order.kunde_adresse)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 rounded-xl bg-white/10 hover:bg-white/20 py-2.5 transition"
          >
            <Navigation className="h-5 w-5 text-white" />
            <span className="text-[9px] font-bold text-white/80">Maps</span>
          </a>
          <a
            href={wazeUrl(current.order.kunde_lat, current.order.kunde_lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 rounded-xl bg-white/10 hover:bg-white/20 py-2.5 transition"
          >
            <ExternalLink className="h-5 w-5 text-white" />
            <span className="text-[9px] font-bold text-white/80">Waze</span>
          </a>
          {current.order.kunde_telefon ? (
            <a
              href={`tel:${current.order.kunde_telefon}`}
              className="flex flex-col items-center gap-1 rounded-xl bg-white/10 hover:bg-white/20 py-2.5 transition"
            >
              <Phone className="h-5 w-5 text-white" />
              <span className="text-[9px] font-bold text-white/80">Anrufen</span>
            </a>
          ) : (
            <div className="flex flex-col items-center gap-1 rounded-xl bg-white/5 py-2.5 opacity-30">
              <Phone className="h-5 w-5 text-white" />
              <span className="text-[9px] font-bold text-white/80">Anrufen</span>
            </div>
          )}
        </div>
      </div>

      {/* Next stop preview */}
      {next && (
        <div className="border-t border-white/10 px-4 py-2.5 flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-wider text-matcha-400">Danach:</span>
          <span className="text-[11px] text-matcha-300 truncate flex-1">{next.order.kunde_name}</span>
          <span className="text-[9px] text-matcha-400 shrink-0 truncate max-w-[140px]">
            {next.order.kunde_adresse?.split(',')[0]}
          </span>
        </div>
      )}

      {/* Stop mini-list */}
      {remaining.length > 1 && (
        <div className="border-t border-white/10 px-4 py-2 flex gap-1.5 overflow-x-auto scrollbar-none">
          {remaining.slice(1).map((s) => (
            <div
              key={s.id}
              className="flex-shrink-0 flex flex-col items-center gap-0.5 rounded-lg bg-white/8 border border-white/10 px-2 py-1.5 min-w-[48px]"
            >
              <span className="text-[9px] font-black text-matcha-300">#{s.reihenfolge}</span>
              <span className="text-[8px] text-matcha-400 truncate max-w-[44px] text-center">
                {s.order.kunde_name.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
