'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';

interface FahrerEntry {
  id: string;
  name: string;
  rate_pct: number;
  touren: number;
  trend: 'up' | 'down' | 'neutral';
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
  alert_typ: 'under' | 'over' | null;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_pct: number;
}

const ZIEL_MIN = 60;
const ZIEL_MAX = 85;
const ALERT_UNDER = 40;
const ALERT_OVER  = 90;

function calcAmpel(pct: number): 'gruen' | 'gelb' | 'rot' {
  if (pct >= ZIEL_MIN && pct <= ZIEL_MAX) return 'gruen';
  if ((pct >= ALERT_UNDER && pct < ZIEL_MIN) || (pct > ZIEL_MAX && pct <= ALERT_OVER)) return 'gelb';
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
  if (trend === 'up')   return <TrendingUp   size={11} className="text-green-600" />;
  if (trend === 'down') return <TrendingDown size={11} className="text-red-500"   />;
  return                       <Minus        size={11} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { id: 'd1', name: 'Anna K.',  rate_pct: 78, touren: 12, trend: 'up',      ampel: 'gruen', alert: false, alert_typ: null    },
    { id: 'd2', name: 'Ben T.',   rate_pct: 92, touren: 15, trend: 'up',      ampel: 'rot',   alert: true,  alert_typ: 'over'  },
    { id: 'd3', name: 'Chris M.', rate_pct: 35, touren:  6, trend: 'down',    ampel: 'rot',   alert: true,  alert_typ: 'under' },
    { id: 'd4', name: 'Diana P.', rate_pct: 65, touren: 11, trend: 'neutral', ampel: 'gruen', alert: false, alert_typ: null    },
  ],
  team_avg_pct: 68,
};

export function KitchenPhase2875AuslastungsTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-auslastung?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched  = data.fahrer.map(f => ({ ...f, ampel: calcAmpel(f.rate_pct) }));
  const sorted    = [...enriched].sort((a, b) => b.rate_pct - a.rate_pct);
  const alerts    = enriched.filter(f => f.alert);
  const hasAlert  = alerts.length > 0;
  const teamAmpel = calcAmpel(data.team_avg_pct);

  return (
    <div className={`rounded-xl border p-3 mb-3 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-blue-500" />
          <span className="font-semibold text-xs text-gray-800">Auslastung Fahrer</span>
          {hasAlert && <AlertTriangle size={12} className="text-red-500" />}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${dotCls(teamAmpel)} text-white`}>
            Ø {data.team_avg_pct}%
          </span>
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {alerts.map(f => (
            <div key={f.id} className="flex items-center gap-1 text-[10px] text-red-700 bg-red-100 rounded px-2 py-1">
              <AlertTriangle size={10} />
              <span className="font-medium">{f.name}</span>
              <span>
                — {f.alert_typ === 'under' ? `Niedrige Auslastung! (${f.rate_pct}%)` : `Überlastung! (${f.rate_pct}%)`}
              </span>
            </div>
          ))}

          {sorted.map(f => (
            <div key={f.id} className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
              <span className={`w-2 h-2 flex-shrink-0 rounded-full ${dotCls(f.ampel)}`} />
              <span className="text-xs text-gray-800 flex-1 truncate">{f.name}</span>
              <span className="text-[10px] text-gray-400">{f.touren} Touren</span>
              <TrendIcon trend={f.trend} />
              <span className={`text-xs font-semibold ${textCls(f.ampel)}`}>{f.rate_pct}%</span>
            </div>
          ))}

          <div className="text-[10px] text-gray-400 text-center pt-1">
            Ziel {ZIEL_MIN}–{ZIEL_MAX}% — {alerts.length === 0 ? 'Alle im Zielbereich ✓' : `${alerts.length} Fahrer außerhalb`}
          </div>
        </div>
      )}
    </div>
  );
}
