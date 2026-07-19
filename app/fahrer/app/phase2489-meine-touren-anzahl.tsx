'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Map } from 'lucide-react';

interface FahrerTouren {
  fahrer_id: string;
  fahrer_name: string;
  touren_heute: number;
  touren_vw: number;
  trend: string;
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_low: boolean;
  alert_high: boolean;
}

interface ApiData {
  fahrer: FahrerTouren[];
  team_avg_touren: number;
  team_avg_touren_vw: number;
  alert_count: number;
}

function ampelStyle(touren: number) {
  if (touren >= 6 && touren <= 10) return { bg: 'bg-green-50 border-green-200', text: 'text-green-700', val: 'text-green-600' };
  if (touren < 4 || touren > 12) return { bg: 'bg-red-50 border-red-200', text: 'text-red-700', val: 'text-red-600' };
  return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', val: 'text-amber-600' };
}

function TourenBar({ touren }: { touren: number }) {
  const max = 15;
  const w = Math.min(100, (touren / max) * 100);
  const color = touren >= 6 && touren <= 10 ? 'bg-green-500' : touren < 4 || touren > 12 ? 'bg-red-500' : 'bg-amber-400';
  return (
    <div className="relative h-3 rounded-full bg-gray-200 w-full">
      <div className={`absolute left-0 top-0 h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${w}%` }} />
      <div className="absolute top-0 h-full border-l-2 border-dashed border-green-600" style={{ left: `${(6 / max) * 100}%` }} title="Ziel: 6" />
      <div className="absolute top-0 h-full border-l-2 border-dashed border-green-600" style={{ left: `${(10 / max) * 100}%` }} title="Ziel: 10" />
      <div className="absolute top-0 h-full border-l-2 border-dashed border-red-400" style={{ left: `${(12 / max) * 100}%` }} title="Alert: 12" />
    </div>
  );
}

function coachingTipp(touren: number): string {
  if (touren < 4) return `Nur ${touren} Touren heute — wenig los oder Probleme? Melde dich beim Dispatcher.`;
  if (touren >= 6 && touren <= 10) return `${touren} Touren — top! Du bist im optimalen Bereich. Weiter so!`;
  if (touren <= 12) return `${touren} Touren — etwas viel. Achte auf Pausen und informiere bei Bedarf den Dispatcher.`;
  return `${touren} Touren — zu viele! Bitte den Dispatcher kontaktieren — du brauchst Entlastung.`;
}

const MOCK: ApiData = {
  fahrer: [{ fahrer_id: 'me', fahrer_name: 'Ich', touren_heute: 8, touren_vw: 7, trend: 'steigend', trend_delta: 1, ampel: 'gruen', alert_low: false, alert_high: false }],
  team_avg_touren: 8.0,
  team_avg_touren_vw: 8.0,
  alert_count: 0,
};

export function FahrerPhase2489MeineTourenAnzahl({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!isOnline) return;
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-touren-anzahl?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId, isOnline]);

  if (!isOnline || !data) return null;

  const me = driverId ? data.fahrer.find(f => f.fahrer_id === driverId) : data.fahrer[0];
  if (!me) return null;

  const style = ampelStyle(me.touren_heute);
  const tipp = coachingTipp(me.touren_heute);

  return (
    <div className={`rounded-xl border ${style.bg} shadow-sm`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Map size={16} className={style.text} />
          <span className="text-sm font-bold text-gray-800">Meine Touren-Anzahl</span>
          <span className={`text-sm font-black tabular-nums ${style.val}`}>
            {me.touren_heute} Touren
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          <div className="flex items-end gap-3">
            <div className={`text-4xl font-black tabular-nums ${style.val}`}>
              {me.touren_heute}
            </div>
            <div className="pb-1">
              <div className="text-xs font-bold text-gray-500">Touren heute</div>
              <div className="flex items-center gap-1 text-[10px] text-gray-400">
                {me.trend === 'steigend' ? <TrendingUp size={11} className="text-green-600" /> :
                 me.trend === 'fallend' ? <TrendingDown size={11} className="text-red-500" /> :
                 <Minus size={11} className="text-gray-400" />}
                {me.trend_delta !== 0 ? `${me.trend_delta > 0 ? '+' : ''}${me.trend_delta} vs. VW` : 'Stabil vs. VW'}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <TourenBar touren={me.touren_heute} />
            <div className="flex justify-between text-[9px] text-gray-400">
              <span>0</span>
              <span className="text-green-600 font-bold">Min 6</span>
              <span className="text-green-600 font-bold">Ziel 10</span>
              <span className="text-red-400">Max 12</span>
              <span>15</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: 'Heute', val: `${me.touren_heute}`, col: style.val },
              { label: 'VW', val: `${me.touren_vw}`, col: 'text-gray-700' },
              { label: 'Ziel', val: '6–10', col: 'text-green-700' },
              { label: 'Team-Ø', val: `${data.team_avg_touren.toFixed(1)}`, col: 'text-blue-700' },
            ].map(k => (
              <div key={k.label} className="rounded-lg bg-white/60 px-2 py-2 text-center">
                <div className={`text-sm font-black ${k.col}`}>{k.val}</div>
                <div className="text-[9px] text-gray-400 mt-0.5">{k.label}</div>
              </div>
            ))}
          </div>

          <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${style.bg} ${style.text}`}>
            💡 {tipp}
          </div>
        </div>
      )}
    </div>
  );
}
