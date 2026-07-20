'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, BedDouble, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  ruhe_h: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_ruhe_h: number;
}

function ampelVon(h: number): 'gruen' | 'gelb' | 'rot' {
  if (h >= 11) return 'gruen';
  if (h >= 8)  return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',   bar: 'bg-red-500',   big: 'text-red-600'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400', big: 'text-amber-600' };
  return                   { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500', big: 'text-green-600' };
}

function coaching(ampel: string): string {
  if (ampel === 'gruen') return 'Super Erholung — mind. 11 h Pause eingehalten! Weiter so.';
  if (ampel === 'gelb')  return 'Ruhezeit im gelben Bereich (8–10 h). Versuche auf 11 h zu kommen.';
  return 'Ruhezeit unter 8 h! Bitte Dispatch informieren — Erschöpfungsrisiko beachten.';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-red-500"   />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK_DRIVER_ID = 'mock-me';
const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: MOCK_DRIVER_ID, fahrer_name: 'Ich',    ruhe_h: 9.5,  trend: 'steigend', trend_delta:  1.5 },
    { fahrer_id: 'f2',           fahrer_name: 'Max M.', ruhe_h: 6.5,  trend: 'fallend',  trend_delta: -1.5 },
  ],
  team_avg_ruhe_h: 9.0,
};

export function FahrerPhase2678MeineRuhezeit({
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
      fetch(`/api/delivery/admin/fahrer-ruhezeiten?location_id=${locationId}`)
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

  const ampel = ampelVon(me.ruhe_h);
  const cls   = ampelCls(ampel);
  const MAX   = 16;
  const fill  = Math.min(100, (me.ruhe_h / MAX) * 100);
  const goal  = Math.min(100, (11 / MAX) * 100);

  return (
    <div className={`rounded-xl border ${cls.bg} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <BedDouble size={16} className={cls.text} />
          <span className="font-semibold text-sm text-gray-800">Meine Ruhezeit</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Big Value */}
          <div className="text-center py-1">
            <p className={`text-4xl font-black ${cls.big}`}>{me.ruhe_h} h</p>
            <p className="text-xs text-gray-500 mt-0.5">Ruhezeit seit letzter Schicht</p>
          </div>

          {/* Bar */}
          <div className="relative h-4 rounded-full bg-gray-200">
            <div className={`absolute top-0 left-0 h-full rounded-full ${cls.bar}`} style={{ width: `${fill}%` }} />
            <div
              className="absolute top-0 h-full border-l-2 border-dashed border-green-600"
              style={{ left: `${goal}%` }}
              title="Ziel ≥11 h"
            />
          </div>
          <p className="text-xs text-gray-400 text-center">0 h → 16 h | Ziel: ≥11 h</p>

          {/* KPI Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
              <p className="text-xs text-gray-500">Trend gestern</p>
              <div className="flex items-center gap-1">
                <TrendIcon trend={me.trend} />
                <p className="text-sm font-bold text-gray-700">
                  {me.trend_delta > 0 ? '+' : ''}{me.trend_delta} h
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
              <p className="text-xs text-gray-500">Ziel</p>
              <p className="text-sm font-bold text-green-600">≥11 h</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
              <p className="text-xs text-gray-500">Ampel</p>
              <p className={`text-sm font-bold ${cls.text}`}>
                {ampel === 'gruen' ? '🟢 Gut' : ampel === 'gelb' ? '🟡 Mittel' : '🔴 Zu kurz'}
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
              <p className="text-xs text-gray-500">Team-Ø</p>
              <p className="text-sm font-bold text-gray-700">{data.team_avg_ruhe_h} h</p>
            </div>
          </div>

          {/* Coaching */}
          <div className={`rounded-lg border ${cls.bg} px-3 py-2`}>
            <p className={`text-xs ${cls.text}`}>{coaching(ampel)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
