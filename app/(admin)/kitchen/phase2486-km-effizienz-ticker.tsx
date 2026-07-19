'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Route } from 'lucide-react';

interface FahrerKm {
  driver_id: string;
  name: string;
  km_per_auftrag: number;
  effizienz_score: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerKm[];
  team_avg_km: number;
  alert_count: number;
}

function dot(km: number) {
  if (km <= 5) return 'bg-green-500';
  if (km <= 10) return 'bg-amber-400';
  return 'bg-red-500';
}

const MOCK: ApiData = {
  fahrer: [
    { driver_id: 'd1', name: 'Max M.',   km_per_auftrag: 3.2,  effizienz_score: 92, trend: 'besser',     alert: false },
    { driver_id: 'd2', name: 'Sarah K.', km_per_auftrag: 5.8,  effizienz_score: 71, trend: 'gleich',     alert: false },
    { driver_id: 'd3', name: 'Tom B.',   km_per_auftrag: 13.1, effizienz_score: 31, trend: 'schlechter', alert: true  },
  ],
  team_avg_km: 6.7,
  alert_count: 1,
};

export function KitchenPhase2486KmEffizienzTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-km-effizienz?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const hasAlert = data.alert_count > 0;
  const sorted = [...data.fahrer].sort((a, b) => b.km_per_auftrag - a.km_per_auftrag);

  return (
    <div className={`rounded-xl border shadow-sm ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <Route size={14} className={hasAlert ? 'text-red-600' : 'text-blue-500'} />
          <span className="text-xs font-bold text-gray-700">KM-Effizienz</span>
          <span className={`text-xs font-black tabular-nums ${hasAlert ? 'text-red-700' : 'text-gray-700'}`}>
            Ø {data.team_avg_km.toFixed(1)} km/A.
          </span>
          {hasAlert && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-black text-red-700 animate-pulse">
              <AlertTriangle size={9} /> {data.alert_count}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="border-t px-3 pb-3 pt-2 space-y-1.5">
          {hasAlert && (
            <div className="flex items-center gap-1.5 rounded-lg bg-red-100 px-2 py-1.5 text-[10px] font-semibold text-red-800">
              <AlertTriangle size={11} className="shrink-0" />
              {data.alert_count} Fahrer &gt;10 km/Auftr. — Routen optimieren!
            </div>
          )}
          {sorted.map(f => (
            <div key={f.driver_id} className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full shrink-0 ${dot(f.km_per_auftrag)}`} />
              <span className="text-[10px] text-gray-700 flex-1 truncate">{f.name}</span>
              <span className={`text-[10px] font-black tabular-nums shrink-0 ${f.km_per_auftrag > 10 ? 'text-red-600' : f.km_per_auftrag > 5 ? 'text-amber-600' : 'text-green-600'}`}>
                {f.km_per_auftrag.toFixed(1)} km
              </span>
            </div>
          ))}
          <div className="pt-0.5 text-[8px] text-gray-400">30-Min-Polling · Ziel: ≤ 5 km/Auftrag</div>
        </div>
      )}
    </div>
  );
}
