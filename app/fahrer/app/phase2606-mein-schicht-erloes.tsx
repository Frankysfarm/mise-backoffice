'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Euro } from 'lucide-react';

interface SingleEntry {
  fahrer_id: string;
  fahrer_name: string;
  erloes_heute: number;
  erloes_gestern: number | null;
  trend: 'besser' | 'schlechter' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface SingleData {
  fahrer_single: SingleEntry;
  team_avg_heute: number;
  team_avg_gestern: number | null;
  ziel: number;
}

function ampelStyle(ampel: string) {
  if (ampel === 'rot')  return { text: 'text-red-600',   bg: 'bg-red-50 border-red-200',    bar: 'bg-red-500'   };
  if (ampel === 'gelb') return { text: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', bar: 'bg-amber-400' };
  return                       { text: 'text-green-600', bg: 'bg-green-50 border-green-200', bar: 'bg-green-500' };
}

function coachingTipp(ampel: string, ziel: number): string {
  if (ampel === 'rot')  return `Dein Schicht-Erlös liegt unter 100 €. Übernimm mehr Touren, um das Tagesziel von ${ziel} € zu erreichen!`;
  if (ampel === 'gelb') return `Du bist auf dem richtigen Weg! Noch ein paar Touren und du erreichst das Ziel von ${ziel} €.`;
  return `Stark! Du hast das Tagesziel von ${ziel} € erreicht oder übertroffen. Weiter so!`;
}

function TrendIcon({ trend }: { trend: 'besser' | 'schlechter' | 'stabil' }) {
  if (trend === 'besser')     return <TrendingUp   size={14} className="text-green-600" />;
  if (trend === 'schlechter') return <TrendingDown size={14} className="text-red-500"   />;
  return                             <Minus        size={14} className="text-gray-400"  />;
}

function ErloesBalken({ erloes, ziel, barClass }: { erloes: number; ziel: number; barClass: string }) {
  const max     = 400;
  const fill    = Math.min(100, (erloes / max) * 100);
  const goalPct = Math.min(100, (ziel   / max) * 100);
  return (
    <div className="relative h-3 rounded-full bg-gray-200">
      <div className={`absolute top-0 left-0 h-full rounded-full ${barClass}`} style={{ width: `${fill}%` }} />
      <div
        className="absolute top-0 h-full border-l-2 border-dashed border-green-500"
        style={{ left: `${goalPct}%` }}
        title={`Ziel ${ziel} €`}
      />
    </div>
  );
}

const MOCK: SingleData = {
  fahrer_single: {
    fahrer_id: 'me', fahrer_name: 'Ich',
    erloes_heute: 142.60, erloes_gestern: 138.90, trend: 'stabil', trend_delta: 3.70, ampel: 'gelb', alert: false,
  },
  team_avg_heute: 149.52,
  team_avg_gestern: 185.66,
  ziel: 200,
};

export function FahrerPhase2606MeinSchichtErloes({
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
      fetch(`/api/delivery/admin/fahrer-schicht-erloes?${params}`)
        .then(r => r.json())
        .then((res: SingleData | { fahrer: SingleEntry[]; team_avg_heute: number; team_avg_gestern: number | null; ziel: number }) => {
          if ('fahrer_single' in res && res.fahrer_single) {
            setData(res as SingleData);
          } else if ('fahrer' in res && Array.isArray(res.fahrer) && res.fahrer.length > 0) {
            const all = res as { fahrer: SingleEntry[]; team_avg_heute: number; team_avg_gestern: number | null; ziel: number };
            const me  = driverId ? all.fahrer.find(f => f.fahrer_id === driverId) : null;
            setData({
              fahrer_single:    me ?? all.fahrer[0],
              team_avg_heute:   all.team_avg_heute,
              team_avg_gestern: all.team_avg_gestern ?? null,
              ziel:             all.ziel ?? 200,
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
          <Euro size={16} className={st.text} />
          <span className="font-semibold text-sm text-gray-800">Mein Schicht-Erlös</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${st.text}`}>{e.erloes_heute.toFixed(2)} €</span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Hauptwert */}
          <div className="text-center py-2">
            <div className={`text-4xl font-black ${st.text}`}>{e.erloes_heute.toFixed(2)} €</div>
            <div className="text-xs text-gray-500 mt-1">Erlös heute (Ziel: ≥{data.ziel} €)</div>
          </div>

          {/* Balken */}
          <ErloesBalken erloes={e.erloes_heute} ziel={data.ziel} barClass={st.bar} />
          <div className="flex justify-between text-xs text-gray-400">
            <span>0 €</span>
            <span className="text-green-600">Ziel {data.ziel} €</span>
            <span>400 €</span>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-gray-700">
                {e.erloes_gestern !== null ? `${e.erloes_gestern.toFixed(0)} €` : '—'}
              </div>
              <div className="text-xs text-gray-400">Gestern</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="flex items-center justify-center gap-1">
                <TrendIcon trend={e.trend} />
                <span className="text-base font-bold text-gray-700">
                  {e.trend_delta > 0 ? '+' : ''}{e.trend_delta.toFixed(0)} €
                </span>
              </div>
              <div className="text-xs text-gray-400">Trend</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-green-600">≥{data.ziel} €</div>
              <div className="text-xs text-gray-400">Ziel</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-gray-700">{data.team_avg_heute.toFixed(0)} €</div>
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
