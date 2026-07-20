'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  ueberstunden_min: number;
  schicht_geplant_min: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_ueberstunden: number;
  alert_count: number;
}

function ampelVon(min: number): 'gruen' | 'gelb' | 'rot' {
  if (min <= 15) return 'gruen';
  if (min <= 45) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    dot: 'bg-red-500',   text: 'text-red-700',   bar: 'bg-red-500'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700', bar: 'bg-amber-400' };
  return                   { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700', bar: 'bg-green-500' };
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={12} className="text-red-500"   />;
  if (trend === 'fallend')  return <TrendingDown size={12} className="text-green-600" />;
  return                           <Minus        size={12} className="text-gray-400"  />;
}

function MinutenBalken({ min, barClass }: { min: number; barClass: string }) {
  const MAX     = 90;
  const ZIEL    = 15;
  const fill    = Math.min(100, (min / MAX) * 100);
  const goalPct = Math.min(100, (ZIEL / MAX) * 100);
  return (
    <div className="relative h-3 rounded-full bg-gray-200 flex-1">
      <div className={`absolute top-0 left-0 h-full rounded-full ${barClass}`} style={{ width: `${fill}%` }} />
      <div
        className="absolute top-0 h-full border-l-2 border-dashed border-green-500"
        style={{ left: `${goalPct}%` }}
        title="Ziel ≤15 Min"
      />
    </div>
  );
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   ueberstunden_min: 67, schicht_geplant_min: 480, trend: 'steigend', trend_delta:  22 },
    { fahrer_id: 'f5', fahrer_name: 'Jonas W.', ueberstunden_min: 51, schicht_geplant_min: 480, trend: 'steigend', trend_delta:  15 },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  ueberstunden_min: 32, schicht_geplant_min: 480, trend: 'steigend', trend_delta:  12 },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   ueberstunden_min: 12, schicht_geplant_min: 480, trend: 'stabil',   trend_delta:   3 },
    { fahrer_id: 'f4', fahrer_name: 'Lisa F.',  ueberstunden_min:  8, schicht_geplant_min: 480, trend: 'fallend',  trend_delta:  -7 },
  ],
  team_avg_ueberstunden: 34,
  alert_count: 2,
};

export function DispatchPhase2667UeberstundenBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-ueberstunden-v2?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched  = data.fahrer.map(f => ({ ...f, ampel: ampelVon(f.ueberstunden_min) }));
  const alerts    = enriched.filter(f => f.ueberstunden_min > 45);
  const hasAlert  = alerts.length > 0;
  const teamAmpel = ampelVon(data.team_avg_ueberstunden);
  const teamCls   = ampelCls(teamAmpel);

  const bester = enriched.length > 0
    ? enriched.reduce((a, b) => a.ueberstunden_min < b.ueberstunden_min ? a : b)
    : null;

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className={hasAlert ? 'text-red-500' : 'text-gray-500'} />
          <span className="font-semibold text-sm text-gray-800">Überstunden-Board</span>
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
                <p className="text-xs font-semibold text-red-700">Überstunden zu hoch!</p>
                <p className="text-xs text-red-600">{alerts.map(a => a.fahrer_name).join(', ')} — bitte Schichtende koordinieren</p>
              </div>
            </div>
          )}

          {/* KPI Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className={`rounded-lg border px-2 py-2 ${teamCls.bg}`}>
              <p className="text-xs text-gray-500">Team-Ø</p>
              <p className={`text-base font-bold ${teamCls.text}`}>{data.team_avg_ueberstunden} Min</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-2 py-2">
              <p className="text-xs text-gray-500">Bester heute</p>
              <p className="text-base font-bold text-green-600">
                {bester ? `${bester.ueberstunden_min} Min` : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-2 py-2">
              <p className="text-xs text-gray-500">Ziel</p>
              <p className="text-base font-bold text-gray-700">≤15 Min</p>
            </div>
          </div>

          {/* Driver List */}
          <div className="space-y-2">
            {enriched.map(f => {
              const cls = ampelCls(f.ampel);
              return (
                <div key={f.fahrer_id} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${cls.dot}`} />
                  <span className="text-xs font-medium text-gray-700 w-16 truncate">{f.fahrer_name}</span>
                  <MinutenBalken min={f.ueberstunden_min} barClass={cls.bar} />
                  <span className={`text-xs font-bold w-12 text-right ${cls.text}`}>{f.ueberstunden_min} Min</span>
                  <TrendIcon trend={f.trend} />
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 pt-1">
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /><span className="text-xs text-gray-500">≤15 Min</span></div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /><span className="text-xs text-gray-500">16–45 Min</span></div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"   /><span className="text-xs text-gray-500">&gt;45 Min</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
