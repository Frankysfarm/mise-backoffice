'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_wartezeit_min: number;
  touren_anzahl: number;
  max_wartezeit_min: number;
  ampel: string;
  trend: string;
  trend_delta: number;
  rang: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_wartezeit_min: number;
  alert_count: number;
}

const ZIEL_MIN    = 3;
const ALERT_MIN   = 6;
const MAX_MIN     = 15;

function calcAmpel(min: number): string {
  if (min > ALERT_MIN) return 'rot';
  if (min > ZIEL_MIN)  return 'gelb';
  return 'gruen';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    dot: 'bg-red-500',   text: 'text-red-700',   bar: 'bg-red-500'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700', bar: 'bg-amber-400' };
  return                   { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700', bar: 'bg-green-500' };
}

// Invertiert: steigend=rot (länger warten=schlecht), fallend=grün
function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={12} className="text-red-500"   />;
  if (trend === 'fallend')  return <TrendingDown size={12} className="text-green-600" />;
  return                           <Minus        size={12} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   avg_wartezeit_min:  2.1, touren_anzahl: 9,  max_wartezeit_min:  4.0, ampel: 'gruen', trend: 'fallend',  trend_delta: -1.1, rang: 1 },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  avg_wartezeit_min:  4.8, touren_anzahl: 7,  max_wartezeit_min:  9.0, ampel: 'gelb',  trend: 'stabil',   trend_delta:  0.0, rang: 2 },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   avg_wartezeit_min:  3.3, touren_anzahl: 5,  max_wartezeit_min:  6.0, ampel: 'gelb',  trend: 'steigend', trend_delta:  1.2, rang: 3 },
    { fahrer_id: 'f4', fahrer_name: 'Lisa F.',  avg_wartezeit_min:  8.5, touren_anzahl: 11, max_wartezeit_min: 14.0, ampel: 'rot',   trend: 'steigend', trend_delta:  2.7, rang: 4 },
  ],
  team_avg_wartezeit_min: 4.7,
  alert_count: 1,
};

export function DispatchPhase2831WartezeitBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-wartezeit?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched  = data.fahrer.map(f => ({ ...f, ampel: calcAmpel(f.avg_wartezeit_min) }));
  // Aufsteigend: niedrigste Wartezeit oben = Effizienteste zuerst
  const sorted    = [...enriched].sort((a, b) => a.avg_wartezeit_min - b.avg_wartezeit_min);
  const alerts    = enriched.filter(f => f.avg_wartezeit_min > ALERT_MIN);
  const hasAlert  = alerts.length > 0;
  const teamAmpel = calcAmpel(data.team_avg_wartezeit_min);
  const best      = sorted[0]?.avg_wartezeit_min ?? 0;
  const { text: teamText } = ampelCls(teamAmpel);
  const zielPct   = Math.min((ZIEL_MIN / MAX_MIN) * 100, 100);

  return (
    <div className={`rounded-xl border p-4 mb-4 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-blue-600" />
          <span className="font-semibold text-sm text-gray-800">Wartezeit am Restaurant</span>
          {hasAlert && <AlertTriangle size={14} className="text-red-500" />}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 ${teamText}`}>
            Ø {data.team_avg_wartezeit_min.toFixed(1)} Min
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
                <div key={f.fahrer_id} className="flex items-center gap-2 text-xs text-red-700">
                  <AlertTriangle size={12} />
                  <span className="font-medium">{f.fahrer_name}</span>
                  <span>— Lange Wartezeit! ({f.avg_wartezeit_min.toFixed(1)} Min / Ziel ≤{ZIEL_MIN} Min)</span>
                </div>
              ))}
            </div>
          )}

          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Team-Ø',  val: `${data.team_avg_wartezeit_min.toFixed(1)} Min` },
              { label: 'Bester',  val: `${best.toFixed(1)} Min` },
              { label: 'Ziel',    val: `≤${ZIEL_MIN} Min` },
            ].map(k => (
              <div key={k.label} className="bg-gray-50 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500">{k.label}</div>
                <div className="text-sm font-semibold text-gray-800">{k.val}</div>
              </div>
            ))}
          </div>

          {/* Fahrerliste aufsteigend */}
          <div className="space-y-2">
            {sorted.map(f => {
              const a      = ampelCls(f.ampel);
              const barPct = Math.min((f.avg_wartezeit_min / MAX_MIN) * 100, 100);
              return (
                <div key={f.fahrer_id} className={`rounded-lg border p-2 ${a.bg}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${a.dot}`} />
                      <span className="text-xs font-medium text-gray-800">{f.fahrer_name}</span>
                      <TrendIcon trend={f.trend} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{f.touren_anzahl} Touren</span>
                      <span className={`font-bold ${a.text}`}>{f.avg_wartezeit_min.toFixed(1)} Min</span>
                    </div>
                  </div>
                  {/* Balken 0–15 Min mit Ziel-Linie 3 Min */}
                  <div className="relative h-2 bg-gray-200 rounded-full overflow-visible">
                    <div
                      className={`h-full rounded-full ${a.bar}`}
                      style={{ width: `${barPct}%` }}
                    />
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-blue-400"
                      style={{ left: `${zielPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                    <span>0</span>
                    <span className="text-blue-500">Ziel {ZIEL_MIN} Min</span>
                    <span>{MAX_MIN} Min</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ampel-Legende */}
          <div className="flex gap-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> ≤{ZIEL_MIN} Min</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> {ZIEL_MIN}–{ALERT_MIN} Min</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"   /> &gt;{ALERT_MIN} Min</span>
          </div>
        </div>
      )}
    </div>
  );
}
