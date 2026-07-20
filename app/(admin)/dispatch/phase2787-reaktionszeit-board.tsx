'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_min: number;
  batches_heute: number;
  ampel: string;
  trend: string;
  trend_delta: number;
  alert: boolean;
  rang: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_min: number;
  alert_count: number;
}

const ZIEL_MIN = 2;
const WARN_MIN = 5;
const MAX_MIN  = 10;

function calcAmpel(m: number): string {
  if (m <= ZIEL_MIN) return 'gruen';
  if (m <= WARN_MIN) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    dot: 'bg-red-500',   text: 'text-red-700',   bar: 'bg-red-500'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700', bar: 'bg-amber-400' };
  return                   { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700', bar: 'bg-green-500' };
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={12} className="text-red-500"   />;
  if (trend === 'fallend')  return <TrendingDown size={12} className="text-green-600" />;
  return                           <Minus        size={12} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   avg_min: 1.4, batches_heute: 11, ampel: 'gruen', trend: 'fallend',  trend_delta: -0.4, alert: false, rang: 1 },
    { fahrer_id: 'f4', fahrer_name: 'Anna B.',  avg_min: 2.1, batches_heute: 10, ampel: 'gruen', trend: 'stabil',   trend_delta: 0.0,  alert: false, rang: 2 },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  avg_min: 3.2, batches_heute:  8, ampel: 'gelb',  trend: 'steigend', trend_delta: 0.3,  alert: false, rang: 3 },
    { fahrer_id: 'f3', fahrer_name: 'Tim W.',   avg_min: 6.5, batches_heute:  6, ampel: 'rot',   trend: 'steigend', trend_delta: 0.7,  alert: true,  rang: 4 },
  ],
  team_avg_min: 3.3,
  alert_count: 1,
};

export function DispatchPhase2787ReaktionszeitBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen]     = useState(true);
  const [data, setData]     = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-reaktionszeit-auf-zuweisung?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted   = [...data.fahrer].sort((a, b) => a.avg_min - b.avg_min);
  const alerts   = data.fahrer.filter(f => f.alert);
  const hasAlert = alerts.length > 0;
  const teamAmpel = calcAmpel(data.team_avg_min);
  const best      = sorted[0]?.avg_min ?? 0;
  const { bg: teamBg, text: teamText } = ampelCls(teamAmpel);

  return (
    <div className={`rounded-xl border p-4 mb-4 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800">Reaktionszeit auf Zuweisung</span>
          {hasAlert && <AlertTriangle size={14} className="text-red-500" />}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${teamBg} ${teamText}`}>
            Ø {data.team_avg_min} Min
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
                  <span>— Langsame Reaktion! ({f.avg_min} Min)</span>
                </div>
              ))}
            </div>
          )}

          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Team-Ø',  val: `${data.team_avg_min} Min` },
              { label: 'Bester',  val: `${best} Min` },
              { label: 'Ziel',    val: `≤${ZIEL_MIN} Min` },
            ].map(k => (
              <div key={k.label} className="bg-gray-50 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500">{k.label}</div>
                <div className="text-sm font-semibold text-gray-800">{k.val}</div>
              </div>
            ))}
          </div>

          {/* Fahrerliste */}
          <div className="space-y-2">
            {sorted.map(f => {
              const a   = ampelCls(f.ampel || calcAmpel(f.avg_min));
              const pct = Math.min(100, (f.avg_min / MAX_MIN) * 100);
              const zielPct = (ZIEL_MIN / MAX_MIN) * 100;
              return (
                <div key={f.fahrer_id} className={`rounded-lg border p-2 ${a.bg}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${a.dot}`} />
                      <span className="text-xs font-medium text-gray-800">{f.fahrer_name}</span>
                      <TrendIcon trend={f.trend} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{f.batches_heute} Touren</span>
                      <span className={`font-bold ${a.text}`}>{f.avg_min} Min</span>
                    </div>
                  </div>
                  {/* Balken 0–10 Min mit Ziel-Linie 2 Min */}
                  <div className="relative h-2 bg-gray-200 rounded-full overflow-visible">
                    <div
                      className={`h-full rounded-full ${a.bar}`}
                      style={{ width: `${pct}%` }}
                    />
                    {/* Ziel-Linie */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-blue-400"
                      style={{ left: `${zielPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                    <span>0 Min</span>
                    <span className="text-blue-500">Ziel {ZIEL_MIN} Min</span>
                    <span>{MAX_MIN} Min</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ampel-Legende */}
          <div className="flex gap-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> ≤2 Min</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> 2–5 Min</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"   /> &gt;5 Min</span>
          </div>
        </div>
      )}
    </div>
  );
}
