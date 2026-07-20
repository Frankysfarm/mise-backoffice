'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Coffee, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  pausen_min: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  alert: string | null;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_min: number;
}

function ampelVon(min: number): 'gruen' | 'gelb' | 'rot' {
  if (min >= 20 && min <= 40) return 'gruen';
  if ((min >= 10 && min < 20) || (min > 40 && min <= 60)) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',   bar: 'bg-red-500',   big: 'text-red-600'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400', big: 'text-amber-600' };
  return                   { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500', big: 'text-green-600' };
}

function coaching(ampel: string, alert: string | null): string {
  if (alert === 'Zu wenig Pause!') return 'Zu wenig Pause! Bitte lege eine Pause von mindestens 10 Minuten ein — besser 20–40 Min.';
  if (alert === 'Zu lange Pause!') return 'Pause über 60 Minuten! Bitte kehre auf Tour zurück, um den Zeitplan einzuhalten.';
  if (ampel === 'gruen') return 'Perfekte Pausenzeit (20–40 Min)! Gut erholt für die Tour.';
  return 'Pausenzeit im Randbereich. Ziel: 20–40 Minuten pro Schicht.';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-red-500"   />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK_DRIVER_ID = 'mock-me';
const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: MOCK_DRIVER_ID, fahrer_name: 'Ich',    pausen_min: 30, trend: 'steigend', trend_delta:  5, alert: null              },
    { fahrer_id: 'f2',           fahrer_name: 'Max M.', pausen_min: 7,  trend: 'fallend',  trend_delta: -18, alert: 'Zu wenig Pause!' },
  ],
  team_avg_min: 34,
};

export function FahrerPhase2688MeinePausen({
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
      fetch(`/api/delivery/admin/fahrer-schicht-pausen?location_id=${locationId}`)
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

  const ampel = ampelVon(me.pausen_min);
  const cls   = ampelCls(ampel);
  const max   = 90;
  const fill  = Math.min(100, (me.pausen_min / max) * 100);

  return (
    <div className={`rounded-xl border ${cls.bg} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Coffee size={16} className={cls.text} />
          <span className="font-semibold text-sm text-gray-800">Meine Pausen</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Big Value */}
          <div className="text-center py-1">
            <p className={`text-4xl font-black ${cls.big}`}>{me.pausen_min} Min</p>
            <p className="text-xs text-gray-500 mt-0.5">Gesamtpause heute</p>
          </div>

          {/* Bar with Ziel-Zone */}
          <div className="relative h-4 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="absolute top-0 h-full bg-green-100 border-x border-green-300"
              style={{ left: `${(20 / max) * 100}%`, width: `${(20 / max) * 100}%` }}
              title="Ziel-Zone 20–40 Min"
            />
            <div
              className={`absolute top-0 left-0 h-full rounded-full ${cls.bar}`}
              style={{ width: `${fill}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 text-center">0 → 90 Min | Ziel: 20–40 Min</p>

          {/* KPI Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
              <p className="text-xs text-gray-500">Trend</p>
              <div className="flex items-center gap-1">
                <TrendIcon trend={me.trend} />
                <p className="text-sm font-bold text-gray-700">
                  {me.trend_delta > 0 ? '+' : ''}{me.trend_delta} Min
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
              <p className="text-xs text-gray-500">Ziel</p>
              <p className="text-sm font-bold text-green-700">20–40 Min</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
              <p className="text-xs text-gray-500">Ampel</p>
              <p className={`text-sm font-bold ${cls.text}`}>
                {ampel === 'gruen' ? '🟢 Optimal' : ampel === 'gelb' ? '🟡 Randzone' : '🔴 Abweichung'}
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
              <p className="text-xs text-gray-500">Team-Ø</p>
              <p className="text-sm font-bold text-gray-700">{data.team_avg_min} Min</p>
            </div>
          </div>

          {/* Coaching */}
          <div className={`rounded-lg border ${cls.bg} px-3 py-2`}>
            <p className={`text-xs ${cls.text}`}>{coaching(ampel, me.alert)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
