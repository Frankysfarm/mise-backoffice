'use client';
import { useEffect, useState } from 'react';
import { MapPin, Navigation, CheckCircle2, Circle, Clock, ChevronDown, ChevronUp, Phone, ExternalLink } from 'lucide-react';

interface TourStop {
  id: string;
  sequence: number;
  type: 'dropoff' | 'pickup';
  customer_name: string;
  address: string;
  eta_min: number | null;
  completed: boolean;
  phone: string | null;
  notes: string | null;
  lat: number | null;
  lng: number | null;
}

interface TourData {
  batch_id: string;
  stops: TourStop[];
  total_stops: number;
  completed_stops: number;
  eta_total_min: number | null;
  started_at: string | null;
}

interface Props {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}

function formatEta(min: number | null): string {
  if (min == null) return '—';
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${min % 60}min`;
}

function navUrl(lat: number | null, lng: number | null, address: string): string {
  if (lat && lng) return `https://maps.google.com/maps?daddr=${lat},${lng}`;
  return `https://maps.google.com/maps?daddr=${encodeURIComponent(address)}`;
}

export function FahrerPhase2340TourStopsNavigationsPro({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<TourData | null>(null);
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!driverId || !isOnline) return;
    const load = () =>
      fetch(`/api/delivery/fahrer/aktive-tour?driver_id=${driverId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => d && setData(d))
        .catch(() => null);
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [driverId, isOnline]);

  if (!isOnline || !data) return null;

  const pendingStops = data.stops.filter(s => !s.completed);
  const nextStop = pendingStops[0] ?? null;
  const progress = data.total_stops > 0 ? (data.completed_stops / data.total_stops) * 100 : 0;

  return (
    <div className="rounded-xl border border-blue-200 bg-white shadow-sm mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 rounded-t-xl"
      >
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-blue-500" />
          <span className="font-semibold text-sm text-blue-800">
            Tour-Stops ({data.completed_stops}/{data.total_stops})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {data.eta_total_min != null && (
            <span className="text-[11px] text-blue-600 font-medium">~{formatEta(data.eta_total_min)}</span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="p-4">
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
              <span>{data.completed_stops} geliefert</span>
              <span>{pendingStops.length} verbleibend</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-2 bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Next Stop Highlight */}
          {nextStop && (
            <div className="mb-4 rounded-xl bg-blue-600 text-white p-4 shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80 mb-1">
                    Nächster Stopp ({nextStop.sequence})
                  </div>
                  <div className="font-bold text-base truncate">{nextStop.customer_name}</div>
                  <div className="text-sm opacity-90 truncate mt-0.5">{nextStop.address}</div>
                  {nextStop.notes && (
                    <div className="text-[11px] opacity-75 mt-1 italic">{nextStop.notes}</div>
                  )}
                  {nextStop.eta_min != null && (
                    <div className="flex items-center gap-1 mt-2 text-sm">
                      <Clock className="w-3.5 h-3.5 opacity-80" />
                      <span>ETA: {formatEta(nextStop.eta_min)}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 ml-3 shrink-0">
                  <a
                    href={navUrl(nextStop.lat, nextStop.lng, nextStop.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-lg bg-white text-blue-600 px-3 py-1.5 text-xs font-bold shadow-sm hover:bg-blue-50 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Navi
                  </a>
                  {nextStop.phone && (
                    <a
                      href={`tel:${nextStop.phone}`}
                      className="flex items-center gap-1 rounded-lg bg-white/20 text-white px-3 py-1.5 text-xs font-semibold hover:bg-white/30 transition"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      Anruf
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* All Stops List */}
          <div className="space-y-2">
            {data.stops.map(s => (
              <div key={s.id} className={`rounded-lg border ${s.completed ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}>
                <button
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                  onClick={() => setExpanded(e => e === s.id ? null : s.id)}
                >
                  <div className="shrink-0">
                    {s.completed
                      ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                      : <Circle className="w-5 h-5 text-gray-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-gray-500">{s.sequence}.</span>
                      <span className={`text-sm font-medium truncate ${s.completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                        {s.customer_name}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-400 truncate">{s.address}</div>
                  </div>
                  {s.eta_min != null && !s.completed && (
                    <span className="text-[11px] text-gray-500 shrink-0">{formatEta(s.eta_min)}</span>
                  )}
                  {expanded === s.id ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                </button>

                {expanded === s.id && (
                  <div className="border-t border-gray-100 px-3 pb-3 pt-2">
                    <div className="flex gap-2">
                      <a
                        href={navUrl(s.lat, s.lng, s.address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg bg-blue-50 text-blue-700 px-3 py-1.5 text-xs font-semibold border border-blue-200 hover:bg-blue-100 transition"
                      >
                        <MapPin className="w-3.5 h-3.5" /> Navigation
                      </a>
                      {s.phone && (
                        <a
                          href={`tel:${s.phone}`}
                          className="flex items-center gap-1.5 rounded-lg bg-gray-50 text-gray-700 px-3 py-1.5 text-xs font-semibold border border-gray-200 hover:bg-gray-100 transition"
                        >
                          <Phone className="w-3.5 h-3.5" /> {s.phone}
                        </a>
                      )}
                    </div>
                    {s.notes && (
                      <div className="mt-2 text-[11px] text-gray-500 italic bg-yellow-50 rounded-lg px-2 py-1.5 border border-yellow-100">
                        {s.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
