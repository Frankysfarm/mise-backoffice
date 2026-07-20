'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  wechsel_anzahl: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  alert: string | null;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_wechsel: number;
}

function calcAmpel(w: number): 'gruen' | 'gelb' | 'rot' {
  if (w === 1) return 'gruen';
  if (w === 2) return 'gelb';
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

function WechselBalken({ w, barClass }: { w: number; barClass: string }) {
  const max  = 5;
  const fill = Math.min(100, (w / max) * 100);
  // Ziel-Linie bei 1 Wechsel = 20%
  return (
    <div className="relative h-3 rounded-full bg-gray-200 flex-1">
      <div
        className="absolute top-0 h-full w-0.5 bg-green-500 z-10"
        style={{ left: `${(1 / max) * 100}%` }}
        title="Ziel: 1 Schichtwechsel"
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
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   wechsel_anzahl: 3, trend: 'steigend', trend_delta:  2, alert: 'Zu viele Schichtwechsel!' },
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', wechsel_anzahl: 0, trend: 'fallend',  trend_delta: -1, alert: 'Keine Schicht!'           },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   wechsel_anzahl: 2, trend: 'steigend', trend_delta:  1, alert: null                       },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  wechsel_anzahl: 1, trend: 'stabil',   trend_delta:  0, alert: null                       },
  ],
  team_avg_wechsel: 2,
};

export function DispatchPhase2692SchichtwechselBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-schicht-wechsel?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched = data.fahrer.map(f => ({ ...f, ampel: calcAmpel(f.wechsel_anzahl) }));
  const sorted   = [...enriched].sort((a, b) => b.wechsel_anzahl - a.wechsel_anzahl);
  const alerts   = enriched.filter(f => f.alert !== null);
  const hasAlert = alerts.length > 0;

  const meiste   = sorted[0];
  const wenigste = sorted[sorted.length - 1];
  const teamAmpel = calcAmpel(Math.round(data.team_avg_wechsel));
  const teamCls   = ampelCls(teamAmpel);

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <RefreshCw size={16} className={hasAlert ? 'text-red-500' : 'text-gray-500'} />
          <span className="font-semibold text-sm text-gray-800">Schichtwechsel-Board</span>
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
              <p className={`text-base font-bold ${teamCls.text}`}>{data.team_avg_wechsel} Wechsel</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-2 py-2">
              <p className="text-xs text-gray-500">Meiste</p>
              <p className="text-base font-bold text-red-600">{meiste ? `${meiste.wechsel_anzahl}×` : '—'}</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-2 py-2">
              <p className="text-xs text-gray-500">Wenigste</p>
              <p className="text-base font-bold text-green-600">{wenigste ? `${wenigste.wechsel_anzahl}×` : '—'}</p>
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
                  <WechselBalken w={f.wechsel_anzahl} barClass={cls.bar} />
                  <span className={`text-xs font-bold w-10 text-right ${cls.text}`}>{f.wechsel_anzahl}×</span>
                  <TrendIcon trend={f.trend} />
                </div>
              );
            })}
          </div>

          {/* Legende */}
          <p className="text-xs text-gray-400">0 → 5 Wechsel | Ziel: 1 Schichtwechsel (grün)</p>
          <div className="flex items-center gap-3 pt-1">
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"   /><span className="text-xs text-gray-500">≥3 oder 0</span></div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /><span className="text-xs text-gray-500">2 Wechsel</span></div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /><span className="text-xs text-gray-500">1 Wechsel</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
