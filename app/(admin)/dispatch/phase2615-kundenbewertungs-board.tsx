'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  bewertung_avg: number;
  bewertungen_heute: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rang: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_durchschnitt: number;
  alert_count: number;
}

function ampelCls(ampel: string) {
  if (ampel === 'rot')  return { bg: 'bg-red-50 border-red-200',    dot: 'bg-red-500',   text: 'text-red-700',   bar: 'bg-red-500'   };
  if (ampel === 'gelb') return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700', bar: 'bg-amber-400' };
  return                       { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700', bar: 'bg-green-500' };
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={12} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={12} className="text-red-500"   />;
  return                           <Minus        size={12} className="text-gray-400"  />;
}

function SterneBalken({ avg, ziel, barClass }: { avg: number; ziel: number; barClass: string }) {
  const max     = 5;
  const fill    = Math.min(100, (avg  / max) * 100);
  const goalPct = Math.min(100, (ziel / max) * 100);
  return (
    <div className="relative h-3 rounded-full bg-gray-200 flex-1">
      <div className={`absolute top-0 left-0 h-full rounded-full ${barClass}`} style={{ width: `${fill}%` }} />
      <div
        className="absolute top-0 h-full border-l-2 border-dashed border-green-500"
        style={{ left: `${goalPct}%` }}
        title={`Ziel ${ziel} ★`}
      />
    </div>
  );
}

const ZIEL = 4.5;

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f5', fahrer_name: 'Jana F.',   bewertung_avg: 2.9, bewertungen_heute: 6,  trend: 'fallend',  trend_delta: -0.9, ampel: 'rot',   rang: 5 },
    { fahrer_id: 'f2', fahrer_name: 'Sarah K.',  bewertung_avg: 3.2, bewertungen_heute: 8,  trend: 'fallend',  trend_delta: -0.9, ampel: 'rot',   rang: 4 },
    { fahrer_id: 'f3', fahrer_name: 'Lena S.',   bewertung_avg: 4.1, bewertungen_heute: 10, trend: 'stabil',   trend_delta:  0.1, ampel: 'gelb',  rang: 3 },
    { fahrer_id: 'f4', fahrer_name: 'Tom B.',    bewertung_avg: 4.6, bewertungen_heute: 11, trend: 'stabil',   trend_delta: -0.1, ampel: 'gruen', rang: 2 },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',    bewertung_avg: 4.8, bewertungen_heute: 12, trend: 'steigend', trend_delta:  0.2, ampel: 'gruen', rang: 1 },
  ],
  team_durchschnitt: 3.92,
  alert_count: 2,
};

export function DispatchPhase2615KundenbewertungsBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-kundenbewertung?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted     = [...data.fahrer].sort((a, b) => a.bewertung_avg - b.bewertung_avg);
  const hasAlert   = data.alert_count > 0;
  const teamAmpel  = data.team_durchschnitt >= ZIEL ? 'gruen' : data.team_durchschnitt >= 3.5 ? 'gelb' : 'rot';
  const teamCls    = ampelCls(teamAmpel);
  const alertNames = data.fahrer.filter((f: FahrerEntry) => f.ampel === 'rot').map((f: FahrerEntry) => f.fahrer_name);

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Star size={16} className="text-amber-400 fill-amber-400" />
          <span className="font-semibold text-sm text-gray-800">Kundenbewertungs-Board</span>
          {hasAlert && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              {data.alert_count} Alert{data.alert_count > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold ${teamCls.text}`}>Ø {data.team_durchschnitt.toFixed(1)} ★</span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className={`text-lg font-bold ${teamCls.text}`}>{data.team_durchschnitt.toFixed(1)} ★</div>
              <div className="text-xs text-gray-500">Team Ø heute</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-lg font-bold text-gray-700">
                {data.fahrer.length > 0
                  ? `${data.fahrer.reduce((s, f) => s + f.bewertungen_heute, 0)} Bew.`
                  : '—'}
              </div>
              <div className="text-xs text-gray-500">Gesamt heute</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-lg font-bold text-green-600">≥{ZIEL} ★</div>
              <div className="text-xs text-gray-500">Ziel</div>
            </div>
          </div>

          {/* Alert-Banner */}
          {hasAlert && (
            <div className="flex items-center gap-2 bg-red-100 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle size={14} className="text-red-600 flex-shrink-0" />
              <p className="text-xs text-red-700 font-medium">
                Schlechte Bewertung: {alertNames.join(', ')}
              </p>
            </div>
          )}

          {/* Fahrerliste */}
          <div className="space-y-1.5">
            {sorted.map(f => {
              const cls = ampelCls(f.ampel);
              return (
                <div key={f.fahrer_id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${cls.bg}`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cls.dot}`} />
                  <span className="text-xs font-medium text-gray-700 w-20 truncate">{f.fahrer_name}</span>
                  <SterneBalken avg={f.bewertung_avg} ziel={ZIEL} barClass={cls.bar} />
                  <span className={`text-xs font-bold w-12 text-right ${cls.text}`}>{f.bewertung_avg.toFixed(1)} ★</span>
                  <TrendIcon trend={f.trend} />
                  <span className="text-xs text-gray-400 w-10 text-right">
                    {f.trend_delta > 0 ? '+' : ''}{f.trend_delta.toFixed(1)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Legende */}
          <div className="flex gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />≥{ZIEL} ★</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />3.5–{ZIEL - 0.1} ★</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />&lt;3.5 ★</span>
          </div>
        </div>
      )}
    </div>
  );
}
