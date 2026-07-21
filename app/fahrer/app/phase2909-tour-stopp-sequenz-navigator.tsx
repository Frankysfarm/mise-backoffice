'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Navigation, Phone, CheckCircle2, Clock } from 'lucide-react';

interface TourStop {
  stop_id: string;
  position: number;
  address: string;
  customer_name: string;
  customer_phone?: string;
  eta_min: number;
  status: 'pending' | 'current' | 'done';
  notes?: string;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
  batchId?: string | null;
  stops?: TourStop[];
}

const MOCK_STOPS: TourStop[] = [
  { stop_id: 's1', position: 1, address: 'Hauptstr. 12, Berlin',    customer_name: 'Anna M.',  customer_phone: '+4915112345', eta_min: 8,  status: 'current' },
  { stop_id: 's2', position: 2, address: 'Parkweg 5, Berlin',       customer_name: 'Ben K.',   customer_phone: '+4915198765', eta_min: 18, status: 'pending' },
  { stop_id: 's3', position: 3, address: 'Schillerstr. 33, Berlin', customer_name: 'Clara R.',                                eta_min: 28, status: 'pending' },
];

function mapsUrl(addr: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}&travelmode=driving`;
}

function wazeUrl(addr: string): string {
  return `https://waze.com/ul?q=${encodeURIComponent(addr)}&navigate=yes`;
}

export function FahrerPhase2909TourStoppSequenzNavigator({ driverId, locationId, isOnline, batchId, stops: propStops }: Props) {
  const [open, setOpen]   = useState(true);
  const [stops, setStops] = useState<TourStop[]>(propStops ?? MOCK_STOPS);

  useEffect(() => {
    if (propStops && propStops.length > 0) { setStops(propStops); return; }
    if (!isOnline || !batchId || !locationId) return;
    fetch(`/api/delivery/fahrer/tour-stops?batch_id=${batchId}&location_id=${locationId}&driver_id=${driverId}`)
      .then(r => r.json())
      .then((d: { stops: TourStop[] }) => setStops(d.stops ?? MOCK_STOPS))
      .catch(() => setStops(MOCK_STOPS));
  }, [isOnline, batchId, locationId, driverId, propStops]);

  if (!isOnline) return null;

  const current   = stops.find(s => s.status === 'current');
  const pending   = stops.filter(s => s.status === 'pending');
  const doneCount = stops.filter(s => s.status === 'done').length;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Navigation size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800">Tour-Stopp Sequenz</span>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
            {doneCount}/{stops.length} erledigt
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Current stop hero */}
          {current && (
            <div className="rounded-xl bg-blue-600 text-white p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold bg-white text-blue-600 rounded-full px-2 py-0.5">Jetzt</span>
                <span className="text-sm font-bold">{current.customer_name}</span>
                <span className="flex items-center gap-1 ml-auto text-xs opacity-80">
                  <Clock size={11} /> {current.eta_min} Min
                </span>
              </div>
              <div className="flex items-start gap-1 text-xs opacity-90">
                <MapPin size={12} className="mt-0.5 flex-shrink-0" />
                <span>{current.address}</span>
              </div>
              {current.notes && (
                <div className="text-[10px] opacity-75 italic">📝 {current.notes}</div>
              )}
              <div className="flex gap-2">
                <a
                  href={mapsUrl(current.address)}
                  target="_blank" rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-1 bg-white text-blue-600 rounded-lg py-2 text-xs font-bold"
                >
                  <Navigation size={13} /> Maps
                </a>
                <a
                  href={wazeUrl(current.address)}
                  target="_blank" rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-1 bg-blue-500 text-white rounded-lg py-2 text-xs font-bold border border-blue-400"
                >
                  <Navigation size={13} /> Waze
                </a>
                {current.customer_phone && (
                  <a
                    href={`tel:${current.customer_phone}`}
                    className="flex items-center justify-center gap-1 bg-blue-500 text-white rounded-lg py-2 px-3 text-xs font-bold border border-blue-400"
                  >
                    <Phone size={13} />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Upcoming stops */}
          {pending.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Nächste Stopps</div>
              {pending.map(s => (
                <div key={s.stop_id} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2">
                  <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {s.position}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-800 truncate">{s.customer_name}</div>
                    <div className="text-[10px] text-gray-500 truncate">{s.address}</div>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-gray-500 flex-shrink-0">
                    <Clock size={10} /> {s.eta_min} Min
                  </div>
                </div>
              ))}
            </div>
          )}

          {doneCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle2 size={12} /> {doneCount} Stopp{doneCount > 1 ? 's' : ''} abgeschlossen
            </div>
          )}
        </div>
      )}
    </div>
  );
}
