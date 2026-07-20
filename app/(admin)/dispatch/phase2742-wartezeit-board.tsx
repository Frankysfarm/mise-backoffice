'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_wartezeit_min: number;
  stopps: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  alert: string | null;
  rang: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_wartezeit_min: number;
}

const ZIEL = 3;
const WARN = 6;
const MAX  = 10;

function calcAmpel(min: number): 'gruen' | 'gelb' | 'rot' {
  if (min <= ZIEL) return 'gruen';
  if (min <= WARN) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    dot: 'bg-red-500',   text: 'text-red-700',   bar: 'bg-red-500'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700', bar: 'bg-amber-400' };
  return                   { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700', bar: 'bg-green-500' };
}

function TrendIcon({ trend }: { trend: string }) {
  // steigend = länger warten = schlechter (rot), fallend = besser (grün)
  if (trend === 'steigend') return <TrendingUp   size={12} className="text-red-500"   />;
  if (trend === 'fallend')  return <TrendingDown size={12} className="text-green-600" />;
  return                           <Minus        size={12} className="text-gray-400"  />;
}

function WartezeitBalken({ min, barClass }: { min: number; barClass: string }) {
  const fill    = Math.min(100, (min / MAX) * 100);
  const zielPct = (ZIEL / MAX) * 100;
  return (
    <div className="relative h-3 rounded-full bg-gray-200 flex-1">
      <div
        className="absolute top-0 h-full w-0.5 bg-green-500 z-10"
        style={{ left: `${zielPct}%` }}
        title={`Ziel: ≤${ZIEL} Min`}
      />
      <div
        className={`absolute top-0 left-0 h-full rounded-full ${barClass}`}
        style={{ width: `${fill}%` }}
      />
    </div>
  );
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   avg_wartezeit_min: 2.1, stopps: 10, trend: 'fallend',  alert: null,                  rang: 1 },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  avg_wartezeit_min: 4.3, stopps:  8, trend: 'steigend', alert: null,                  rang: 2 },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   avg_wartezeit_min: 5.8, stopps:  6, trend: 'steigend', alert: null,                  rang: 3 },
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', avg_wartezeit_min: 7.5, stopps:  5, trend: 'steigend', alert: 'Zu lange Wartezeit!', rang: 4 },
  ],
  team_avg_wartezeit_min: 4.9,
};

export function DispatchPhase2742WartezeitBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-wartezeit-stopp?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  // aufsteigend: niedrigste Wartezeit (beste) oben
  const sorted    = [...data.fahrer].sort((a, b) => a.avg_wartezeit_min - b.avg_wartezeit_min);
  const alerts    = data.fahrer.filter((f: FahrerEntry) => f.alert !== null);
  const hasAlert  = alerts.length > 0;
  const teamAmpel = calcAmpel(data.team_avg_wartezeit_min);
  const best      = sorted[0]?.avg_wartezeit_min ?? 0;

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className={hasAlert ? 'text-red-500' : 'text-indigo-600'} />
          <span className="font-semibold text-sm text-gray-800">Wartezeit am Stopp</span>
          {hasAlert && (
            <span className="inline-flex items-center gap-0.5 text-xs text-red-600 font-medium">
              <AlertTriangle size={11} /> {alerts.length}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Alert-Banner */}
          {alerts.map((f: FahrerEntry) => (
            <div key={f.fahrer_id} className="flex items-center gap-2 rounded-lg bg-red-100 border border-red-200 px-3 py-2 text-xs text-red-700 font-medium">
              <AlertTriangle size={13} />
              <span className="font-bold">{f.fahrer_name}</span>: {f.alert} ({f.avg_wartezeit_min} Min)
            </div>
          ))}

          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-2 py-2">
              <div className="text-[10px] text-gray-500 mb-0.5">Team-Ø</div>
              <div className={`text-base font-bold ${ampelCls(teamAmpel).text}`}>{data.team_avg_wartezeit_min} Min</div>
            </div>
            <div className="rounded-lg bg-green-50 border border-green-200 px-2 py-2">
              <div className="text-[10px] text-gray-500 mb-0.5">Bester</div>
              <div className="text-base font-bold text-green-700">{best} Min</div>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-2 py-2">
              <div className="text-[10px] text-gray-500 mb-0.5">Ziel</div>
              <div className="text-base font-bold text-gray-700">≤{ZIEL} Min</div>
            </div>
          </div>

          {/* Fahrerliste */}
          <div className="space-y-2">
            {sorted.map((f: FahrerEntry) => {
              const a   = calcAmpel(f.avg_wartezeit_min);
              const cls = ampelCls(a);
              return (
                <div key={f.fahrer_id} className={`rounded-lg border ${cls.bg} px-3 py-2`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${cls.dot}`} />
                      <span className="text-xs font-semibold text-gray-800">{f.fahrer_name}</span>
                      <span className="text-[10px] text-gray-400">{f.stopps} Stopps</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TrendIcon trend={f.trend} />
                      <span className={`text-sm font-bold ${cls.text}`}>{f.avg_wartezeit_min} Min</span>
                    </div>
                  </div>
                  <WartezeitBalken min={f.avg_wartezeit_min} barClass={cls.bar} />
                </div>
              );
            })}
          </div>

          {/* Legende */}
          <div className="flex items-center gap-3 text-[10px] text-gray-500 pt-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />≤{ZIEL} Min</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />{ZIEL}–{WARN} Min</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />&gt;{WARN} Min</span>
            <span className="ml-auto flex items-center gap-1 text-gray-400">Ziel ≤{ZIEL} Min/Stopp</span>
          </div>
        </div>
      )}
    </div>
  );
}
