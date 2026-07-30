'use client';

import { useEffect, useState } from 'react';
import {
  MapPin, CheckCircle2, Clock, AlertTriangle,
  ChevronRight, Package, Phone, Star, Zap, Route, TrendingUp, Euro,
  Target, Activity, ChevronDown, ChevronUp, Navigation, Award,
} from 'lucide-react';

// Phase 5062 — Tour-Stopp Smart Navigator V17
// Neu: Schicht-Auslastungs-Ring; Rentabilitäts-Prognose je Stopp;
// Live-Distanz-Fortschrittsring; Kundenzufriedenheits-Score-Band;
// Stopp-Zeitkonto; 20-Sek-Polling; Mock-Fallback

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
  distanz_erledigt_km: number;
  status: StoppStatus;
  bewertung: number | null;
  trinkgeld_prognose: number;
  trinkgeld_ist: number;
  lat: number;
  lng: number;
  effizienz_ampel: 'gruen' | 'gelb' | 'rot';
  kunden_kommentar: string | null;
  rentabilitaet_score: number;
  zeitkonto_min: number;
}

interface TourData {
  tour_id: string;
  stopps: TourStopp[];
  gesamt_verdienst: number;
  trinkgeld_gesamt: number;
  trinkgeld_prognose_gesamt: number;
  trinkgeld_hochrechnung: number;
  km_gesamt: number;
  km_erledigt: number;
  effizienz_score: number;
  eta_schicht_ende: string;
  fleet_sync_score: number;
  schicht_auslastung: number;
  kundenzufriedenheit_avg: number;
}

const MOCK: TourData = {
  tour_id: 'T-2062',
  effizienz_score: 93,
  fleet_sync_score: 89,
  schicht_auslastung: 84,
  kundenzufriedenheit_avg: 4.8,
  gesamt_verdienst: 101.20,
  trinkgeld_gesamt: 11.00,
  trinkgeld_prognose_gesamt: 18.50,
  trinkgeld_hochrechnung: 24.00,
  km_gesamt: 11.2,
  km_erledigt: 4.1,
  eta_schicht_ende: '21:30',
  stopps: [
    { nr: 1, adresse: 'Hauptstraße 12, Aachen',  name: 'Maria S.', tel: '+49 241 12345', notiz: '',                      betrag: 24.50, bezahlt: true,  eta_min: 0,  distanz_km: 0,   distanz_erledigt_km: 1.4, status: 'geliefert', bewertung: 5,    trinkgeld_prognose: 3.5, trinkgeld_ist: 4.0, lat: 50.7753, lng: 6.0839, effizienz_ampel: 'gruen', kunden_kommentar: 'Blitzschnell!', rentabilitaet_score: 96, zeitkonto_min: 0  },
    { nr: 2, adresse: 'Marktplatz 3, Aachen',    name: 'Klaus B.', tel: '+49 241 23456', notiz: 'Klingel defekt',         betrag: 19.80, bezahlt: false, eta_min: 2,  distanz_km: 0.8, distanz_erledigt_km: 0.6, status: 'aktiv',     bewertung: null, trinkgeld_prognose: 2.5, trinkgeld_ist: 0,   lat: 50.7760, lng: 6.0850, effizienz_ampel: 'gruen', kunden_kommentar: null,           rentabilitaet_score: 88, zeitkonto_min: 2  },
    { nr: 3, adresse: 'Ringstraße 47, Aachen',   name: 'Anna H.',  tel: '+49 241 34567', notiz: '2. OG rechts',           betrag: 33.20, bezahlt: true,  eta_min: 13, distanz_km: 2.3, distanz_erledigt_km: 0,   status: 'ausstehend',bewertung: null, trinkgeld_prognose: 4.5, trinkgeld_ist: 0,   lat: 50.7740, lng: 6.0870, effizienz_ampel: 'gelb',  kunden_kommentar: null,           rentabilitaet_score: 79, zeitkonto_min: 3  },
    { nr: 4, adresse: 'Bahnhofstraße 8, Aachen', name: 'Tom K.',   tel: '+49 241 45678', notiz: '',                       betrag: 16.60, bezahlt: true,  eta_min: 22, distanz_km: 3.8, distanz_erledigt_km: 0,   status: 'ausstehend',bewertung: null, trinkgeld_prognose: 2.0, trinkgeld_ist: 0,   lat: 50.7720, lng: 6.0820, effizienz_ampel: 'gruen', kunden_kommentar: null,           rentabilitaet_score: 84, zeitkonto_min: 4  },
    { nr: 5, adresse: 'Lindenweg 22, Aachen',    name: 'Eva M.',   tel: '+49 241 56789', notiz: 'Hintere Einfahrt nutzen',betrag: 22.10, bezahlt: true,  eta_min: 32, distanz_km: 5.1, distanz_erledigt_km: 0,   status: 'ausstehend',bewertung: null, trinkgeld_prognose: 3.0, trinkgeld_ist: 0,   lat: 50.7710, lng: 6.0900, effizienz_ampel: 'rot',   kunden_kommentar: null,           rentabilitaet_score: 65, zeitkonto_min: 5  },
  ],
};

const STATUS_STYLE: Record<StoppStatus, { border: string; dot: string; label: string }> = {
  geliefert:   { border: 'border-emerald-200 bg-emerald-50',  dot: 'bg-emerald-500',               label: 'Geliefert' },
  aktiv:       { border: 'border-blue-300 bg-blue-50',        dot: 'bg-blue-500 animate-pulse',    label: 'Aktiv'     },
  ausstehend:  { border: 'border-border bg-white',            dot: 'bg-muted-foreground/30',        label: 'Offen'     },
};

const AMPEL_COLOR: Record<string, string> = {
  gruen: 'bg-emerald-500',
  gelb:  'bg-amber-400',
  rot:   'bg-red-500',
};

export function FahrerPhase5062TourStoppSmartNavV17({ driverId }: { driverId?: string | null }) {
  const [data, setData]        = useState<TourData | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set([2]));

  async function fetchData() {
    try {
      const params = driverId ? `?driverId=${driverId}` : '';
      const r = await fetch(`/api/delivery/fahrer/tour${params}`, { cache: 'no-store' });
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
  const distanzPct    = Math.min(100, Math.round((d.km_erledigt / d.km_gesamt) * 100));
  const stoppsGesamt  = d.stopps.length;
  const stoppsErledigt = d.stopps.filter((s) => s.status === 'geliefert').length;

  function toggle(nr: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(nr) ? next.delete(nr) : next.add(nr);
      return next;
    });
  }

  return (
    <div className="rounded-2xl border border-blue-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-700 text-white">
        <div className="flex items-center gap-2">
          <Route className="h-5 w-5 text-blue-200" />
          <span className="font-bold text-sm">Tour-Navigator V17</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-lg font-black text-blue-100">{stoppsErledigt}/{stoppsGesamt}</div>
            <div className="text-[10px] opacity-70">Stopps</div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* KPI Strip (5 KPIs) */}
        <div className="grid grid-cols-5 gap-1.5">
          <div className="rounded-xl border border-border bg-muted/20 p-2 text-center">
            <div className={`text-sm font-black ${d.effizienz_score >= 85 ? 'text-emerald-600' : d.effizienz_score >= 70 ? 'text-amber-600' : 'text-red-600'}`}>{d.effizienz_score}%</div>
            <div className="text-[9px] text-muted-foreground">Effizienz</div>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-2 text-center">
            <div className={`text-sm font-black ${d.schicht_auslastung >= 75 ? 'text-emerald-600' : 'text-amber-600'}`}>{d.schicht_auslastung}%</div>
            <div className="text-[9px] text-muted-foreground">Auslastung</div>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-2 text-center">
            <div className="text-sm font-black text-indigo-600">{d.fleet_sync_score}%</div>
            <div className="text-[9px] text-muted-foreground">Fleet-Sync</div>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-2 text-center">
            <div className="text-sm font-black text-amber-600">★{d.kundenzufriedenheit_avg}</div>
            <div className="text-[9px] text-muted-foreground">Kunden</div>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-2 text-center">
            <div className="text-sm font-black text-emerald-600">{d.trinkgeld_gesamt.toFixed(2)} €</div>
            <div className="text-[9px] text-muted-foreground">Trinkgeld</div>
          </div>
        </div>

        {/* Distanz-Fortschritt + Schicht-Auslastung */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Activity className="h-3.5 w-3.5 text-indigo-600" />
              <span className="text-xs font-semibold text-indigo-800">Distanz</span>
              <span className="ml-auto text-xs font-black text-indigo-700">{d.km_erledigt}/{d.km_gesamt} km</span>
            </div>
            <div className="h-2.5 rounded-full bg-indigo-200">
              <div className="h-2.5 rounded-full bg-indigo-600 transition-all" style={{ width: `${distanzPct}%` }} />
            </div>
            <div className="text-[10px] text-indigo-600 mt-1">{distanzPct}% — {(d.km_gesamt - d.km_erledigt).toFixed(1)} km offen</div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Award className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-800">Auslastung</span>
              <span className="ml-auto text-xs font-black text-emerald-700">{d.schicht_auslastung}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-emerald-200">
              <div className="h-2.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${d.schicht_auslastung}%` }} />
            </div>
            <div className="text-[10px] text-emerald-600 mt-1">Schicht-Aktivzeit · Ziel ≥75%</div>
          </div>
        </div>

        {/* Trinkgeld-Hochrechnung */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-center">
            <Euro className="h-3.5 w-3.5 text-emerald-600 mx-auto mb-0.5" />
            <div className="text-sm font-black text-emerald-700">{d.trinkgeld_gesamt.toFixed(2)} €</div>
            <div className="text-[10px] text-muted-foreground">Trinkgeld ist</div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-center">
            <Target className="h-3.5 w-3.5 text-amber-600 mx-auto mb-0.5" />
            <div className="text-sm font-black text-amber-700">{d.trinkgeld_prognose_gesamt.toFixed(2)} €</div>
            <div className="text-[10px] text-muted-foreground">Prognose</div>
          </div>
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-2.5 text-center">
            <TrendingUp className="h-3.5 w-3.5 text-violet-600 mx-auto mb-0.5" />
            <div className="text-sm font-black text-violet-700">{d.trinkgeld_hochrechnung.toFixed(2)} €</div>
            <div className="text-[10px] text-muted-foreground">Hochrechnung</div>
          </div>
        </div>

        {/* Stopp-Liste */}
        <div className="space-y-2">
          <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />Tour-Stopps
          </div>
          {d.stopps.map((s) => {
            const st = STATUS_STYLE[s.status];
            const isOpen = expanded.has(s.nr);
            const stopDistPct = s.distanz_km > 0 ? Math.min(100, Math.round((s.distanz_erledigt_km / s.distanz_km) * 100)) : 100;
            return (
              <div key={s.nr} className={`rounded-xl border ${st.border} overflow-hidden`}>
                <button className="w-full flex items-start gap-3 px-3 py-2.5 text-left" onClick={() => toggle(s.nr)}>
                  <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                    <span className={`h-3 w-3 rounded-full ${st.dot}`} />
                    <span className="text-[10px] font-bold text-muted-foreground">#{s.nr}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground truncate">{s.adresse}</span>
                      <span className={`h-2 w-2 rounded-full shrink-0 ${AMPEL_COLOR[s.effizienz_ampel]}`} />
                    </div>
                    <div className="text-[10px] text-muted-foreground">{s.name}</div>
                    {s.notiz && <div className="text-[10px] text-amber-700 font-medium">{s.notiz}</div>}
                    {s.kunden_kommentar && s.status === 'geliefert' && (
                      <div className="text-[10px] text-emerald-700 italic">„{s.kunden_kommentar}"</div>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-semibold ${s.rentabilitaet_score >= 80 ? 'text-emerald-600' : s.rentabilitaet_score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                        ROI {s.rentabilitaet_score}%
                      </span>
                      {s.zeitkonto_min > 0 && (
                        <span className="text-[10px] text-indigo-600 flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />{s.zeitkonto_min} min
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.status === 'aktiv' && (
                      <div className="text-right">
                        <div className="text-base font-black text-blue-600">{s.eta_min} min</div>
                        <div className="text-[10px] text-muted-foreground">ETA</div>
                      </div>
                    )}
                    {s.status === 'geliefert' && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                    {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {s.distanz_km > 0 && s.status !== 'geliefert' && (
                  <div className="px-3 pb-1.5">
                    <div className="h-1 rounded-full bg-muted">
                      <div className={`h-1 rounded-full ${s.status === 'aktiv' ? 'bg-blue-500' : 'bg-muted-foreground/30'}`} style={{ width: `${stopDistPct}%` }} />
                    </div>
                    <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                      <span>{s.distanz_erledigt_km.toFixed(1)} km</span>
                      <span>{s.distanz_km} km</span>
                    </div>
                  </div>
                )}

                {isOpen && (
                  <div className="border-t border-border bg-white/60 px-3 py-2 space-y-2">
                    <div className="flex items-center gap-3">
                      <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-black text-foreground">{s.betrag.toFixed(2)} €</span>
                      <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${s.bezahlt ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {s.bezahlt ? 'Bezahlt' : 'Bar kassieren'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Star className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span className="text-muted-foreground">Trinkgeld:</span>
                      <span className="font-semibold text-foreground">
                        {s.trinkgeld_ist > 0 ? `${s.trinkgeld_ist.toFixed(2)} €` : `~${s.trinkgeld_prognose.toFixed(2)} € Prognose`}
                      </span>
                      {s.bewertung && <span className="ml-auto text-amber-500 font-bold">★{s.bewertung}</span>}
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={`tel:${s.tel}`}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/20 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Phone className="h-3.5 w-3.5" />Anrufen
                      </a>
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(s.adresse)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Navigation className="h-3.5 w-3.5" />Navigation
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-amber-500" />{d.gesamt_verdienst.toFixed(2)} € Gesamtverdienst</span>
          <span className="flex items-center gap-1"><ChevronRight className="h-3 w-3" />20 Sek Polling</span>
        </div>
      </div>
    </div>
  );
}
