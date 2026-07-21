'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Gauge } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  effizienz_score: number;
  touren_pro_stunde: number;
  trend: string;
  ampel: string;
  alert_niedrig: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_score: number;
}

const ZIEL = 80;
const WARN = 60;

function calcAmpel(score: number): string {
  if (score >= ZIEL) return 'gruen';
  if (score >= WARN) return 'gelb';
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
  if (trend === 'steigend') return <TrendingUp   size={11} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={11} className="text-red-500"   />;
  return                           <Minus        size={11} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'd1', fahrer_name: 'Max M.',  effizienz_score: 88, touren_pro_stunde: 4.2, trend: 'steigend', ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'd2', fahrer_name: 'Julia F.', effizienz_score: 82, touren_pro_stunde: 3.8, trend: 'stabil',   ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'd3', fahrer_name: 'Sara K.',  effizienz_score: 71, touren_pro_stunde: 3.1, trend: 'fallend',  ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'd4', fahrer_name: 'Tim B.',   effizienz_score: 55, touren_pro_stunde: 2.4, trend: 'fallend',  ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_score: 74,
};

export function KitchenPhase2861EffizienzTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-effizienz-index?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched  = data.fahrer.map(f => ({ ...f, ampel: calcAmpel(f.effizienz_score) }));
  // Absteigend nach Score — höchste oben = effizienteste zuerst
  const sorted    = [...enriched].sort((a, b) => b.effizienz_score - a.effizienz_score);
  const alerts    = enriched.filter(f => f.effizienz_score < WARN);
  const hasAlert  = alerts.length > 0;
  const teamAmpel = calcAmpel(data.team_avg_score);

  return (
    <div className={`rounded-xl border p-3 mb-3 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Gauge size={14} className="text-indigo-500" />
          <span className="font-semibold text-xs text-gray-800">Effizienz Fahrer</span>
          {hasAlert && <AlertTriangle size={12} className="text-red-500" />}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${dotCls(teamAmpel)} text-white`}>
            Ø {data.team_avg_score} Pkt
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
              <span>— Effizienz zu niedrig! ({f.effizienz_score} Pkt)</span>
            </div>
          ))}

          {sorted.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
              <span className={`w-2 h-2 flex-shrink-0 rounded-full ${dotCls(f.ampel)}`} />
              <span className="text-xs text-gray-800 flex-1 truncate">{f.fahrer_name}</span>
              <span className="text-[10px] text-gray-400">{f.touren_pro_stunde}/h</span>
              <TrendIcon trend={f.trend} />
              <span className={`text-xs font-semibold ${textCls(f.ampel)}`}>{f.effizienz_score} Pkt</span>
            </div>
          ))}

          <div className="text-[10px] text-gray-400 text-center pt-1">
            Ziel ≥{ZIEL} Pkt — {alerts.length === 0 ? 'Alle im Zielbereich ✓' : `${alerts.length} Fahrer unter ${WARN} Pkt`}
          </div>
        </div>
      )}
    </div>
  );
}
