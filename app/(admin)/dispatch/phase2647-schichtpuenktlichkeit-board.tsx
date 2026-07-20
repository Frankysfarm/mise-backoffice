'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  verspaetung_min: number;
  schichten_heute: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  rang: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_durchschnitt: number;
  alert_count: number;
}

function ampelVon(min: number): 'gruen' | 'gelb' | 'rot' {
  if (min <= 2)  return 'gruen';
  if (min <= 10) return 'gelb';
  return 'rot';
}

function ampelCls(ampel: string) {
  if (ampel === 'rot')  return { bg: 'bg-red-50 border-red-200',    dot: 'bg-red-500',   text: 'text-red-700',   bar: 'bg-red-500'   };
  if (ampel === 'gelb') return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700', bar: 'bg-amber-400' };
  return                       { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700', bar: 'bg-green-500' };
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={12} className="text-red-500"   />;
  if (trend === 'fallend')  return <TrendingDown size={12} className="text-green-600" />;
  return                           <Minus        size={12} className="text-gray-400"  />;
}

function VerspaetungsBalken({ min, barClass }: { min: number; barClass: string }) {
  const MAX     = 15;
  const ZIEL    = 2;
  const fill    = Math.min(100, (min  / MAX) * 100);
  const goalPct = Math.min(100, (ZIEL / MAX) * 100);
  return (
    <div className="relative h-3 rounded-full bg-gray-200 flex-1">
      <div className={`absolute top-0 left-0 h-full rounded-full ${barClass}`} style={{ width: `${fill}%` }} />
      <div
        className="absolute top-0 h-full border-l-2 border-dashed border-green-500"
        style={{ left: `${goalPct}%` }}
        title="Ziel ≤2 Min"
      />
    </div>
  );
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f3', fahrer_name: 'Tim W.',   verspaetung_min: 14.0, schichten_heute: 1, trend: 'steigend', trend_delta:  6.0, rang: 1 },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  verspaetung_min:  5.0, schichten_heute: 1, trend: 'steigend', trend_delta:  1.5, rang: 2 },
    { fahrer_id: 'f4', fahrer_name: 'Anna B.',  verspaetung_min:  3.0, schichten_heute: 1, trend: 'fallend',  trend_delta: -1.0, rang: 3 },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   verspaetung_min:  1.5, schichten_heute: 1, trend: 'fallend',  trend_delta: -0.5, rang: 4 },
  ],
  team_durchschnitt: 5.9,
  alert_count: 1,
};

export function DispatchPhase2647SchichtPuenktlichkeitsBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-schichtpuenktlichkeit?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched  = data.fahrer.map(f => ({ ...f, ampel: ampelVon(f.verspaetung_min) }));
  const sorted    = [...enriched].sort((a, b) => b.verspaetung_min - a.verspaetung_min);
  const alerts    = enriched.filter(f => f.verspaetung_min > 10);
  const hasAlert  = alerts.length > 0;
  const teamAmpel = ampelVon(data.team_durchschnitt);
  const teamCls   = ampelCls(teamAmpel);
  const bestMin   = enriched.length > 0 ? Math.min(...enriched.map(f => f.verspaetung_min)) : null;

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800">Schichtpünktlichkeit</span>
          {hasAlert && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              {alerts.length} Alert{alerts.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold ${teamCls.text}`}>Ø {data.team_durchschnitt.toFixed(1)} Min</span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {hasAlert && (
            <div className="flex items-start gap-2 bg-red-100 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 font-medium">
                Schicht-Verspätung &gt;10 Min: {alerts.map((f: { fahrer_name: string }) => f.fahrer_name).join(', ')}
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className={`text-lg font-bold ${teamCls.text}`}>{data.team_durchschnitt.toFixed(1)} Min</div>
              <div className="text-xs text-gray-500">Team Ø heute</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-lg font-bold text-gray-700">
                {bestMin !== null ? `${bestMin.toFixed(1)} Min` : '—'}
              </div>
              <div className="text-xs text-gray-500">Bester heute</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-lg font-bold text-green-600">≤2 Min</div>
              <div className="text-xs text-gray-500">Ziel</div>
            </div>
          </div>

          <div className="space-y-2">
            {sorted.map(f => {
              const cls = ampelCls(f.ampel);
              return (
                <div key={f.fahrer_id} className={`rounded-lg border p-2 ${cls.bg}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cls.dot}`} />
                    <span className="text-xs font-medium text-gray-800 flex-1 truncate">{f.fahrer_name}</span>
                    <TrendIcon trend={f.trend} />
                    <span className={`text-xs font-bold ${cls.text}`}>{f.verspaetung_min.toFixed(1)} Min</span>
                  </div>
                  <VerspaetungsBalken min={f.verspaetung_min} barClass={cls.bar} />
                </div>
              );
            })}
          </div>
          <div className="text-xs text-gray-400 text-right">Ziel ≤2 Min — alle 30 Min aktualisiert</div>
        </div>
      )}
    </div>
  );
}
