'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, MapPin } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  dichte: number;
  stopps_heute: number;
  km_heute: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  alert: string | null;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_dichte: number;
}

const ZIEL = 0.3;
const MAX  = 0.6;

function calcAmpel(d: number): 'gruen' | 'gelb' | 'rot' {
  if (d >= ZIEL)  return 'gruen';
  if (d >= 0.15) return 'gelb';
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

function DichteBalken({ d, barClass }: { d: number; barClass: string }) {
  const fill    = Math.min(100, (d / MAX) * 100);
  const zielPct = (ZIEL / MAX) * 100;
  return (
    <div className="relative h-3 rounded-full bg-gray-200 flex-1">
      <div
        className="absolute top-0 h-full w-0.5 bg-green-500 z-10"
        style={{ left: `${zielPct}%` }}
        title={`Ziel: ≥${ZIEL} Stopps/km`}
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
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   dichte: 0.42, stopps_heute: 13, km_heute: 31.0, trend: 'steigend', alert: null                       },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  dichte: 0.31, stopps_heute:  9, km_heute: 29.0, trend: 'fallend',  alert: null                       },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   dichte: 0.21, stopps_heute:  6, km_heute: 28.6, trend: 'stabil',   alert: null                       },
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', dichte: 0.11, stopps_heute:  4, km_heute: 36.4, trend: 'fallend',  alert: 'Lieferdichte zu gering!' },
  ],
  team_avg_dichte: 0.26,
};

export function DispatchPhase2712LieferdichteBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-lieferdichte?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched  = data.fahrer.map((f: FahrerEntry) => ({ ...f, ampel: calcAmpel(f.dichte) }));
  const sorted    = [...enriched].sort((a, b) => b.dichte - a.dichte);
  const alerts    = enriched.filter((f: FahrerEntry & { ampel: string }) => f.alert !== null);
  const hasAlert  = alerts.length > 0;
  const bester    = sorted[0];
  const teamAmpel = calcAmpel(data.team_avg_dichte);
  const teamCls   = ampelCls(teamAmpel);

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <MapPin size={16} className={hasAlert ? 'text-red-500' : 'text-green-600'} />
          <span className="font-semibold text-sm text-gray-800">Lieferdichte</span>
          {hasAlert && (
            <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
              <AlertTriangle size={12} /> {alerts.length} Alert{alerts.length > 1 ? 's' : ''}
            </span>
          )}
          <span className={`ml-2 text-xs font-bold ${teamCls.text}`}>
            Ø {data.team_avg_dichte.toFixed(2)} Stopps/km
          </span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {alerts.map((f: FahrerEntry & { ampel: string }) => (
            <div key={f.fahrer_id} className="flex items-center gap-2 rounded-lg bg-red-100 border border-red-200 px-3 py-2 text-xs text-red-700 font-medium">
              <AlertTriangle size={13} />
              <span className="font-bold">{f.fahrer_name}</span>: {f.alert} ({f.dichte.toFixed(2)} Stopps/km)
            </div>
          ))}

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Team-Ø', value: `${data.team_avg_dichte.toFixed(2)}/km`, cls: teamCls.text },
              { label: 'Bester', value: bester ? `${bester.dichte.toFixed(2)}/km` : '–',            cls: 'text-green-600' },
              { label: 'Ziel',   value: `≥${ZIEL}/km`,                                              cls: 'text-gray-500'  },
            ].map(({ label, value, cls }) => (
              <div key={label} className="rounded-lg bg-gray-50 border border-gray-200 p-2 text-center">
                <div className="text-xs text-gray-500">{label}</div>
                <div className={`text-sm font-bold ${cls}`}>{value}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> ≥0.3/km</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> 0.15–0.29/km</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500  inline-block" /> &lt;0.15/km</span>
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
                      <span className={`text-xs font-bold ${cls.text}`}>{f.dichte.toFixed(2)}/km</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DichteBalken d={f.dichte} barClass={cls.bar} />
                    <span className="text-[10px] text-gray-400 w-24 text-right">
                      {f.stopps_heute}S / {f.km_heute.toFixed(1)}km
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
