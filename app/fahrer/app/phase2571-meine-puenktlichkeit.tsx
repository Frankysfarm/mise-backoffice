'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';

interface SingleEntry {
  fahrer_id: string;
  fahrer_name: string;
  puenktlichkeit_pct: number;
  puenktlichkeit_pct_vw: number | null;
  puenktlich_count: number;
  gesamt_count: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface SingleData {
  fahrer_single: SingleEntry;
  team_avg_pct: number;
}

function ampelStyle(pct: number) {
  if (pct >= 90) return { text: 'text-green-600', bg: 'bg-green-50 border-green-200', bar: 'bg-green-500' };
  if (pct >= 75) return { text: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', bar: 'bg-amber-400' };
  return { text: 'text-red-600', bg: 'bg-red-50 border-red-200', bar: 'bg-red-500' };
}

function coachingTipp(pct: number): string {
  if (pct >= 90) return 'Ausgezeichnet! Du lieferst fast immer pünktlich. Halte dieses Niveau — Kunden schätzen Verlässlichkeit!';
  if (pct >= 75) return 'Gute Basis! Optimiere deine Routen vor dem Start und fahre bei Stau Alternativen früher an.';
  return 'Mehr als 25% Lieferungen zu spät. Starte Touren früher und informiere den Dispatch bei Verzögerungen sofort.';
}

function TrendIcon({ trend }: { trend: 'steigend' | 'fallend' | 'stabil' }) {
  if (trend === 'steigend') return <TrendingUp size={14} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-red-500" />;
  return <Minus size={14} className="text-gray-400" />;
}

const MOCK: SingleData = {
  fahrer_single: {
    fahrer_id: 'me',
    fahrer_name: 'Ich',
    puenktlichkeit_pct: 81.8,
    puenktlichkeit_pct_vw: 83.3,
    puenktlich_count: 9,
    gesamt_count: 11,
    trend: 'fallend',
    trend_delta: -1.5,
    ampel: 'gelb',
  },
  team_avg_pct: 78.5,
};

export function FahrerPhase2571MeinePuenktlichkeit({
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
      fetch(`/api/delivery/admin/fahrer-lieferzeit-puenktlichkeit?${params}`)
        .then(r => r.json())
        .then((res: SingleData | { fahrer: SingleEntry[]; team_avg_pct: number }) => {
          if ('fahrer_single' in res && res.fahrer_single) {
            setData(res as SingleData);
          } else if ('fahrer' in res && Array.isArray(res.fahrer) && res.fahrer.length > 0) {
            const all = res as { fahrer: SingleEntry[]; team_avg_pct: number };
            const me = driverId ? all.fahrer.find(f => f.fahrer_id === driverId) : null;
            setData({ fahrer_single: me ?? all.fahrer[0], team_avg_pct: all.team_avg_pct });
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

  const e = data.fahrer_single;
  const st = ampelStyle(e.puenktlichkeit_pct);
  const barW = Math.min(100, e.puenktlichkeit_pct);

  return (
    <div className={`rounded-xl border ${st.bg} shadow-sm mb-3`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className={st.text} />
          <span className="font-semibold text-sm text-gray-800">Meine Pünktlichkeit</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${st.text}`}>{e.puenktlichkeit_pct.toFixed(1)}%</span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Hauptwert */}
          <div className="text-center py-2">
            <div className={`text-4xl font-black ${st.text}`}>{e.puenktlichkeit_pct.toFixed(1)}%</div>
            <div className="text-xs text-gray-500 mt-1">
              {e.puenktlich_count} von {e.gesamt_count} Lieferungen pünktlich
            </div>
          </div>

          {/* Balken */}
          <div className="relative h-3 rounded-full bg-gray-200">
            <div className={`absolute left-0 top-0 h-full rounded-full ${st.bar}`} style={{ width: `${barW}%` }} />
            <div className="absolute top-0 h-full border-l-2 border-dashed border-red-500" style={{ left: '75%' }} title="Alert <75%" />
            <div className="absolute top-0 h-full border-l border-dashed border-amber-400" style={{ left: '90%' }} title="Ziel ≥90%" />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>0%</span>
            <span className="text-red-500">75%</span>
            <span className="text-amber-500">90%</span>
            <span>100%</span>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-gray-700">
                {e.puenktlichkeit_pct_vw !== null ? `${e.puenktlichkeit_pct_vw.toFixed(1)}%` : '—'}
              </div>
              <div className="text-xs text-gray-400">Vorwoche</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="flex items-center justify-center gap-1">
                <TrendIcon trend={e.trend} />
                <span className="text-base font-bold text-gray-700">
                  {e.trend_delta > 0 ? '+' : ''}{e.trend_delta.toFixed(1)}%
                </span>
              </div>
              <div className="text-xs text-gray-400">Trend</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-green-600">≥90%</div>
              <div className="text-xs text-gray-400">Ziel</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-gray-700">{data.team_avg_pct.toFixed(1)}%</div>
              <div className="text-xs text-gray-400">Team Ø</div>
            </div>
          </div>

          {/* Coaching */}
          <div className={`rounded-lg p-2.5 text-xs ${e.ampel === 'rot' ? 'bg-red-100 text-red-800' : e.ampel === 'gelb' ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-800'}`}>
            {coachingTipp(e.puenktlichkeit_pct)}
          </div>
        </div>
      )}
    </div>
  );
}
