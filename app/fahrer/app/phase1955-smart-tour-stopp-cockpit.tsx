'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  MapPin, Navigation, Clock, CheckCircle2, AlertTriangle, Zap, Package, Phone,
  ChevronRight, TrendingUp, Star, Route,
} from 'lucide-react';

// Phase 1955 — Smart Tour-Stopp Cockpit
// Zeigt alle Stopps der aktiven Tour mit Countdown-ETA, Navigations-CTA und Pünktlichkeits-Ampel
// Mobile-first; 15-Sek-Polling; Mock-Fallback

interface TourStop {
  id: string;
  reihenfolge: number;
  status: 'fertig' | 'aktiv' | 'ausstehend' | 'verspaetet';
  kunde_name: string;
  kunde_adresse: string;
  kunde_plz: string;
  bestellnummer: string;
  betrag: number;
  eta_min: number | null;
  notiz: string | null;
  telefon: string | null;
  bewertung: number | null;
}

interface TourKpi {
  gesamt_stopps: number;
  fertig_stopps: number;
  naechste_eta_min: number | null;
  tour_score: number;
  puenktlichkeit_pct: number;
  verbleibende_km: number;
}

interface ApiData {
  stopps: TourStop[];
  kpi: TourKpi;
  alert: string | null;
}

const MOCK: ApiData = {
  kpi: { gesamt_stopps: 3, fertig_stopps: 1, naechste_eta_min: 4, tour_score: 88, puenktlichkeit_pct: 92, verbleibende_km: 3.2 },
  alert: null,
  stopps: [
    { id: '1', reihenfolge: 1, status: 'fertig',      kunde_name: 'Maria S.',   kunde_adresse: 'Hauptstr. 12', kunde_plz: '52066', bestellnummer: '#1041', betrag: 28.50, eta_min: null, notiz: null, telefon: null, bewertung: 5 },
    { id: '2', reihenfolge: 2, status: 'aktiv',       kunde_name: 'Jonas K.',   kunde_adresse: 'Blumenweg 5',  kunde_plz: '52068', bestellnummer: '#1042', betrag: 34.90, eta_min: 4,    notiz: '2. Etage, bitte klingeln', telefon: '+49123456789', bewertung: null },
    { id: '3', reihenfolge: 3, status: 'ausstehend',  kunde_name: 'Lena B.',    kunde_adresse: 'Parkstr. 21',  kunde_plz: '52070', bestellnummer: '#1043', betrag: 19.80, eta_min: 18,   notiz: null, telefon: null, bewertung: null },
  ],
};

const STATUS_CONFIG: Record<TourStop['status'], { label: string; dot: string; card: string; border: string }> = {
  fertig:     { label: 'Geliefert', dot: 'bg-matcha-500',      card: 'bg-matcha-50',   border: 'border-matcha-200' },
  aktiv:      { label: 'Jetzt',     dot: 'bg-indigo-500 animate-pulse', card: 'bg-indigo-50',   border: 'border-indigo-400' },
  ausstehend: { label: 'Kommt',     dot: 'bg-muted-foreground/40',       card: 'bg-muted/20',    border: 'border-border' },
  verspaetet: { label: 'Verspätet', dot: 'bg-red-500 animate-pulse',    card: 'bg-red-50',      border: 'border-red-300' },
};

function openNav(adresse: string, plz: string) {
  const query = encodeURIComponent(`${adresse}, ${plz}`);
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) {
    window.open(`maps://maps.apple.com/?daddr=${query}`, '_blank');
  } else {
    window.open(`https://maps.google.com/?daddr=${query}`, '_blank');
  }
}

export function FahrerPhase1955SmartTourStoppCockpit({ driverId }: { driverId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    try {
      const params = driverId ? `?driverId=${driverId}` : '';
      const r = await fetch(`/api/delivery/tours${params}`, { cache: 'no-store' });
      if (!r.ok) throw new Error('api');
      setData(await r.json());
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 15_000);
    return () => clearInterval(t);
  }, [driverId]);

  const d = data ?? MOCK;
  const kpi = d.kpi;
  const donePct = kpi.gesamt_stopps > 0 ? Math.round((kpi.fertig_stopps / kpi.gesamt_stopps) * 100) : 0;

  return (
    <div className="rounded-2xl border border-indigo-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-indigo-700 text-white">
        <div className="flex items-center gap-2">
          <Route className="h-5 w-5 text-indigo-200" />
          <span className="font-bold text-sm">Tour-Stopps</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="opacity-80">{kpi.fertig_stopps}/{kpi.gesamt_stopps} Stopps</span>
          <span className={`rounded-full px-2 py-0.5 font-bold ${kpi.tour_score >= 85 ? 'bg-green-500' : kpi.tour_score >= 70 ? 'bg-amber-400 text-black' : 'bg-red-500'}`}>
            Score {kpi.tour_score}
          </span>
        </div>
      </div>

      {d.alert && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-xs font-medium">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {d.alert}
        </div>
      )}

      {/* Tour Progress Bar */}
      <div className="px-4 py-3 border-b border-border bg-muted/20">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
          <span>Tour-Fortschritt</span>
          <span>{donePct}% · {kpi.verbleibende_km} km verbleibend</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-2 rounded-full bg-indigo-500 transition-all" style={{ width: `${donePct}%` }} />
        </div>
        {kpi.naechste_eta_min != null && (
          <div className="flex items-center gap-1 mt-1.5 text-xs font-semibold text-indigo-700">
            <Clock className="h-3.5 w-3.5" />
            Nächster Stopp in <strong>{kpi.naechste_eta_min} Min</strong>
          </div>
        )}
      </div>

      {/* Stop Cards */}
      {loading ? (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground animate-pulse">Lade Tour…</div>
      ) : (
        <div className="p-3 space-y-2">
          {d.stopps.map((stop) => {
            const cfg = STATUS_CONFIG[stop.status];
            const isActive = stop.status === 'aktiv';
            const isDone = stop.status === 'fertig';
            return (
              <div key={stop.id} className={`rounded-xl border-2 p-3 ${cfg.card} ${cfg.border}`}>
                <div className="flex items-start gap-3">
                  {/* Step indicator */}
                  <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
                    <div className={`h-4 w-4 rounded-full ${cfg.dot} flex items-center justify-center`}>
                      {isDone && <CheckCircle2 className="h-3 w-3 text-white" />}
                    </div>
                    <span className="text-[10px] text-muted-foreground font-bold">{stop.reihenfolge}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm truncate">{stop.kunde_name}</span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                            stop.status === 'aktiv' ? 'bg-indigo-500 text-white' :
                            stop.status === 'fertig' ? 'bg-matcha-500 text-white' :
                            stop.status === 'verspaetet' ? 'bg-red-500 text-white' :
                            'bg-muted text-muted-foreground'}`}>{cfg.label}</span>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {stop.kunde_adresse}, {stop.kunde_plz}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {stop.eta_min != null && !isDone && (
                          <div className={`flex items-center gap-0.5 font-bold text-sm ${stop.eta_min <= 5 ? 'text-orange-600' : 'text-foreground'}`}>
                            <Clock className="h-3.5 w-3.5" />{stop.eta_min}m
                          </div>
                        )}
                        {isDone && stop.bewertung != null && (
                          <div className="flex items-center gap-0.5 text-amber-500 font-bold text-sm">
                            <Star className="h-3.5 w-3.5 fill-current" />{stop.bewertung}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">{stop.betrag.toFixed(2)} €</div>
                      </div>
                    </div>

                    {stop.notiz && (
                      <div className="mt-1.5 text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1 border border-amber-200">
                        📝 {stop.notiz}
                      </div>
                    )}

                    {isActive && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => openNav(stop.kunde_adresse, stop.kunde_plz)}
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 text-white py-2 text-xs font-bold hover:bg-indigo-700 active:scale-95 transition"
                        >
                          <Navigation className="h-3.5 w-3.5" />
                          Navigation
                        </button>
                        {stop.telefon && (
                          <a
                            href={`tel:${stop.telefon}`}
                            className="flex items-center justify-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs font-bold hover:bg-muted/70 transition"
                          >
                            <Phone className="h-3.5 w-3.5" />
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
      )}
    </div>
  );
}
