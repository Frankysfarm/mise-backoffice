'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingDown, TrendingUp, Minus, Gauge } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_min: number;
  touren_heute: number;
  ampel: string;
  alert: boolean;
  trend: string;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_durchschnitt: number;
}

const ZIEL_MIN = 25;
const WARN_MIN = 35;

function calcAmpel(min: number): string {
  if (min <= ZIEL_MIN) return 'gruen';
  if (min <= WARN_MIN) return 'gelb';
  return 'rot';
}

function dotCls(a: string) {
  if (a === 'rot')  return 'bg-red-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-green-500';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'fallend')  return <TrendingDown size={10} className="text-green-600" />;
  if (trend === 'steigend') return <TrendingUp   size={10} className="text-red-500"   />;
  return                           <Minus        size={10} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'd1', fahrer_name: 'Max M.',  avg_min: 21.5, touren_heute: 12, ampel: 'gruen', alert: false, trend: 'fallend'  },
    { fahrer_id: 'd2', fahrer_name: 'Anna B.', avg_min: 24.8, touren_heute: 11, ampel: 'gruen', alert: false, trend: 'fallend'  },
    { fahrer_id: 'd3', fahrer_name: 'Sara K.', avg_min: 27.3, touren_heute:  9, ampel: 'gelb',  alert: false, trend: 'steigend' },
    { fahrer_id: 'd4', fahrer_name: 'Tim W.',  avg_min: 38.1, touren_heute:  7, ampel: 'rot',   alert: true,  trend: 'steigend' },
  ],
  team_durchschnitt: 27.9,
};

export function KitchenPhase2885LiefergeschwindigkeitTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-liefergeschwindigkeit?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched  = data.fahrer.map(f => ({ ...f, ampel: calcAmpel(f.avg_min) }));
  const sorted    = [...enriched].sort((a, b) => a.avg_min - b.avg_min);
  const alerts    = enriched.filter(f => f.avg_min > WARN_MIN);
  const hasAlert  = alerts.length > 0;
  const teamAmpel = calcAmpel(data.team_durchschnitt);
  const teamDotCls = dotCls(teamAmpel);

  return (
    <div className={`rounded-xl border p-3 mb-3 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Gauge size={14} className="text-blue-500" />
          <span className="font-semibold text-xs text-gray-800">Liefergeschwindigkeit</span>
          {hasAlert && <AlertTriangle size={12} className="text-red-500" />}
          <span className="flex items-center gap-1 text-xs text-gray-600">
            <span className={`w-2 h-2 rounded-full ${teamDotCls}`} />
            Ø {data.team_durchschnitt.toFixed(1)} Min
          </span>
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {hasAlert && (
            <div className="bg-red-100 border border-red-300 rounded-lg p-1.5 space-y-0.5">
              {alerts.map(f => (
                <div key={f.fahrer_id} className="flex items-center gap-1 text-[10px] text-red-700">
                  <AlertTriangle size={10} />
                  <span className="font-medium">{f.fahrer_name}</span>
                  <span>— Zu langsam! ({f.avg_min.toFixed(1)} Min)</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1">
            {sorted.map(f => (
              <div key={f.fahrer_id} className="flex items-center justify-between text-[11px] text-gray-700">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotCls(f.ampel)}`} />
                  <span className="truncate max-w-[90px]">{f.fahrer_name}</span>
                  <TrendIcon trend={f.trend} />
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <span>{f.touren_heute} T.</span>
                  <span className="font-medium">{f.avg_min.toFixed(1)} Min</span>
                </div>
              </div>
            ))}
          </div>

          <div className="text-[10px] text-gray-400 text-right">Ziel ≤{ZIEL_MIN} Min</div>
        </div>
      )}
    </div>
  );
}
