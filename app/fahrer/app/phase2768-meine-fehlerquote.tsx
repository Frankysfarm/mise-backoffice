'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, XCircle } from 'lucide-react';

interface DriverData {
  fehler: number;
  touren: number;
  fehlerquote_pct: number;
  fehlerquote_pct_gestern: number | null;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: string | null;
  rang: number;
  team_avg_pct: number;
}

const ZIEL = 5;
const MAX  = 30;

const MOCK: DriverData = {
  fehler: 1,
  touren: 10,
  fehlerquote_pct: 10.0,
  fehlerquote_pct_gestern: 8.0,
  trend: 'steigend',
  trend_delta: 2.0,
  ampel: 'gelb',
  alert: null,
  rang: 2,
  team_avg_pct: 11.2,
};

function ampelCls(a: string) {
  if (a === 'rot')  return { big: 'text-red-600',   bar: 'bg-red-500',   bg: 'bg-red-50 border-red-200',    label: 'bg-red-100 text-red-700' };
  if (a === 'gelb') return { big: 'text-amber-600', bar: 'bg-amber-400', bg: 'bg-amber-50 border-amber-200', label: 'bg-amber-100 text-amber-700' };
  return                   { big: 'text-green-600', bar: 'bg-green-500', bg: 'bg-green-50 border-green-200', label: 'bg-green-100 text-green-700' };
}

function coachTipp(a: string): string {
  if (a === 'rot')  return '🚨 Fehlerquote zu hoch! Prüfe Adressen sorgfältig und melde Probleme sofort.';
  if (a === 'gelb') return '⚠️ Deine Fehlerquote ist erhöht. Versuche Fehlerquellen zu reduzieren.';
  return '✅ Ausgezeichnet! Deine Fehlerquote ist vorbildlich.';
}

function TrendIcon({ trend }: { trend: string }) {
  // steigend = mehr Fehler = schlechter → rot; fallend = weniger Fehler = besser → grün
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-red-500"   />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-green-600" />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

export function FahrerPhase2768MeineFehlerquote({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<DriverData | null>(null);

  useEffect(() => {
    if (!isOnline || !driverId || !locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-fehlerquote?location_id=${locationId}&driver_id=${driverId}`)
        .then(r => r.json())
        .then((d: { fahrer: DriverData[]; team_avg_pct: number }) => {
          const me = d.fahrer?.[0];
          if (me) setData({ ...me, team_avg_pct: d.team_avg_pct });
          else setData(MOCK);
        })
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!data) return null;
  if (!isOnline) return null;

  const c       = ampelCls(data.ampel);
  const fillPct = Math.min(100, (data.fehlerquote_pct / MAX) * 100);
  const zielPct = (ZIEL / MAX) * 100;

  return (
    <div className={`border rounded-xl p-3 mb-3 text-sm ${c.bg}`}>
      <button
        className="w-full flex items-center justify-between font-semibold text-gray-800 mb-2"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2">
          <XCircle size={15} className="text-red-500" />
          Meine Fehlerquote
          {data.alert && <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">{data.alert}</span>}
        </span>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>

      {open && (
        <>
          {/* Hauptwert */}
          <div className="text-center my-3">
            <p className={`text-5xl font-black ${c.big}`}>{data.fehlerquote_pct}%</p>
            <p className="text-gray-500 text-sm mt-1">{data.fehler} von {data.touren} Touren</p>
            <div className="flex items-center justify-center gap-1 mt-1 text-xs text-gray-500">
              <TrendIcon trend={data.trend} />
              {data.trend_delta !== 0
                ? <span>{data.trend_delta > 0 ? '+' : ''}{data.trend_delta}% vs. gestern ({data.fehlerquote_pct_gestern ?? '–'}%)</span>
                : <span>Gleich wie gestern</span>}
            </div>
          </div>

          {/* Balken */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-gray-400 w-4">0%</span>
            <div className="relative flex-1 h-4 rounded-full bg-gray-200">
              <div
                className="absolute top-0 h-full w-0.5 bg-green-500 z-10"
                style={{ left: `${zielPct}%` }}
                title={`Ziel: <${ZIEL}%`}
              />
              <div className={`absolute top-0 left-0 h-full rounded-full ${c.bar}`} style={{ width: `${fillPct}%` }} />
            </div>
            <span className="text-xs text-gray-400 w-8">{MAX}%</span>
          </div>
          <div className="text-center text-xs text-gray-500 mb-3">Ziel: &lt;{ZIEL}%</div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { label: 'Gestern',  val: data.fehlerquote_pct_gestern !== null ? `${data.fehlerquote_pct_gestern}%` : '–' },
              { label: 'Trend',    val: data.trend_delta !== 0 ? `${data.trend_delta > 0 ? '+' : ''}${data.trend_delta}%` : '=', cls: data.trend === 'steigend' ? 'text-red-600' : data.trend === 'fallend' ? 'text-green-600' : 'text-gray-600' },
              { label: 'Ziel',     val: `<${ZIEL}%` },
              { label: 'Team-Ø',   val: `${data.team_avg_pct}%` },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-lg p-1.5 text-center border border-gray-200">
                <p className={`font-bold text-sm ${'cls' in k ? k.cls : ''}`}>{k.val}</p>
                <p className="text-gray-500 text-xs">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Coaching-Tipp */}
          <div className="bg-white rounded-lg p-2.5 border border-gray-200 text-xs text-gray-700">
            {coachTipp(data.ampel)}
          </div>
        </>
      )}
    </div>
  );
}
