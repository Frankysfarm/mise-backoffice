'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Route } from 'lucide-react';

interface FahrerEntry {
  id: string;
  name: string;
  km_gesamt: number;
  km_gesamt_vw: number;
  km_pro_tour: number;
  touren: number;
  trend: 'up' | 'down' | 'neutral';
  ampel: string;
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_km_gesamt: number;
  team_km_gesamt_vw: number;
  alert_count: number;
}

const ZIEL_KM   = 50;
const ALERT_KM  = 20;
const MAX_KM    = 150;

function calcAmpel(km: number): string {
  if (km < ALERT_KM) return 'rot';
  if (km < ZIEL_KM)  return 'gelb';
  return 'gruen';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    dot: 'bg-red-500',   text: 'text-red-700',   bar: 'bg-red-500'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700', bar: 'bg-amber-400' };
  return                   { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700', bar: 'bg-green-500' };
}

// Normal: mehr km = besser (steigend=grün, fallend=rot)
function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up')   return <TrendingUp   size={12} className="text-green-600" />;
  if (trend === 'down') return <TrendingDown size={12} className="text-red-500"   />;
  return                       <Minus        size={12} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { id: 'd1', name: 'Anna K.',  km_gesamt:  74.2, km_gesamt_vw: 80.1, km_pro_tour:  6.2, touren: 12, trend: 'down', ampel: 'gruen', alert: false },
    { id: 'd2', name: 'Ben T.',   km_gesamt: 118.5, km_gesamt_vw: 105.0, km_pro_tour:  7.9, touren: 15, trend: 'up',  ampel: 'gruen', alert: false },
    { id: 'd3', name: 'Chris M.', km_gesamt:  32.4, km_gesamt_vw:  40.0, km_pro_tour:  5.4, touren:  6, trend: 'down', ampel: 'gelb',  alert: false },
    { id: 'd4', name: 'Diana P.', km_gesamt:  14.8, km_gesamt_vw:  22.0, km_pro_tour:  4.9, touren:  3, trend: 'down', ampel: 'rot',   alert: true  },
  ],
  team_km_gesamt:    60.0,
  team_km_gesamt_vw: 62.0,
  alert_count: 1,
};

export function DispatchPhase2836KilometerBoard({ locationId }: { locationId: string | null }) {
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

  const enriched = data.fahrer.map(f => ({ ...f, ampel: calcAmpel(f.km_gesamt) }));
  // Absteigend: höchste km oben = aktivste Fahrer zuerst
  const sorted   = [...enriched].sort((a, b) => b.km_gesamt - a.km_gesamt);
  const alerts   = enriched.filter(f => f.km_gesamt < ALERT_KM);
  const hasAlert = alerts.length > 0;
  const best     = sorted[0]?.km_gesamt ?? 0;
  const teamAmpel = calcAmpel(data.team_km_gesamt);
  const { text: teamText } = ampelCls(teamAmpel);
  const zielPct  = Math.min((ZIEL_KM / MAX_KM) * 100, 100);

  return (
    <div className={`rounded-xl border p-4 mb-4 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Route size={16} className="text-indigo-600" />
          <span className="font-semibold text-sm text-gray-800">Kilometer heute</span>
          {hasAlert && <AlertTriangle size={14} className="text-red-500" />}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 ${teamText}`}>
            Ø {data.team_km_gesamt.toFixed(1)} km
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Alert-Banner */}
          {hasAlert && (
            <div className="bg-red-100 border border-red-300 rounded-lg p-2 space-y-1">
              {alerts.map(f => (
                <div key={f.id} className="flex items-center gap-2 text-xs text-red-700">
                  <AlertTriangle size={12} />
                  <span className="font-medium">{f.name}</span>
                  <span>— Wenig Kilometer! ({f.km_gesamt.toFixed(1)} km / Ziel ≥{ZIEL_KM} km)</span>
                </div>
              ))}
            </div>
          )}

          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Team-Ø', val: `${data.team_km_gesamt.toFixed(1)} km` },
              { label: 'Bester', val: `${best.toFixed(1)} km` },
              { label: 'Ziel',   val: `≥${ZIEL_KM} km` },
            ].map(k => (
              <div key={k.label} className="bg-gray-50 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500">{k.label}</div>
                <div className="text-sm font-semibold text-gray-800">{k.val}</div>
              </div>
            ))}
          </div>

          {/* Fahrerliste absteigend */}
          <div className="space-y-2">
            {sorted.map(f => {
              const a      = ampelCls(f.ampel);
              const barPct = Math.min((f.km_gesamt / MAX_KM) * 100, 100);
              return (
                <div key={f.id} className={`rounded-lg border p-2 ${a.bg}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${a.dot}`} />
                      <span className="text-xs font-medium text-gray-800">{f.name}</span>
                      <TrendIcon trend={f.trend} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{f.touren} Touren</span>
                      <span className={`font-bold ${a.text}`}>{f.km_gesamt.toFixed(1)} km</span>
                    </div>
                  </div>
                  {/* Balken 0–150 km mit Ziel-Linie 50 km */}
                  <div className="relative h-2 bg-gray-200 rounded-full overflow-visible">
                    <div
                      className={`h-full rounded-full ${a.bar}`}
                      style={{ width: `${barPct}%` }}
                    />
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-indigo-400"
                      style={{ left: `${zielPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                    <span>0</span>
                    <span className="text-indigo-500">Ziel {ZIEL_KM} km</span>
                    <span>{MAX_KM} km</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ampel-Legende */}
          <div className="flex gap-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> ≥{ZIEL_KM} km</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> {ALERT_KM}–{ZIEL_KM - 1} km</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"   /> &lt;{ALERT_KM} km</span>
          </div>
        </div>
      )}
    </div>
  );
}
