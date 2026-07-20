'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';

interface DriverEntry {
  driverId: string;
  driverName: string;
  auslastungPct: number;
  remainingMin: number;
  activeTours: number;
}

interface ApiData {
  drivers: DriverEntry[];
  avgAuslastungPct: number;
  freiKapazitaet: number;
}

const ZIEL_PCT = 80;
const WARN_PCT = 50;

function calcAmpel(p: number): 'gruen' | 'gelb' | 'rot' {
  if (p > ZIEL_PCT) return 'gruen';
  if (p >= WARN_PCT) return 'gelb';
  return 'rot';
}

function dotCls(a: string) {
  if (a === 'rot')  return 'bg-red-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-green-500';
}

function textCls(a: string) {
  if (a === 'rot')  return 'text-red-700';
  if (a === 'gelb') return 'text-amber-700';
  return 'text-green-700';
}

function TrendIcon({ p }: { p: number }) {
  if (p > ZIEL_PCT) return <TrendingUp   size={11} className="text-green-600" />;
  if (p < WARN_PCT) return <TrendingDown size={11} className="text-red-500"   />;
  return                   <Minus        size={11} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  drivers: [
    { driverId: 'f4', driverName: 'Julia F.', auslastungPct: 30, remainingMin: 180, activeTours: 0 },
    { driverId: 'f3', driverName: 'Tim B.',   auslastungPct: 48, remainingMin: 120, activeTours: 0 },
    { driverId: 'f2', driverName: 'Sara K.',  auslastungPct: 65, remainingMin:  90, activeTours: 1 },
    { driverId: 'f1', driverName: 'Max M.',   auslastungPct: 92, remainingMin:  45, activeTours: 1 },
  ],
  avgAuslastungPct: 59,
  freiKapazitaet: 2,
};

export function KitchenPhase2781AuslastungsPrognoseTicker({ locationId }: { locationId?: string | null }) {
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

  const enriched = data.drivers.map(d => ({ ...d, ampel: calcAmpel(d.auslastungPct) }));
  // Kompakt: absteigend (höchste Auslastung oben)
  const sorted   = [...enriched].sort((a, b) => b.auslastungPct - a.auslastungPct);
  const alerts   = enriched.filter(d => d.auslastungPct < WARN_PCT);
  const hasAlert = alerts.length > 0;
  const teamAmpel = calcAmpel(data.avgAuslastungPct);

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm mb-3`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock size={15} className={hasAlert ? 'text-red-500' : 'text-blue-600'} />
          <span className="font-semibold text-sm text-gray-800">Schicht-Auslastungs-Prognose</span>
          {hasAlert && (
            <span className="inline-flex items-center gap-0.5 text-xs text-red-600 font-medium">
              <AlertTriangle size={11} /> {alerts.length}
            </span>
          )}
          <span className={`ml-1 text-xs font-bold ${textCls(teamAmpel)}`}>
            Team-Ø {data.avgAuslastungPct}%
          </span>
          <span className="text-[10px] text-gray-400 ml-1">Ziel &gt;{ZIEL_PCT}%</span>
        </div>
        {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-1.5">
          {alerts.map(d => (
            <div key={d.driverId} className="flex items-center gap-1.5 rounded bg-red-100 border border-red-200 px-2 py-1 text-xs text-red-700 font-medium">
              <AlertTriangle size={11} />
              <span className="font-bold">{d.driverName}</span>: Fahrer unterausgelastet! ({d.auslastungPct}%)
            </div>
          ))}

          {sorted.map(d => (
            <div key={d.driverId} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${dotCls(d.ampel)}`} />
                <span className="text-xs text-gray-700">{d.driverName}</span>
                <span className="text-[10px] text-gray-400">{d.remainingMin}min</span>
              </div>
              <div className="flex items-center gap-1.5">
                <TrendIcon p={d.auslastungPct} />
                <span className={`text-xs font-bold ${textCls(d.ampel)}`}>{d.auslastungPct}%</span>
              </div>
            </div>
          ))}

          <div className="pt-1 text-[10px] text-gray-400">
            {data.freiKapazitaet} Fahrer ohne aktive Tour · Ziel &gt;{ZIEL_PCT}% Auslastung
          </div>
        </div>
      )}
    </div>
  );
}
