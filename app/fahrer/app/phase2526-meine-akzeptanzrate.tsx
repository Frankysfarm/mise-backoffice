'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, CheckCircle } from 'lucide-react';

interface SingleData {
  fahrer_single: {
    fahrer_id: string;
    fahrer_name: string;
    akzeptanzrate: number;
    akzeptanzrate_vw: number;
    angenommen: number;
    angeboten: number;
    trend: 'steigend' | 'fallend' | 'stabil';
    trend_delta: number;
    ampel: 'gruen' | 'gelb' | 'rot';
  };
  team_avg_rate: number;
}

function ampelStyle(rate: number) {
  if (rate >= 90) return { text: 'text-green-600', bg: 'bg-green-50 border-green-200', bar: 'bg-green-500', label: 'Sehr gut' };
  if (rate >= 70) return { text: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', bar: 'bg-amber-400', label: 'Verbesserungsbedarf' };
  return { text: 'text-red-600', bg: 'bg-red-50 border-red-200', bar: 'bg-red-500', label: 'Kritisch' };
}

function coachingTipp(rate: number): string {
  if (rate >= 90) return 'Hervorragend! Du nimmst fast alle Aufträge an — weiter so!';
  if (rate >= 70) return 'Gut, aber Luft nach oben. Mehr Aufträge annehmen = mehr Verdienst.';
  return 'Deine Akzeptanzrate ist niedrig. Bitte so viele Aufträge wie möglich annehmen.';
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
    akzeptanzrate: 88.5,
    akzeptanzrate_vw: 82.0,
    angenommen: 23,
    angeboten: 26,
    trend: 'steigend',
    trend_delta: 6.5,
    ampel: 'gelb',
  },
  team_avg_rate: 83.2,
};

export function FahrerPhase2526MeineAkzeptanzrate({
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
      fetch(`/api/delivery/admin/fahrer-akzeptanzrate?${params}`)
        .then(r => r.json())
        .then((res: SingleData | { fahrer: unknown[] }) => {
          if ('fahrer_single' in res) {
            setData(res as SingleData);
          } else if ('fahrer' in res && Array.isArray(res.fahrer) && res.fahrer.length > 0) {
            const all = res as { fahrer: SingleData['fahrer_single'][]; team_avg_rate: number };
            const me = driverId ? all.fahrer.find((f) => f.fahrer_id === driverId) : null;
            setData({ fahrer_single: me ?? (all.fahrer[0] as SingleData['fahrer_single']), team_avg_rate: all.team_avg_rate });
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

  const f = data.fahrer_single;
  const style = ampelStyle(f.akzeptanzrate);
  const max = 100;
  const barW = Math.min(100, (f.akzeptanzrate / max) * 100);

  return (
    <div className={`rounded-xl border ${style.bg} shadow-sm`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <CheckCircle size={16} className={style.text} />
          <span className="text-sm font-bold text-gray-800">Meine Akzeptanzrate</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${style.text} border ${style.bg}`}>
            {f.akzeptanzrate.toFixed(1)}%
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-4">
          {/* Big number */}
          <div className="text-center">
            <div className={`text-4xl font-black tabular-nums ${style.text}`}>{f.akzeptanzrate.toFixed(1)}%</div>
            <div className="text-xs text-gray-500 mt-0.5">{style.label}</div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="relative h-3 rounded-full bg-gray-200">
              <div
                className={`absolute left-0 top-0 h-full rounded-full transition-all ${style.bar}`}
                style={{ width: `${barW}%` }}
              />
              <div className="absolute top-0 h-full border-l-2 border-dashed border-red-400" style={{ left: '70%' }} title="Alert <70%" />
              <div className="absolute top-0 h-full border-l-2 border-dashed border-green-600" style={{ left: '90%' }} title="Ziel ≥90%" />
            </div>
            <div className="flex justify-between text-[9px] text-gray-400">
              <span>0%</span>
              <span className="text-red-400">70%</span>
              <span className="text-green-600">90% Ziel</span>
              <span>100%</span>
            </div>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white/70 p-2 text-center">
              <div className="text-[10px] text-gray-500 font-medium">Vorwoche</div>
              <div className="flex items-center justify-center gap-1">
                <span className="text-sm font-black tabular-nums text-gray-700">{f.akzeptanzrate_vw.toFixed(1)}%</span>
                <TrendIcon trend={f.trend} />
              </div>
            </div>
            <div className="rounded-lg bg-white/70 p-2 text-center">
              <div className="text-[10px] text-gray-500 font-medium">Team-Ø</div>
              <div className="text-sm font-black tabular-nums text-gray-700">{data.team_avg_rate.toFixed(1)}%</div>
            </div>
            <div className="rounded-lg bg-white/70 p-2 text-center">
              <div className="text-[10px] text-gray-500 font-medium">Angenommen</div>
              <div className="text-sm font-black tabular-nums text-gray-700">{f.angenommen}</div>
            </div>
            <div className="rounded-lg bg-white/70 p-2 text-center">
              <div className="text-[10px] text-gray-500 font-medium">Angeboten</div>
              <div className="text-sm font-black tabular-nums text-gray-700">{f.angeboten}</div>
            </div>
          </div>

          {/* Coaching tip */}
          <div className="rounded-lg bg-white/60 border border-gray-200 px-3 py-2 text-xs text-gray-600">
            💡 {coachingTipp(f.akzeptanzrate)}
          </div>
        </div>
      )}
    </div>
  );
}
