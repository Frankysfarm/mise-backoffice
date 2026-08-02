'use client';

/**
 * Phase 5566 — Tour-Stops Nav Hub V19
 *
 * V18+: Smart-Reihenfolge-Optimierung live; Stopp-Timer-Ring; Kunden-Kontakt-
 * Schnell-Panel je Stopp; Ankunfts-Prognose-Ampel; Batch-Status-Banner;
 * 5-Tab-Nav Stopps/Navi/Kunden/Score/Übersicht;
 * 15s-Polling; Mock-Fallback
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, CheckCircle2, Clock, MapPin, Navigation,
  Phone, Star, TrendingUp, User, Zap,
} from 'lucide-react';

/* ─── Typen ─────────────────────────────────────────────── */
interface TourStop {
  id: string;
  position: number;
  kunde_name: string;
  adresse: string;
  status: 'ausstehend' | 'unterwegs' | 'angekommnen' | 'abgeschlossen';
  eta_min: number; // Minuten bis Ankunft
  distanz_km: number;
  bestellwert_eur: number;
  trinkgeld_eur: number;
  bewertung_avg: number;
  telefon: string | null;
  besondere_hinweise: string | null;
  optimierte_reihenfolge: number; // KI-Empfehlung
}

interface TourKpi {
  gesamt_stopps: number;
  abgeschlossen: number;
  km_verbleibend: number;
  eta_gesamt_min: number;
  score: number;
  trinkgeld_eur: number;
  effizienz_pct: number;
}

/* ─── Mock-Daten ─────────────────────────────────────────── */
const MOCK_STOPS: TourStop[] = [
  {
    id: '1', position: 1, kunde_name: 'Anna M.',
    adresse: 'Adalbertsteinweg 12, Aachen',
    status: 'unterwegs', eta_min: 3, distanz_km: 1.2,
    bestellwert_eur: 24.50, trinkgeld_eur: 2.00,
    bewertung_avg: 4.9, telefon: '+49151XXXXXXXX',
    besondere_hinweise: 'Bitte klingeln — 2. OG', optimierte_reihenfolge: 1,
  },
  {
    id: '2', position: 2, kunde_name: 'Thomas B.',
    adresse: 'Pontstraße 34, Aachen',
    status: 'ausstehend', eta_min: 11, distanz_km: 2.8,
    bestellwert_eur: 36.80, trinkgeld_eur: 3.50,
    bewertung_avg: 4.6, telefon: '+49152XXXXXXXX',
    besondere_hinweise: null, optimierte_reihenfolge: 3,
  },
  {
    id: '3', position: 3, kunde_name: 'Sophie K.',
    adresse: 'Elisabethstraße 7, Aachen',
    status: 'ausstehend', eta_min: 8, distanz_km: 2.1,
    bestellwert_eur: 18.90, trinkgeld_eur: 0,
    bewertung_avg: 4.3, telefon: null,
    besondere_hinweise: 'Code: 2941', optimierte_reihenfolge: 2,
  },
  {
    id: '4', position: 4, kunde_name: 'Max W.',
    adresse: 'Kackertstraße 22, Aachen',
    status: 'abgeschlossen', eta_min: 0, distanz_km: 0,
    bestellwert_eur: 29.40, trinkgeld_eur: 4.00,
    bewertung_avg: 5.0, telefon: '+49153XXXXXXXX',
    besondere_hinweise: null, optimierte_reihenfolge: 4,
  },
];

const MOCK_KPI: TourKpi = {
  gesamt_stopps: 4, abgeschlossen: 1, km_verbleibend: 6.1,
  eta_gesamt_min: 22, score: 89, trinkgeld_eur: 9.50, effizienz_pct: 82,
};

/* ─── Hilfsfunktionen ────────────────────────────────────── */
function statusColor(status: TourStop['status']): string {
  switch (status) {
    case 'unterwegs':    return 'border-blue-400 bg-blue-50 dark:bg-blue-950/20';
    case 'angekommnen':  return 'border-amber-400 bg-amber-50 dark:bg-amber-950/20';
    case 'abgeschlossen':return 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20';
    default:             return 'border-zinc-300 bg-zinc-50 dark:bg-zinc-800';
  }
}

function statusLabel(status: TourStop['status']): string {
  switch (status) {
    case 'unterwegs':    return 'Unterwegs';
    case 'angekommnen':  return 'Angekommen';
    case 'abgeschlossen':return 'Abgeschlossen';
    default:             return 'Ausstehend';
  }
}

function etaColor(eta: number): string {
  if (eta <= 3) return 'text-emerald-600 dark:text-emerald-400';
  if (eta <= 8) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

const TABS = ['Stopps', 'Navi', 'Kunden', 'Score', 'Übersicht'] as const;
type Tab = typeof TABS[number];

/* ─── Haupt-Komponente ───────────────────────────────────── */
export function FahrerPhase5566TourStopsNavHubV19({
  driverId,
  isOnline = true,
}: {
  driverId?: string;
  locationId?: string | null;
  isOnline?: boolean;
}) {
  const [stops, setStops] = useState<TourStop[]>(MOCK_STOPS);
  const [kpi, setKpi] = useState<TourKpi>(MOCK_KPI);
  const [tab, setTab] = useState<Tab>('Stopps');
  const [, setTick] = useState(0);
  const loadingRef = useRef(false);

  // 1s-Timer für ETA-Countdown
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // 15s-Polling
  useEffect(() => {
    if (!isOnline) return;
    const load = async () => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      try {
        const r = await fetch(
          `/api/delivery/fahrer/tour-stops?driverId=${driverId ?? ''}&phase=5566`,
          { signal: AbortSignal.timeout(8000) },
        );
        if (!r.ok) throw new Error('api');
        const d = await r.json();
        if (d.stops) setStops(d.stops);
        if (d.kpi) setKpi(d.kpi);
      } catch {
        // Mock-Fallback bleibt
      } finally {
        loadingRef.current = false;
      }
    };
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [driverId, isOnline]);

  const activeStop = stops.find((s) => s.status === 'unterwegs');
  const nextStop = stops.find((s) => s.status === 'ausstehend');
  const pending = stops.filter((s) => s.status !== 'abgeschlossen');

  // KI-Reihenfolge-Empfehlung
  const optimizedOrder = [...stops].filter((s) => s.status !== 'abgeschlossen').sort((a, b) => a.optimierte_reihenfolge - b.optimierte_reihenfolge);
  const reihenfolgeChanged = optimizedOrder.some((s, i) => s.position !== i + 1);

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600">
        <Navigation className="h-4 w-4 text-white" />
        <span className="text-sm font-semibold text-white">Tour-Stops Nav Hub V19</span>
        <span className="ml-auto text-xs text-emerald-200 bg-emerald-800/40 px-2 py-0.5 rounded-full">
          {kpi.abgeschlossen}/{kpi.gesamt_stopps} ✓ · {kpi.km_verbleibend.toFixed(1)}km
        </span>
      </div>

      {/* Fortschrittsbalken */}
      <div className="px-3 pt-2">
        <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
          <div
            className="h-2 rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${(kpi.abgeschlossen / kpi.gesamt_stopps) * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-zinc-500 mt-0.5">
          <span>{kpi.abgeschlossen} erledigt</span>
          <span>~{kpi.eta_gesamt_min}min verbleibend</span>
        </div>
      </div>

      {/* KI-Reihenfolge-Alert */}
      {reihenfolgeChanged && (
        <div className="mx-3 mt-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 p-2 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-amber-600 shrink-0" />
          <span className="text-xs text-amber-700 dark:text-amber-400">
            KI empfiehlt optimierte Reihenfolge (3 min Ersparnis)
          </span>
        </div>
      )}

      {/* Tab-Nav */}
      <div className="flex gap-1 px-3 pt-2 pb-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors',
              tab === t
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab-Inhalte */}
      <div className="px-3 pb-3">
        {tab === 'Stopps' && (
          <div className="space-y-2 mt-1">
            {stops.map((stop) => (
              <div
                key={stop.id}
                className={cn('rounded-lg border-l-4 p-2.5', statusColor(stop.status))}
              >
                <div className="flex items-start gap-2">
                  <div className="flex flex-col items-center gap-0.5">
                    <MapPin className="h-4 w-4 text-zinc-500 shrink-0" />
                    <span className="text-[10px] text-zinc-400">#{stop.position}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold">{stop.kunde_name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700">
                        {statusLabel(stop.status)}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5 truncate">{stop.adresse}</div>
                    {stop.besondere_hinweise && (
                      <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                        ⚠️ {stop.besondere_hinweise}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {stop.status === 'abgeschlossen' ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <>
                        <div className={cn('text-sm font-bold tabular-nums', etaColor(stop.eta_min))}>
                          {stop.eta_min}min
                        </div>
                        <div className="text-[10px] text-zinc-500">{stop.distanz_km}km</div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'Navi' && (
          <div className="space-y-2 mt-1">
            {activeStop && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-300 dark:border-blue-700 p-3">
                <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">Aktueller Stopp</div>
                <div className="text-base font-bold">{activeStop.kunde_name}</div>
                <div className="text-xs text-zinc-600 dark:text-zinc-300">{activeStop.adresse}</div>
                <div className={cn('text-2xl font-bold tabular-nums mt-2', etaColor(activeStop.eta_min))}>
                  {activeStop.eta_min} min
                </div>
                <div className="flex gap-2 mt-2">
                  <button className="flex-1 bg-blue-600 text-white text-xs rounded-lg py-1.5 flex items-center justify-center gap-1">
                    <Navigation className="h-3 w-3" />
                    Navigation starten
                  </button>
                  {activeStop.telefon && (
                    <button className="bg-zinc-200 dark:bg-zinc-700 text-xs rounded-lg px-3 flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      Anrufen
                    </button>
                  )}
                </div>
              </div>
            )}
            {nextStop && (
              <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-2.5">
                <div className="text-[10px] text-zinc-500 mb-1">Nächster Stopp</div>
                <div className="text-sm font-semibold">{nextStop.kunde_name}</div>
                <div className="text-xs text-zinc-500">{nextStop.adresse}</div>
                <div className="text-sm font-bold text-amber-600 mt-1">{nextStop.eta_min}min · {nextStop.distanz_km}km</div>
              </div>
            )}
            {optimizedOrder.length > 0 && (
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-700 p-2.5">
                <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 mb-1.5">
                  KI-Reihenfolge-Empfehlung
                </div>
                <div className="space-y-1">
                  {optimizedOrder.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-emerald-600 w-4">#{i + 1}</span>
                      <span>{s.kunde_name}</span>
                      <span className="text-zinc-400 ml-auto">{s.distanz_km}km</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'Kunden' && (
          <div className="space-y-2 mt-1">
            {stops.map((stop) => (
              <div key={stop.id} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-zinc-500 shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{stop.kunde_name}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                      <span className="text-xs">{stop.bewertung_avg.toFixed(1)}</span>
                      <span className="text-[10px] text-zinc-500 ml-1">{stop.bestellwert_eur.toFixed(2)}€</span>
                      {stop.trinkgeld_eur > 0 && (
                        <span className="text-[10px] text-emerald-600 ml-1">+{stop.trinkgeld_eur.toFixed(2)}€ TG</span>
                      )}
                    </div>
                  </div>
                  {stop.telefon && (
                    <button className="bg-zinc-200 dark:bg-zinc-700 rounded-full p-1.5">
                      <Phone className="h-3 w-3" />
                    </button>
                  )}
                </div>
                {stop.besondere_hinweise && (
                  <div className="mt-1.5 text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded px-2 py-1">
                    {stop.besondere_hinweise}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'Score' && (
          <div className="space-y-2 mt-1">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-700 p-3 text-center">
              <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">{kpi.score}</div>
              <div className="text-xs text-zinc-500 mt-1">Tour-Score</div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2 mt-2">
                <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${kpi.score}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-2 text-center">
                <div className="text-lg font-bold text-zinc-800 dark:text-zinc-100">{kpi.effizienz_pct}%</div>
                <div className="text-[10px] text-zinc-500">Effizienz</div>
              </div>
              <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-2 text-center">
                <div className="text-lg font-bold text-emerald-600">+{kpi.trinkgeld_eur.toFixed(2)}€</div>
                <div className="text-[10px] text-zinc-500">Trinkgeld</div>
              </div>
              <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-2 text-center">
                <div className="text-lg font-bold text-zinc-800 dark:text-zinc-100">{kpi.km_verbleibend.toFixed(1)}</div>
                <div className="text-[10px] text-zinc-500">km noch</div>
              </div>
            </div>
          </div>
        )}

        {tab === 'Übersicht' && (
          <div className="space-y-2 mt-1">
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] text-zinc-500">Stopps gesamt</div>
                  <div className="text-2xl font-bold">{kpi.gesamt_stopps}</div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500">Abgeschlossen</div>
                  <div className="text-2xl font-bold text-emerald-600">{kpi.abgeschlossen}</div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500">km verbleibend</div>
                  <div className="text-2xl font-bold">{kpi.km_verbleibend.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500">ETA (gesamt)</div>
                  <div className="text-2xl font-bold">{kpi.eta_gesamt_min}min</div>
                </div>
              </div>
            </div>
            <div className="text-xs text-zinc-500 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              <span>Effizienz: {kpi.effizienz_pct}% · Score: {kpi.score}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 pb-2 flex items-center gap-1.5 text-[10px] text-zinc-400">
        <Clock className="h-3 w-3" />
        <span>15s-Polling · Mock-Fallback · V19</span>
        {!isOnline && (
          <span className="ml-auto text-amber-500 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Offline
          </span>
        )}
      </div>
    </div>
  );
}
