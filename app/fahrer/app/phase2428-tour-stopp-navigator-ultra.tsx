'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Phone, Navigation, CheckCircle2, Clock, AlertTriangle, Package } from 'lucide-react';

interface TourStop {
  id: string;
  reihenfolge: number;
  adresse: string;
  kunde_name: string | null;
  telefon: string | null;
  bestellnummer: string | null;
  status: 'ausstehend' | 'unterwegs' | 'angekommen' | 'abgeliefert';
  eta_min: number | null;
  notiz: string | null;
}

function stopStyle(s: string) {
  if (s === 'abgeliefert') return { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', label: 'Abgeliefert', textColor: 'text-green-700' };
  if (s === 'angekommen') return { bg: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500', label: 'Angekommen', textColor: 'text-blue-700' };
  if (s === 'unterwegs') return { bg: 'bg-amber-50 border-amber-300', dot: 'bg-amber-500', label: 'Unterwegs', textColor: 'text-amber-700' };
  return { bg: 'bg-white border-gray-200', dot: 'bg-gray-300', label: 'Ausstehend', textColor: 'text-gray-500' };
}

function NaviLink({ adresse }: { adresse: string }) {
  const url = `https://maps.google.com/?q=${encodeURIComponent(adresse)}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 bg-matcha-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-matcha-700 active:scale-95 transition"
    >
      <Navigation size={12} />
      Navigation starten
    </a>
  );
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2428TourStoppNavigatorUltra({ driverId, locationId, isOnline }: Props) {
  const [stops, setStops] = useState<TourStop[]>([]);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!driverId || !isOnline) { setLoading(false); return; }
    try {
      const r = await fetch(`/api/delivery/fahrer/tour-stops?driver_id=${driverId}`);
      if (r.ok) {
        const data = await r.json();
        setStops(Array.isArray(data) ? data : []);
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 20 * 1000);
    return () => clearInterval(t);
  }, [driverId, isOnline]);

  if (!isOnline) return null;

  const naechsterStopp = stops.find(s => s.status === 'unterwegs' || s.status === 'angekommen') ?? stops.find(s => s.status === 'ausstehend');
  const abgeliefert = stops.filter(s => s.status === 'abgeliefert').length;
  const gesamt = stops.length;
  const progressPct = gesamt > 0 ? (abgeliefert / gesamt) * 100 : 0;
  const istFertig = gesamt > 0 && abgeliefert === gesamt;

  return (
    <div className="rounded-xl border mb-3 border-matcha-200 bg-matcha-50">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <MapPin size={16} className="text-matcha-600" />
          <span className="font-semibold text-sm text-matcha-800">
            Tour-Stopps
            {gesamt > 0 ? ` — ${abgeliefert}/${gesamt} erledigt` : ''}
          </span>
          {istFertig && (
            <span className="text-xs bg-green-200 text-green-800 rounded-full px-2 py-0.5">Tour fertig!</span>
          )}
          {!istFertig && naechsterStopp?.eta_min != null && (
            <span className="text-xs bg-matcha-200 text-matcha-800 rounded-full px-2 py-0.5">
              {naechsterStopp.eta_min} Min bis nächster Stopp
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {loading ? (
            <p className="text-xs text-gray-500 animate-pulse">Lade Tour-Stopps…</p>
          ) : stops.length === 0 ? (
            <div className="text-center py-4">
              <Package size={24} className="text-gray-300 mx-auto mb-1" />
              <p className="text-xs text-gray-500">Keine aktive Tour.</p>
            </div>
          ) : (
            <>
              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>Tour-Fortschritt</span>
                  <span>{Math.round(progressPct)}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-matcha-500 transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>{abgeliefert} abgeliefert</span>
                  <span>{gesamt - abgeliefert} ausstehend</span>
                </div>
              </div>

              {/* Next Stop Hero */}
              {naechsterStopp && !istFertig && (
                <div className="bg-matcha-600 rounded-xl p-4 text-white">
                  <div className="flex items-center gap-1.5 text-matcha-200 text-[10px] font-semibold mb-1 uppercase tracking-wide">
                    <Navigation size={10} />
                    Nächster Stopp #{naechsterStopp.reihenfolge}
                  </div>
                  <p className="text-sm font-bold leading-snug">{naechsterStopp.adresse}</p>
                  {naechsterStopp.kunde_name && (
                    <p className="text-matcha-200 text-xs mt-0.5">{naechsterStopp.kunde_name}</p>
                  )}
                  {naechsterStopp.eta_min != null && (
                    <div className="flex items-center gap-1 text-matcha-200 text-xs mt-1">
                      <Clock size={10} />
                      ETA ca. {naechsterStopp.eta_min} Min
                    </div>
                  )}
                  {naechsterStopp.notiz && (
                    <div className="flex items-start gap-1.5 mt-2 bg-matcha-700 rounded-lg p-2">
                      <AlertTriangle size={11} className="text-amber-300 mt-0.5 shrink-0" />
                      <p className="text-xs text-matcha-100">{naechsterStopp.notiz}</p>
                    </div>
                  )}
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <NaviLink adresse={naechsterStopp.adresse} />
                    {naechsterStopp.telefon && (
                      <a
                        href={`tel:${naechsterStopp.telefon}`}
                        className="inline-flex items-center gap-1.5 bg-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-white/30 active:scale-95 transition"
                      >
                        <Phone size={12} />
                        Anrufen
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* All Stops List */}
              <div className="space-y-2">
                {stops.map(s => {
                  const st = stopStyle(s.status);
                  const isNext = s.id === naechsterStopp?.id && !istFertig;
                  return (
                    <div
                      key={s.id}
                      className={`rounded-lg border p-3 ${st.bg} ${isNext ? 'ring-2 ring-matcha-400' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center gap-1 shrink-0">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${st.dot}`}>
                            {s.status === 'abgeliefert' ? '✓' : s.reihenfolge}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-gray-800 truncate">
                              {s.adresse}
                            </span>
                            <span className={`text-[10px] font-semibold ${st.textColor}`}>
                              {st.label}
                            </span>
                          </div>
                          {s.kunde_name && (
                            <p className="text-[10px] text-gray-500 mt-0.5">{s.kunde_name}</p>
                          )}
                          {s.eta_min != null && s.status !== 'abgeliefert' && (
                            <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-0.5">
                              <Clock size={9} />
                              {s.eta_min} Min
                            </div>
                          )}
                          {s.notiz && (
                            <p className="text-[10px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 mt-1 border border-amber-200">
                              {s.notiz}
                            </p>
                          )}
                          {(s.status !== 'abgeliefert') && (
                            <div className="flex gap-1.5 mt-2 flex-wrap">
                              {s.status !== 'abgeliefert' && (
                                <NaviLink adresse={s.adresse} />
                              )}
                              {s.telefon && (
                                <a
                                  href={`tel:${s.telefon}`}
                                  className="inline-flex items-center gap-1 text-[10px] text-gray-600 bg-white border border-gray-200 rounded px-2 py-1 hover:bg-gray-50"
                                >
                                  <Phone size={9} />
                                  {s.telefon}
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {istFertig && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3">
                  <CheckCircle2 size={20} className="text-green-500 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-green-800">Tour abgeschlossen!</p>
                    <p className="text-xs text-green-600">Alle {gesamt} Stopps erledigt. Sehr gut!</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
