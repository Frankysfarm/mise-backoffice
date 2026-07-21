'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Gauge } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_min: number;
  touren_heute: number;
  ampel: string;
  alert: boolean;
  trend: string;
  trend_delta: number;
  rang: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_durchschnitt: number;
}

const ZIEL_MIN  = 25;
const WARN_MIN  = 35;
const MAX_BAR   = 60;

function calcAmpel(min: number): string {
  if (min <= ZIEL_MIN) return 'gruen';
  if (min <= WARN_MIN) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    dot: 'bg-red-500',   text: 'text-red-700',   bar: 'bg-red-500'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700', bar: 'bg-amber-400' };
  return                   { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700', bar: 'bg-green-500' };
}

function TrendIcon({ trend }: { trend: string }) {
  // Invertiert: fallend=grün (schneller=besser), steigend=rot
  if (trend === 'fallend')  return <TrendingDown size={12} className="text-green-600" />;
  if (trend === 'steigend') return <TrendingUp   size={12} className="text-red-500"   />;
  return                           <Minus        size={12} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'd1', fahrer_name: 'Max M.',   avg_min: 21.5, touren_heute: 12, ampel: 'gruen', alert: false, trend: 'fallend',  trend_delta: -1.5, rang: 1 },
    { fahrer_id: 'd2', fahrer_name: 'Anna B.',  avg_min: 24.8, touren_heute: 11, ampel: 'gruen', alert: false, trend: 'fallend',  trend_delta: -1.4, rang: 2 },
    { fahrer_id: 'd3', fahrer_name: 'Sara K.',  avg_min: 27.3, touren_heute:  9, ampel: 'gelb',  alert: false, trend: 'steigend', trend_delta:  2.3, rang: 3 },
    { fahrer_id: 'd4', fahrer_name: 'Tim W.',   avg_min: 38.1, touren_heute:  7, ampel: 'rot',   alert: true,  trend: 'steigend', trend_delta:  1.6, rang: 4 },
  ],
  team_durchschnitt: 27.9,
};

export function DispatchPhase2882LiefergeschwindigkeitBoard({ locationId }: { locationId: string | null }) {
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

  const enriched = data.fahrer.map(f => ({ ...f, ampel: calcAmpel(f.avg_min) }));
  const sorted   = [...enriched].sort((a, b) => a.avg_min - b.avg_min);
  const alerts   = enriched.filter(f => f.avg_min > WARN_MIN);
  const hasAlert = alerts.length > 0;
  const best     = sorted[0]?.avg_min ?? 0;
  const teamAmpel = calcAmpel(data.team_durchschnitt);
  const { text: teamText } = ampelCls(teamAmpel);

  return (
    <div className={`rounded-xl border p-4 mb-4 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Gauge size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800">Liefergeschwindigkeit Fahrer</span>
          {hasAlert && <AlertTriangle size={14} className="text-red-500" />}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 ${teamText}`}>
            Ø {data.team_durchschnitt.toFixed(1)} Min
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {hasAlert && (
            <div className="bg-red-100 border border-red-300 rounded-lg p-2 space-y-1">
              {alerts.map(f => (
                <div key={f.fahrer_id} className="flex items-center gap-2 text-xs text-red-700">
                  <AlertTriangle size={12} />
                  <span className="font-medium">{f.fahrer_name}</span>
                  <span>— Zu langsam! ({f.avg_min.toFixed(1)} Min / Ziel ≤{ZIEL_MIN} Min)</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Team-Ø', val: `${data.team_durchschnitt.toFixed(1)} Min` },
              { label: 'Bester', val: `${best.toFixed(1)} Min` },
              { label: 'Ziel',   val: `≤${ZIEL_MIN} Min` },
            ].map(k => (
              <div key={k.label} className="bg-gray-50 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500">{k.label}</div>
                <div className="text-sm font-semibold text-gray-800">{k.val}</div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            {sorted.map(f => {
              const a      = ampelCls(f.ampel);
              const barPct = Math.min((f.avg_min / MAX_BAR) * 100, 100);
              const zielPct = (ZIEL_MIN / MAX_BAR) * 100;
              return (
                <div key={f.fahrer_id} className={`rounded-lg border p-2 ${a.bg}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${a.dot}`} />
                      <span className="text-xs font-medium text-gray-800">{f.fahrer_name}</span>
                      <TrendIcon trend={f.trend} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{f.touren_heute} Touren</span>
                      <span className={`font-bold ${a.text}`}>{f.avg_min.toFixed(1)} Min</span>
                    </div>
                  </div>
                  <div className="relative h-2 bg-gray-200 rounded-full overflow-visible">
                    <div className={`h-full rounded-full ${a.bar}`} style={{ width: `${barPct}%` }} />
                    <div className="absolute top-0 bottom-0 w-0.5 bg-indigo-400" style={{ left: `${zielPct}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                    <span>0</span>
                    <span className="text-indigo-500">Ziel {ZIEL_MIN} Min</span>
                    <span>{MAX_BAR} Min</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> ≤{ZIEL_MIN} Min</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> {ZIEL_MIN+1}–{WARN_MIN} Min</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"   /> &gt;{WARN_MIN} Min</span>
          </div>
        </div>
      )}
    </div>
  );
}
