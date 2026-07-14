'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Navigation, Phone, Package, Clock, CheckCircle2, AlertTriangle, ChevronRight } from 'lucide-react';

interface Stop {
  id: string;
  stop_nummer: number;
  kunde_name: string | null;
  adresse: string | null;
  plz: string | null;
  lat: number | null;
  lng: number | null;
  telefon: string | null;
  eta_min: number | null;
  gesamtbetrag: number | null;
  status: 'pending' | 'arrived' | 'delivered';
  zahlungsart?: string | null;
  notiz?: string | null;
}

function fmtEuro(v: number | null | undefined) {
  if (v == null) return '';
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
}

function openGoogleMaps(lat: number, lng: number, adresse?: string | null) {
  const dest = adresse ? encodeURIComponent(adresse) : `${lat},${lng}`;
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}`, '_blank');
}

function openWaze(lat: number, lng: number) {
  window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_blank');
}

export function FahrerPhase1433SmartStoppNavigatorUltra({ stops }: { stops: Stop[] }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(iv);
  }, []);

  if (!stops || stops.length === 0) return null;

  const pending = stops.filter((s) => s.status !== 'delivered');
  const done = stops.filter((s) => s.status === 'delivered').length;
  const nextStop = pending[0] ?? null;
  const totalStops = stops.length;

  if (pending.length === 0) {
    return (
      <div className="rounded-2xl bg-matcha-900 border border-matcha-700 p-4 flex items-center gap-3">
        <CheckCircle2 className="h-6 w-6 text-matcha-400 shrink-0" />
        <div>
          <div className="font-bold text-matcha-100">Alle {totalStops} Stopps abgeschlossen!</div>
          <div className="text-xs text-matcha-400">Zurück zum Depot navigieren</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-matcha-900/95 border border-matcha-700/60 overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-matcha-700/40">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-matcha-400 shrink-0" />
          <span className="text-xs font-black uppercase tracking-wider text-matcha-300">
            Smart-Stopp-Navigator
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {stops.map((s, i) => (
              <div
                key={s.id}
                className={cn(
                  'h-2 w-2 rounded-full',
                  s.status === 'delivered' ? 'bg-matcha-500' :
                  s.status === 'arrived' ? 'bg-amber-400 animate-pulse' :
                  i === done ? 'bg-white' : 'bg-matcha-700',
                )}
              />
            ))}
          </div>
          <span className="text-[10px] font-bold text-matcha-400 tabular-nums">
            {done}/{totalStops}
          </span>
        </div>
      </div>

      {/* Next stop — hero card */}
      {nextStop && (
        <div className={cn(
          'px-4 py-4',
          nextStop.eta_min !== null && nextStop.eta_min <= 3 && 'bg-red-900/30',
        )}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className={cn(
                'shrink-0 flex items-center justify-center h-9 w-9 rounded-full font-black text-sm',
                nextStop.status === 'arrived' ? 'bg-amber-500 text-white animate-pulse' : 'bg-matcha-600 text-white',
              )}>
                {nextStop.stop_nummer}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-white text-sm truncate">
                  {nextStop.kunde_name ?? 'Kunde'}
                </div>
                {nextStop.adresse && (
                  <div className="text-xs text-matcha-300 mt-0.5 line-clamp-2">
                    <MapPin className="h-3 w-3 inline-block mr-0.5 shrink-0" />
                    {nextStop.adresse}{nextStop.plz ? `, ${nextStop.plz}` : ''}
                  </div>
                )}
                {nextStop.notiz && (
                  <div className="text-[10px] text-amber-300 mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    {nextStop.notiz}
                  </div>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right">
              {nextStop.eta_min !== null && (
                <div className={cn(
                  'font-mono text-xl font-black tabular-nums',
                  nextStop.eta_min <= 3 ? 'text-red-400' : nextStop.eta_min <= 8 ? 'text-amber-400' : 'text-matcha-300',
                )}>
                  ~{nextStop.eta_min}m
                </div>
              )}
              {nextStop.gesamtbetrag != null && (
                <div className="text-xs text-matcha-400 font-bold">{fmtEuro(nextStop.gesamtbetrag)}</div>
              )}
              {nextStop.zahlungsart && (
                <div className="text-[9px] text-matcha-500 uppercase">{nextStop.zahlungsart}</div>
              )}
            </div>
          </div>

          {/* Navigation buttons */}
          <div className="flex gap-2">
            {nextStop.lat != null && nextStop.lng != null ? (
              <>
                <button
                  onClick={() => openGoogleMaps(nextStop.lat!, nextStop.lng!, nextStop.adresse)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
                >
                  <Navigation className="h-3.5 w-3.5 shrink-0" />
                  Google Maps
                </button>
                <button
                  onClick={() => openWaze(nextStop.lat!, nextStop.lng!)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold transition-colors"
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  Waze
                </button>
              </>
            ) : nextStop.adresse ? (
              <button
                onClick={() => openGoogleMaps(0, 0, nextStop.adresse)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
              >
                <Navigation className="h-3.5 w-3.5 shrink-0" />
                Adresse navigieren
              </button>
            ) : null}
            {nextStop.telefon && (
              <a
                href={`tel:${nextStop.telefon}`}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-matcha-700 hover:bg-matcha-600 text-white text-xs font-bold transition-colors"
              >
                <Phone className="h-3.5 w-3.5 shrink-0" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Remaining stops preview */}
      {pending.length > 1 && (
        <div className="border-t border-matcha-700/40 px-4 py-2">
          <div className="text-[9px] font-black uppercase tracking-wider text-matcha-500 mb-2">
            Nächste Stopps ({pending.length - 1} weitere)
          </div>
          <div className="space-y-1.5">
            {pending.slice(1, 4).map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <div className="h-5 w-5 shrink-0 rounded-full bg-matcha-800 border border-matcha-600 flex items-center justify-center text-[9px] font-bold text-matcha-300">
                  {s.stop_nummer}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-matcha-300 font-bold truncate block">
                    {s.kunde_name ?? '—'}
                  </span>
                  {s.adresse && (
                    <span className="text-[9px] text-matcha-500 truncate block">
                      {s.adresse}
                    </span>
                  )}
                </div>
                {s.eta_min != null && (
                  <span className="text-[9px] font-bold text-matcha-400 tabular-nums shrink-0">
                    ~{s.eta_min}m
                  </span>
                )}
                <ChevronRight className="h-3 w-3 text-matcha-600 shrink-0" />
              </div>
            ))}
            {pending.length > 4 && (
              <div className="text-[9px] text-matcha-600 pl-7">
                +{pending.length - 4} weitere Stopps
              </div>
            )}
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-matcha-800 overflow-hidden">
            <div
              className="h-full bg-matcha-500 rounded-full transition-all duration-500"
              style={{ width: `${totalStops > 0 ? (done / totalStops) * 100 : 0}%` }}
            />
          </div>
          <span className="text-[9px] font-bold text-matcha-500 tabular-nums shrink-0">
            {Math.round(totalStops > 0 ? (done / totalStops) * 100 : 0)}%
          </span>
        </div>
      </div>
    </div>
  );
}
