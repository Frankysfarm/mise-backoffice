'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

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
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',   bar: 'bg-red-500',   big: 'text-red-600'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400', big: 'text-amber-600' };
  return                   { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500', big: 'text-green-600' };
}

function coaching(pct: number): string {
  if (pct < WARN_PCT) return `Deine Schicht-Auslastung liegt bei ${pct}% — unter dem Ziel. Nimm aktiv mehr Touren an!`;
  if (pct > ZIEL_PCT) return `Starke Auslastung: ${pct}%! Du bist gut im Einsatz. Weiter so!`;
  return `${pct}% Auslastung — du bist auf Kurs. Noch 1–2 Touren und du übertriffst das Ziel von >${ZIEL_PCT}%!`;
}

function TrendIcon({ curr }: { curr: number }) {
  if (curr > ZIEL_PCT) return <TrendingUp   size={14} className="text-green-600" />;
  if (curr < WARN_PCT) return <TrendingDown size={14} className="text-red-500"   />;
  return                      <Minus        size={14} className="text-gray-400"  />;
}

const MOCK_DRIVER_ID = 'mock-me';
const MOCK: ApiData = {
  drivers: [
    { driverId: MOCK_DRIVER_ID, driverName: 'Ich',    auslastungPct: 65, remainingMin: 90, deliveriesToday: 6, activeTours: 1, ratePerHour: 2.0, projectedTotal: 9  },
    { driverId: 'f1',           driverName: 'Max M.', auslastungPct: 92, remainingMin: 45, deliveriesToday: 9, activeTours: 1, ratePerHour: 3.2, projectedTotal: 12 },
  ],
  avgAuslastungPct: 59,
  freiKapazitaet: 2,
  totalActiveDrivers: 4,
};

export function FahrerPhase2778MeineRestschichtPrognose({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!isOnline || !locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-schicht-auslastung?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !data) return null;

  const me = driverId
    ? (data.drivers.find(d => d.driverId === driverId) ?? data.drivers[0])
    : data.drivers[0];
  if (!me) return null;

  const ampel = calcAmpel(me.auslastungPct);
  const cls   = ampelCls(ampel);
  const fill  = Math.min(150, me.auslastungPct);

  const restStunden = Math.floor(me.remainingMin / 60);
  const restMinuten = me.remainingMin % 60;

  return (
    <div className={`rounded-xl border ${cls.bg} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className={cls.text} />
          <span className="font-semibold text-sm text-gray-800">Meine Restschicht-Prognose</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Hauptwert */}
          <div className="text-center">
            <div className={`text-4xl font-black ${cls.big}`}>{me.auslastungPct}%</div>
            <div className="text-xs text-gray-500 mt-0.5">Prognostizierte Schicht-Auslastung</div>
          </div>

          {/* Restschicht-Countdown */}
          <div className="flex items-center justify-center gap-1.5 text-sm text-gray-600">
            <Clock size={13} className="text-gray-400" />
            <span>Restschicht: <span className="font-semibold">{restStunden}h {restMinuten}min</span></span>
          </div>

          {/* Balken 0–150% */}
          <div className="relative h-4 rounded-full bg-gray-200">
            <div
              className="absolute top-0 h-full w-0.5 bg-green-600 z-10"
              style={{ left: `${(ZIEL_PCT / 150) * 100}%` }}
              title={`Ziel: >${ZIEL_PCT}%`}
            />
            <div
              className={`absolute top-0 left-0 h-full rounded-full ${cls.bar}`}
              style={{ width: `${(fill / 150) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>0%</span>
            <span>Ziel &gt;{ZIEL_PCT}%</span>
            <span>150%</span>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <div className="rounded-lg bg-white border border-gray-200 px-1 py-2">
              <div className="text-[9px] text-gray-400 mb-0.5">Trend</div>
              <div className="flex justify-center"><TrendIcon curr={me.auslastungPct} /></div>
            </div>
            <div className="rounded-lg bg-white border border-gray-200 px-1 py-2">
              <div className="text-[9px] text-gray-400 mb-0.5">Ziel</div>
              <div className="text-xs font-bold text-gray-700">&gt;{ZIEL_PCT}%</div>
            </div>
            <div className="rounded-lg bg-white border border-gray-200 px-1 py-2">
              <div className="text-[9px] text-gray-400 mb-0.5">Ampel</div>
              <div className={`text-xs font-bold ${cls.text}`}>●</div>
            </div>
            <div className="rounded-lg bg-white border border-gray-200 px-1 py-2">
              <div className="text-[9px] text-gray-400 mb-0.5">Team-Ø</div>
              <div className="text-xs font-bold text-gray-700">{data.avgAuslastungPct}%</div>
            </div>
          </div>

          {/* Prognose-Details */}
          <div className="rounded-lg bg-white border border-gray-200 px-3 py-2 space-y-1">
            <div className="text-[10px] font-semibold text-gray-500 mb-1">Prognose Details</div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Touren heute</span>
              <span className="font-semibold text-gray-700">{me.deliveriesToday}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Rate</span>
              <span className="font-semibold text-gray-700">{me.ratePerHour} Touren/h</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Prognose gesamt</span>
              <span className={`font-bold ${cls.text}`}>{me.projectedTotal} Touren</span>
            </div>
          </div>

          {/* Coaching-Tipp */}
          <div className={`rounded-lg px-3 py-2 text-xs ${cls.text} bg-white border ${ampel === 'rot' ? 'border-red-200' : ampel === 'gelb' ? 'border-amber-200' : 'border-green-200'}`}>
            {coaching(me.auslastungPct)}
          </div>
        </div>
      )}
    </div>
  );
}
