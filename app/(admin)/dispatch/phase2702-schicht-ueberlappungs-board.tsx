'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Layers } from 'lucide-react';

interface FahrerEntry {
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
  fahrer: FahrerEntry[];
  team_avg_ueberlappung: number;
  team_avg_ueberlappung_gestern: number;
  alert_count: number;
}

function calcAmpel(min: number): 'gruen' | 'gelb' | 'rot' {
  if (min === 0) return 'gruen';
  if (min <= 30) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',   bar: 'bg-red-500',   dot: 'bg-red-500'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400', dot: 'bg-amber-400' };
  return                   { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500', dot: 'bg-green-500' };
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={11} className="text-red-500"   />;
  if (trend === 'fallend')  return <TrendingDown size={11} className="text-green-600" />;
  return                           <Minus        size={11} className="text-gray-400"  />;
}

function UeberlappungsBalken({ min, barClass }: { min: number; barClass: string }) {
  const MAX = 60;
  const pct = Math.min(100, (min / MAX) * 100);
  const zielPct = 0;
  return (
    <div className="flex-1 relative h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className={`absolute left-0 top-0 h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
      <div className="absolute top-0 h-full w-px bg-green-600 opacity-60" style={{ left: `${zielPct}%` }} />
    </div>
  );
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'd1', fahrer_name: 'Max M.',   ueberlappung_min: 45, ueberlappung_min_gestern: 0,  trend: 'steigend', trend_delta:  45, ampel: 'rot',   alert: 'Schicht-Überlappung: Max M.!'   },
    { fahrer_id: 'd2', fahrer_name: 'Sara K.',  ueberlappung_min: 15, ueberlappung_min_gestern: 10, trend: 'steigend', trend_delta:   5, ampel: 'gelb',  alert: null },
    { fahrer_id: 'd3', fahrer_name: 'Tim B.',   ueberlappung_min:  0, ueberlappung_min_gestern:  0, trend: 'stabil',   trend_delta:   0, ampel: 'gruen', alert: null },
    { fahrer_id: 'd4', fahrer_name: 'Julia F.', ueberlappung_min:  0, ueberlappung_min_gestern:  5, trend: 'fallend',  trend_delta:  -5, ampel: 'gruen', alert: null },
  ],
  team_avg_ueberlappung: 15,
  team_avg_ueberlappung_gestern: 3.75,
  alert_count: 1,
};

export function DispatchPhase2702SchichtUeberlappungsBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-schicht-ueberlappung?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted   = [...data.fahrer].sort((a, b) => b.ueberlappung_min - a.ueberlappung_min);
  const alerts   = data.fahrer.filter(f => f.alert !== null);
  const hasAlert = alerts.length > 0;

  const meiste   = sorted[0];
  const teamAmpel = calcAmpel(Math.round(data.team_avg_ueberlappung));
  const teamCls   = ampelCls(teamAmpel);

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Layers size={16} className={hasAlert ? 'text-red-500' : 'text-gray-500'} />
          <span className="font-semibold text-sm text-gray-800">Schicht-Überlappungen</span>
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
          {alerts.map(a => (
            <div key={a.fahrer_id} className="flex items-start gap-2 bg-red-100 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle size={14} className="text-red-600 mt-0.5 shrink-0" />
              <p className="text-xs font-semibold text-red-700">{a.alert}</p>
            </div>
          ))}

          <div className="grid grid-cols-3 gap-2">
            <div className={`rounded-lg border px-2 py-2 ${teamCls.bg}`}>
              <p className="text-xs text-gray-500">Team-Ø</p>
              <p className={`text-base font-bold ${teamCls.text}`}>{data.team_avg_ueberlappung.toFixed(1)} Min</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-2 py-2">
              <p className="text-xs text-gray-500">Höchste</p>
              <p className="text-base font-bold text-red-600">{meiste ? `${meiste.ueberlappung_min} Min` : '—'}</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-2 py-2">
              <p className="text-xs text-gray-500">Ziel</p>
              <p className="text-base font-bold text-green-600">0 Min</p>
            </div>
          </div>

          <div className="space-y-2">
            {sorted.map(f => {
              const cls = ampelCls(f.ampel);
              return (
                <div key={f.fahrer_id} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${cls.dot}`} />
                  <span className="text-xs font-medium text-gray-700 w-16 truncate">{f.fahrer_name}</span>
                  <UeberlappungsBalken min={f.ueberlappung_min} barClass={cls.bar} />
                  <span className={`text-xs font-bold w-12 text-right ${cls.text}`}>{f.ueberlappung_min} Min</span>
                  <TrendIcon trend={f.trend} />
                </div>
              );
            })}
          </div>

          <p className="text-xs text-gray-400">0 → 60 Min | Ziel: 0 Min Überlappung (grün)</p>
          <div className="flex items-center gap-3 pt-1">
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"   /><span className="text-xs text-gray-500">&gt;30 Min</span></div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /><span className="text-xs text-gray-500">1–30 Min</span></div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /><span className="text-xs text-gray-500">0 Min</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
