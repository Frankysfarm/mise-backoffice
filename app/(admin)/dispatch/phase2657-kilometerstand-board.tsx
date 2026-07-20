'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Navigation } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_km_tour: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  touren_heute: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_km_tour: number;
  alert_count: number;
}

function ampelVon(km: number): 'gruen' | 'gelb' | 'rot' {
  if (km <= 8)  return 'gruen';
  if (km <= 15) return 'gelb';
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

function KmBalken({ km, barClass }: { km: number; barClass: string }) {
  const MAX     = 20;
  const ZIEL    = 8;
  const fill    = Math.min(100, (km   / MAX) * 100);
  const goalPct = Math.min(100, (ZIEL / MAX) * 100);
  return (
    <div className="relative h-3 rounded-full bg-gray-200 flex-1">
      <div className={`absolute top-0 left-0 h-full rounded-full ${barClass}`} style={{ width: `${fill}%` }} />
      <div
        className="absolute top-0 h-full border-l-2 border-dashed border-green-500"
        style={{ left: `${goalPct}%` }}
        title="Ziel ≤8 km"
      />
    </div>
  );
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f3', fahrer_name: 'Tim W.',   avg_km_tour: 17.4, trend: 'steigend', trend_delta:  2.1, touren_heute: 9  },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  avg_km_tour: 11.8, trend: 'fallend',  trend_delta: -1.2, touren_heute: 11 },
    { fahrer_id: 'f4', fahrer_name: 'Anna B.',  avg_km_tour:  7.3, trend: 'steigend', trend_delta:  0.4, touren_heute: 8  },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   avg_km_tour:  6.1, trend: 'fallend',  trend_delta: -0.8, touren_heute: 10 },
  ],
  team_avg_km_tour: 10.7,
  alert_count: 1,
};

export function DispatchPhase2657KilometerstandBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-kilometerstand?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched = data.fahrer.map(f => ({ ...f, ampel: ampelVon(f.avg_km_tour) }));
  const sorted   = [...enriched].sort((a, b) => b.avg_km_tour - a.avg_km_tour);
  const alerts   = enriched.filter(f => f.avg_km_tour > 15);
  const hasAlert = alerts.length > 0;
  const teamAmpel = ampelVon(data.team_avg_km_tour);
  const teamCls   = ampelCls(teamAmpel);
  const bestKm    = enriched.length > 0 ? Math.min(...enriched.map(f => f.avg_km_tour)) : null;

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Navigation size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800">Kilometerstand je Fahrer</span>
          {hasAlert && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              {alerts.length} Alert{alerts.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold ${teamCls.text}`}>Ø {data.team_avg_km_tour.toFixed(1)} km</span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {hasAlert && (
            <div className="flex items-start gap-2 bg-red-100 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 font-medium">
                km/Tour &gt;15: {alerts.map(f => f.fahrer_name).join(', ')}
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className={`text-lg font-bold ${teamCls.text}`}>{data.team_avg_km_tour.toFixed(1)} km</div>
              <div className="text-xs text-gray-500">Team Ø heute</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-lg font-bold text-gray-700">
                {bestKm !== null ? `${bestKm.toFixed(1)} km` : '—'}
              </div>
              <div className="text-xs text-gray-500">Bester heute</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-lg font-bold text-green-600">≤8 km</div>
              <div className="text-xs text-gray-500">Ziel</div>
            </div>
          </div>

          <div className="space-y-2">
            {sorted.map(f => {
              const cls = ampelCls(f.ampel);
              return (
                <div key={f.fahrer_id} className={`rounded-lg border p-2 ${cls.bg}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cls.dot}`} />
                    <span className="text-xs font-medium text-gray-800 flex-1 truncate">{f.fahrer_name}</span>
                    <TrendIcon trend={f.trend} />
                    <span className={`text-xs font-bold ${cls.text}`}>{f.avg_km_tour.toFixed(1)} km</span>
                  </div>
                  <KmBalken km={f.avg_km_tour} barClass={cls.bar} />
                </div>
              );
            })}
          </div>

          <div className="flex justify-between text-xs text-gray-400">
            <span>
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />≤8 km
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mx-1 ml-2" />9–15 km
              <span className="inline-block w-2 h-2 rounded-full bg-red-500 mx-1 ml-2" />&gt;15 km
            </span>
            <span>alle 30 Min aktualisiert</span>
          </div>
        </div>
      )}
    </div>
  );
}
