'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Map } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  zonen_count: number;
  touren: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  alert: string | null;
  rang: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_zonen: number;
}

const ZIEL = 3;
const WARN = 2;
const MAX  = 6;

function calcAmpel(n: number): 'gruen' | 'gelb' | 'rot' {
  if (n >= ZIEL) return 'gruen';
  if (n >= WARN) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    dot: 'bg-red-500',   text: 'text-red-700',   bar: 'bg-red-500'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700', bar: 'bg-amber-400' };
  return                   { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700', bar: 'bg-green-500' };
}

function TrendIcon({ trend }: { trend: string }) {
  // steigend = mehr Zonen = besser (grün), fallend = schlechter (rot)
  if (trend === 'steigend') return <TrendingUp   size={12} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={12} className="text-red-500"   />;
  return                           <Minus        size={12} className="text-gray-400"  />;
}

function ZonenBalken({ n, barClass }: { n: number; barClass: string }) {
  const fill    = Math.min(100, (n / MAX) * 100);
  const zielPct = (ZIEL / MAX) * 100;
  return (
    <div className="relative h-3 rounded-full bg-gray-200 flex-1">
      <div
        className="absolute top-0 h-full w-0.5 bg-green-500 z-10"
        style={{ left: `${zielPct}%` }}
        title={`Ziel: ≥${ZIEL} Zonen`}
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
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   zonen_count: 4, touren: 10, trend: 'steigend', alert: null,                        rang: 1 },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  zonen_count: 3, touren:  8, trend: 'stabil',   alert: null,                        rang: 2 },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   zonen_count: 2, touren:  6, trend: 'fallend',  alert: null,                        rang: 3 },
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', zonen_count: 1, touren:  5, trend: 'fallend',  alert: 'Geringe Gebietsabdeckung!', rang: 4 },
  ],
  team_avg_zonen: 2.5,
};

export function DispatchPhase2762LiefergebietBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-liefergebiet?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched  = data.fahrer.map((f: FahrerEntry) => ({ ...f, ampel: calcAmpel(f.zonen_count) }));
  // absteigend: meiste Zonen (breiteste Abdeckung) zuerst
  const sorted    = [...enriched].sort((a, b) => b.zonen_count - a.zonen_count);
  const alerts    = enriched.filter((f: FahrerEntry & { ampel: string }) => f.alert !== null);
  const hasAlert  = alerts.length > 0;
  const teamAmpel = calcAmpel(data.team_avg_zonen);
  const tc        = ampelCls(teamAmpel);

  return (
    <div className={`border rounded-xl p-3 mb-3 text-sm ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        className="w-full flex items-center justify-between font-semibold text-gray-800 mb-2"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2">
          <Map size={15} className="text-blue-500" />
          Liefergebiet-Abdeckung
          <span className={`text-xs font-normal px-1.5 py-0.5 rounded-full ${tc.bg} ${tc.text} border ${hasAlert ? 'border-red-300' : ''}`}>
            Ø {data.team_avg_zonen} Zonen
          </span>
          {hasAlert && <AlertTriangle size={13} className="text-red-500" />}
        </span>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>

      {open && (
        <>
          {/* Alert-Banner */}
          {alerts.map(f => (
            <div key={f.fahrer_id} className="mb-2 px-3 py-1.5 rounded-lg bg-red-100 border border-red-300 text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle size={12} />
              <strong>{f.fahrer_name}</strong>: {f.alert} — nur {f.zonen_count} Zone{f.zonen_count !== 1 ? 'n' : ''}
            </div>
          ))}

          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: 'Team-Ø',       val: `${data.team_avg_zonen} Zonen`, cls: tc.text },
              { label: 'Meiste',       val: `${sorted[0]?.zonen_count ?? 0} Zonen`, cls: 'text-green-700' },
              { label: 'Ziel',         val: `≥${ZIEL} Zonen`, cls: 'text-blue-700' },
            ].map(k => (
              <div key={k.label} className="bg-gray-50 rounded-lg p-2 text-center border border-gray-200">
                <p className={`font-bold text-base ${k.cls}`}>{k.val}</p>
                <p className="text-gray-500 text-xs">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Fahrerliste */}
          <div className="space-y-2">
            {sorted.map(f => {
              const c = ampelCls(f.ampel);
              return (
                <div key={f.fahrer_id} className={`border rounded-lg p-2 ${c.bg}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                    <span className={`font-medium flex-1 ${c.text}`}>{f.fahrer_name}</span>
                    <span className="text-gray-500 text-xs">{f.touren} Touren</span>
                    <TrendIcon trend={f.trend} />
                    <span className={`font-bold text-sm ${c.text}`}>{f.zonen_count}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-xs w-8">0</span>
                    <ZonenBalken n={f.zonen_count} barClass={c.bar} />
                    <span className="text-gray-400 text-xs w-6">{MAX}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legende */}
          <div className="flex gap-3 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />≥3 Zonen</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />2 Zonen</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />1 Zone</span>
          </div>
        </>
      )}
    </div>
  );
}
