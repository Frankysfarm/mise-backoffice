'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Navigation } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  km_heute: number;
  km_gestern: number | null;
  trend: 'besser' | 'schlechter' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_heute: number;
  team_avg_gestern: number | null;
  ziel: number;
  alert_count: number;
}

function ampelCls(ampel: string) {
  if (ampel === 'rot')  return { bg: 'bg-red-50 border-red-200',    dot: 'bg-red-500',    text: 'text-red-700',    bar: 'bg-red-500' };
  if (ampel === 'gelb') return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400',  text: 'text-amber-700',  bar: 'bg-amber-400' };
  return                       { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500',  text: 'text-green-700',  bar: 'bg-green-500' };
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'besser')     return <TrendingUp   size={12} className="text-green-600" />;
  if (trend === 'schlechter') return <TrendingDown size={12} className="text-red-500"   />;
  return <Minus size={12} className="text-gray-400" />;
}

function KmBalken({ km, barClass }: { km: number; barClass: string }) {
  const MAX  = 150;
  const ZIEL = 80;
  const fill    = Math.min(100, (km / MAX) * 100);
  const goalPct = Math.min(100, (ZIEL / MAX) * 100);
  return (
    <div className="relative h-3 rounded-full bg-gray-200 flex-1">
      <div className={`absolute top-0 left-0 h-full rounded-full ${barClass}`} style={{ width: `${fill}%` }} />
      <div
        className="absolute top-0 h-full border-l-2 border-dashed border-green-500"
        style={{ left: `${goalPct}%` }}
        title="Ziel ≥80 km"
      />
    </div>
  );
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f2', fahrer_name: 'Sarah K.', km_heute: 42.1, km_gestern: 61.5, trend: 'schlechter', trend_delta: -19.4, ampel: 'rot',   alert: true  },
    { fahrer_id: 'f5', fahrer_name: 'Jana F.',  km_heute: 38.7, km_gestern: 52.0, trend: 'schlechter', trend_delta: -13.3, ampel: 'rot',   alert: true  },
    { fahrer_id: 'f3', fahrer_name: 'Lena S.',  km_heute: 63.8, km_gestern: 65.2, trend: 'stabil',     trend_delta: -1.4,  ampel: 'gelb',  alert: false },
    { fahrer_id: 'f4', fahrer_name: 'Tom B.',   km_heute: 84.5, km_gestern: 79.3, trend: 'besser',     trend_delta: 5.2,   ampel: 'gruen', alert: false },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   km_heute: 97.4, km_gestern: 88.1, trend: 'besser',     trend_delta: 9.3,   ampel: 'gruen', alert: false },
  ],
  team_avg_heute: 65.3, team_avg_gestern: 69.2, ziel: 80, alert_count: 2,
};

export function DispatchPhase2600KmBilanzBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-km-bilanz-heute?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted     = [...data.fahrer].sort((a, b) => a.km_heute - b.km_heute);
  const hasAlert   = data.alert_count > 0;
  const teamAmpel  = data.team_avg_heute >= 80 ? 'gruen' : data.team_avg_heute >= 50 ? 'gelb' : 'rot';
  const teamCls    = ampelCls(teamAmpel);
  const alertNames = data.fahrer.filter((f: FahrerEntry) => f.alert).map((f: FahrerEntry) => f.fahrer_name);

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Navigation size={16} className={hasAlert ? 'text-red-500' : 'text-green-600'} />
          <span className="font-semibold text-sm text-gray-800">km-Bilanz-Board</span>
          {hasAlert && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              {data.alert_count} Alert{data.alert_count > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold ${teamCls.text}`}>Ø {data.team_avg_heute.toFixed(1)} km</span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className={`text-lg font-bold ${teamCls.text}`}>{data.team_avg_heute.toFixed(1)}</div>
              <div className="text-xs text-gray-500">Team Ø heute (km)</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-lg font-bold text-gray-700">
                {data.team_avg_gestern !== null ? data.team_avg_gestern.toFixed(1) : '—'}
              </div>
              <div className="text-xs text-gray-500">Gestern (km)</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-lg font-bold text-green-600">≥80</div>
              <div className="text-xs text-gray-500">Ziel (km)</div>
            </div>
          </div>

          {/* Alert-Banner */}
          {alertNames.length > 0 && (
            <div className="flex items-center gap-2 bg-red-100 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle size={14} className="text-red-600 flex-shrink-0" />
              <p className="text-xs text-red-700 font-medium">
                Unterauslastung (&lt;50 km): {alertNames.join(', ')}
              </p>
            </div>
          )}

          {/* Fahrerliste */}
          <div className="space-y-1.5">
            {sorted.map(f => {
              const cls = ampelCls(f.ampel);
              return (
                <div key={f.fahrer_id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${cls.bg}`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cls.dot}`} />
                  <span className="text-xs font-medium text-gray-700 w-20 truncate">{f.fahrer_name}</span>
                  <KmBalken km={f.km_heute} barClass={cls.bar} />
                  <span className={`text-xs font-bold w-14 text-right ${cls.text}`}>{f.km_heute.toFixed(1)} km</span>
                  <TrendIcon trend={f.trend} />
                  <span className="text-xs text-gray-400 w-12 text-right">
                    {f.trend_delta > 0 ? '+' : ''}{f.trend_delta.toFixed(1)} km
                  </span>
                </div>
              );
            })}
          </div>

          {/* Legende */}
          <div className="flex gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />≥80 km</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />50–79 km</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />&lt;50 km</span>
          </div>
        </div>
      )}
    </div>
  );
}
