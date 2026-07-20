'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerSingle {
  fahrer_id: string;
  fahrer_name: string;
  liefertreue_heute: number;
  liefertreue_vw: number;
  puenktlich_heute: number;
  gesamt_heute: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rang: number;
}

interface ApiData {
  fahrer_single: FahrerSingle;
  team_avg_liefertreue: number;
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',   bar: 'bg-red-500',   big: 'text-red-600'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400', big: 'text-amber-600' };
  return                   { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500', big: 'text-green-600' };
}

function coaching(pct: number): string {
  if (pct >= 95) return 'Exzellente Liefertreue! Du lieferst fast immer pünktlich. Weiter so!';
  if (pct >= 85) return `${pct} % Liefertreue. Noch ein kleiner Schub bis zum Ziel ≥95 %.`;
  return `${pct} % — zu viele Verspätungen. Bitte überprüfe deine Routen und Zeitplanung.`;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-red-500"   />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK_SINGLE: FahrerSingle = {
  fahrer_id: 'mock-me', fahrer_name: 'Ich',
  liefertreue_heute: 94, liefertreue_vw: 90,
  puenktlich_heute: 47, gesamt_heute: 50,
  trend: 'steigend', trend_delta: 4, ampel: 'gelb', rang: 2,
};

export function FahrerPhase2699MeineLiefertreue({
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
    if (!isOnline || !locationId) {
      setData({ fahrer_single: MOCK_SINGLE, team_avg_liefertreue: 90.8 });
      return;
    }
    const params = new URLSearchParams({ location_id: locationId });
    if (driverId) params.set('driver_id', driverId);
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-liefertreue-heute?${params}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData({ fahrer_single: MOCK_SINGLE, team_avg_liefertreue: 90.8 }));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !data?.fahrer_single) return null;

  const me  = data.fahrer_single;
  const cls = ampelCls(me.ampel);

  return (
    <div className={`rounded-xl border ${cls.bg} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <CheckCircle size={16} className={cls.text} />
          <span className="font-semibold text-sm text-gray-800">Meine Liefertreue</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="text-center py-1">
            <p className={`text-4xl font-black ${cls.big}`}>{me.liefertreue_heute} %</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {me.puenktlich_heute} von {me.gesamt_heute} Lieferungen pünktlich
            </p>
          </div>

          <div className="relative h-4 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="absolute top-0 h-full w-0.5 bg-green-600 z-10"
              style={{ left: '95%' }}
              title="Ziel: ≥95 %"
            />
            <div
              className={`absolute top-0 left-0 h-full rounded-full ${cls.bar}`}
              style={{ width: `${me.liefertreue_heute}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 text-center">0 → 100 % | Ziel: ≥95 %</p>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
              <p className="text-xs text-gray-500">Trend</p>
              <div className="flex items-center gap-1">
                <TrendIcon trend={me.trend} />
                <p className="text-sm font-bold text-gray-700">
                  {me.trend_delta > 0 ? '+' : ''}{me.trend_delta} %
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
              <p className="text-xs text-gray-500">Vorwoche</p>
              <p className="text-sm font-bold text-gray-700">{me.liefertreue_vw} %</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
              <p className="text-xs text-gray-500">Rang</p>
              <p className={`text-sm font-bold ${cls.text}`}>#{me.rang}</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
              <p className="text-xs text-gray-500">Team-Ø</p>
              <p className="text-sm font-bold text-gray-700">{data.team_avg_liefertreue.toFixed(1)} %</p>
            </div>
          </div>

          <div className={`rounded-lg border ${cls.bg} px-3 py-2`}>
            <p className={`text-xs ${cls.text}`}>{coaching(me.liefertreue_heute)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
