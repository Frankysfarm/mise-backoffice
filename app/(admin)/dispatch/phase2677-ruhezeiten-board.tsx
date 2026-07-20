'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, BedDouble } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  ruhe_h: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  alert_zu_kurz?: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_ruhe_h: number;
  alert_count: number;
}

function ampelVon(h: number): 'gruen' | 'gelb' | 'rot' {
  if (h >= 11) return 'gruen';
  if (h >= 8)  return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    dot: 'bg-red-500',   text: 'text-red-700',   bar: 'bg-red-500'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700', bar: 'bg-amber-400' };
  return                   { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700', bar: 'bg-green-500' };
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={12} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={12} className="text-red-500"   />;
  return                           <Minus        size={12} className="text-gray-400"  />;
}

function RuheBalken({ h, barClass }: { h: number; barClass: string }) {
  const MAX     = 16;
  const fill    = Math.min(100, (h / MAX) * 100);
  const goal    = Math.min(100, (11 / MAX) * 100);
  return (
    <div className="relative h-3 rounded-full bg-gray-200 flex-1">
      <div className={`absolute top-0 left-0 h-full rounded-full ${barClass}`} style={{ width: `${fill}%` }} />
      <div
        className="absolute top-0 h-full border-l-2 border-dashed border-green-600"
        style={{ left: `${goal}%` }}
        title="Ziel ≥11 h"
      />
    </div>
  );
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   ruhe_h: 6.5,  trend: 'fallend',  trend_delta: -1.5, alert_zu_kurz: true  },
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', ruhe_h: 7.0,  trend: 'fallend',  trend_delta: -2.0, alert_zu_kurz: true  },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  ruhe_h: 9.5,  trend: 'steigend', trend_delta:  0.5, alert_zu_kurz: false },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   ruhe_h: 13.0, trend: 'steigend', trend_delta:  1.5, alert_zu_kurz: false },
  ],
  team_avg_ruhe_h: 9.0,
  alert_count: 2,
};

export function DispatchPhase2677RuhezeitenBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-ruhezeiten?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched  = data.fahrer.map(f => ({ ...f, ampel: ampelVon(f.ruhe_h) }));
  const sorted    = [...enriched].sort((a, b) => a.ruhe_h - b.ruhe_h);
  const alerts    = enriched.filter(f => f.ruhe_h < 8);
  const hasAlert  = alerts.length > 0;
  const teamAmpel = ampelVon(data.team_avg_ruhe_h);
  const teamCls   = ampelCls(teamAmpel);

  const bester = enriched.length > 0
    ? enriched.reduce((a, b) => a.ruhe_h > b.ruhe_h ? a : b)
    : null;

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <BedDouble size={16} className={hasAlert ? 'text-red-500' : 'text-gray-500'} />
          <span className="font-semibold text-sm text-gray-800">Ruhezeiten-Board</span>
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
          {/* Alert Banner */}
          {hasAlert && (
            <div className="flex items-start gap-2 bg-red-100 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle size={14} className="text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-red-700">Ruhezeit zu kurz!</p>
                <p className="text-xs text-red-600">{alerts.map(a => a.fahrer_name).join(', ')} — unter 8 h Pause</p>
              </div>
            </div>
          )}

          {/* KPI Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className={`rounded-lg border px-2 py-2 ${teamCls.bg}`}>
              <p className="text-xs text-gray-500">Team-Ø</p>
              <p className={`text-base font-bold ${teamCls.text}`}>{data.team_avg_ruhe_h} h</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-2 py-2">
              <p className="text-xs text-gray-500">Kürzeste</p>
              <p className="text-base font-bold text-red-600">
                {sorted[0] ? `${sorted[0].ruhe_h} h` : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-2 py-2">
              <p className="text-xs text-gray-500">Längste</p>
              <p className="text-base font-bold text-green-600">
                {bester ? `${bester.ruhe_h} h` : '—'}
              </p>
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
                  <RuheBalken h={f.ruhe_h} barClass={cls.bar} />
                  <span className={`text-xs font-bold w-10 text-right ${cls.text}`}>{f.ruhe_h} h</span>
                  <TrendIcon trend={f.trend} />
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 pt-1">
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"   /><span className="text-xs text-gray-500">&lt;8 h</span></div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /><span className="text-xs text-gray-500">8–10 h</span></div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /><span className="text-xs text-gray-500">≥11 h</span></div>
            <div className="flex items-center gap-1 ml-1"><span className="border-l-2 border-dashed border-green-600 h-3 inline-block" /><span className="text-xs text-gray-400">Ziel 11 h</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
