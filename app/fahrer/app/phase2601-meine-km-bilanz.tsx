'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Navigation } from 'lucide-react';

interface SingleEntry {
  fahrer_id: string;
  fahrer_name: string;
  km_heute: number;
  km_gestern: number | null;
  trend: 'besser' | 'schlechter' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface SingleData {
  fahrer_single: SingleEntry;
  team_avg_heute: number;
  team_avg_gestern: number | null;
  ziel: number;
}

function ampelStyle(ampel: string) {
  if (ampel === 'rot')  return { text: 'text-red-600',   bg: 'bg-red-50 border-red-200',    bar: 'bg-red-500',   tip: 'bg-red-100 text-red-800'   };
  if (ampel === 'gelb') return { text: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', bar: 'bg-amber-400', tip: 'bg-amber-50 text-amber-800' };
  return                       { text: 'text-green-600', bg: 'bg-green-50 border-green-200', bar: 'bg-green-500', tip: 'bg-green-50 text-green-800'  };
}

function coachingTipp(e: SingleEntry): string {
  if (e.ampel === 'rot')  return 'Deine heutigen km sind niedrig. Nimm aktiv mehr Touren an, um deine Kilometerleistung zu steigern!';
  if (e.ampel === 'gelb') return 'Du bist auf dem Weg zum Ziel. Noch einige Touren und du erreichst ≥80 km heute!';
  return 'Super Leistung! Du hast das Tagesziel von 80 km erreicht. Weiter so!';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'besser')     return <TrendingUp   size={14} className="text-green-600" />;
  if (trend === 'schlechter') return <TrendingDown size={14} className="text-red-500"   />;
  return <Minus size={14} className="text-gray-400" />;
}

function KmBalken({ km, barClass }: { km: number; barClass: string }) {
  const MAX  = 150;
  const ZIEL = 80;
  const fill    = Math.min(100, (km / MAX) * 100);
  const goalPct = Math.min(100, (ZIEL / MAX) * 100);
  return (
    <div className="relative h-3 rounded-full bg-gray-200">
      <div className={`absolute top-0 left-0 h-full rounded-full ${barClass}`} style={{ width: `${fill}%` }} />
      <div
        className="absolute top-0 h-full border-l-2 border-dashed border-green-500"
        style={{ left: `${goalPct}%` }}
        title="Ziel ≥80 km"
      />
    </div>
  );
}

const MOCK: SingleData = {
  fahrer_single: {
    fahrer_id: 'me', fahrer_name: 'Ich',
    km_heute: 54.2, km_gestern: 68.0,
    trend: 'schlechter', trend_delta: -13.8,
    ampel: 'gelb', alert: false,
  },
  team_avg_heute: 65.3,
  team_avg_gestern: 69.2,
  ziel: 80,
};

export function FahrerPhase2601MeineKmBilanz({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<SingleData | null>(null);

  useEffect(() => {
    if (!isOnline) return;
    if (!locationId) { setData(MOCK); return; }
    const params = new URLSearchParams({ location_id: locationId });
    if (driverId) params.set('driver_id', driverId);
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-km-bilanz-heute?${params}`)
        .then(r => r.json())
        .then((res: SingleData | { fahrer: SingleEntry[]; team_avg_heute: number; team_avg_gestern: number | null; ziel: number }) => {
          if ('fahrer_single' in res && res.fahrer_single) {
            setData(res as SingleData);
          } else if ('fahrer' in res && Array.isArray(res.fahrer) && res.fahrer.length > 0) {
            const all = res as { fahrer: SingleEntry[]; team_avg_heute: number; team_avg_gestern: number | null; ziel: number };
            const me  = driverId ? all.fahrer.find(f => f.fahrer_id === driverId) : null;
            setData({
              fahrer_single:  me ?? all.fahrer[0],
              team_avg_heute: all.team_avg_heute,
              team_avg_gestern: all.team_avg_gestern,
              ziel: all.ziel,
            });
          } else {
            setData(MOCK);
          }
        })
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !data) return null;

  const e   = data.fahrer_single;
  const st  = ampelStyle(e.ampel);
  const tip = coachingTipp(e);

  return (
    <div className={`rounded-xl border ${st.bg} shadow-sm mb-3`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Navigation size={16} className={st.text} />
          <span className="font-semibold text-sm text-gray-800">Meine km-Bilanz</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${st.text}`}>{e.km_heute.toFixed(1)} km</span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Hauptwert */}
          <div className="text-center py-2">
            <div className={`text-4xl font-black ${st.text}`}>{e.km_heute.toFixed(1)}</div>
            <div className="text-sm text-gray-500 mt-0.5">km heute</div>
          </div>

          {/* Balken */}
          <KmBalken km={e.km_heute} barClass={st.bar} />
          <div className="flex justify-between text-xs text-gray-400">
            <span>0 km</span>
            <span className="text-green-600 font-medium">Ziel: 80 km</span>
            <span>150 km</span>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-4 gap-1.5">
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-sm font-bold text-gray-700">
                {e.km_gestern !== null ? e.km_gestern.toFixed(1) : '—'}
              </div>
              <div className="text-xs text-gray-400">Gestern</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="flex justify-center"><TrendIcon trend={e.trend} /></div>
              <div className="text-xs text-gray-400">Trend</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-sm font-bold text-green-600">80</div>
              <div className="text-xs text-gray-400">Ziel</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-sm font-bold text-gray-700">{data.team_avg_heute.toFixed(1)}</div>
              <div className="text-xs text-gray-400">Team Ø</div>
            </div>
          </div>

          {/* Coaching-Tipp */}
          <div className={`rounded-lg px-3 py-2 text-xs ${st.tip}`}>
            {tip}
          </div>
        </div>
      )}
    </div>
  );
}
