'use client';
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, MapPin, Navigation, Phone } from 'lucide-react';

interface Stop {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  angekommen_am: string | null;
  order_id: string;
  adresse: string | null;
  kunde_name: string | null;
  kunde_telefon: string | null;
  eta_min: number | null;
  lat?: number | null;
  lng?: number | null;
  bestellnummer?: string | null;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
  stops?: Stop[];
  batchId?: string | null;
}

function fmt(sec: number): string {
  const m = Math.floor(Math.abs(sec) / 60);
  const s = Math.abs(sec) % 60;
  return `${sec < 0 ? '-' : ''}${m}:${s.toString().padStart(2, '0')}`;
}

export function FahrerPhase2896TourStoppNaviFinal({ driverId, locationId, isOnline, stops = [], batchId }: Props) {
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setTick(t => t + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  if (!isOnline || stops.length === 0) return null;

  const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const done = sorted.filter(s => !!s.geliefert_am);
  const pending = sorted.filter(s => !s.geliefert_am);
  const next = pending[0] ?? null;

  const etaRemain = next?.eta_min != null
    ? next.eta_min * 60 - tick
    : null;

  const mapsUrl = next?.lat && next?.lng
    ? `https://maps.google.com/?q=${next.lat},${next.lng}`
    : next?.adresse
      ? `https://maps.google.com/?q=${encodeURIComponent(next.adresse)}`
      : null;

  const wazeUrl = next?.lat && next?.lng
    ? `https://waze.com/ul?ll=${next.lat},${next.lng}&navigate=yes`
    : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Navigation size={16} className="text-matcha-600" />
          <span className="font-semibold text-sm text-gray-800">Tour-Stopp Navi</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-matcha-100 text-matcha-700 font-medium">
            {done.length}/{sorted.length} erledigt
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Progress Dots */}
          <div className="flex items-center gap-1.5">
            {sorted.map((s, i) => (
              <div
                key={s.id}
                className={`flex-1 h-2 rounded-full ${s.geliefert_am ? 'bg-matcha-500' : i === done.length ? 'bg-amber-400' : 'bg-gray-200'}`}
              />
            ))}
          </div>

          {/* Next Stop Hero */}
          {next && (
            <div className="rounded-xl border-2 border-matcha-300 bg-matcha-50 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-bold text-matcha-600 uppercase tracking-wide">Stopp {done.length + 1}</span>
                    {etaRemain !== null && (
                      <span className={`text-[10px] font-mono font-black px-1.5 rounded ${etaRemain < 0 ? 'bg-red-100 text-red-600' : etaRemain < 120 ? 'bg-amber-100 text-amber-700' : 'bg-matcha-100 text-matcha-700'}`}>
                        {fmt(etaRemain)}
                      </span>
                    )}
                  </div>
                  {next.kunde_name && (
                    <div className="text-sm font-bold text-gray-800 truncate">{next.kunde_name}</div>
                  )}
                  {next.bestellnummer && (
                    <div className="text-[10px] text-gray-500">#{next.bestellnummer}</div>
                  )}
                  {next.adresse && (
                    <div className="flex items-start gap-1 mt-1">
                      <MapPin size={10} className="text-matcha-500 mt-0.5 shrink-0" />
                      <span className="text-xs text-gray-700 leading-snug">{next.adresse}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 bg-matcha-600 text-white text-xs font-bold py-2.5 rounded-lg active:scale-95 transition-transform"
                  >
                    <Navigation size={14} />
                    Google Maps
                  </a>
                )}
                {wazeUrl && (
                  <a
                    href={wazeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 bg-blue-600 text-white text-xs font-bold py-2.5 rounded-lg active:scale-95 transition-transform"
                  >
                    <Navigation size={14} />
                    Waze
                  </a>
                )}
                {next.kunde_telefon && (
                  <a
                    href={`tel:${next.kunde_telefon}`}
                    className="flex items-center justify-center gap-1.5 border border-gray-300 bg-white text-gray-700 text-xs font-bold py-2.5 rounded-lg active:scale-95 transition-transform col-span-1"
                  >
                    <Phone size={14} />
                    Anrufen
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Remaining Stops */}
          {pending.length > 1 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Weitere Stopps</div>
              {pending.slice(1).map((s, i) => (
                <div key={s.id} className="flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                  <span className="text-[10px] font-bold text-gray-400 w-4">{done.length + 2 + i}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-700 truncate">{s.kunde_name ?? 'Kunde'}</div>
                    {s.adresse && <div className="text-[10px] text-gray-500 truncate">{s.adresse}</div>}
                  </div>
                  {s.eta_min != null && (
                    <span className="text-[10px] text-gray-400 shrink-0">~{s.eta_min} Min</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Done Stop Count */}
          {done.length > 0 && pending.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-2 text-matcha-600">
              <CheckCircle2 size={18} />
              <span className="text-sm font-bold">Alle {done.length} Stopps erledigt!</span>
            </div>
          )}

          {/* No more stops alert */}
          {pending.length === 0 && done.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <AlertTriangle size={12} className="text-amber-500" />
              Keine aktiven Stopps gefunden.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
