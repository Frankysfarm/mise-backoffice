'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle } from 'lucide-react';

interface FahrerAkzeptanz {
  fahrer_id: string;
  fahrer_name: string;
  akzeptanzrate: number;
  angenommen: number;
  angeboten: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiData {
  fahrer: FahrerAkzeptanz[];
  team_avg_rate: number;
  alert_count: number;
}

function dotColor(ampel: 'gruen' | 'gelb' | 'rot') {
  if (ampel === 'gruen') return 'bg-green-500';
  if (ampel === 'gelb')  return 'bg-amber-400';
  return 'bg-red-500';
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'd3', fahrer_name: 'Tim B.',   akzeptanzrate: 55.6, angenommen: 10, angeboten: 18, ampel: 'rot',   alert_niedrig: true },
    { fahrer_id: 'd2', fahrer_name: 'Sara K.',  akzeptanzrate: 85.0, angenommen: 17, angeboten: 20, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'd4', fahrer_name: 'Julia F.', akzeptanzrate: 95.5, angenommen: 21, angeboten: 22, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'd1', fahrer_name: 'Max M.',   akzeptanzrate: 95.7, angenommen: 22, angeboten: 23, ampel: 'gruen', alert_niedrig: false },
  ],
  team_avg_rate: 82.9,
  alert_count: 1,
};

export function KitchenPhase2528AkzeptanzrateTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-akzeptanzrate?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted = [...data.fahrer].sort((a, b) => a.akzeptanzrate - b.akzeptanzrate);
  const hasAlert = data.alert_count > 0;
  const alertNames = data.fahrer.filter(f => f.alert_niedrig).map(f => f.fahrer_name);

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <CheckCircle size={16} className={hasAlert ? 'text-red-600' : 'text-green-600'} />
          <span className="text-sm font-bold text-gray-800">Akzeptanzrate</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${hasAlert ? 'text-red-700 bg-red-100' : 'text-green-700 bg-green-100'}`}>
            Ø {data.team_avg_rate.toFixed(1)}%
          </span>
          {hasAlert && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700 animate-pulse">
              <AlertTriangle size={10} /> {data.alert_count} Alert
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="border-t px-4 pb-3 pt-3 space-y-3">
          {/* Alert Banner */}
          {alertNames.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-100 border border-red-200 px-3 py-2 text-xs font-semibold text-red-800">
              <AlertTriangle size={13} className="shrink-0" />
              Akzeptanzrate &lt;70%: {alertNames.join(', ')} — Motivationsgespräch empfohlen!
            </div>
          )}

          {/* Driver List */}
          <div className="space-y-1.5">
            {sorted.map(f => (
              <div key={f.fahrer_id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1.5">
                <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor(f.ampel)}`} />
                <span className="text-xs font-semibold text-gray-800 flex-1 truncate">{f.fahrer_name}</span>
                <span className="text-[10px] text-gray-500 shrink-0">{f.angenommen}/{f.angeboten}</span>
                <span className={`text-xs font-black tabular-nums shrink-0 ${
                  f.ampel === 'gruen' ? 'text-green-700' : f.ampel === 'gelb' ? 'text-amber-600' : 'text-red-600'
                }`}>{f.akzeptanzrate.toFixed(1)}%</span>
              </div>
            ))}
          </div>

          <div className="text-[9px] text-gray-400 text-right">30-Min-Polling</div>
        </div>
      )}
    </div>
  );
}
