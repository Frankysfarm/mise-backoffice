'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Route } from 'lucide-react';

interface FahrerEntry {
  id: string;
  name: string;
  km_gesamt: number;
  touren: number;
  trend: 'up' | 'down' | 'neutral';
  ampel: string;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_km_gesamt: number;
  alert_count: number;
}

const ZIEL_KM  = 50;
const ALERT_KM = 20;

function calcAmpel(km: number): string {
  if (km < ALERT_KM) return 'rot';
  if (km < ZIEL_KM)  return 'gelb';
  return 'gruen';
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

// Mehr km = besser (steigend=grün, fallend=rot)
function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up')   return <TrendingUp   size={11} className="text-green-600" />;
  if (trend === 'down') return <TrendingDown size={11} className="text-red-500"   />;
  return                       <Minus        size={11} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { id: 'd2', name: 'Ben T.',   km_gesamt: 118.5, touren: 15, trend: 'up',   ampel: 'gruen' },
    { id: 'd1', name: 'Anna K.',  km_gesamt:  74.2, touren: 12, trend: 'down', ampel: 'gruen' },
    { id: 'd3', name: 'Chris M.', km_gesamt:  32.4, touren:  6, trend: 'down', ampel: 'gelb'  },
    { id: 'd4', name: 'Diana P.', km_gesamt:  14.8, touren:  3, trend: 'down', ampel: 'rot'   },
  ],
  team_km_gesamt: 60.0,
  alert_count: 1,
};

export function KitchenPhase2839KilometerTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-kilometer?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched  = data.fahrer.map(f => ({ ...f, ampel: calcAmpel(f.km_gesamt) }));
  // Absteigend: höchste km oben = aktivste Fahrer zuerst
  const sorted    = [...enriched].sort((a, b) => b.km_gesamt - a.km_gesamt);
  const alerts    = enriched.filter(f => f.km_gesamt < ALERT_KM);
  const hasAlert  = alerts.length > 0;
  const teamAmpel = calcAmpel(data.team_km_gesamt);

  return (
    <div className={`rounded-xl border p-3 mb-3 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Route size={14} className="text-indigo-600" />
          <span className="font-semibold text-xs text-gray-800">Kilometer Fahrer</span>
          {hasAlert && <AlertTriangle size={12} className="text-red-500" />}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${dotCls(teamAmpel)} text-white`}>
            Ø {data.team_km_gesamt.toFixed(1)} km
          </span>
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {/* Alert-Banner */}
          {alerts.map(f => (
            <div key={f.id} className="flex items-center gap-1 text-[10px] text-red-700 bg-red-100 rounded px-2 py-1">
              <AlertTriangle size={10} />
              <span className="font-medium">{f.name}</span>
              <span>— Wenig Kilometer! ({f.km_gesamt.toFixed(1)} km)</span>
            </div>
          ))}

          {/* Fahrerliste kompakt absteigend */}
          {sorted.map(f => (
            <div key={f.id} className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
              <span className={`w-2 h-2 flex-shrink-0 rounded-full ${dotCls(f.ampel)}`} />
              <span className="text-xs text-gray-800 flex-1 truncate">{f.name}</span>
              <span className="text-[10px] text-gray-400">{f.touren} Touren</span>
              <TrendIcon trend={f.trend} />
              <span className={`text-xs font-semibold ${textCls(f.ampel)}`}>{f.km_gesamt.toFixed(1)} km</span>
            </div>
          ))}

          {/* Ziel */}
          <div className="text-[10px] text-gray-400 text-center pt-1">
            Ziel ≥{ZIEL_KM} km — {data.alert_count === 0 ? 'Alle im Zielbereich ✓' : `${data.alert_count} Fahrer unter ${ALERT_KM} km`}
          </div>
        </div>
      )}
    </div>
  );
}
