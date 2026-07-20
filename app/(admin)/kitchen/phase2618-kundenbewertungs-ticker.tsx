'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  bewertung_avg: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_durchschnitt: number;
  alert_count: number;
}

function dotColor(ampel: string) {
  if (ampel === 'rot')  return 'bg-red-500';
  if (ampel === 'gelb') return 'bg-amber-400';
  return 'bg-green-500';
}

function textColor(ampel: string) {
  if (ampel === 'rot')  return 'text-red-600';
  if (ampel === 'gelb') return 'text-amber-600';
  return 'text-green-600';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={10} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={10} className="text-red-500"   />;
  return                           <Minus        size={10} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f5', fahrer_name: 'Jana F.',  bewertung_avg: 2.9, trend: 'fallend',  ampel: 'rot'   },
    { fahrer_id: 'f2', fahrer_name: 'Sarah K.', bewertung_avg: 3.2, trend: 'fallend',  ampel: 'rot'   },
    { fahrer_id: 'f3', fahrer_name: 'Lena S.',  bewertung_avg: 4.1, trend: 'stabil',   ampel: 'gelb'  },
    { fahrer_id: 'f4', fahrer_name: 'Tom B.',   bewertung_avg: 4.6, trend: 'stabil',   ampel: 'gruen' },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   bewertung_avg: 4.8, trend: 'steigend', ampel: 'gruen' },
  ],
  team_durchschnitt: 3.92,
  alert_count: 2,
};

export function KitchenPhase2618KundenbewertungsTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-kundenbewertung?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted     = [...data.fahrer].sort((a, b) => a.bewertung_avg - b.bewertung_avg);
  const hasAlert   = data.alert_count > 0;
  const alertNames = data.fahrer.filter((f: FahrerEntry) => f.ampel === 'rot').map((f: FahrerEntry) => f.fahrer_name);
  const teamColor  = data.team_durchschnitt >= 4.5 ? 'text-green-600' : data.team_durchschnitt >= 3.5 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm mb-3`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-sm">⭐</span>
          <span className="font-semibold text-xs text-gray-800">Kundenbewertung</span>
          {hasAlert && (
            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
              {data.alert_count}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-bold ${teamColor}`}>Ø {data.team_durchschnitt.toFixed(1)} ★</span>
          {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {hasAlert && (
            <div className="flex items-start gap-1.5 bg-red-100 border border-red-200 rounded-lg px-2 py-1.5">
              <AlertTriangle size={12} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 font-medium">
                Schlechte Kundenbewertung: {alertNames.join(', ')}
              </p>
            </div>
          )}
          <div className="space-y-1">
            {sorted.map(f => (
              <div key={f.fahrer_id} className="flex items-center gap-1.5 py-0.5">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor(f.ampel)}`} />
                <span className="text-xs text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
                <TrendIcon trend={f.trend} />
                <span className={`text-xs font-semibold ${textColor(f.ampel)}`}>
                  {f.bewertung_avg.toFixed(1)} ★
                </span>
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-400 text-right">Ziel: ≥4.5 ★</div>
        </div>
      )}
    </div>
  );
}
