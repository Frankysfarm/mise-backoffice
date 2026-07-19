'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  effizienz_pct: number;
  online_min: number;
  liefer_min: number;
  effizienz_pct_vw: number | null;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_pct: number;
  team_avg_pct_vw: number | null;
  alert_count: number;
}

const MOCK_DRIVER: FahrerEntry = {
  fahrer_id: 'me',
  effizienz_pct: 55,
  online_min: 420,
  liefer_min: 231,
  effizienz_pct_vw: 60,
  trend: 'fallend',
  trend_delta: -5,
  ampel: 'gelb',
  alert: false,
};
const MOCK: ApiData = { fahrer: [MOCK_DRIVER], team_avg_pct: 52, team_avg_pct_vw: 53, alert_count: 0 };

function ampelStyle(ampel: string) {
  if (ampel === 'gruen') return { text: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', bar: 'bg-green-500' };
  if (ampel === 'gelb')  return { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', bar: 'bg-amber-400' };
  return                  { text: 'text-red-600',   bg: 'bg-red-50',   border: 'border-red-200',   bar: 'bg-red-500'   };
}

function coaching(ampel: string): string {
  if (ampel === 'gruen') return 'Sehr gut! Du nutzt deine Online-Zeit effizient. Weiter so!';
  if (ampel === 'gelb')  return 'Tipp: Kürzere Wartezeiten zwischen Lieferungen erhöhen deine Effizienz.';
  return 'Tipp: Prüfe Routen und reduziere Leerlaufzeiten — jede Minute zählt!';
}

function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function FahrerPhase2561MeineOnlineZeit({
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
      ? `/api/delivery/admin/fahrer-online-zeit?location_id=${locationId}&driver_id=${driverId}`
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
  const pct = Math.min(100, me.effizienz_pct);

  return (
    <div className={`rounded-2xl border ${sty.border} ${sty.bg} shadow-sm mb-3`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className={sty.text} />
          <span className="font-semibold text-sm text-gray-800">Meine Online-Zeit-Effizienz</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${sty.text}`}>{me.effizienz_pct}%</span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Effizienz groß */}
          <div className="flex items-center justify-center py-2">
            <div className={`text-5xl font-black tabular-nums ${sty.text}`}>{me.effizienz_pct}</div>
            <div className="ml-1 text-xl text-gray-400">%</div>
          </div>

          {/* Fortschrittsbalken */}
          <div className="relative h-3 rounded-full bg-gray-200">
            <div className={`absolute left-0 top-0 h-full rounded-full transition-all ${sty.bar}`} style={{ width: `${pct}%` }} />
            <div className="absolute top-0 h-full border-l-2 border-dashed border-red-400 opacity-70"   style={{ left: '40%' }} title="Alert <40%" />
            <div className="absolute top-0 h-full border-l-2 border-dashed border-green-500 opacity-70" style={{ left: '60%' }} title="Ziel ≥60%" />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>0%</span><span className="text-red-400">40%</span><span className="text-green-500">60%</span><span>100%</span>
          </div>

          {/* Online vs. Lieferzeit */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-xl border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-gray-700">{fmtMin(me.online_min)}</div>
              <div className="text-xs text-gray-400">Online-Zeit</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-2 text-center">
              <div className={`text-base font-bold ${sty.text}`}>{fmtMin(me.liefer_min)}</div>
              <div className="text-xs text-gray-400">Lieferzeit</div>
            </div>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-xl border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-gray-600">{me.effizienz_pct_vw != null ? `${me.effizienz_pct_vw}%` : '–'}</div>
              <div className="text-xs text-gray-400">Vorwoche</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-gray-600">{data.team_avg_pct}%</div>
              <div className="text-xs text-gray-400">Team Ø</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-green-600">≥60%</div>
              <div className="text-xs text-gray-400">Ziel</div>
            </div>
          </div>

          {/* Trend */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            {me.trend === 'steigend'
              ? <TrendingUp size={13} className="text-green-600" />
              : me.trend === 'fallend'
                ? <TrendingDown size={13} className="text-red-500" />
                : <Minus size={13} className="text-gray-400" />}
            <span>{me.trend_delta > 0 ? '+' : ''}{me.trend_delta}% vs. Vorwoche</span>
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
