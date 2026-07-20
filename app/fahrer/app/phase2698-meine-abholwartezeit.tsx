'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_min: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rang: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_min: number;
  alert_count: number;
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',   bar: 'bg-red-500',   big: 'text-red-600'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400', big: 'text-amber-600' };
  return                   { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500', big: 'text-green-600' };
}

function coaching(min: number): string {
  if (min <= 4)  return 'Perfekt — du wartest kaum auf Abholung. Weiter so!';
  if (min <= 8)  return `${min.toFixed(1)} Min Wartezeit. Versuche noch früher zu sein, Ziel ist ≤4 Min.`;
  return `${min.toFixed(1)} Min Wartezeit ist zu lang. Bitte melde dich beim Restaurant sobald du da bist.`;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-red-500"   />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-green-600" />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'mock-me', fahrer_name: 'Ich',    avg_min: 3.8, trend: 'fallend',  trend_delta: -0.6, ampel: 'gruen', rang: 1 },
    { fahrer_id: 'f2',      fahrer_name: 'Max M.', avg_min: 7.2, trend: 'steigend', trend_delta:  1.2, ampel: 'gelb',  rang: 2 },
  ],
  team_avg_min: 5.5,
  alert_count: 0,
};

export function FahrerPhase2698MeineAbholwartezeit({
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
    if (!isOnline || !locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-abholwartezeit?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !data) return null;

  const me = driverId
    ? (data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0])
    : data.fahrer[0];
  if (!me) return null;

  const cls  = ampelCls(me.ampel);
  const max  = 15;
  const fill = Math.min(100, (me.avg_min / max) * 100);
  const zielPct = (4 / max) * 100;

  return (
    <div className={`rounded-xl border ${cls.bg} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className={cls.text} />
          <span className="font-semibold text-sm text-gray-800">Meine Abholwartezeit</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="text-center py-1">
            <p className={`text-4xl font-black ${cls.big}`}>{me.avg_min.toFixed(1)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Ø Abholwartezeit (Min)</p>
          </div>

          <div className="relative h-4 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="absolute top-0 h-full w-0.5 bg-green-500 z-10"
              style={{ left: `${zielPct}%` }}
              title="Ziel: ≤4 Min"
            />
            <div
              className={`absolute top-0 left-0 h-full rounded-full ${cls.bar}`}
              style={{ width: `${fill}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 text-center">0 → 15 Min | Ziel: ≤4 Min</p>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
              <p className="text-xs text-gray-500">Trend</p>
              <div className="flex items-center gap-1">
                <TrendIcon trend={me.trend} />
                <p className="text-sm font-bold text-gray-700">
                  {me.trend_delta > 0 ? '+' : ''}{me.trend_delta.toFixed(1)} Min
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
              <p className="text-xs text-gray-500">Ziel</p>
              <p className="text-sm font-bold text-green-700">≤4 Min</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
              <p className="text-xs text-gray-500">Rang</p>
              <p className={`text-sm font-bold ${cls.text}`}>#{me.rang}</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
              <p className="text-xs text-gray-500">Team-Ø</p>
              <p className="text-sm font-bold text-gray-700">{data.team_avg_min.toFixed(1)} Min</p>
            </div>
          </div>

          <div className={`rounded-lg border ${cls.bg} px-3 py-2`}>
            <p className={`text-xs ${cls.text}`}>{coaching(me.avg_min)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
