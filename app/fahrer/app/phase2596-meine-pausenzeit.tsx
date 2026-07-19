'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';

interface SingleEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_pause_min: number;
  avg_pause_min_vw: number;
  pausen_anzahl: number;
  touren_heute: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_lang: boolean;
  alert_kurz: boolean;
}

interface SingleData {
  fahrer_single: SingleEntry;
  team_avg_pause_min: number;
  team_avg_pause_min_vw: number;
}

function ampelStyle(ampel: string) {
  if (ampel === 'rot')  return { text: 'text-red-600', bg: 'bg-red-50 border-red-200', bar: 'bg-red-500', tip: 'bg-red-100 text-red-800' };
  if (ampel === 'gelb') return { text: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', bar: 'bg-amber-400', tip: 'bg-amber-50 text-amber-800' };
  return { text: 'text-green-600', bg: 'bg-green-50 border-green-200', bar: 'bg-green-500', tip: 'bg-green-50 text-green-800' };
}

function coachingTipp(e: SingleEntry): string {
  if (e.alert_kurz) return 'Deine Pausen sind sehr kurz. Gönne dir kurze Erholungspausen zwischen den Touren für sichere Arbeit!';
  if (e.alert_lang) return 'Deine Pausen zwischen Touren sind sehr lang. Nimm schneller neue Touren an, um die Effizienz zu steigern!';
  if (e.ampel === 'gelb') return 'Deine Pausen liegen im gelben Bereich. Versuche sie auf unter 15 Min zu reduzieren.';
  return 'Top! Deine Pausenzeiten sind optimal. Weiter so!';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp size={14} className="text-red-500" />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-green-600" />;
  return <Minus size={14} className="text-gray-400" />;
}

function PausenzeitBalken({ min, barClass }: { min: number; barClass: string }) {
  const MAX = 60;
  const ZIEL = 15;
  const fill    = Math.min(100, (min / MAX) * 100);
  const goalPct = Math.min(100, (ZIEL / MAX) * 100);
  return (
    <div className="relative h-3 rounded-full bg-gray-200">
      <div className={`absolute top-0 left-0 h-full rounded-full ${barClass}`} style={{ width: `${fill}%` }} />
      <div
        className="absolute top-0 h-full border-l-2 border-dashed border-green-500"
        style={{ left: `${goalPct}%` }}
        title="Ziel ≤15 Min"
      />
    </div>
  );
}

const MOCK: SingleData = {
  fahrer_single: {
    fahrer_id: 'me', fahrer_name: 'Ich',
    avg_pause_min: 18.5, avg_pause_min_vw: 16.2,
    pausen_anzahl: 7, touren_heute: 8,
    trend: 'steigend', trend_delta: 2.3,
    ampel: 'gelb', alert_lang: false, alert_kurz: false,
  },
  team_avg_pause_min: 19.2,
  team_avg_pause_min_vw: 17.1,
};

export function FahrerPhase2596MeinePausenzeit({
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
      fetch(`/api/delivery/admin/fahrer-pausenzeit?${params}`)
        .then(r => r.json())
        .then((res: SingleData | { fahrer: SingleEntry[]; team_avg_pause_min: number; team_avg_pause_min_vw: number }) => {
          if ('fahrer_single' in res && res.fahrer_single) {
            setData(res as SingleData);
          } else if ('fahrer' in res && Array.isArray(res.fahrer) && res.fahrer.length > 0) {
            const all = res as { fahrer: SingleEntry[]; team_avg_pause_min: number; team_avg_pause_min_vw: number };
            const me  = driverId ? all.fahrer.find(f => f.fahrer_id === driverId) : null;
            setData({
              fahrer_single: me ?? all.fahrer[0],
              team_avg_pause_min: all.team_avg_pause_min,
              team_avg_pause_min_vw: all.team_avg_pause_min_vw,
            });
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
  const st = ampelStyle(e.ampel);

  return (
    <div className={`rounded-xl border ${st.bg} shadow-sm mb-3`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className={st.text} />
          <span className="font-semibold text-sm text-gray-800">Meine Pausenzeit</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${st.text}`}>{e.avg_pause_min.toFixed(1)} Min</span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Hauptwert */}
          <div className="text-center py-2">
            <div className={`text-4xl font-black ${st.text}`}>{e.avg_pause_min.toFixed(1)}'</div>
            <div className="text-xs text-gray-500 mt-1">Ø Pause zwischen Touren (Ziel: ≤15 Min)</div>
            <div className="text-xs text-gray-400 mt-0.5">{e.pausen_anzahl} Pausen · {e.touren_heute} Touren heute</div>
          </div>

          {/* Balken */}
          <PausenzeitBalken min={e.avg_pause_min} barClass={st.bar} />
          <div className="flex justify-between text-xs text-gray-400">
            <span>0 Min</span>
            <span className="text-green-600">Ziel 15 Min</span>
            <span>60 Min</span>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-gray-700">{e.avg_pause_min_vw.toFixed(1)}'</div>
              <div className="text-xs text-gray-400">Vorwoche</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="flex items-center justify-center gap-1">
                <TrendIcon trend={e.trend} />
                <span className="text-base font-bold text-gray-700">
                  {e.trend_delta > 0 ? '+' : ''}{e.trend_delta.toFixed(1)}'
                </span>
              </div>
              <div className="text-xs text-gray-400">Trend</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-green-600">≤15'</div>
              <div className="text-xs text-gray-400">Ziel</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-gray-700">{data.team_avg_pause_min.toFixed(1)}'</div>
              <div className="text-xs text-gray-400">Team Ø</div>
            </div>
          </div>

          {/* Coaching */}
          <div className={`rounded-lg p-2.5 text-xs ${st.tip}`}>
            {coachingTipp(e)}
          </div>
        </div>
      )}
    </div>
  );
}
