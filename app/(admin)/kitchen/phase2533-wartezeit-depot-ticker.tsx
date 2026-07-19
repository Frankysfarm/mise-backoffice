'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Clock } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_wartezeit_depot_min: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_wartezeit_depot_min: number;
  alert_count: number;
}

function dotColor(ampel: string) {
  if (ampel === 'rot')  return 'bg-red-500';
  if (ampel === 'gelb') return 'bg-amber-400';
  return 'bg-green-500';
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'd2', fahrer_name: 'Sarah K.', avg_wartezeit_depot_min: 25.4, ampel: 'rot',   alert: true  },
    { fahrer_id: 'd5', fahrer_name: 'Anna B.',  avg_wartezeit_depot_min: 22.9, ampel: 'rot',   alert: true  },
    { fahrer_id: 'd3', fahrer_name: 'Lena S.',  avg_wartezeit_depot_min: 14.7, ampel: 'gelb',  alert: false },
    { fahrer_id: 'd1', fahrer_name: 'Max M.',   avg_wartezeit_depot_min: 8.2,  ampel: 'gruen', alert: false },
    { fahrer_id: 'd4', fahrer_name: 'Tom B.',   avg_wartezeit_depot_min: 6.1,  ampel: 'gruen', alert: false },
  ],
  team_avg_wartezeit_depot_min: 15.5,
  alert_count: 2,
};

export function KitchenPhase2533WartezeitDepotTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-wartezeit-depot?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted = [...data.fahrer].sort((a, b) => b.avg_wartezeit_depot_min - a.avg_wartezeit_depot_min);
  const hasAlert = data.alert_count > 0;
  const alertFahrer = data.fahrer.filter(f => f.alert).map(f => f.fahrer_name);

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock size={15} className={hasAlert ? 'text-red-600' : 'text-gray-500'} />
          <span className="text-sm font-bold text-gray-800">Depot-Wartezeit</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${hasAlert ? 'text-red-700 bg-red-100' : 'text-gray-600 bg-gray-100'}`}>
            Ø {data.team_avg_wartezeit_depot_min.toFixed(1)} min
          </span>
          {hasAlert && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700 animate-pulse">
              <AlertTriangle size={10} /> {data.alert_count}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>

      {open && (
        <div className="border-t px-4 pb-3 pt-2 space-y-2">
          {alertFahrer.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-100 border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-800">
              <AlertTriangle size={12} className="shrink-0" />
              &gt;20 min: {alertFahrer.join(', ')} — Disposition prüfen!
            </div>
          )}
          <div className="space-y-1">
            {sorted.map(f => (
              <div key={f.fahrer_id} className="flex items-center gap-2 rounded-md px-2 py-1 bg-gray-50">
                <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor(f.ampel)}`} />
                <span className="text-xs text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
                <span className={`text-xs font-black tabular-nums shrink-0 ${f.ampel === 'rot' ? 'text-red-600' : f.ampel === 'gelb' ? 'text-amber-600' : 'text-green-600'}`}>
                  {f.avg_wartezeit_depot_min.toFixed(1)} min
                </span>
              </div>
            ))}
          </div>
          <div className="text-[9px] text-gray-400 text-right">30-Min-Polling</div>
        </div>
      )}
    </div>
  );
}
