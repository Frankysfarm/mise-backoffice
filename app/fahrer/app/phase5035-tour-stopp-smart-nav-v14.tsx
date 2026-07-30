'use client';

import { useEffect, useState } from 'react';
import {
  MapPin, CheckCircle2, Clock, Navigation, AlertTriangle,
  ChevronRight, Package, Phone, Star, Zap, Route,
} from 'lucide-react';

// Phase 5035 — Tour-Stopp Smart Navigator V14
// Aktuelle Tour-Stopps mit ETA-Ampel; Navigation-CTA je Stopp; Status geliefert/aktiv/ausstehend;
// Kundenkontakt-Schnell; Bewertungs-Vorschau; Verdienstprognose; 20-Sek-Polling; Mock-Fallback

type StoppStatus = 'geliefert' | 'aktiv' | 'ausstehend';

interface TourStopp {
  nr: number;
  adresse: string;
  name: string;
  tel: string;
  notiz: string;
  betrag: number;
  bezahlt: boolean;
  eta_min: number;
  status: StoppStatus;
  bewertung: number | null;
  lat: number;
  lng: number;
}

interface TourData {
  tour_id: string;
  stopps: TourStopp[];
  gesamt_verdienst: number;
  trinkgeld_gesamt: number;
  km_gesamt: number;
  eta_schicht_ende: string;
  aktiver_stopp_idx: number;
}

const MOCK: TourData = {
  tour_id: 'T-2024',
  stopps: [
    { nr: 1, adresse: 'Hauptstraße 12, Aachen',    name: 'Maria S.', tel: '+49 241 12345', notiz: '',                     betrag: 22.50, bezahlt: true,  eta_min: 0,  status: 'geliefert', bewertung: 5,    lat: 50.7753, lng: 6.0839 },
    { nr: 2, adresse: 'Marktplatz 3, Aachen',      name: 'Klaus B.', tel: '+49 241 23456', notiz: 'Klingel defekt, anrufen', betrag: 17.80, bezahlt: false, eta_min: 4,  status: 'aktiv',     bewertung: null, lat: 50.7753, lng: 6.0839 },
    { nr: 3, adresse: 'Ringstraße 47, Aachen',     name: 'Anna H.', tel: '+49 241 34567', notiz: '2. OG rechts',           betrag: 31.20, bezahlt: true,  eta_min: 12, status: 'ausstehend',bewertung: null, lat: 50.7753, lng: 6.0839 },
    { nr: 4, adresse: 'Bahnhofstraße 8, Aachen',   name: 'Tom K.', tel: '+49 241 45678', notiz: '',                        betrag: 14.60, bezahlt: true,  eta_min: 21, status: 'ausstehend',bewertung: null, lat: 50.7753, lng: 6.0839 },
  ],
  gesamt_verdienst: 86.10,
  trinkgeld_gesamt: 7.50,
  km_gesamt: 8.4,
  eta_schicht_ende: '21:45',
  aktiver_stopp_idx: 1,
};

const STATUS_STYLE: Record<StoppStatus, { border: string; bg: string; badge: string; label: string }> = {
  geliefert:  { border: 'border-emerald-300', bg: 'bg-emerald-50', badge: 'bg-emerald-600 text-white', label: 'Geliefert' },
  aktiv:      { border: 'border-blue-400',    bg: 'bg-blue-50',    badge: 'bg-blue-600 text-white',    label: 'Aktiv ▶'  },
  ausstehend: { border: 'border-border',      bg: 'bg-white',      badge: 'bg-slate-400 text-white',   label: 'Offen'    },
};

const ETA_COLOR = (min: number, status: StoppStatus) => {
  if (status === 'geliefert') return 'text-emerald-600';
  if (min <= 5) return 'text-red-600';
  if (min <= 10) return 'text-amber-600';
  return 'text-emerald-600';
};

function NavLink({ lat, lng, adresse }: { lat: number; lng: number; adresse: string }) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 rounded-lg bg-blue-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-blue-700 transition shrink-0"
    >
      <Navigation className="h-3.5 w-3.5" />Navi
    </a>
  );
}

export function FahrerPhase5035TourStoppSmartNavV14({ driverId }: { driverId?: string | null }) {
  const [data, setData]     = useState<TourData | null>(null);
  const [expanded, setExp]  = useState<Set<number>>(new Set([1]));

  async function fetchData() {
    try {
      const params = driverId ? `?driverId=${driverId}` : '';
      const r = await fetch(`/api/delivery/driver/tour${params}`, { cache: 'no-store' });
      if (!r.ok) throw new Error();
      setData(await r.json());
    } catch {
      setData(MOCK);
    }
  }

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 20_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  const d = data ?? MOCK;

  function toggle(nr: number) {
    setExp((prev) => {
      const next = new Set(prev);
      next.has(nr) ? next.delete(nr) : next.add(nr);
      return next;
    });
  }

  const fertig = d.stopps.filter((s) => s.status === 'geliefert').length;

  return (
    <div className="rounded-2xl border border-blue-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-700 text-white">
        <div className="flex items-center gap-2">
          <Route className="h-5 w-5 text-blue-300" />
          <span className="font-bold text-sm">Tour {d.tour_id}</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="opacity-80">{fertig}/{d.stopps.length} Stopps</span>
          <span className="bg-white/20 rounded-full px-2 py-0.5 font-semibold">
            Ende ~{d.eta_schicht_ende}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Schicht-KPIs */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-border bg-muted/20 p-2.5 text-center">
            <div className="text-base font-black text-emerald-600">{d.gesamt_verdienst.toFixed(2)} €</div>
            <div className="text-[10px] text-muted-foreground">Verdienst</div>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-2.5 text-center">
            <div className="text-base font-black text-amber-500">+{d.trinkgeld_gesamt.toFixed(2)} €</div>
            <div className="text-[10px] text-muted-foreground">Trinkgeld</div>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-2.5 text-center">
            <div className="text-base font-black text-indigo-600">{d.km_gesamt} km</div>
            <div className="text-[10px] text-muted-foreground">Gesamtstrecke</div>
          </div>
        </div>

        {/* Stopp-Liste */}
        <div className="space-y-2">
          {d.stopps.map((s) => {
            const st = STATUS_STYLE[s.status];
            const isOpen = expanded.has(s.nr);
            return (
              <div key={s.nr} className={`rounded-xl border ${st.border} ${st.bg} overflow-hidden`}>
                <button
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                  onClick={() => toggle(s.nr)}
                >
                  {/* Nr Badge */}
                  <span className={`rounded-full h-6 w-6 flex items-center justify-center text-xs font-black shrink-0 ${st.badge}`}>
                    {s.status === 'geliefert' ? <CheckCircle2 className="h-4 w-4" /> : s.nr}
                  </span>

                  {/* Adresse */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{s.adresse}</div>
                    <div className="text-[10px] text-muted-foreground">{s.name}</div>
                  </div>

                  {/* ETA + Chevron */}
                  <div className="flex items-center gap-2 shrink-0">
                    {s.status !== 'geliefert' ? (
                      <div className="text-right">
                        <div className={`text-sm font-black ${ETA_COLOR(s.eta_min, s.status)}`}>
                          {s.eta_min} min
                        </div>
                        <div className="text-[10px] text-muted-foreground">ETA</div>
                      </div>
                    ) : (
                      s.bewertung && <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                    )}
                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition ${isOpen ? 'rotate-90' : ''}`} />
                  </div>
                </button>

                {/* Erweitert */}
                {isOpen && (
                  <div className="border-t border-border bg-white/70 px-3 py-3 space-y-2">
                    {s.notiz && (
                      <div className="flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1.5 text-xs text-amber-800">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        {s.notiz}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Betrag:</span>
                        <span className="font-bold">{s.betrag.toFixed(2)} €</span>
                        {!s.bezahlt && (
                          <span className="rounded bg-amber-100 text-amber-700 px-1 text-[9px] font-bold">BARZAHLUNG</span>
                        )}
                        {s.bewertung && (
                          <span className="flex items-center gap-0.5 text-amber-500 font-semibold">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />{s.bewertung}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <NavLink lat={s.lat} lng={s.lng} adresse={s.adresse} />
                      <a
                        href={`tel:${s.tel}`}
                        className="flex items-center gap-1.5 rounded-lg border border-border bg-white text-foreground px-3 py-1.5 text-xs font-semibold hover:bg-muted/30 transition"
                      >
                        <Phone className="h-3.5 w-3.5" />{s.tel}
                      </a>
                      {s.status === 'aktiv' && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-blue-600 ml-auto">
                          <Package className="h-3.5 w-3.5" />Liefern
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border pt-2">
          <span className="flex items-center gap-1"><Zap className="h-3 w-3" />20 Sek Polling</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Schicht-Ende ~{d.eta_schicht_ende}</span>
        </div>
      </div>
    </div>
  );
}
