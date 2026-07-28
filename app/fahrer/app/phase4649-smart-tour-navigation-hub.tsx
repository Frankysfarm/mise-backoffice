'use client';

import { useEffect, useState } from 'react';
import { Navigation2, MapPin, CheckCircle2, Clock, Package, ChevronRight } from 'lucide-react';

interface StoppRow {
  stopp_nr: number;
  adresse: string;
  kunde_name: string;
  items: number;
  eta_min: number;
  status: 'erledigt' | 'aktuell' | 'offen';
  distanz_m: number;
}

interface ApiData {
  tour_id: string;
  stopps: StoppRow[];
  aktueller_stopp: number;
  tour_eta_total_min: number;
  score: number;
}

const MOCK: ApiData = {
  tour_id: 'tour-42',
  aktueller_stopp: 2,
  tour_eta_total_min: 38,
  score: 84,
  stopps: [
    { stopp_nr: 1, adresse: 'Hauptstr. 12', kunde_name: 'M. Müller', items: 2, eta_min: 0, status: 'erledigt', distanz_m: 0 },
    { stopp_nr: 2, adresse: 'Bahnhofstr. 7', kunde_name: 'S. Schmidt', items: 3, eta_min: 6, status: 'aktuell', distanz_m: 850 },
    { stopp_nr: 3, adresse: 'Gartenweg 3', kunde_name: 'A. Berger', items: 1, eta_min: 18, status: 'offen', distanz_m: 1400 },
    { stopp_nr: 4, adresse: 'Ringstr. 22', kunde_name: 'T. Koch', items: 2, eta_min: 28, status: 'offen', distanz_m: 2100 },
  ],
};

const STATUS_STYLE: Record<string, { bg: string; icon: React.ReactNode; text: string }> = {
  erledigt: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  aktuell: {
    bg: 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-700',
    icon: <Navigation2 className="w-4 h-4 text-indigo-600 animate-pulse" />,
    text: 'text-indigo-700 dark:text-indigo-300',
  },
  offen: {
    bg: 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700',
    icon: <Package className="w-4 h-4 text-gray-400" />,
    text: 'text-gray-600 dark:text-gray-400',
  },
};

export function FahrerPhase4649SmartTourNavigationHub({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const p = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/fahrer/aktuelle-tour${p}`);
        if (!res.ok) throw new Error();
        const json: ApiData = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(MOCK);
      }
    }

    load();
    const iv = setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (!data) return <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 animate-pulse h-72" />;

  const aktuell = data.stopps.find(s => s.status === 'aktuell');
  const scoreColor = data.score >= 85 ? 'text-emerald-600 dark:text-emerald-400' : data.score >= 70 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-gray-900 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Navigation2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Tour-Navigation</h3>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-400">Score</span>
          <span className={`text-lg font-bold ${scoreColor}`}>{data.score}</span>
        </div>
      </div>

      {/* Aktueller Stopp Highlight */}
      {aktuell && (
        <div className="rounded-xl bg-indigo-600 p-4 text-white space-y-2">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span className="text-xs font-medium opacity-80">Jetzt anfahren — Stopp {aktuell.stopp_nr}</span>
          </div>
          <p className="text-lg font-bold">{aktuell.adresse}</p>
          <p className="text-sm opacity-90">{aktuell.kunde_name} · {aktuell.items} Artikel</p>
          <div className="flex items-center gap-2 pt-1">
            <Clock className="w-3.5 h-3.5 opacity-70" />
            <span className="text-sm">~{aktuell.eta_min} min · {(aktuell.distanz_m / 1000).toFixed(1)} km</span>
          </div>
        </div>
      )}

      {/* Tour gesamt ETA */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Clock className="w-3.5 h-3.5" />
        <span>Tour-ETA gesamt: ~{data.tour_eta_total_min} min</span>
        <span className="ml-auto">{data.stopps.filter(s => s.status === 'erledigt').length}/{data.stopps.length} erledigt</span>
      </div>

      {/* Stopp-Liste */}
      <div className="space-y-2">
        {data.stopps.map(s => {
          const style = STATUS_STYLE[s.status];
          return (
            <div key={s.stopp_nr} className={`rounded-xl border ${style.bg} p-3 flex items-center gap-3`}>
              <div className="flex-shrink-0">{style.icon}</div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${style.text}`}>{s.adresse}</p>
                <p className="text-xs text-gray-400 truncate">{s.kunde_name}</p>
              </div>
              <div className="text-right shrink-0">
                {s.status !== 'erledigt' && (
                  <>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">~{s.eta_min} min</p>
                    <p className="text-xs text-gray-400">{(s.distanz_m / 1000).toFixed(1)} km</p>
                  </>
                )}
                {s.status === 'erledigt' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              </div>
              {s.status === 'aktuell' && <ChevronRight className="w-4 h-4 text-indigo-400 shrink-0" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
