'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Route } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  quote_pct: number;
  leerfahrten_heute: number;
  touren_heute: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  alert: string | null;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_pct: number;
}

const ZIEL   = 10;
const WARN   = 25;
const MAX    = 50;

function calcAmpel(pct: number): 'gruen' | 'gelb' | 'rot' {
  if (pct < ZIEL) return 'gruen';
  if (pct <= WARN) return 'gelb';
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

function QuoteBalken({ pct, barClass }: { pct: number; barClass: string }) {
  const fill    = Math.min(100, (pct / MAX) * 100);
  const zielPct = (ZIEL / MAX) * 100;
  return (
    <div className="relative h-3 rounded-full bg-gray-200 flex-1">
      <div
        className="absolute top-0 h-full w-0.5 bg-green-500 z-10"
        style={{ left: `${zielPct}%` }}
        title={`Ziel: <${ZIEL}%`}
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
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', quote_pct: 31.0, leerfahrten_heute: 4, touren_heute: 13, trend: 'steigend', alert: 'Zu viele Leerfahrten!' },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   quote_pct: 22.0, leerfahrten_heute: 3, touren_heute: 14, trend: 'steigend', alert: null },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  quote_pct: 15.0, leerfahrten_heute: 2, touren_heute: 13, trend: 'steigend', alert: null },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   quote_pct:  5.0, leerfahrten_heute: 1, touren_heute: 20, trend: 'fallend',  alert: null },
  ],
  team_avg_pct: 18.25,
};

export function DispatchPhase2722LeerfahrtenBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-leerfahrten?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched = data.fahrer.map((f: FahrerEntry) => ({ ...f, ampel: calcAmpel(f.quote_pct) }));
  const sorted   = [...enriched].sort((a, b) => b.quote_pct - a.quote_pct);
  const alerts   = enriched.filter((f: FahrerEntry & { ampel: string }) => f.alert !== null);
  const hasAlert = alerts.length > 0;
  const bester   = sorted[sorted.length - 1];
  const teamAmpel = calcAmpel(data.team_avg_pct);
  const teamCls   = ampelCls(teamAmpel);

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Route size={16} className={hasAlert ? 'text-red-500' : 'text-blue-600'} />
          <span className="font-semibold text-sm text-gray-800">Leerfahrten-Quote</span>
          {hasAlert && (
            <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
              <AlertTriangle size={12} /> {alerts.length} Alert{alerts.length > 1 ? 's' : ''}
            </span>
          )}
          <span className={`ml-2 text-xs font-bold ${teamCls.text}`}>
            Ø {data.team_avg_pct.toFixed(1)}%
          </span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {alerts.map((f: FahrerEntry & { ampel: string }) => (
            <div key={f.fahrer_id} className="flex items-center gap-2 rounded-lg bg-red-100 border border-red-200 px-3 py-2 text-xs text-red-700 font-medium">
              <AlertTriangle size={13} />
              <span className="font-bold">{f.fahrer_name}</span>: {f.alert} ({f.quote_pct.toFixed(1)}%)
            </div>
          ))}

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Team-Ø',  value: `${data.team_avg_pct.toFixed(1)}%`, cls: teamCls.text },
              { label: 'Bester',  value: bester ? `${bester.quote_pct.toFixed(1)}%` : '–', cls: 'text-green-600' },
              { label: 'Ziel',    value: `<${ZIEL}%`, cls: 'text-gray-500' },
            ].map(({ label, value, cls }) => (
              <div key={label} className="rounded-lg bg-gray-50 border border-gray-200 p-2 text-center">
                <div className="text-xs text-gray-500">{label}</div>
                <div className={`text-sm font-bold ${cls}`}>{value}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> &lt;{ZIEL}%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> {ZIEL}–{WARN}%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500  inline-block" /> &gt;{WARN}%</span>
          </div>

          <div className="space-y-2">
            {sorted.map((f: FahrerEntry & { ampel: string }) => {
              const cls = ampelCls(f.ampel);
              return (
                <div key={f.fahrer_id} className={`rounded-lg border ${cls.bg} px-3 py-2`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${cls.dot}`} />
                      <span className="text-xs font-medium text-gray-800">{f.fahrer_name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TrendIcon trend={f.trend} />
                      <span className={`text-xs font-bold ${cls.text}`}>{f.quote_pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <QuoteBalken pct={f.quote_pct} barClass={cls.bar} />
                    <span className="text-[10px] text-gray-400 w-28 text-right">
                      {f.leerfahrten_heute}L / {f.touren_heute}T
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
