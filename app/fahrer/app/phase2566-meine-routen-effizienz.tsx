'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Route, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  effizienz_pct: number;
  effizienz_pct_vw: number | null;
  direkt_km: number;
  ist_km: number;
  lieferungen_count: number;
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

const MOCK_ME: FahrerEntry = {
  fahrer_id: 'me',
  effizienz_pct: 68.9,
  effizienz_pct_vw: 67.0,
  direkt_km: 3.1,
  ist_km: 4.5,
  lieferungen_count: 11,
  trend: 'steigend',
  trend_delta: 1.9,
  ampel: 'gelb',
  alert: false,
};
const MOCK: ApiData = { fahrer: [MOCK_ME], team_avg_pct: 69.6, team_avg_pct_vw: 69.7, alert_count: 0 };

function ampelStyle(ampel: string) {
  if (ampel === 'gruen') return { text: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', bar: 'bg-green-500' };
  if (ampel === 'gelb')  return { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', bar: 'bg-amber-400' };
  return                  { text: 'text-red-600',   bg: 'bg-red-50',   border: 'border-red-200',   bar: 'bg-red-500'   };
}

function coaching(ampel: string): string {
  if (ampel === 'gruen') return 'Top-Routen-Effizienz! Du fährst fast die direkte Linie. Weiter so!';
  if (ampel === 'gelb')  return 'Tipp: Prüfe vor der Tour die Route — kürzere Wege sparen Zeit und Sprit.';
  return 'Tipp: Nutze die vorgeschlagene Route und vermeide unnötige Umwege!';
}

export function FahrerPhase2566MeineRoutenEffizienz({
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
      ? `/api/delivery/admin/fahrer-routen-effizienz?location_id=${locationId}&driver_id=${driverId}`
      : null;
    if (!url) { setData(MOCK); return; }
    const load = () => fetch(url).then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!data) return null;
  const me = data.fahrer[0] ?? MOCK_ME;
  const sty = ampelStyle(me.ampel);
  const pct = Math.min(100, me.effizienz_pct);

  return (
    <div className={`rounded-2xl border ${sty.border} ${sty.bg} shadow-sm mb-3`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Route size={16} className={sty.text} />
          <span className="font-semibold text-sm text-gray-800">Meine Routen-Effizienz</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${sty.text}`}>{me.effizienz_pct}%</span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Haupt-% */}
          <div className="text-center py-2">
            <div className={`text-4xl font-black ${sty.text}`}>{me.effizienz_pct}%</div>
            <div className="text-xs text-gray-500 mt-1">Routen-Effizienz heute</div>
          </div>

          {/* Fortschrittsbalken */}
          <div className="relative h-3 rounded-full bg-gray-200">
            <div
              className={`absolute left-0 top-0 h-full rounded-full ${sty.bar} transition-all duration-500`}
              style={{ width: `${pct}%` }}
            />
            <div className="absolute top-0 h-full border-l-2 border-dashed border-red-400 opacity-80" style={{ left: '60%' }} />
            <div className="absolute top-0 h-full border-l-2 border-dashed border-green-600 opacity-80" style={{ left: '80%' }} />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>0%</span>
            <span className="text-red-400">60%</span>
            <span className="text-green-600">80% Ziel</span>
            <span>100%</span>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-sm font-bold text-gray-500">
                {me.effizienz_pct_vw != null ? `${me.effizienz_pct_vw}%` : '–'}
              </div>
              <div className="text-xs text-gray-400">Vorwoche</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="flex items-center justify-center gap-1">
                {me.trend === 'steigend' && <TrendingUp size={13} className="text-green-600" />}
                {me.trend === 'fallend'  && <TrendingDown size={13} className="text-red-500" />}
                {me.trend === 'stabil'   && <Minus size={13} className="text-gray-400" />}
                <span className={`text-sm font-bold ${me.trend === 'steigend' ? 'text-green-600' : me.trend === 'fallend' ? 'text-red-500' : 'text-gray-500'}`}>
                  {me.trend_delta >= 0 ? '+' : ''}{me.trend_delta.toFixed(1)}%
                </span>
              </div>
              <div className="text-xs text-gray-400">Trend</div>
            </div>
          </div>

          {/* Km-Vergleich */}
          <div className="rounded-lg bg-white border border-gray-100 p-3">
            <div className="text-xs text-gray-500 mb-1.5 font-medium">Ø km je Lieferung</div>
            <div className="flex items-center justify-between">
              <div className="text-center">
                <div className="text-base font-bold text-green-600">{me.direkt_km} km</div>
                <div className="text-xs text-gray-400">Direkt</div>
              </div>
              <div className="text-gray-300 text-lg">→</div>
              <div className="text-center">
                <div className="text-base font-bold text-gray-700">{me.ist_km} km</div>
                <div className="text-xs text-gray-400">Gefahren</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-bold text-gray-500">{me.lieferungen_count}×</div>
                <div className="text-xs text-gray-400">Touren</div>
              </div>
            </div>
          </div>

          {/* Coaching-Tipp */}
          <div className={`rounded-lg border ${sty.border} px-3 py-2`}>
            <p className={`text-xs ${sty.text} font-medium`}>{coaching(me.ampel)}</p>
          </div>

          {/* Team-Vergleich */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Team-Ø:</span>
            <span className="font-semibold">{data.team_avg_pct}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
