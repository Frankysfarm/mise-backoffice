'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Smile, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  score: number;
  score_vw: number | null;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
  bewertung_avg: number;
  trinkgeld_quote_pct: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg: number;
  team_avg_vw: number | null;
  alert_count: number;
}

const MOCK_DRIVER: FahrerEntry = {
  fahrer_id: 'me',
  score: 74,
  score_vw: 78,
  trend: 'fallend',
  trend_delta: -4,
  ampel: 'gelb',
  alert: false,
  bewertung_avg: 4.2,
  trinkgeld_quote_pct: 15.0,
};
const MOCK: ApiData = {
  fahrer: [MOCK_DRIVER],
  team_avg: 71,
  team_avg_vw: 71,
  alert_count: 0,
};

function ampelStyle(ampel: string) {
  if (ampel === 'gruen') return { text: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', bar: 'bg-green-500', ring: 'ring-green-200' };
  if (ampel === 'gelb')  return { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', bar: 'bg-amber-400', ring: 'ring-amber-200' };
  return                  { text: 'text-red-600',   bg: 'bg-red-50',   border: 'border-red-200',   bar: 'bg-red-500',   ring: 'ring-red-200'   };
}

function coaching(ampel: string): string {
  if (ampel === 'gruen') return 'Top! Deine Kunden sind begeistert. Weiter so!';
  if (ampel === 'gelb')  return 'Guter Start! Achte auf Pünktlichkeit und freundlichen Service.';
  return 'Tipp: Lächeln, schnell liefern und Kunden kurz informieren verbessert die Bewertung.';
}

export function FahrerPhase2556MeineZufriedenheitsScore({
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
    if (!isOnline || !driverId) { setData(MOCK); return; }
    const url = locationId
      ? `/api/delivery/admin/fahrer-zufriedenheits-score-v2?location_id=${locationId}&driver_id=${driverId}`
      : null;
    if (!url) { setData(MOCK); return; }
    const load = () => fetch(url).then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!data) return null;
  const me = data.fahrer[0] ?? MOCK_DRIVER;
  const sty = ampelStyle(me.ampel);
  const pct = Math.min(100, me.score);

  return (
    <div className={`rounded-2xl border ${sty.border} ${sty.bg} shadow-sm mb-3`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Smile size={16} className={sty.text} />
          <span className="font-semibold text-sm text-gray-800">Mein Zufriedenheits-Score</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${sty.text}`}>{me.score}</span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Score groß */}
          <div className="flex items-center justify-center py-2">
            <div className={`text-5xl font-black tabular-nums ${sty.text}`}>{me.score}</div>
            <div className="ml-2 text-xl text-gray-400">/100</div>
          </div>

          {/* Fortschrittsbalken */}
          <div className="relative h-3 rounded-full bg-gray-200">
            <div className={`absolute left-0 top-0 h-full rounded-full transition-all ${sty.bar}`} style={{ width: `${pct}%` }} />
            <div className="absolute top-0 h-full border-l-2 border-dashed border-red-400 opacity-70" style={{ left: '60%' }} title="Alert <60" />
            <div className="absolute top-0 h-full border-l-2 border-dashed border-green-500 opacity-70" style={{ left: '80%' }} title="Ziel ≥80" />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>0</span><span className="text-red-400">60</span><span className="text-green-500">80</span><span>100</span>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-xl border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-gray-600">{me.score_vw ?? '–'}</div>
              <div className="text-xs text-gray-400">Vorwoche</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-gray-600">{data.team_avg}</div>
              <div className="text-xs text-gray-400">Team Ø</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-green-600">≥80</div>
              <div className="text-xs text-gray-400">Ziel</div>
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-xl border border-gray-100 p-2">
              <div className="text-xs text-gray-500">Bewertung Ø</div>
              <div className="text-sm font-bold text-gray-700">★ {me.bewertung_avg.toFixed(1)}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-2">
              <div className="text-xs text-gray-500">Trinkgeld-Quote</div>
              <div className="text-sm font-bold text-gray-700">{me.trinkgeld_quote_pct.toFixed(1)}%</div>
            </div>
          </div>

          {/* Trend */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            {me.trend === 'steigend'
              ? <TrendingUp size={13} className="text-green-600" />
              : me.trend === 'fallend'
                ? <TrendingDown size={13} className="text-red-500" />
                : <Minus size={13} className="text-gray-400" />}
            <span>{me.trend_delta > 0 ? '+' : ''}{me.trend_delta} Punkte vs. Vorwoche</span>
          </div>

          {/* Coaching-Tipp */}
          <div className={`rounded-xl ${sty.bg} border ${sty.border} px-3 py-2`}>
            <p className={`text-xs font-medium ${sty.text}`}>{coaching(me.ampel)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
