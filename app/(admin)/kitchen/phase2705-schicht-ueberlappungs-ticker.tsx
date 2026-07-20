'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Layers, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  ueberlappung_min: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: string | null;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_ueberlappung: number;
  alert_count: number;
}

function dotCls(a: string) {
  if (a === 'rot')  return 'bg-red-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-green-500';
}

function textCls(a: string) {
  if (a === 'rot')  return 'text-red-700';
  if (a === 'gelb') return 'text-amber-700';
  return 'text-green-700';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={11} className="text-red-500"   />;
  if (trend === 'fallend')  return <TrendingDown size={11} className="text-green-600" />;
  return                           <Minus        size={11} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'd1', fahrer_name: 'Max M.',   ueberlappung_min: 45, trend: 'steigend', ampel: 'rot',   alert: 'Schicht-Überlappung: Max M.!'   },
    { fahrer_id: 'd2', fahrer_name: 'Sara K.',  ueberlappung_min: 15, trend: 'steigend', ampel: 'gelb',  alert: null },
    { fahrer_id: 'd3', fahrer_name: 'Tim B.',   ueberlappung_min:  0, trend: 'stabil',   ampel: 'gruen', alert: null },
    { fahrer_id: 'd4', fahrer_name: 'Julia F.', ueberlappung_min:  0, trend: 'fallend',  ampel: 'gruen', alert: null },
  ],
  team_avg_ueberlappung: 15,
  alert_count: 1,
};

export function KitchenPhase2705SchichtUeberlappungsTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen]   = useState(true);
  const [data, setData]   = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-schicht-ueberlappung?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const hasAlert  = data.alert_count > 0;
  const sorted    = [...data.fahrer].sort((a, b) => b.ueberlappung_min - a.ueberlappung_min);
  const teamMin   = data.team_avg_ueberlappung;
  const teamAmpel = teamMin === 0 ? 'gruen' : teamMin <= 30 ? 'gelb' : 'rot';

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Layers size={15} className={hasAlert ? 'text-red-500' : 'text-gray-500'} />
          <span className="font-semibold text-sm text-gray-800">Schicht-Überlappungen</span>
          <span className={`text-xs font-bold ${textCls(teamAmpel)}`}>
            Ø {teamMin.toFixed(1)} Min
          </span>
          {hasAlert && (
            <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
              {data.alert_count}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-2">
          {data.fahrer.filter(f => f.alert !== null).map(f => (
            <div key={f.fahrer_id} className="flex items-start gap-2 bg-red-100 border border-red-200 rounded-lg px-3 py-1.5">
              <AlertTriangle size={13} className="text-red-600 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700 font-medium">{f.alert}</p>
            </div>
          ))}

          {sorted.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${dotCls(f.ampel)}`} />
              <span className="text-xs text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
              <TrendIcon trend={f.trend} />
              <span className={`text-xs font-bold ${textCls(f.ampel)}`}>{f.ueberlappung_min} Min</span>
            </div>
          ))}

          <p className="text-xs text-gray-400 pt-1">Ziel: 0 Min Überlappung (grün)</p>
        </div>
      )}
    </div>
  );
}
