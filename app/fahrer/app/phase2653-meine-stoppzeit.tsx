'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Timer, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerSingle {
  fahrer_id: string;
  fahrer_name: string;
  avg_stoppzeit_min: number;
  avg_stoppzeit_min_vw: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  fahrer_single: FahrerSingle;
  team_avg_stoppzeit_min: number;
}

function ampelVon(min: number): 'gruen' | 'gelb' | 'rot' {
  if (min <= 3) return 'gruen';
  if (min <= 7) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',   bar: 'bg-red-500',   big: 'text-red-600'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400', big: 'text-amber-600' };
  return                   { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500', big: 'text-green-600' };
}

function coaching(ampel: string): string {
  if (ampel === 'gruen') return 'Super! Deine Stoppzeit ist im Zielbereich. Weiter so!';
  if (ampel === 'gelb')  return 'Fast am Ziel. Versuche Übergaben zügiger abzuschließen.';
  return 'Stoppzeit zu lang. Reduziere Wartezeit beim Kunden — klingeln, warten, weiter!';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-red-500"   />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-green-600" />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer_single: {
    fahrer_id: 'me',
    fahrer_name: 'Ich',
    avg_stoppzeit_min: 5.3,
    avg_stoppzeit_min_vw: 6.1,
    trend: 'fallend',
    trend_delta: -0.8,
    ampel: 'gelb',
  },
  team_avg_stoppzeit_min: 6.2,
};

export function FahrerPhase2653MeineStoppzeit({
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
    if (!isOnline || !driverId || !locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-stoppzeit?location_id=${locationId}&driver_id=${driverId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !data) return null;

  const f      = data.fahrer_single;
  const ampel  = ampelVon(f.avg_stoppzeit_min);
  const cls    = ampelCls(ampel);
  const MAX    = 15;
  const ZIEL   = 3;
  const fill   = Math.min(100, (f.avg_stoppzeit_min / MAX) * 100);
  const goalPct = Math.min(100, (ZIEL / MAX) * 100);

  return (
    <div className={`rounded-xl border ${cls.bg} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Timer size={16} className="text-orange-500" />
          <span className="font-semibold text-sm text-gray-800">Meine Stoppzeit</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold ${cls.text}`}>{f.avg_stoppzeit_min.toFixed(1)} Min</span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className={`text-4xl font-black text-center py-2 ${cls.big}`}>
            {f.avg_stoppzeit_min.toFixed(1)} <span className="text-xl font-semibold">Min</span>
          </div>

          <div className="relative h-4 rounded-full bg-gray-200">
            <div className={`absolute top-0 left-0 h-full rounded-full ${cls.bar}`} style={{ width: `${fill}%` }} />
            <div
              className="absolute top-0 h-full border-l-2 border-dashed border-green-500"
              style={{ left: `${goalPct}%` }}
              title="Ziel ≤3 Min"
            />
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="flex items-center justify-center gap-1">
                <TrendIcon trend={f.trend} />
                <span className="text-sm font-bold text-gray-700">
                  {f.trend_delta > 0 ? '+' : ''}{f.trend_delta.toFixed(1)}
                </span>
              </div>
              <div className="text-xs text-gray-500">Trend</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-sm font-bold text-green-600">≤3 Min</div>
              <div className="text-xs text-gray-500">Ziel</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className={`text-sm font-bold ${cls.text}`}>
                {ampel === 'gruen' ? '🥇' : ampel === 'gelb' ? '🥈' : '🔴'}
              </div>
              <div className="text-xs text-gray-500">Ampel</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-sm font-bold text-gray-700">{data.team_avg_stoppzeit_min.toFixed(1)}</div>
              <div className="text-xs text-gray-500">Team Ø</div>
            </div>
          </div>

          <div className={`rounded-lg px-3 py-2 text-xs ${cls.bg} border ${cls.text.replace('text-', 'border-')}`}>
            💡 {coaching(ampel)}
          </div>

          <div className="text-xs text-gray-400 text-right">alle 30 Min aktualisiert</div>
        </div>
      )}
    </div>
  );
}
