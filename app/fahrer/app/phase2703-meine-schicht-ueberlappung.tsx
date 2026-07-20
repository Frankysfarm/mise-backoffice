'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Layers, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerSingle {
  fahrer_id: string;
  fahrer_name: string;
  ueberlappung_min: number;
  ueberlappung_min_gestern: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: string | null;
}

interface ApiData {
  fahrer_single: FahrerSingle;
  team_avg_ueberlappung: number;
}

function calcAmpel(min: number): 'gruen' | 'gelb' | 'rot' {
  if (min === 0) return 'gruen';
  if (min <= 30) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    text: 'text-red-600',   big: 'text-red-600',   bar: 'bg-red-500'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-600', big: 'text-amber-600', bar: 'bg-amber-400' };
  return                   { bg: 'bg-green-50 border-green-200', text: 'text-green-600', big: 'text-green-600', bar: 'bg-green-500' };
}

function coaching(min: number, alert: string | null): string {
  if (alert) return 'Deine Schichten überlappen sich! Bitte den Dispatcher kontaktieren, um das zu korrigieren.';
  if (min <= 30 && min > 0) return `${min} Min Überlappung — bitte kläre das mit dem Dispatcher.`;
  return 'Keine Schicht-Überlappung heute. Super!';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-red-500"   />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-green-600" />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK_ME: ApiData = {
  fahrer_single: {
    fahrer_id:               'mock-me',
    fahrer_name:             'Ich',
    ueberlappung_min:        0,
    ueberlappung_min_gestern: 0,
    trend:                   'stabil',
    trend_delta:             0,
    ampel:                   'gruen',
    alert:                   null,
  },
  team_avg_ueberlappung: 15,
};

export function FahrerPhase2703MeineSchichtUeberlappung({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!isOnline || !driverId || !locationId) { setData(MOCK_ME); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-schicht-ueberlappung?location_id=${locationId}&driver_id=${driverId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK_ME));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !data) return null;

  const f   = data.fahrer_single;
  const cls = ampelCls(f.ampel ?? calcAmpel(f.ueberlappung_min));
  const MAX = 60;
  const pct = Math.min(100, (f.ueberlappung_min / MAX) * 100);

  return (
    <div className={`rounded-xl border ${cls.bg} shadow-sm mb-3`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Layers size={15} className={cls.text} />
          <span className="font-semibold text-sm text-gray-800">Meine Schicht-Überlappung</span>
          <span className={`text-xs font-bold ${cls.text}`}>{f.ueberlappung_min} Min</span>
          {f.alert && (
            <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">!</span>
          )}
        </div>
        {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {f.alert && (
            <div className="flex items-start gap-2 bg-red-100 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle size={14} className="text-red-600 mt-0.5 shrink-0" />
              <p className="text-xs font-semibold text-red-700">{f.alert}</p>
            </div>
          )}

          <div className="flex flex-col items-center py-2">
            <span className={`text-4xl font-black ${cls.big}`}>{f.ueberlappung_min}</span>
            <span className="text-sm text-gray-500 mt-0.5">Min Überlappung</span>
          </div>

          <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className={`absolute left-0 top-0 h-full rounded-full ${cls.bar}`} style={{ width: `${pct}%` }} />
            <div className="absolute top-0 h-full w-0.5 bg-green-600 opacity-70" style={{ left: '0%' }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>0 Min (Ziel)</span>
            <span>30 Min</span>
            <span>60 Min</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-gray-100 bg-white px-2 py-2">
              <p className="text-xs text-gray-400">Gestern</p>
              <p className="text-sm font-bold text-gray-700">{f.ueberlappung_min_gestern} Min</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-white px-2 py-2">
              <p className="text-xs text-gray-400">Trend</p>
              <div className="flex justify-center mt-0.5"><TrendIcon trend={f.trend} /></div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-white px-2 py-2">
              <p className="text-xs text-gray-400">Team-Ø</p>
              <p className="text-sm font-bold text-gray-700">{data.team_avg_ueberlappung.toFixed(1)} Min</p>
            </div>
          </div>

          <div className="rounded-lg bg-white border border-gray-100 px-3 py-2">
            <p className="text-xs text-gray-600">{coaching(f.ueberlappung_min, f.alert)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
