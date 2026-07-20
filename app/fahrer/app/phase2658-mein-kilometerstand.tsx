'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Navigation, TrendingUp, TrendingDown, Minus } from 'lucide-react';

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
}

function ampelVon(km: number): 'gruen' | 'gelb' | 'rot' {
  if (km <= 8)  return 'gruen';
  if (km <= 15) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',   bar: 'bg-red-500',   big: 'text-red-600'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400', big: 'text-amber-600' };
  return                   { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500', big: 'text-green-600' };
}

function coaching(ampel: string): string {
  if (ampel === 'gruen') return 'Optimal! Deine Touren sind effizient — kurze Wege, mehr Lieferungen möglich.';
  if (ampel === 'gelb')  return 'Etwas lange Wege. Prüfe ob Touren besser gebündelt werden können.';
  return 'Zu viele Kilometer je Tour. Bitte Dispatch kontaktieren — Routenoptimierung empfohlen!';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-red-500"   />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-green-600" />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK_DRIVER_ID = 'mock-me';
const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: MOCK_DRIVER_ID, fahrer_name: 'Ich', avg_km_tour: 9.8, trend: 'fallend', trend_delta: -1.1, touren_heute: 7 },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.', avg_km_tour: 11.8, trend: 'stabil', trend_delta: 0.2, touren_heute: 11 },
  ],
  team_avg_km_tour: 10.7,
};

export function FahrerPhase2658MeinKilometerstand({
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
      fetch(`/api/delivery/admin/fahrer-kilometerstand?location_id=${locationId}`)
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

  const ampel  = ampelVon(me.avg_km_tour);
  const cls    = ampelCls(ampel);
  const MAX    = 20;
  const ZIEL   = 8;
  const fill   = Math.min(100, (me.avg_km_tour / MAX) * 100);
  const goalPct = Math.min(100, (ZIEL / MAX) * 100);

  return (
    <div className={`rounded-xl border ${cls.bg} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Navigation size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800">Mein Kilometerstand</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold ${cls.text}`}>{me.avg_km_tour.toFixed(1)} km</span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className={`text-4xl font-black text-center py-2 ${cls.big}`}>
            {me.avg_km_tour.toFixed(1)} <span className="text-xl font-semibold">km</span>
            <div className="text-xs font-normal text-gray-500 mt-1">Ø km pro Tour</div>
          </div>

          <div className="relative h-4 rounded-full bg-gray-200">
            <div className={`absolute top-0 left-0 h-full rounded-full ${cls.bar}`} style={{ width: `${fill}%` }} />
            <div
              className="absolute top-0 h-full border-l-2 border-dashed border-green-500"
              style={{ left: `${goalPct}%` }}
              title="Ziel ≤8 km"
            />
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="flex items-center justify-center gap-1">
                <TrendIcon trend={me.trend} />
                <span className="text-sm font-bold text-gray-700">
                  {me.trend_delta > 0 ? '+' : ''}{me.trend_delta.toFixed(1)}
                </span>
              </div>
              <div className="text-xs text-gray-500">Trend</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-sm font-bold text-green-600">≤8 km</div>
              <div className="text-xs text-gray-500">Ziel</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className={`text-sm font-bold ${cls.text}`}>
                {ampel === 'gruen' ? '🟢' : ampel === 'gelb' ? '🟡' : '🔴'}
              </div>
              <div className="text-xs text-gray-500">Ampel</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-sm font-bold text-gray-700">{data.team_avg_km_tour.toFixed(1)}</div>
              <div className="text-xs text-gray-500">Team Ø</div>
            </div>
          </div>

          <div className={`rounded-lg px-3 py-2 text-xs border ${cls.bg} ${cls.text}`}>
            💡 {coaching(ampel)}
          </div>

          <div className="text-xs text-gray-400 text-right">alle 30 Min aktualisiert</div>
        </div>
      )}
    </div>
  );
}
