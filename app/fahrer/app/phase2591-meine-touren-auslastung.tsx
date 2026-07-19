'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';

interface SingleEntry {
  fahrer_id: string;
  fahrer_name: string;
  auslastung_pct: number;
  auslastung_pct_gestern: number | null;
  aktive_minuten_heute: number;
  trend: 'besser' | 'schlechter' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface SingleData {
  fahrer_single: SingleEntry;
  team_avg_heute: number;
  ziel: number;
}

function ampelStyle(ampel: string) {
  if (ampel === 'rot')  return { text: 'text-red-600', bg: 'bg-red-50 border-red-200', bar: 'bg-red-500' };
  if (ampel === 'gelb') return { text: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', bar: 'bg-amber-400' };
  return { text: 'text-green-600', bg: 'bg-green-50 border-green-200', bar: 'bg-green-500' };
}

function coachingTipp(ampel: string, ziel: number): string {
  if (ampel === 'rot')  return `Deine Auslastung liegt unter 50%. Nimm verfügbare Touren an und bleib aktiv, um das Ziel von ${ziel}% zu erreichen!`;
  if (ampel === 'gelb') return `Gut unterwegs! Noch ein paar Touren mehr und du erreichst das Ziel von ${ziel}% Auslastung.`;
  return `Super! Du hast das Auslastungsziel von ${ziel}% erreicht oder übertroffen. Weiter so!`;
}

function TrendIcon({ trend }: { trend: 'besser' | 'schlechter' | 'stabil' }) {
  if (trend === 'besser')      return <TrendingUp size={14} className="text-green-600" />;
  if (trend === 'schlechter')  return <TrendingDown size={14} className="text-red-500" />;
  return <Minus size={14} className="text-gray-400" />;
}

function AuslastungsBalken({ pct, ziel, barClass }: { pct: number; ziel: number; barClass: string }) {
  const fill    = Math.min(100, pct);
  const goalPct = Math.min(100, ziel);
  return (
    <div className="relative h-3 rounded-full bg-gray-200">
      <div className={`absolute top-0 left-0 h-full rounded-full ${barClass}`} style={{ width: `${fill}%` }} />
      <div
        className="absolute top-0 h-full border-l-2 border-dashed border-green-500"
        style={{ left: `${goalPct}%` }}
        title={`Ziel ${ziel}%`}
      />
    </div>
  );
}

const MOCK: SingleData = {
  fahrer_single: {
    fahrer_id: 'me', fahrer_name: 'Ich',
    auslastung_pct: 61, auslastung_pct_gestern: 58, aktive_minuten_heute: 293,
    trend: 'stabil', trend_delta: 3, ampel: 'gelb', alert: false,
  },
  team_avg_heute: 60.0,
  ziel: 70,
};

export function FahrerPhase2591MeineTourenAuslastung({
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
      fetch(`/api/delivery/admin/fahrer-touren-auslastung?${params}`)
        .then(r => r.json())
        .then((res: SingleData | { fahrer: SingleEntry[]; team_avg_heute: number; ziel: number }) => {
          if ('fahrer_single' in res && res.fahrer_single) {
            setData(res as SingleData);
          } else if ('fahrer' in res && Array.isArray(res.fahrer) && res.fahrer.length > 0) {
            const all = res as { fahrer: SingleEntry[]; team_avg_heute: number; ziel: number };
            const me  = driverId ? all.fahrer.find(f => f.fahrer_id === driverId) : null;
            setData({ fahrer_single: me ?? all.fahrer[0], team_avg_heute: all.team_avg_heute, ziel: all.ziel ?? 70 });
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
          <Activity size={16} className={st.text} />
          <span className="font-semibold text-sm text-gray-800">Meine Touren-Auslastung</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${st.text}`}>{e.auslastung_pct}%</span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Hauptwert */}
          <div className="text-center py-2">
            <div className={`text-4xl font-black ${st.text}`}>{e.auslastung_pct}%</div>
            <div className="text-xs text-gray-500 mt-1">
              Touren-Auslastung heute (Ziel: ≥{data.ziel}%)
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{e.aktive_minuten_heute} Min. aktiv</div>
          </div>

          {/* Balken */}
          <AuslastungsBalken pct={e.auslastung_pct} ziel={data.ziel} barClass={st.bar} />
          <div className="flex justify-between text-xs text-gray-400">
            <span>0%</span>
            <span className="text-green-600">Ziel {data.ziel}%</span>
            <span>100%</span>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-gray-700">
                {e.auslastung_pct_gestern !== null ? `${e.auslastung_pct_gestern}%` : '—'}
              </div>
              <div className="text-xs text-gray-400">Gestern</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="flex items-center justify-center gap-1">
                <TrendIcon trend={e.trend} />
                <span className="text-base font-bold text-gray-700">
                  {e.trend_delta > 0 ? '+' : ''}{e.trend_delta}%
                </span>
              </div>
              <div className="text-xs text-gray-400">Trend</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-green-600">≥{data.ziel}%</div>
              <div className="text-xs text-gray-400">Ziel</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-gray-700">{data.team_avg_heute.toFixed(1)}%</div>
              <div className="text-xs text-gray-400">Team Ø</div>
            </div>
          </div>

          {/* Coaching */}
          <div className={`rounded-lg p-2.5 text-xs ${
            e.ampel === 'rot'  ? 'bg-red-100 text-red-800' :
            e.ampel === 'gelb' ? 'bg-amber-50 text-amber-800' :
            'bg-green-50 text-green-800'
          }`}>
            {coachingTipp(e.ampel, data.ziel)}
          </div>
        </div>
      )}
    </div>
  );
}
