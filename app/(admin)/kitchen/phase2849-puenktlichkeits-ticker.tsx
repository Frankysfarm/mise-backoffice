'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  quote_pct: number;
  puenktlich: number;
  gesamt_stopps: number;
  ampel: string;
  trend: string;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_durchschnitt: number;
}

const ZIEL_PCT = 90;
const WARN_PCT = 70;

function calcAmpel(pct: number): string {
  if (pct >= ZIEL_PCT) return 'gruen';
  if (pct >= WARN_PCT) return 'gelb';
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
    { fahrer_id: 'd1', fahrer_name: 'Anna K.',  quote_pct: 96, puenktlich: 24, gesamt_stopps: 25, ampel: 'gruen', trend: 'steigend' },
    { fahrer_id: 'd2', fahrer_name: 'Max M.',   quote_pct: 91, puenktlich: 20, gesamt_stopps: 22, ampel: 'gruen', trend: 'stabil'   },
    { fahrer_id: 'd3', fahrer_name: 'Sara K.',  quote_pct: 78, puenktlich: 14, gesamt_stopps: 18, ampel: 'gelb',  trend: 'fallend'  },
    { fahrer_id: 'd4', fahrer_name: 'Tim W.',   quote_pct: 62, puenktlich:  8, gesamt_stopps: 13, ampel: 'rot',   trend: 'fallend'  },
  ],
  team_durchschnitt: 81.8,
};

export function KitchenPhase2849PuenktlichkeitsTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-puenktlichkeit?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched  = data.fahrer.map(f => ({ ...f, ampel: calcAmpel(f.quote_pct) }));
  const sorted    = [...enriched].sort((a, b) => b.quote_pct - a.quote_pct);
  const alerts    = enriched.filter(f => f.quote_pct < WARN_PCT);
  const hasAlert  = alerts.length > 0;
  const teamAmpel = calcAmpel(data.team_durchschnitt);

  return (
    <div className={`rounded-xl border p-3 mb-3 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-blue-600" />
          <span className="font-semibold text-xs text-gray-800">Pünktlichkeit Fahrer</span>
          {hasAlert && <AlertTriangle size={12} className="text-red-500" />}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${dotCls(teamAmpel)} text-white`}>
            Ø {data.team_durchschnitt.toFixed(1)}%
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
              <span>— Niedrige Pünktlichkeit! ({f.quote_pct.toFixed(1)}%)</span>
            </div>
          ))}

          {sorted.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
              <span className={`w-2 h-2 flex-shrink-0 rounded-full ${dotCls(f.ampel)}`} />
              <span className="text-xs text-gray-800 flex-1 truncate">{f.fahrer_name}</span>
              <span className="text-[10px] text-gray-400">{f.puenktlich}/{f.gesamt_stopps}</span>
              <TrendIcon trend={f.trend} />
              <span className={`text-xs font-semibold ${textCls(f.ampel)}`}>{f.quote_pct.toFixed(1)}%</span>
            </div>
          ))}

          <div className="text-[10px] text-gray-400 text-center pt-1">
            Ziel ≥{ZIEL_PCT}% — {alerts.length === 0 ? 'Alle im Zielbereich ✓' : `${alerts.length} Fahrer unter ${WARN_PCT}%`}
          </div>
        </div>
      )}
    </div>
  );
}
