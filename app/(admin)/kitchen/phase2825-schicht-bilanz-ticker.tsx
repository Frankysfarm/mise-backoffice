'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, BarChart2, ChevronDown, ChevronUp, Minus, TrendingDown, TrendingUp } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  einnahmen: number;
  touren: number;
  schichtdauer_h: number;
  trend_einnahmen: string;
  ampel: string;
  alert_schicht: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_einnahmen: number;
  alert_count: number;
}

const EINNAHMEN_ZIEL = 100;

function dotCls(a: string): string {
  if (a === 'rot')  return 'bg-red-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-green-500';
}

function textCls(a: string): string {
  if (a === 'rot')  return 'text-red-700';
  if (a === 'gelb') return 'text-amber-700';
  return 'text-green-700';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={11} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={11} className="text-red-500"   />;
  return                           <Minus        size={11} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'd3', fahrer_name: 'Tim B.',   einnahmen:  45, touren: 3, schichtdauer_h: 10.5, trend_einnahmen: 'fallend',  ampel: 'rot',   alert_schicht: true  },
    { fahrer_id: 'd2', fahrer_name: 'Sara K.',  einnahmen:  98, touren: 7, schichtdauer_h:  8.0, trend_einnahmen: 'stabil',   ampel: 'gruen', alert_schicht: false },
    { fahrer_id: 'd4', fahrer_name: 'Julia F.', einnahmen: 112, touren: 8, schichtdauer_h:  6.5, trend_einnahmen: 'steigend', ampel: 'gruen', alert_schicht: false },
    { fahrer_id: 'd1', fahrer_name: 'Max M.',   einnahmen: 135, touren: 9, schichtdauer_h:  7.5, trend_einnahmen: 'steigend', ampel: 'gruen', alert_schicht: false },
  ],
  team_einnahmen: 390,
  alert_count: 1,
};

export function KitchenPhase2825SchichtBilanzTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-schicht-bilanz?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched  = data.fahrer.map(f => ({ ...f, ampel: f.ampel ?? (f.einnahmen >= EINNAHMEN_ZIEL ? 'gruen' : 'rot') }));
  // Aufsteigend nach Einnahmen (niedrigste = kritischste zuerst)
  const sorted    = [...enriched].sort((a, b) => a.einnahmen - b.einnahmen);
  const alertList = enriched.filter(f => f.alert_schicht);
  const hasAlert  = alertList.length > 0;
  const teamAvgEin = data.fahrer.length > 0
    ? Math.round(data.fahrer.reduce((s, f) => s + f.einnahmen, 0) / data.fahrer.length)
    : 0;

  return (
    <div className={`rounded-xl border p-3 mb-3 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <BarChart2 size={14} className="text-indigo-500" />
          <span className="font-semibold text-xs text-gray-800">Schicht-Bilanz Fahrer</span>
          {hasAlert && <AlertTriangle size={12} className="text-red-500" />}
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700">
            Ø {teamAvgEin} €
          </span>
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {/* Alert: lange Schicht */}
          {alertList.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-1 text-[10px] text-red-700 bg-red-100 rounded px-2 py-1">
              <AlertTriangle size={10} />
              <span className="font-medium">{f.fahrer_name}</span>
              <span>— Lange Schicht ({f.schichtdauer_h} h)!</span>
            </div>
          ))}

          {/* Fahrerliste kompakt */}
          {sorted.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
              <span className={`w-2 h-2 flex-shrink-0 rounded-full ${dotCls(f.ampel)}`} />
              <span className="text-xs text-gray-800 flex-1 truncate">{f.fahrer_name}</span>
              <span className="text-[10px] text-gray-400">{f.touren} Tour{f.touren !== 1 ? 'en' : ''}</span>
              <TrendIcon trend={f.trend_einnahmen} />
              <span className={`text-xs font-semibold ${textCls(f.ampel)}`}>{f.einnahmen} €</span>
            </div>
          ))}

          {/* Ziel-Hinweis */}
          <div className="text-[10px] text-gray-400 text-center pt-1">
            Ziel ≥{EINNAHMEN_ZIEL} €/Fahrer — Team-Einnahmen: {data.team_einnahmen} €
          </div>
        </div>
      )}
    </div>
  );
}
