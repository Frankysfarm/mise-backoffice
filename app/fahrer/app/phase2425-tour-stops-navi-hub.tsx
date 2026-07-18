'use client';
import { useEffect, useState } from 'react';
import { Navigation2, MapPin, CheckCircle2, Clock, Phone, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

interface TourStop {
  id: string;
  reihenfolge: number;
  adresse: string | null;
  kundeName: string | null;
  kundePhone: string | null;
  status: 'offen' | 'aktiv' | 'erledigt';
  eta_min: number | null;
  entfernung_m: number | null;
}

interface Props {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
  stops?: TourStop[];
}

function statusIcon(s: string) {
  if (s === 'erledigt') return <CheckCircle2 size={14} className="text-green-600" />;
  if (s === 'aktiv') return <Navigation2 size={14} className="text-blue-600" />;
  return <Clock size={14} className="text-gray-400" />;
}

function statusBg(s: string) {
  if (s === 'erledigt') return 'bg-green-50 border-green-200';
  if (s === 'aktiv') return 'bg-blue-50 border-blue-300 ring-1 ring-blue-300';
  return 'bg-white border-gray-100';
}

export function FahrerPhase2425TourStopsNaviHub({ driverId, locationId, isOnline, stops: propStops }: Props) {
  const [stops, setStops] = useState<TourStop[]>(propStops ?? []);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(!propStops);

  async function load() {
    if (!isOnline || !driverId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-rueckkehr-uebersicht?driver_id=${driverId}&location_id=${locationId ?? ''}`);
      if (!r.ok) return;
      const raw = await r.json();
      const rawStops = raw.stops ?? raw.tour_stops ?? raw.aktive_stops ?? [];
      setStops(rawStops.map((s: any) => ({
        id: s.id ?? s.stop_id,
        reihenfolge: s.reihenfolge ?? s.stop_number ?? s.position ?? 0,
        adresse: s.adresse ?? s.address ?? s.kunde_adresse ?? null,
        kundeName: s.kunde_name ?? s.customer_name ?? null,
        kundePhone: s.phone ?? s.telefon ?? null,
        status: s.status === 'done' || s.abgeschlossen ? 'erledigt' : s.status === 'active' || s.aktuell ? 'aktiv' : 'offen',
        eta_min: s.eta_min ?? null,
        entfernung_m: s.distanz_m ?? s.distance_m ?? null,
      })));
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    if (propStops) {
      setStops(propStops);
      setLoading(false);
    } else {
      load();
      const t = setInterval(load, 30_000);
      return () => clearInterval(t);
    }
  }, [driverId, locationId, isOnline]);

  function openNavi(adresse: string) {
    const url = `https://maps.google.com/?q=${encodeURIComponent(adresse)}`;
    window.open(url, '_blank');
  }

  if (!isOnline) return null;

  const aktiv = stops.find(s => s.status === 'aktiv');
  const erledigt = stops.filter(s => s.status === 'erledigt').length;
  const gesamt = stops.length;

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 mb-3">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Navigation2 size={16} className="text-blue-600" />
          <span className="font-semibold text-sm text-blue-800">
            Tour-Stops & Navigation
          </span>
          {gesamt > 0 && (
            <span className="text-xs bg-blue-200 text-blue-800 rounded-full px-2 py-0.5">
              {erledigt}/{gesamt} erledigt
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-blue-600" /> : <ChevronDown size={16} className="text-blue-600" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {loading ? (
            <p className="text-xs text-blue-600">Lade Stops…</p>
          ) : stops.length === 0 ? (
            <div className="flex items-center gap-2 bg-blue-100 rounded-lg p-3">
              <CheckCircle2 size={14} className="text-blue-600" />
              <p className="text-xs text-blue-700">Keine aktiven Tour-Stops.</p>
            </div>
          ) : (
            <>
              {/* Progress bar */}
              {gesamt > 0 && (
                <div className="mb-2">
                  <div className="flex justify-between text-[10px] text-blue-700 mb-1">
                    <span>Tour-Fortschritt</span>
                    <span className="font-bold">{Math.round((erledigt / gesamt) * 100)}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-blue-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all duration-500"
                      style={{ width: `${(erledigt / gesamt) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Active stop highlight */}
              {aktiv && (
                <div className="bg-blue-600 text-white rounded-xl p-3 mb-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Navigation2 size={13} />
                    <span className="text-xs font-black">Aktueller Stop #{aktiv.reihenfolge}</span>
                    {aktiv.eta_min !== null && (
                      <span className="ml-auto text-[10px] bg-white/20 rounded-full px-2 py-0.5">
                        ~{aktiv.eta_min} Min
                      </span>
                    )}
                  </div>
                  {aktiv.kundeName && (
                    <p className="text-xs font-semibold">{aktiv.kundeName}</p>
                  )}
                  {aktiv.adresse && (
                    <p className="text-[10px] opacity-80 mt-0.5">{aktiv.adresse}</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    {aktiv.adresse && (
                      <button
                        onClick={() => openNavi(aktiv.adresse!)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-white text-blue-700 rounded-lg py-1.5 text-xs font-bold"
                      >
                        <MapPin size={12} /> Navigieren
                      </button>
                    )}
                    {aktiv.kundePhone && (
                      <a
                        href={`tel:${aktiv.kundePhone}`}
                        className="flex items-center justify-center gap-1.5 bg-white/20 rounded-lg px-3 py-1.5 text-xs font-bold"
                      >
                        <Phone size={12} /> Anrufen
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* All stops list */}
              <div className="space-y-1.5">
                {stops.map(s => (
                  <div key={s.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${statusBg(s.status)}`}>
                    <span className="shrink-0 font-bold text-gray-500 w-5">{s.reihenfolge}.</span>
                    {statusIcon(s.status)}
                    <div className="flex-1 min-w-0">
                      {s.kundeName && <p className="font-semibold truncate">{s.kundeName}</p>}
                      {s.adresse && <p className="text-[10px] text-gray-500 truncate">{s.adresse}</p>}
                    </div>
                    <div className="shrink-0 flex items-center gap-1">
                      {s.entfernung_m !== null && (
                        <span className="text-[10px] text-gray-500">
                          {s.entfernung_m >= 1000 ? `${(s.entfernung_m / 1000).toFixed(1)} km` : `${s.entfernung_m} m`}
                        </span>
                      )}
                      {s.adresse && s.status !== 'erledigt' && (
                        <button
                          onClick={() => openNavi(s.adresse!)}
                          className="rounded-md bg-blue-100 text-blue-700 px-1.5 py-0.5 text-[10px] font-bold hover:bg-blue-200 transition"
                        >
                          Nav
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
