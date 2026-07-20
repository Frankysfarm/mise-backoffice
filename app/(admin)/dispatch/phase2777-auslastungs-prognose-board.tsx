'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';

interface DriverEntry {
  driverId: string;
  driverName: string;
  auslastungPct: number;
  remainingMin: number;
  deliveriesToday: number;
  activeTours: number;
  ratePerHour: number;
  projectedTotal: number;
}

interface ApiData {
  drivers: DriverEntry[];
  avgAuslastungPct: number;
  freiKapazitaet: number;
  totalActiveDrivers: number;
}

const ZIEL_PCT = 80;
const WARN_PCT = 50;

function calcAmpel(p: number): 'gruen' | 'gelb' | 'rot' {
  if (p > ZIEL_PCT) return 'gruen';
  if (p >= WARN_PCT) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    dot: 'bg-red-500',   text: 'text-red-700',   bar: 'bg-red-500'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700', bar: 'bg-amber-400' };
  return                   { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700', bar: 'bg-green-500' };
}

function TrendIcon({ curr, prev }: { curr: number; prev: number }) {
  const d = curr - prev;
  if (d > 2)  return <TrendingUp   size={12} className="text-green-600" />;
  if (d < -2) return <TrendingDown size={12} className="text-red-500"   />;
  return              <Minus        size={12} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  drivers: [
    { driverId: 'f1', driverName: 'Max M.',   auslastungPct: 92, remainingMin: 45, deliveriesToday: 9, activeTours: 1, ratePerHour: 3.2, projectedTotal: 12 },
    { driverId: 'f2', driverName: 'Sara K.',  auslastungPct: 65, remainingMin: 90, deliveriesToday: 6, activeTours: 0, ratePerHour: 2.0, projectedTotal: 9  },
    { driverId: 'f3', driverName: 'Tim B.',   auslastungPct: 48, remainingMin: 120, deliveriesToday: 3, activeTours: 0, ratePerHour: 1.2, projectedTotal: 5  },
    { driverId: 'f4', driverName: 'Julia F.', auslastungPct: 30, remainingMin: 180, deliveriesToday: 2, activeTours: 0, ratePerHour: 0.8, projectedTotal: 4  },
  ],
  avgAuslastungPct: 59,
  freiKapazitaet: 3,
  totalActiveDrivers: 4,
};

export function DispatchPhase2777AuslastungsPrognosBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-schicht-auslastung?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted    = [...data.drivers].sort((a, b) => b.auslastungPct - a.auslastungPct);
  const alerts    = data.drivers.filter(d => d.auslastungPct < WARN_PCT);
  const hasAlert  = alerts.length > 0;
  const teamAmpel = calcAmpel(data.avgAuslastungPct);
  const best      = sorted[0]?.auslastungPct ?? 0;

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className={hasAlert ? 'text-red-500' : 'text-blue-600'} />
          <span className="font-semibold text-sm text-gray-800">Schicht-Auslastungs-Prognose</span>
          {hasAlert && (
            <span className="inline-flex items-center gap-0.5 text-xs text-red-600 font-medium">
              <AlertTriangle size={11} /> {alerts.length}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Alert-Banner */}
          {alerts.map(d => (
            <div key={d.driverId} className="flex items-center gap-2 rounded-lg bg-red-100 border border-red-200 px-3 py-2 text-xs text-red-700 font-medium">
              <AlertTriangle size={13} />
              <span className="font-bold">{d.driverName}</span>: Fahrer unterausgelastet! ({d.auslastungPct}%)
            </div>
          ))}

          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {(() => { const c = ampelCls(teamAmpel); return (
              <div className={`rounded-lg border ${c.bg} px-2 py-2`}>
                <div className="text-[10px] text-gray-500 mb-0.5">Team-Ø</div>
                <div className={`text-base font-bold ${c.text}`}>{data.avgAuslastungPct}%</div>
              </div>
            ); })()}
            <div className="rounded-lg bg-green-50 border border-green-200 px-2 py-2">
              <div className="text-[10px] text-gray-500 mb-0.5">Bester</div>
              <div className="text-base font-bold text-green-700">{best}%</div>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-2 py-2">
              <div className="text-[10px] text-gray-500 mb-0.5">Ziel</div>
              <div className="text-base font-bold text-gray-700">&gt;{ZIEL_PCT}%</div>
            </div>
          </div>

          {/* Fahrerliste nach Auslastung absteigend */}
          <div className="space-y-2">
            {sorted.map(d => {
              const a   = calcAmpel(d.auslastungPct);
              const cls = ampelCls(a);
              const fill = Math.min(150, d.auslastungPct);
              const zielPct = ZIEL_PCT;
              return (
                <div key={d.driverId} className={`rounded-lg border ${cls.bg} px-3 py-2`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${cls.dot}`} />
                      <span className="text-xs font-semibold text-gray-800">{d.driverName}</span>
                      <span className="text-[10px] text-gray-400">
                        {d.deliveriesToday} Touren · {d.remainingMin} Min. übrig
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TrendIcon curr={d.auslastungPct} prev={d.auslastungPct - 5} />
                      <span className={`text-sm font-bold ${cls.text}`}>{d.auslastungPct}%</span>
                    </div>
                  </div>
                  {/* Balken 0–150% mit Ziel-Linie */}
                  <div className="relative h-3 rounded-full bg-gray-200">
                    <div
                      className="absolute top-0 h-full w-0.5 bg-green-500 z-10"
                      style={{ left: `${(zielPct / 150) * 100}%` }}
                      title={`Ziel: >${ZIEL_PCT}%`}
                    />
                    <div
                      className={`absolute top-0 left-0 h-full rounded-full ${cls.bar}`}
                      style={{ width: `${(fill / 150) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-[9px] text-gray-400">
                    <span>{d.ratePerHour} T/h</span>
                    <span>Prognose: {d.projectedTotal} Touren gesamt</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Freie Kapazität */}
          <div className="flex items-center gap-3 text-[10px] text-gray-500 pt-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />&gt;{ZIEL_PCT}%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />{WARN_PCT}–{ZIEL_PCT}%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />&lt;{WARN_PCT}%</span>
            <span className="ml-auto text-gray-400">{data.freiKapazitaet} Fahrer frei</span>
          </div>
        </div>
      )}
    </div>
  );
}
