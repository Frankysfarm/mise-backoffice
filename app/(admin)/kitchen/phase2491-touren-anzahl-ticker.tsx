'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Map } from 'lucide-react';

interface FahrerTouren {
  fahrer_id: string;
  fahrer_name: string;
  touren_heute: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_low: boolean;
  alert_high: boolean;
}

interface ApiData {
  fahrer: FahrerTouren[];
  team_avg_touren: number;
  alert_count: number;
}

function dot(touren: number) {
  if (touren >= 6 && touren <= 10) return 'bg-green-500';
  if (touren < 4 || touren > 12) return 'bg-red-500';
  return 'bg-amber-400';
}

function textColor(touren: number) {
  if (touren >= 6 && touren <= 10) return 'text-green-600';
  if (touren < 4 || touren > 12) return 'text-red-600';
  return 'text-amber-600';
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'd1', fahrer_name: 'Max M.',   touren_heute: 9,  ampel: 'gruen', alert_low: false, alert_high: false },
    { fahrer_id: 'd2', fahrer_name: 'Sara K.',  touren_heute: 3,  ampel: 'rot',   alert_low: true,  alert_high: false },
    { fahrer_id: 'd3', fahrer_name: 'Tim B.',   touren_heute: 13, ampel: 'rot',   alert_low: false, alert_high: true  },
  ],
  team_avg_touren: 8.3,
  alert_count: 2,
};

export function KitchenPhase2491TourenAnzahlTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-touren-anzahl?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const hasAlert = data.alert_count > 0;
  const sorted = [...data.fahrer].sort((a, b) => b.touren_heute - a.touren_heute);

  return (
    <div className={`rounded-xl border shadow-sm ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <Map size={14} className={hasAlert ? 'text-red-600' : 'text-blue-500'} />
          <span className="text-xs font-bold text-gray-700">Touren-Anzahl</span>
          <span className={`text-xs font-black tabular-nums ${hasAlert ? 'text-red-700' : 'text-gray-700'}`}>
            Ø {data.team_avg_touren.toFixed(1)}
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
              {data.fahrer.filter(f => f.alert_low).length > 0 && `Unterausgelastet (<4): ${data.fahrer.filter(f => f.alert_low).map(f => f.fahrer_name).join(', ')}. `}
              {data.fahrer.filter(f => f.alert_high).length > 0 && `Überlastet (>12): ${data.fahrer.filter(f => f.alert_high).map(f => f.fahrer_name).join(', ')}.`}
            </div>
          )}
          {sorted.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full shrink-0 ${dot(f.touren_heute)}`} />
              <span className="text-[10px] text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
              <span className={`text-[10px] font-black tabular-nums shrink-0 ${textColor(f.touren_heute)}`}>
                {f.touren_heute} Tour{f.touren_heute !== 1 ? 'en' : ''}
              </span>
            </div>
          ))}
          <div className="pt-0.5 text-[8px] text-gray-400">30-Min-Polling · Ziel: 6–10 Touren</div>
        </div>
      )}
    </div>
  );
}
