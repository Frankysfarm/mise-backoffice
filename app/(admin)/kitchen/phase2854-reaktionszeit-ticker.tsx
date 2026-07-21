'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_min: number;
  touren_heute: number;
  ampel: string;
  trend: string;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_durchschnitt: number;
}

const ZIEL_MIN = 3;
const WARN_MIN = 7;

function calcAmpel(min: number): string {
  if (min < ZIEL_MIN) return 'gruen';
  if (min <= WARN_MIN) return 'gelb';
  return 'rot';
}

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
  // Invertiert: fallend=grün (schneller werden=besser), steigend=rot
  if (trend === 'fallend')  return <TrendingDown size={11} className="text-green-600" />;
  if (trend === 'steigend') return <TrendingUp   size={11} className="text-red-500"   />;
  return                           <Minus        size={11} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'd1', fahrer_name: 'Max M.',   avg_min: 2.1, touren_heute: 12, ampel: 'gruen', trend: 'fallend'  },
    { fahrer_id: 'd2', fahrer_name: 'Anna K.',  avg_min: 3.1, touren_heute: 11, ampel: 'gelb',  trend: 'stabil'   },
    { fahrer_id: 'd3', fahrer_name: 'Sara K.',  avg_min: 4.5, touren_heute:  9, ampel: 'gelb',  trend: 'steigend' },
    { fahrer_id: 'd4', fahrer_name: 'Tim W.',   avg_min: 8.2, touren_heute:  7, ampel: 'rot',   trend: 'steigend' },
  ],
  team_durchschnitt: 4.5,
};

export function KitchenPhase2854ReaktionszeitTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-reaktionszeit?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched  = data.fahrer.map(f => ({ ...f, ampel: calcAmpel(f.avg_min) }));
  // Aufsteigend nach Min — schnellste zuerst (niedrigste = beste)
  const sorted    = [...enriched].sort((a, b) => a.avg_min - b.avg_min);
  const alerts    = enriched.filter(f => f.avg_min > WARN_MIN);
  const hasAlert  = alerts.length > 0;
  const teamAmpel = calcAmpel(data.team_durchschnitt);

  return (
    <div className={`rounded-xl border p-3 mb-3 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-yellow-500" />
          <span className="font-semibold text-xs text-gray-800">Reaktionszeit Fahrer</span>
          {hasAlert && <AlertTriangle size={12} className="text-red-500" />}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${dotCls(teamAmpel)} text-white`}>
            Ø {data.team_durchschnitt.toFixed(1)} Min
          </span>
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {alerts.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-1 text-[10px] text-red-700 bg-red-100 rounded px-2 py-1">
              <AlertTriangle size={10} />
              <span className="font-medium">{f.fahrer_name}</span>
              <span>— Langsame Reaktion! ({f.avg_min.toFixed(1)} Min)</span>
            </div>
          ))}

          {sorted.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
              <span className={`w-2 h-2 flex-shrink-0 rounded-full ${dotCls(f.ampel)}`} />
              <span className="text-xs text-gray-800 flex-1 truncate">{f.fahrer_name}</span>
              <span className="text-[10px] text-gray-400">{f.touren_heute} Touren</span>
              <TrendIcon trend={f.trend} />
              <span className={`text-xs font-semibold ${textCls(f.ampel)}`}>{f.avg_min.toFixed(1)} Min</span>
            </div>
          ))}

          <div className="text-[10px] text-gray-400 text-center pt-1">
            Ziel &lt;{ZIEL_MIN} Min — {alerts.length === 0 ? 'Alle im Zielbereich ✓' : `${alerts.length} Fahrer über ${WARN_MIN} Min`}
          </div>
        </div>
      )}
    </div>
  );
}
