'use client';

import { useEffect, useState } from 'react';
import {
  MapPin, CheckCircle2, Clock, Navigation, AlertTriangle,
  ChevronRight, Package, Phone, Star, Zap, Route, TrendingUp, Award,
} from 'lucide-react';

// Phase 5036 — Tour-Stopp Smart Navigator V15
// Aktive Tour-Stopps; ETA-Ampel; Live-Distanz-Anzeige je Stopp;
// Trinkgeld-Prognose; Effizienz-Score; Navigation-CTA; Status geliefert/aktiv/ausstehend;
// 20-Sek-Polling; Mock-Fallback

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
  distanz_km: number;
  status: StoppStatus;
  bewertung: number | null;
  trinkgeld_prognose: number;
  lat: number;
  lng: number;
}

interface TourData {
  tour_id: string;
  stopps: TourStopp[];
  gesamt_verdienst: number;
  trinkgeld_gesamt: number;
  trinkgeld_prognose_gesamt: number;
  km_gesamt: number;
  effizienz_score: number;
  eta_schicht_ende: string;
}

const MOCK: TourData = {
  tour_id: 'T-2025',
  effizienz_score: 88,
  gesamt_verdienst: 91.40,
  trinkgeld_gesamt: 8.50,
  trinkgeld_prognose_gesamt: 14.00,
  km_gesamt: 9.1,
  eta_schicht_ende: '21:50',
  stopps: [
    { nr: 1, adresse: 'Hauptstraße 12, Aachen',  name: 'Maria S.', tel: '+49 241 12345', notiz: '',                      betrag: 22.50, bezahlt: true,  eta_min: 0,  distanz_km: 0,   status: 'geliefert', bewertung: 5,    trinkgeld_prognose: 3.0, lat: 50.7753, lng: 6.0839 },
    { nr: 2, adresse: 'Marktplatz 3, Aachen',    name: 'Klaus B.', tel: '+49 241 23456', notiz: 'Klingel defekt',         betrag: 17.80, bezahlt: false, eta_min: 3,  distanz_km: 0.8, status: 'aktiv',     bewertung: null, trinkgeld_prognose: 2.5, lat: 50.7760, lng: 6.0850 },
    { nr: 3, adresse: 'Ringstraße 47, Aachen',   name: 'Anna H.',  tel: '+49 241 34567', notiz: '2. OG rechts',           betrag: 31.20, bezahlt: true,  eta_min: 13, distanz_km: 2.1, status: 'ausstehend',bewertung: null, trinkgeld_prognose: 4.0, lat: 50.7740, lng: 6.0870 },
    { nr: 4, adresse: 'Bahnhofstraße 8, Aachen', name: 'Tom K.',   tel: '+49 241 45678', notiz: '',                       betrag: 14.60, bezahlt: true,  eta_min: 22, distanz_km: 3.5, status: 'ausstehend',bewertung: null, trinkgeld_prognose: 2.0, lat: 50.7720, lng: 6.0820 },
    { nr: 5, adresse: 'Lindenweg 22, Aachen',    name: 'Eva M.',   tel: '+49 241 56789', notiz: 'Hintere Einfahrt nutzen',betrag: 19.90, bezahlt: true,  eta_min: 31, distanz_km: 4.8, status: 'ausstehend',bewertung: null, trinkgeld_prognose: 2.5, lat: 50.7710, lng: 6.0900 },
  ],
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

function NavLink({ lat, lng }: { lat: number; lng: number }) {
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

export function FahrerPhase5036TourStoppSmartNavV15({ driverId }: { driverId?: string | null }) {
  const [data, setData]    = useState<TourData | null>(null);
  const [expanded, setExp] = useState<Set<number>>(new Set([2]));

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
    setExp((prev) => { const next = new Set(prev); next.has(nr) ? next.delete(nr) : next.add(nr); return next; });
  }

  const fertig = d.stopps.filter((s) => s.status === 'geliefert').length;
  const effColor = d.effizienz_score >= 85 ? 'text-emerald-600' : d.effizienz_score >= 70 ? 'text-amber-600' : 'text-red-600';

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
          <span className="bg-white/20 rounded-full px-2 py-0.5 font-semibold">~{d.eta_schicht_ende}</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* KPI Grid */}
        <div className="grid grid-cols-4 gap-2">
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
            <div className="text-[10px] text-muted-foreground">Strecke</div>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-2.5 text-center">
            <div className={`text-base font-black ${effColor}`}>{d.effizienz_score}%</div>
            <div className="text-[10px] text-muted-foreground">Effizienz</div>
          </div>
        </div>

        {/* Trinkgeld-Prognose Banner */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 flex items-center gap-3 px-3 py-2">
          <Award className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-amber-800">Trinkgeld-Prognose Schicht</div>
            <div className="text-[10px] text-amber-700">Bisher {d.trinkgeld_gesamt.toFixed(2)} € · Prognose {d.trinkgeld_prognose_gesamt.toFixed(2)} €</div>
          </div>
          <div className="flex items-center gap-0.5 text-xs font-bold text-emerald-700">
            <TrendingUp className="h-3.5 w-3.5" />
            +{(d.trinkgeld_prognose_gesamt - d.trinkgeld_gesamt).toFixed(2)} €
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
                  <span className={`rounded-full h-6 w-6 flex items-center justify-center text-xs font-black shrink-0 ${st.badge}`}>
                    {s.status === 'geliefert' ? <CheckCircle2 className="h-4 w-4" /> : s.nr}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{s.adresse}</div>
                    <div className="text-[10px] text-muted-foreground">{s.name}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.status !== 'geliefert' ? (
                      <div className="text-right">
                        <div className={`text-sm font-black ${ETA_COLOR(s.eta_min, s.status)}`}>{s.eta_min} min</div>
                        <div className="text-[10px] text-muted-foreground">{s.distanz_km} km</div>
                      </div>
                    ) : (
                      s.bewertung && <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                    )}
                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition ${isOpen ? 'rotate-90' : ''}`} />
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-border bg-white/70 px-3 py-3 space-y-2">
                    {s.notiz && (
                      <div className="flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1.5 text-xs text-amber-800">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{s.notiz}
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Betrag:</span>
                        <span className="font-bold">{s.betrag.toFixed(2)} €</span>
                        {!s.bezahlt && (
                          <span className="rounded bg-amber-100 text-amber-700 px-1 text-[9px] font-bold">BAR</span>
                        )}
                      </div>
                      {s.trinkgeld_prognose > 0 && s.status !== 'geliefert' && (
                        <span className="flex items-center gap-0.5 text-[10px] text-amber-600 font-semibold">
                          <Award className="h-3 w-3" />~{s.trinkgeld_prognose.toFixed(2)} € Trinkgeld
                        </span>
                      )}
                      {s.bewertung && (
                        <span className="flex items-center gap-0.5 text-amber-500 font-semibold text-xs">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />{s.bewertung}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <NavLink lat={s.lat} lng={s.lng} />
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
