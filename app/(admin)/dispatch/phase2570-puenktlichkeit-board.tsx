'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  puenktlichkeit_pct: number;
  puenktlichkeit_pct_vw: number | null;
  puenktlich_count: number;
  gesamt_count: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_pct: number;
  team_avg_pct_vw: number | null;
  alert_count: number;
}

function ampelClass(pct: number) {
  if (pct >= 90) return { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700', bar: 'bg-green-500' };
  if (pct >= 75) return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700', bar: 'bg-amber-400' };
  return { bg: 'bg-red-50 border-red-200', dot: 'bg-red-500', text: 'text-red-700', bar: 'bg-red-500' };
}

function PuenktlichkeitBar({ pct }: { pct: number }) {
  const w = Math.min(100, pct);
  const cls = ampelClass(pct);
  return (
    <div className="relative h-1.5 rounded-full bg-gray-200 w-24">
      <div className={`absolute left-0 top-0 h-full rounded-full ${cls.bar}`} style={{ width: `${w}%` }} />
      <div className="absolute top-0 h-full border-l-2 border-dashed border-red-500" style={{ left: '75%' }} title="Alert <75%" />
      <div className="absolute top-0 h-full border-l border-dashed border-amber-400" style={{ left: '90%' }} title="Ziel ≥90%" />
    </div>
  );
}

function TrendIcon({ trend }: { trend: 'steigend' | 'fallend' | 'stabil' }) {
  if (trend === 'steigend') return <TrendingUp size={12} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={12} className="text-red-500" />;
  return <Minus size={12} className="text-gray-400" />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f5', fahrer_name: 'Jana F.',   puenktlichkeit_pct: 57.1, puenktlichkeit_pct_vw: 63.6, puenktlich_count:  4, gesamt_count:  7, trend: 'fallend',  trend_delta: -6.5, ampel: 'rot',   alert: true  },
    { fahrer_id: 'f2', fahrer_name: 'Sarah K.',  puenktlichkeit_pct: 66.7, puenktlichkeit_pct_vw: 71.4, puenktlich_count:  8, gesamt_count: 12, trend: 'fallend',  trend_delta: -4.7, ampel: 'rot',   alert: true  },
    { fahrer_id: 'f3', fahrer_name: 'Lena S.',   puenktlichkeit_pct: 81.8, puenktlichkeit_pct_vw: 83.3, puenktlich_count:  9, gesamt_count: 11, trend: 'fallend',  trend_delta: -1.5, ampel: 'gelb',  alert: false },
    { fahrer_id: 'f4', fahrer_name: 'Tom B.',    puenktlichkeit_pct: 92.3, puenktlichkeit_pct_vw: 90.0, puenktlich_count: 12, gesamt_count: 13, trend: 'steigend', trend_delta:  2.3, ampel: 'gruen', alert: false },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',    puenktlichkeit_pct: 94.4, puenktlichkeit_pct_vw: 91.0, puenktlich_count: 17, gesamt_count: 18, trend: 'steigend', trend_delta:  3.4, ampel: 'gruen', alert: false },
  ],
  team_avg_pct: 78.5,
  team_avg_pct_vw: 79.9,
  alert_count: 2,
};

export function DispatchPhase2570PuenktlichkeitBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-lieferzeit-puenktlichkeit?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted = [...data.fahrer].sort((a, b) => a.puenktlichkeit_pct - b.puenktlichkeit_pct);
  const hasAlert   = data.alert_count > 0;
  const teamCls    = ampelClass(data.team_avg_pct);
  const alertFahrer = data.fahrer.filter(f => f.alert).map(f => f.fahrer_name);

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className={hasAlert ? 'text-red-500' : 'text-green-600'} />
          <span className="font-semibold text-sm text-gray-800">Pünktlichkeits-Board</span>
          {hasAlert && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              {data.alert_count} Alert{data.alert_count > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold ${teamCls.text}`}>
            Ø {data.team_avg_pct.toFixed(1)}%
          </span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className={`text-lg font-bold ${teamCls.text}`}>{data.team_avg_pct.toFixed(1)}%</div>
              <div className="text-xs text-gray-500">Team Ø heute</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-lg font-bold text-gray-700">
                {data.team_avg_pct_vw !== null ? `${data.team_avg_pct_vw.toFixed(1)}%` : '—'}
              </div>
              <div className="text-xs text-gray-500">Vorwoche</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-lg font-bold text-green-600">≥90%</div>
              <div className="text-xs text-gray-500">Ziel</div>
            </div>
          </div>

          {/* Alert-Banner */}
          {hasAlert && (
            <div className="flex items-center gap-2 bg-red-100 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle size={14} className="text-red-600 flex-shrink-0" />
              <p className="text-xs text-red-700 font-medium">
                Pünktlichkeit unter Ziel: {alertFahrer.join(', ')}
              </p>
            </div>
          )}

          {/* Fahrerliste */}
          <div className="space-y-1.5">
            {sorted.map(f => {
              const cls = ampelClass(f.puenktlichkeit_pct);
              return (
                <div key={f.fahrer_id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${cls.bg}`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cls.dot}`} />
                  <span className="text-xs font-medium text-gray-700 w-20 truncate">{f.fahrer_name}</span>
                  <PuenktlichkeitBar pct={f.puenktlichkeit_pct} />
                  <span className={`text-xs font-bold w-10 text-right ${cls.text}`}>{f.puenktlichkeit_pct.toFixed(1)}%</span>
                  <TrendIcon trend={f.trend} />
                  <span className="text-xs text-gray-400 w-12 text-right">{f.puenktlich_count}/{f.gesamt_count}</span>
                </div>
              );
            })}
          </div>

          {/* Legende */}
          <div className="flex gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />≥90%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />75–89%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />&lt;75%</span>
          </div>
        </div>
      )}
    </div>
  );
}
