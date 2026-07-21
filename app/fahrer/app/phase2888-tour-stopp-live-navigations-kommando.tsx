'use client';
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, MapPin, Navigation2, Phone, Truck } from 'lucide-react';

interface Stop {
  stop_id: string;
  sequence: number;
  kunde_name: string;
  adresse: string;
  eta_min: number | null;
  done: boolean;
  lat?: number | null;
  lng?: number | null;
  telefon?: string | null;
}

interface ApiData {
  stops: Stop[];
  tour_pct: number;
  naechster_stop_idx: number;
  batch_id: string;
}

const MOCK: ApiData = {
  batch_id: 'b-demo',
  tour_pct: 40,
  naechster_stop_idx: 1,
  stops: [
    { stop_id: 's1', sequence: 1, kunde_name: 'Familie Müller',  adresse: 'Hauptstr. 12, 10115 Berlin',       eta_min: null, done: true,  lat: 52.52,  lng: 13.40, telefon: '+49 30 123456' },
    { stop_id: 's2', sequence: 2, kunde_name: 'Schmidt GmbH',    adresse: 'Berliner Allee 5, 10117 Berlin',   eta_min: 6,    done: false, lat: 52.529, lng: 13.41, telefon: null },
    { stop_id: 's3', sequence: 3, kunde_name: 'Maria Weber',     adresse: 'Kastanienallee 22, 10119 Berlin',  eta_min: 14,   done: false, lat: 52.535, lng: 13.42, telefon: '+49 30 987654' },
  ],
};

function openNavi(lat: number, lng: number, adresse: string) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const url = isIOS
    ? `maps://?daddr=${lat},${lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  window.open(url, '_blank');
}

export function Phase2888TourStoppLiveNavigationsKommando({
  driverId,
  batchId,
  initialData,
}: {
  driverId?: string;
  batchId?: string;
  initialData?: Partial<ApiData>;
}) {
  const [data,    setData]    = useState<ApiData>({ ...MOCK, ...initialData });
  const [now,     setNow]     = useState(Date.now());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const load = () => {
      if (!batchId && !driverId) return;
      const qp = batchId ? `batch_id=${batchId}` : `driver_id=${driverId}`;
      fetch(`/api/delivery/fahrer/tour-stops-live?${qp}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => {});
    };
    load();
    const poll = setInterval(load, 20 * 1000);
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(poll); if (tickRef.current) clearInterval(tickRef.current); };
  }, [batchId, driverId]);

  const stops = data.stops;
  const next  = stops[data.naechster_stop_idx];
  const done  = stops.filter(s => s.done).length;

  return (
    <div className="space-y-3">
      {/* Tour-Fortschritt */}
      <div className="rounded-2xl border border-gray-200 bg-white p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Truck size={14} className="text-blue-600" />
            <span className="text-xs font-bold text-gray-800">Tour-Fortschritt</span>
          </div>
          <span className="text-[10px] text-gray-500">{done}/{stops.length} Stopps</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-700"
            style={{ width: `${data.tour_pct}%` }}
          />
        </div>
        {/* Stop-Dots */}
        <div className="mt-2 flex gap-1.5">
          {stops.map(s => (
            <div
              key={s.stop_id}
              className={`flex-1 rounded-full h-1.5 ${
                s.done ? 'bg-green-500' :
                s.sequence === (next?.sequence ?? 0) ? 'bg-blue-500 animate-pulse' :
                'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Nächster Stopp — prominent */}
      {next && (
        <div className="rounded-2xl border-2 border-blue-400 bg-blue-50 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Navigation2 size={16} className="text-blue-600" />
              <span className="text-sm font-bold text-blue-800">Nächster Stopp #{next.sequence}</span>
            </div>
            {next.eta_min !== null && (
              <span className="rounded-full bg-blue-500 text-white px-2.5 py-0.5 text-xs font-black">
                {next.eta_min} Min
              </span>
            )}
          </div>

          <div className="font-bold text-gray-900 text-sm mb-0.5">{next.kunde_name}</div>
          <div className="flex items-start gap-1 text-xs text-gray-600 mb-3">
            <MapPin size={12} className="shrink-0 mt-0.5 text-gray-400" />
            <span>{next.adresse}</span>
          </div>

          <div className="flex gap-2">
            {next.lat && next.lng && (
              <button
                onClick={() => openNavi(next.lat!, next.lng!, next.adresse)}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 text-white py-2 text-xs font-bold active:scale-95 transition-transform"
              >
                <Navigation2 size={14} />
                Navigation starten
              </button>
            )}
            {next.telefon && (
              <a
                href={`tel:${next.telefon}`}
                className="flex items-center justify-center gap-1 rounded-xl border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-700"
              >
                <Phone size={14} />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Alle Stopps */}
      <div className="rounded-2xl border border-gray-200 bg-white p-3 space-y-1.5">
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">Tour-Übersicht</div>
        {stops.map(stop => (
          <div
            key={stop.stop_id}
            className={`flex items-center gap-3 rounded-xl p-2 ${
              stop.done ? 'bg-green-50 border border-green-200 opacity-70' :
              stop.stop_id === next?.stop_id ? 'bg-blue-50 border border-blue-300' :
              'bg-gray-50 border border-gray-100'
            }`}
          >
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
              stop.done ? 'bg-green-500 text-white' :
              stop.stop_id === next?.stop_id ? 'bg-blue-500 text-white' :
              'bg-gray-200 text-gray-600'
            }`}>
              {stop.done ? <CheckCircle2 size={12} /> : stop.sequence}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-gray-800 truncate">{stop.kunde_name}</div>
              <div className="text-[9px] text-gray-500 truncate">{stop.adresse}</div>
            </div>

            <div className="shrink-0 text-right">
              {stop.done ? (
                <span className="text-[9px] text-green-600 font-semibold">Erledigt</span>
              ) : stop.eta_min !== null ? (
                <span className="flex items-center gap-0.5 text-[10px] text-gray-600">
                  <Clock size={9} />
                  {stop.eta_min} Min
                </span>
              ) : null}
            </div>

            {stop.stop_id === next?.stop_id && (
              <ChevronRight size={14} className="shrink-0 text-blue-500" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
