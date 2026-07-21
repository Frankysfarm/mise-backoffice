'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Route } from 'lucide-react';

interface DriverData {
  fahrer_single: {
    effizienz_score: number;
    effizienz_score_vw: number;
    puenktlichkeit_pct: number;
    abschlussrate_pct: number;
    stoppzeit_min: number;
    trend: string;
    trend_delta: number;
    ampel: string;
    rang: number;
  };
  team_avg_score: number;
}

const ZIEL = 80;
const WARN = 65;

function calcAmpel(score: number): string {
  if (score >= ZIEL) return 'gruen';
  if (score >= WARN) return 'gelb';
  return 'rot';
}

function ampelColors(a: string) {
  if (a === 'rot')  return { text: 'text-red-600',   bar: 'bg-red-500'   };
  if (a === 'gelb') return { text: 'text-amber-600', bar: 'bg-amber-400' };
  return                   { text: 'text-green-600', bar: 'bg-green-500' };
}

function coachingTipp(ampel: string, puenktlichkeit: number, abschluss: number): string {
  if (ampel === 'rot') {
    if (puenktlichkeit < 70) return 'Pünktlichkeit verbessern — plant mehr Puffer bei der Route ein!';
    if (abschluss < 85)      return 'Abschlussrate steigern — sicher alle Stopps vollständig bestätigen!';
    return 'Effizienz zu niedrig — fokussiere dich auf schnelle Abläufe an jedem Stopp!';
  }
  if (ampel === 'gelb') return 'Fast im grünen Bereich! Noch ein bisschen konsequenter und du erreichst dein Ziel.';
  return 'Ausgezeichnete Touren-Effizienz — weiter so!';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend')  return <TrendingUp   size={14} className="text-green-600" />;
  if (trend === 'fallend')   return <TrendingDown size={14} className="text-red-500"   />;
  return                            <Minus        size={14} className="text-gray-400"  />;
}

const MOCK: DriverData = {
  fahrer_single: {
    effizienz_score: 75,
    effizienz_score_vw: 72,
    puenktlichkeit_pct: 78,
    abschlussrate_pct: 91,
    stoppzeit_min: 6.2,
    trend: 'steigend',
    trend_delta: 3,
    ampel: 'gelb',
    rang: 2,
  },
  team_avg_score: 79,
};

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2912MeineTourenEffizienz({ driverId, locationId, isOnline }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<DriverData | null>(null);

  useEffect(() => {
    if (!isOnline) return;
    if (!driverId || !locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/tour-effizienz?location_id=${locationId}&driver_id=${driverId}`)
        .then(r => r.json())
        .then((d: DriverData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !data) return null;

  const f = data.fahrer_single;
  const ampel = calcAmpel(f.effizienz_score);
  const { text, bar } = ampelColors(ampel);
  const pct     = Math.min(100, (f.effizienz_score / 100) * 100);
  const zielPct = ZIEL;
  const tipp    = coachingTipp(ampel, f.puenktlichkeit_pct, f.abschlussrate_pct);

  const subScores = [
    { label: 'Pünktlichkeit', value: `${f.puenktlichkeit_pct}%`, weight: '40%' },
    { label: 'Abschlussrate', value: `${f.abschlussrate_pct}%`, weight: '30%' },
    { label: 'Stoppzeit',     value: `${f.stoppzeit_min.toFixed(1)} Min`, weight: '30%' },
  ];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Route size={16} className="text-violet-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Meine Touren-Effizienz</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 py-4 space-y-4">
          {/* Big value */}
          <div className="text-center">
            <div className={`text-4xl font-extrabold ${text}`}>{f.effizienz_score} Pkt</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Effizienz-Score heute · Rang #{f.rang}</div>
          </div>

          {/* Bar */}
          <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-visible mx-2">
            <div className={`absolute top-0 left-0 h-3 rounded-full transition-all ${bar}`} style={{ width: `${pct}%` }} />
            <div className="absolute top-[-3px] h-5 w-0.5 bg-gray-600 dark:bg-gray-300 opacity-70 rounded" style={{ left: `${zielPct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400 px-2">
            <span>0</span>
            <span className="text-gray-600 dark:text-gray-300 font-medium">Ziel ≥{ZIEL}</span>
            <span>100 Pkt</span>
          </div>

          {/* Sub-Scores */}
          <div className="grid grid-cols-3 gap-2">
            {subScores.map(s => (
              <div key={s.label} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400">{s.label}</div>
                <div className="text-sm font-bold text-gray-700 dark:text-gray-300">{s.value}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500">{s.weight}</div>
              </div>
            ))}
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400">Trend</div>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <TrendIcon trend={f.trend} />
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  {f.trend_delta > 0 ? '+' : ''}{f.trend_delta} Pkt
                </span>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400">Team-Ø</div>
              <div className="text-sm font-bold text-gray-700 dark:text-gray-300">{data.team_avg_score} Pkt</div>
            </div>
          </div>

          {/* Coaching tip */}
          <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-lg px-3 py-2 text-xs text-violet-700 dark:text-violet-300">
            {tipp}
          </div>
        </div>
      )}
    </div>
  );
}
