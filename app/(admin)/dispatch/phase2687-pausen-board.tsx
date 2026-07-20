'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Coffee } from 'lucide-react';

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
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    dot: 'bg-red-500',   text: 'text-red-700',   bar: 'bg-red-500'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700', bar: 'bg-amber-400' };
  return                   { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700', bar: 'bg-green-500' };
}

function deviation(min: number): number {
  if (min >= 20 && min <= 40) return 0;
  return min < 20 ? 20 - min : min - 40;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={12} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={12} className="text-red-500"   />;
  return                           <Minus        size={12} className="text-gray-400"  />;
}

function PausenBalken({ min, barClass }: { min: number; barClass: string }) {
  const max  = 90;
  const fill = Math.min(100, (min / max) * 100);
  return (
    <div className="relative h-3 rounded-full bg-gray-200 flex-1">
      {/* Ziel-Zone 20-40 Min grün schraffiert */}
      <div
        className="absolute top-0 h-full rounded-sm bg-green-100 border-x border-green-300"
        style={{ left: `${(20 / max) * 100}%`, width: `${(20 / max) * 100}%` }}
        title="Ziel-Zone 20–40 Min"
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
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   pausen_min: 7,  trend: 'fallend',  trend_delta: -18, alert: 'Zu wenig Pause!' },
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', pausen_min: 75, trend: 'steigend', trend_delta:  40, alert: 'Zu lange Pause!' },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  pausen_min: 30, trend: 'steigend', trend_delta:   2, alert: null              },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   pausen_min: 22, trend: 'stabil',   trend_delta:   0, alert: null              },
  ],
  team_avg_min: 34,
};

export function DispatchPhase2687PausenBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-schicht-pausen?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched = data.fahrer.map(f => ({ ...f, ampel: ampelVon(f.pausen_min) }));
  const sorted   = [...enriched].sort((a, b) => deviation(b.pausen_min) - deviation(a.pausen_min));
  const alerts   = enriched.filter(f => f.alert !== null);
  const hasAlert = alerts.length > 0;
  const teamAmpel = ampelVon(data.team_avg_min);
  const teamCls   = ampelCls(teamAmpel);
  const kuerz     = [...enriched].sort((a, b) => a.pausen_min - b.pausen_min)[0];
  const laengst   = [...enriched].sort((a, b) => b.pausen_min - a.pausen_min)[0];

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Coffee size={16} className={hasAlert ? 'text-red-500' : 'text-gray-500'} />
          <span className="font-semibold text-sm text-gray-800">Pausen-Board</span>
          {hasAlert && (
            <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
              {alerts.length} Alert{alerts.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Alert Banners */}
          {alerts.map(a => (
            <div key={a.fahrer_id} className="flex items-start gap-2 bg-red-100 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle size={14} className="text-red-600 mt-0.5 shrink-0" />
              <p className="text-xs font-semibold text-red-700">{a.fahrer_name}: {a.alert}</p>
            </div>
          ))}

          {/* KPI Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className={`rounded-lg border px-2 py-2 ${teamCls.bg}`}>
              <p className="text-xs text-gray-500">Team-Ø</p>
              <p className={`text-base font-bold ${teamCls.text}`}>{data.team_avg_min} Min</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-2 py-2">
              <p className="text-xs text-gray-500">Kürzeste</p>
              <p className="text-base font-bold text-red-600">{kuerz ? `${kuerz.pausen_min} Min` : '—'}</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-2 py-2">
              <p className="text-xs text-gray-500">Längste</p>
              <p className="text-base font-bold text-amber-600">{laengst ? `${laengst.pausen_min} Min` : '—'}</p>
            </div>
          </div>

          {/* Driver List */}
          <div className="space-y-2">
            {sorted.map(f => {
              const cls = ampelCls(f.ampel);
              return (
                <div key={f.fahrer_id} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${cls.dot}`} />
                  <span className="text-xs font-medium text-gray-700 w-16 truncate">{f.fahrer_name}</span>
                  <PausenBalken min={f.pausen_min} barClass={cls.bar} />
                  <span className={`text-xs font-bold w-14 text-right ${cls.text}`}>{f.pausen_min} Min</span>
                  <TrendIcon trend={f.trend} />
                </div>
              );
            })}
          </div>

          {/* Legende */}
          <p className="text-xs text-gray-400">0 → 90 Min | Ziel-Zone 20–40 Min (grün)</p>
          <div className="flex items-center gap-3 pt-1">
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"   /><span className="text-xs text-gray-500">&lt;10 oder &gt;60 Min</span></div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /><span className="text-xs text-gray-500">10–19 oder 41–60 Min</span></div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /><span className="text-xs text-gray-500">20–40 Min</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
