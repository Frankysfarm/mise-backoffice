'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Gift } from 'lucide-react';

interface FahrerTrinkgeld {
  id: string;
  name: string;
  trinkgeld_gesamt: number;
  trinkgeld_avg: number;
  touren: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerTrinkgeld[];
  team_avg: number;
  alert_count: number;
}

const DOT: Record<string, string> = {
  gruen: 'bg-green-500',
  gelb:  'bg-amber-400',
  rot:   'bg-red-500',
};

const MOCK: ApiData = {
  fahrer: [
    { id: 'd2', name: 'Ben T.',   trinkgeld_gesamt: 9.24,  trinkgeld_avg: 0.42, touren: 22, ampel: 'rot',   alert: true },
    { id: 'd3', name: 'Chris M.', trinkgeld_gesamt: 7.50,  trinkgeld_avg: 0.50, touren: 15, ampel: 'gelb',  alert: false },
    { id: 'd4', name: 'Diana P.', trinkgeld_gesamt: 16.00, trinkgeld_avg: 0.80, touren: 20, ampel: 'gruen', alert: false },
    { id: 'd1', name: 'Anna K.',  trinkgeld_gesamt: 18.54, trinkgeld_avg: 1.03, touren: 18, ampel: 'gruen', alert: false },
  ],
  team_avg: 0.69,
  alert_count: 1,
};

export function KitchenPhase2517TrinkgeldTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-trinkgeld?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const hasAlert = data.alert_count > 0;
  const alertFahrer = data.fahrer.filter(f => f.alert).map(f => f.name);
  const sorted = [...data.fahrer].sort((a, b) => a.trinkgeld_avg - b.trinkgeld_avg);

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <Gift size={14} className={hasAlert ? 'text-red-600' : 'text-amber-500'} />
          <span className="text-xs font-bold text-gray-800">Trinkgeld</span>
          <span className={`text-xs font-black tabular-nums ${data.team_avg >= 0.75 ? 'text-green-700' : data.team_avg >= 0.50 ? 'text-amber-700' : 'text-red-700'}`}>
            Ø {data.team_avg.toFixed(2)}€/Tour
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
        <div className="border-t px-3 pb-3 pt-2 space-y-2">
          {/* Alert Banner */}
          {alertFahrer.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-100 border border-red-200 px-2 py-1.5 text-[10px] font-semibold text-red-800">
              <AlertTriangle size={11} className="shrink-0" />
              Trinkgeld-Warnung: {alertFahrer.join(', ')} — Servicequalität prüfen!
            </div>
          )}

          {/* Compact Driver List */}
          <div className="space-y-1">
            {sorted.map(f => (
              <div key={f.id} className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full shrink-0 ${DOT[f.ampel]}`} />
                <span className="text-[10px] text-gray-700 flex-1 truncate">{f.name}</span>
                <span className="text-[10px] font-black tabular-nums text-gray-700">{f.trinkgeld_avg.toFixed(2)}€</span>
                <span className="text-[9px] text-gray-400 shrink-0">{f.touren}T</span>
              </div>
            ))}
          </div>

          <div className="text-[8px] text-gray-400 text-right">30-Min-Polling</div>
        </div>
      )}
    </div>
  );
}
