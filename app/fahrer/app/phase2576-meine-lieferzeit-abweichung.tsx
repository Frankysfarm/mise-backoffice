'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Timer } from 'lucide-react';

interface SingleEntry {
  fahrer_id: string;
  fahrer_name: string;
  abweichung_min: number;
  abweichung_min_vw: number | null;
  lieferungen_count: number;
  trend: 'besser' | 'schlechter' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface SingleData {
  fahrer_single: SingleEntry;
  team_avg_min: number;
}

function ampelStyle(min: number) {
  if (min <= 0)  return { text: 'text-green-600', bg: 'bg-green-50 border-green-200', bar: 'bg-green-500' };
  if (min <= 10) return { text: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', bar: 'bg-amber-400' };
  return { text: 'text-red-600', bg: 'bg-red-50 border-red-200', bar: 'bg-red-500' };
}

function formatMin(min: number): string {
  return `${min > 0 ? '+' : ''}${min.toFixed(1)} Min`;
}

function coachingTipp(min: number): string {
  if (min <= 0)  return 'Perfekt! Du lieferst im Schnitt vor der zugesagten Zeit. So machst du Kunden glücklich — weiter so!';
  if (min <= 10) return 'Leicht über der ETA. Plane etwas mehr Pufferzeit ein und informiere Kunden proaktiv bei Verzögerungen.';
  return 'Mehr als 10 Min über der zugesagten Zeit. Starte Touren früher oder melde Engpässe sofort an den Dispatch!';
}

function TrendIcon({ trend }: { trend: 'besser' | 'schlechter' | 'stabil' }) {
  if (trend === 'besser')     return <TrendingDown size={14} className="text-green-600" />;
  if (trend === 'schlechter') return <TrendingUp size={14} className="text-red-500" />;
  return <Minus size={14} className="text-gray-400" />;
}

const NULL_POS = 25; // 10/(10+30)*100 = 25%

function AbweichungsBalken({ min, barClass }: { min: number; barClass: string }) {
  const RANGE_NEG = 10;
  const RANGE_TOT = 40;
  const clamped  = Math.max(-RANGE_NEG, Math.min(30, min));
  const pos = Math.round(((clamped + RANGE_NEG) / RANGE_TOT) * 100);

  const left  = Math.min(pos, NULL_POS);
  const width = Math.abs(pos - NULL_POS);

  return (
    <div className="relative h-3 rounded-full bg-gray-200">
      <div className={`absolute top-0 h-full rounded-full ${barClass}`} style={{ left: `${left}%`, width: `${width}%` }} />
      <div className="absolute top-0 h-full border-l-2 border-gray-600" style={{ left: `${NULL_POS}%` }} title="Ziel ≤0 Min" />
      <div className="absolute top-0 h-full border-l-2 border-dashed border-red-500" style={{ left: `${Math.round((20 / 40) * 100)}%` }} title="Alert >10 Min" />
    </div>
  );
}

const MOCK: SingleData = {
  fahrer_single: {
    fahrer_id: 'me',
    fahrer_name: 'Ich',
    abweichung_min: 6.1,
    abweichung_min_vw: 7.4,
    lieferungen_count: 11,
    trend: 'besser',
    trend_delta: -1.3,
    ampel: 'gelb',
  },
  team_avg_min: 8.1,
};

export function FahrerPhase2576MeineLieferzeitAbweichung({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<SingleData | null>(null);

  useEffect(() => {
    if (!isOnline) return;
    if (!locationId) { setData(MOCK); return; }
    const params = new URLSearchParams({ location_id: locationId });
    if (driverId) params.set('driver_id', driverId);
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-lieferzeit-abweichung?${params}`)
        .then(r => r.json())
        .then((res: SingleData | { fahrer: SingleEntry[]; team_avg_min: number }) => {
          if ('fahrer_single' in res && res.fahrer_single) {
            setData(res as SingleData);
          } else if ('fahrer' in res && Array.isArray(res.fahrer) && res.fahrer.length > 0) {
            const all = res as { fahrer: SingleEntry[]; team_avg_min: number };
            const me  = driverId ? all.fahrer.find(f => f.fahrer_id === driverId) : null;
            setData({ fahrer_single: me ?? all.fahrer[0], team_avg_min: all.team_avg_min });
          } else {
            setData(MOCK);
          }
        })
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !data) return null;

  const e  = data.fahrer_single;
  const st = ampelStyle(e.abweichung_min);

  return (
    <div className={`rounded-xl border ${st.bg} shadow-sm mb-3`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Timer size={16} className={st.text} />
          <span className="font-semibold text-sm text-gray-800">Meine Lieferzeit-Abweichung</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${st.text}`}>{formatMin(e.abweichung_min)}</span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Hauptwert */}
          <div className="text-center py-2">
            <div className={`text-4xl font-black ${st.text}`}>{formatMin(e.abweichung_min)}</div>
            <div className="text-xs text-gray-500 mt-1">
              Ø Abweichung von zugesagter ETA ({e.lieferungen_count} Lieferungen)
            </div>
          </div>

          {/* Balken */}
          <AbweichungsBalken min={e.abweichung_min} barClass={st.bar} />
          <div className="flex justify-between text-xs text-gray-400">
            <span>−10</span>
            <span className="text-gray-600 font-medium">0 Min</span>
            <span className="text-red-500">+10</span>
            <span>+30</span>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-gray-700">
                {e.abweichung_min_vw !== null ? formatMin(e.abweichung_min_vw) : '—'}
              </div>
              <div className="text-xs text-gray-400">Vorwoche</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="flex items-center justify-center gap-1">
                <TrendIcon trend={e.trend} />
                <span className="text-base font-bold text-gray-700">
                  {e.trend_delta > 0 ? '+' : ''}{e.trend_delta.toFixed(1)} Min
                </span>
              </div>
              <div className="text-xs text-gray-400">Trend</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-green-600">≤0 Min</div>
              <div className="text-xs text-gray-400">Ziel</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-gray-700">{formatMin(data.team_avg_min)}</div>
              <div className="text-xs text-gray-400">Team Ø</div>
            </div>
          </div>

          {/* Coaching */}
          <div className={`rounded-lg p-2.5 text-xs ${e.ampel === 'rot' ? 'bg-red-100 text-red-800' : e.ampel === 'gelb' ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-800'}`}>
            {coachingTipp(e.abweichung_min)}
          </div>
        </div>
      )}
    </div>
  );
}
