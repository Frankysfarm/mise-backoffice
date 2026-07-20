'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_min: number;
  trend: 'steigend' | 'fallend' | 'stabil';
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_durchschnitt: number;
  alert_count: number;
}

function ampelVon(min: number): 'gruen' | 'gelb' | 'rot' {
  if (min <= 2) return 'gruen';
  if (min <= 5) return 'gelb';
  return 'rot';
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
  if (trend === 'steigend') return <TrendingUp   size={10} className="text-red-500"   />;
  if (trend === 'fallend')  return <TrendingDown size={10} className="text-green-600" />;
  return                           <Minus        size={10} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f3', fahrer_name: 'Tim W.',  avg_min: 8.2, trend: 'steigend' },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.', avg_min: 4.5, trend: 'fallend'  },
    { fahrer_id: 'f4', fahrer_name: 'Anna B.', avg_min: 3.1, trend: 'stabil'   },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',  avg_min: 2.1, trend: 'fallend'  },
  ],
  team_durchschnitt: 4.5,
  alert_count: 1,
};

export function KitchenPhase2628ReactionsZeitTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-reaktionszeit?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched  = data.fahrer.map(f => ({ ...f, ampel: ampelVon(f.avg_min) }));
  const sorted    = [...enriched].sort((a, b) => b.avg_min - a.avg_min);
  const alerts    = enriched.filter(f => f.avg_min > 5);
  const hasAlert  = alerts.length > 0;
  const teamAmpel = ampelVon(data.team_durchschnitt);
  const teamColor = textColor(teamAmpel);

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm mb-3`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-1.5">
          <Zap size={14} className="text-yellow-500" />
          <span className="font-semibold text-xs text-gray-800">Reaktionszeit</span>
          {hasAlert && (
            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
              {alerts.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-bold ${teamColor}`}>Ø {data.team_durchschnitt.toFixed(1)} Min</span>
          {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {hasAlert && (
            <div className="flex items-start gap-1.5 bg-red-100 border border-red-200 rounded-lg px-2 py-1.5">
              <AlertTriangle size={12} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 font-medium">
                Reaktionszeit zu lang: {alerts.map(f => f.fahrer_name).join(', ')}
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
                  {f.avg_min.toFixed(1)} Min
                </span>
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-400 text-right">Ziel: ≤2 Min</div>
        </div>
      )}
    </div>
  );
}
