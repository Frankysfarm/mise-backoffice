'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Gauge } from 'lucide-react';

interface DriverData {
  avg_min: number;
  touren_heute: number;
  ampel: string;
  alert: boolean;
  trend: string;
  trend_delta: number;
  rang: number;
  team_durchschnitt: number;
}

const ZIEL_MIN = 25;
const WARN_MIN = 35;
const MAX_BAR  = 60;

function calcAmpel(min: number): string {
  if (min <= ZIEL_MIN) return 'gruen';
  if (min <= WARN_MIN) return 'gelb';
  return 'rot';
}

function ampelColors(a: string) {
  if (a === 'rot')  return { text: 'text-red-600',   bar: 'bg-red-500',   bg: 'bg-red-50'   };
  if (a === 'gelb') return { text: 'text-amber-600', bar: 'bg-amber-400', bg: 'bg-amber-50' };
  return                   { text: 'text-green-600', bar: 'bg-green-500', bg: 'bg-green-50' };
}

function coachingTipp(ampel: string): string {
  if (ampel === 'rot')  return 'Route optimieren & unnötige Stopps vermeiden — Ziel: ≤25 Min!';
  if (ampel === 'gelb') return 'Gute Basis! Noch etwas flotter und du erreichst das Ziel.';
  return 'Ausgezeichnet! Du lieferst sehr schnell — weiter so!';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-green-600" />;
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-red-500"   />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK: DriverData = {
  avg_min: 27.3, touren_heute: 9, ampel: 'gelb', alert: false,
  trend: 'steigend', trend_delta: 2.3, rang: 3, team_durchschnitt: 27.9,
};

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2883MeineLiefergeschwindigkeit({ driverId, locationId, isOnline }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<DriverData | null>(null);

  useEffect(() => {
    if (!isOnline) return;
    if (!driverId || !locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-liefergeschwindigkeit?location_id=${locationId}&driver_id=${driverId}`)
        .then(r => r.json())
        .then((d: { fahrer?: DriverData[]; team_durchschnitt?: number }) => {
          const me = d.fahrer?.[0];
          if (me) setData({ ...me, team_durchschnitt: d.team_durchschnitt ?? me.avg_min });
          else setData(MOCK);
        })
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline) return null;
  if (!data) return null;

  const ampel = calcAmpel(data.avg_min);
  const { text, bar, bg } = ampelColors(ampel);
  const barPct  = Math.min((data.avg_min / MAX_BAR) * 100, 100);
  const zielPct = (ZIEL_MIN / MAX_BAR) * 100;

  return (
    <div className={`rounded-xl border p-4 mb-4 ${data.alert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Gauge size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800">Meine Liefergeschwindigkeit</span>
          {data.alert && <AlertTriangle size={14} className="text-red-500" />}
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {data.alert && (
            <div className="bg-red-100 border border-red-300 rounded-lg p-2 text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle size={12} />
              Zu langsam! ({data.avg_min.toFixed(1)} Min / Ziel ≤{ZIEL_MIN} Min)
            </div>
          )}

          <div className={`rounded-xl p-4 text-center ${bg}`}>
            <div className={`text-4xl font-black ${text}`}>{data.avg_min.toFixed(1)}</div>
            <div className="text-xs text-gray-500 mt-0.5">Min Ø Lieferzeit heute</div>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TrendIcon trend={data.trend} />
              <span className="text-xs text-gray-500">{Math.abs(data.trend_delta).toFixed(1)} Min vs. gestern</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="relative h-3 bg-gray-200 rounded-full overflow-visible">
              <div className={`h-full rounded-full ${bar}`} style={{ width: `${barPct}%` }} />
              <div className="absolute top-0 bottom-0 w-0.5 bg-indigo-400" style={{ left: `${zielPct}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>0 Min</span>
              <span className="text-indigo-500">Ziel {ZIEL_MIN} Min</span>
              <span>{MAX_BAR} Min</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Trend',    val: data.trend === 'fallend' ? '↘ schneller' : data.trend === 'steigend' ? '↗ langsamer' : '→ stabil' },
              { label: 'Ziel',     val: `≤${ZIEL_MIN} Min` },
              { label: 'Ampel',    val: ampel === 'gruen' ? '🟢 Gut' : ampel === 'gelb' ? '🟡 Ok' : '🔴 Alert' },
              { label: 'Touren',   val: `${data.touren_heute} heute` },
            ].map(k => (
              <div key={k.label} className="bg-gray-50 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500">{k.label}</div>
                <div className="text-sm font-semibold text-gray-800">{k.val}</div>
              </div>
            ))}
          </div>

          <div className="flex justify-between text-xs text-gray-500">
            <span>Team-Ø: {data.team_durchschnitt.toFixed(1)} Min</span>
            <span>Rang #{data.rang}</span>
          </div>

          <div className={`rounded-lg p-2 text-xs ${bg} ${text} font-medium`}>
            💡 {coachingTipp(ampel)}
          </div>
        </div>
      )}
    </div>
  );
}
