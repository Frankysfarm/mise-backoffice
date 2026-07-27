'use client';

import { useState, useEffect, useCallback } from 'react';
import { Route, MapPin, Clock, Package, CheckCircle2, Loader2 } from 'lucide-react';

interface TourStopp { stopp_nr: number; adresse: string; status: 'angefahren' | 'geliefert' | 'ausstehend'; eta_min: number | null; delay_min: number; }
interface TourRow { tour_id: string; fahrer_name: string; stopps: TourStopp[]; start_zeit: string; eta_ende: string; abgeschlossen: number; gesamt: number; effizienz_score: number; }
interface ApiData { touren: TourRow[]; aktive_touren: number; gesamt_stopps: number; geliefert_pct: number; avg_effizienz: number; }

const MOCK: ApiData = {
  aktive_touren: 3,
  gesamt_stopps: 14,
  geliefert_pct: 64,
  avg_effizienz: 82,
  touren: [
    {
      tour_id: 't1', fahrer_name: 'Max M.', abgeschlossen: 3, gesamt: 5, effizienz_score: 91, start_zeit: new Date(Date.now() - 35 * 60_000).toISOString(), eta_ende: new Date(Date.now() + 20 * 60_000).toISOString(),
      stopps: [
        { stopp_nr: 1, adresse: 'Aachener Str. 12', status: 'geliefert', eta_min: null, delay_min: 0 },
        { stopp_nr: 2, adresse: 'Hauptmarkt 5', status: 'geliefert', eta_min: null, delay_min: 2 },
        { stopp_nr: 3, adresse: 'Burtscheider Markt 3', status: 'geliefert', eta_min: null, delay_min: 0 },
        { stopp_nr: 4, adresse: 'Jülicher Str. 77', status: 'angefahren', eta_min: 6, delay_min: 0 },
        { stopp_nr: 5, adresse: 'Alexianergraben 2', status: 'ausstehend', eta_min: 18, delay_min: 0 },
      ],
    },
    {
      tour_id: 't2', fahrer_name: 'Julia F.', abgeschlossen: 2, gesamt: 4, effizienz_score: 85, start_zeit: new Date(Date.now() - 22 * 60_000).toISOString(), eta_ende: new Date(Date.now() + 30 * 60_000).toISOString(),
      stopps: [
        { stopp_nr: 1, adresse: 'Ponttor Pl. 1', status: 'geliefert', eta_min: null, delay_min: 0 },
        { stopp_nr: 2, adresse: 'Kaiserplatz 8', status: 'geliefert', eta_min: null, delay_min: 4 },
        { stopp_nr: 3, adresse: 'Elisengarten 3', status: 'angefahren', eta_min: 9, delay_min: 3 },
        { stopp_nr: 4, adresse: 'Dom-Platz 1', status: 'ausstehend', eta_min: 24, delay_min: 0 },
      ],
    },
  ],
};

interface Props { locationId: string | null; }

export function DispatchPhase4112TourVisualisierungsBoard({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>('t1');

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/tour-visualisierung?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 15_000); return () => clearInterval(id); }, [load]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-900">Tour-Visualisierung</span>
        </div>
        {loading && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {[
          { label: 'Aktiv', value: data.aktive_touren, color: 'text-blue-600' },
          { label: 'Stopps', value: data.gesamt_stopps, color: 'text-gray-700' },
          { label: 'Geliefert', value: `${data.geliefert_pct}%`, color: 'text-emerald-600' },
          { label: 'Effizienz', value: `${data.avg_effizienz}`, color: data.avg_effizienz >= 80 ? 'text-emerald-600' : 'text-yellow-500' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-gray-50 rounded-lg p-1.5 text-center">
            <div className={`text-sm font-bold ${kpi.color}`}>{kpi.value}</div>
            <div className="text-[9px] text-gray-400">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {data.touren.map((tour) => {
          const isExpanded = expanded === tour.tour_id;
          const pct = Math.round((tour.abgeschlossen / tour.gesamt) * 100);
          const scoreColor = tour.effizienz_score >= 85 ? 'text-emerald-600' : tour.effizienz_score >= 70 ? 'text-yellow-500' : 'text-red-500';
          const barColor = tour.effizienz_score >= 85 ? 'bg-emerald-400' : tour.effizienz_score >= 70 ? 'bg-yellow-400' : 'bg-red-400';

          return (
            <div key={tour.tour_id} className="border border-gray-200 rounded-lg overflow-hidden">
              <button onClick={() => setExpanded(isExpanded ? null : tour.tour_id)} className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 transition-colors">
                <Route className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-gray-800 flex-1 text-left">{tour.fahrer_name}</span>
                <span className="text-[10px] text-gray-500">{tour.abgeschlossen}/{tour.gesamt} Stopps</span>
                <span className={`text-[10px] font-bold ${scoreColor}`}>{tour.effizienz_score}</span>
              </button>
              <div className="px-2 pb-1">
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%`, transition: 'width 0.4s ease' }} />
                </div>
              </div>
              {isExpanded && (
                <div className="px-2 pb-2 space-y-1 border-t border-gray-100 pt-1.5">
                  {tour.stopps.map((stopp) => {
                    const icon = stopp.status === 'geliefert' ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : stopp.status === 'angefahren' ? <Loader2 className="w-3 h-3 text-blue-500 animate-spin" /> : <Package className="w-3 h-3 text-gray-300" />;
                    return (
                      <div key={stopp.stopp_nr} className="flex items-center gap-1.5">
                        <span className="text-[9px] text-gray-400 w-3">{stopp.stopp_nr}.</span>
                        {icon}
                        <span className="text-[10px] text-gray-700 flex-1 truncate">{stopp.adresse}</span>
                        {stopp.eta_min !== null && <span className="text-[9px] text-blue-500 flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{stopp.eta_min}min</span>}
                        {stopp.delay_min > 0 && <span className="text-[9px] text-red-500">+{stopp.delay_min}min</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-[9px] text-gray-400 text-center border-t border-gray-100 pt-1">
        15-Sek-Polling · Live-Tour-Tracking · Stopp-by-Stopp
      </div>
    </div>
  );
}
