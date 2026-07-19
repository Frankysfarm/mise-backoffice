'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Radio } from 'lucide-react';

interface SingleEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_reaktionszeit_sek: number;
  avg_reaktionszeit_vw: number | null;
  angebote_anzahl: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface SingleData {
  fahrer_single: SingleEntry;
  team_avg_reaktionszeit_sek: number;
}

function ampelStyle(sek: number) {
  if (sek > 60) return { text: 'text-red-600', bg: 'bg-red-50 border-red-200', bar: 'bg-red-500', label: 'Zu langsam — Erreichbarkeit verbessern' };
  if (sek > 30) return { text: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', bar: 'bg-amber-400', label: 'Verbesserungsbedarf' };
  return { text: 'text-green-600', bg: 'bg-green-50 border-green-200', bar: 'bg-green-500', label: 'Ausgezeichnet erreichbar' };
}

function coachingTipp(sek: number): string {
  if (sek > 60) return 'Du reagierst zu langsam auf Aufträge. Halte das Handy griffbereit und aktiviere Benachrichtigungen.';
  if (sek > 30) return 'Gute Basis! Mit schnellerer Reaktion kannst du mehr Touren annehmen und deinen Verdienst steigern.';
  return 'Top-Erreichbarkeit! Deine schnelle Reaktion macht dich zum bevorzugten Fahrer bei der Disposition.';
}

function TrendIcon({ trend }: { trend: 'steigend' | 'fallend' | 'stabil' }) {
  if (trend === 'steigend') return <TrendingUp size={14} className="text-red-500" />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-green-600" />;
  return <Minus size={14} className="text-gray-400" />;
}

const MOCK: SingleData = {
  fahrer_single: {
    fahrer_id: 'me',
    fahrer_name: 'Ich',
    avg_reaktionszeit_sek: 44.7,
    avg_reaktionszeit_vw: 42.0,
    angebote_anzahl: 11,
    trend: 'stabil',
    trend_delta: 2.7,
    ampel: 'gelb',
  },
  team_avg_reaktionszeit_sek: 51.7,
};

export function FahrerPhase2536MeineErreichbarkeit({
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
      fetch(`/api/delivery/admin/fahrer-erreichbarkeit-score?${params}`)
        .then(r => r.json())
        .then((res: SingleData | { fahrer: SingleEntry[]; team_avg_reaktionszeit_sek: number }) => {
          if ('fahrer_single' in res && res.fahrer_single) {
            setData(res as SingleData);
          } else if ('fahrer' in res && Array.isArray(res.fahrer) && res.fahrer.length > 0) {
            const all = res as { fahrer: SingleEntry[]; team_avg_reaktionszeit_sek: number };
            const me = driverId ? all.fahrer.find((f) => f.fahrer_id === driverId) : null;
            setData({ fahrer_single: me ?? all.fahrer[0], team_avg_reaktionszeit_sek: all.team_avg_reaktionszeit_sek });
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
  const style = ampelStyle(f.avg_reaktionszeit_sek);
  const maxSek = 120;
  const barW = Math.min(100, (f.avg_reaktionszeit_sek / maxSek) * 100);

  return (
    <div className={`rounded-xl border ${style.bg} shadow-sm`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Radio size={16} className={style.text} />
          <span className="text-sm font-bold text-gray-800">Meine Erreichbarkeit</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${style.text} border ${style.bg}`}>
            {f.avg_reaktionszeit_sek.toFixed(1)} s
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-4">
          {/* Big number */}
          <div className="text-center">
            <div className={`text-4xl font-black tabular-nums ${style.text}`}>{f.avg_reaktionszeit_sek.toFixed(1)}<span className="text-xl ml-1">s</span></div>
            <div className="text-xs text-gray-500 mt-0.5">{style.label}</div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="relative h-3 rounded-full bg-gray-200">
              <div
                className={`absolute left-0 top-0 h-full rounded-full transition-all ${style.bar}`}
                style={{ width: `${barW}%` }}
              />
              <div className="absolute top-0 h-full border-l-2 border-dashed border-amber-400" style={{ left: `${(30 / maxSek) * 100}%` }} title="Ziel ≤30s" />
              <div className="absolute top-0 h-full border-l-2 border-dashed border-red-500" style={{ left: `${(60 / maxSek) * 100}%` }} title="Alert >60s" />
            </div>
            <div className="flex justify-between text-[9px] text-gray-400">
              <span>0</span>
              <span className="text-amber-500">30 s</span>
              <span className="text-red-500">60 s</span>
              <span>120 s</span>
            </div>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white/70 p-2 text-center">
              <div className="text-[10px] text-gray-500 font-medium">Vorwoche</div>
              <div className="flex items-center justify-center gap-1">
                <span className="text-sm font-black tabular-nums text-gray-700">
                  {f.avg_reaktionszeit_vw !== null ? `${f.avg_reaktionszeit_vw.toFixed(1)} s` : '–'}
                </span>
                <TrendIcon trend={f.trend} />
              </div>
            </div>
            <div className="rounded-lg bg-white/70 p-2 text-center">
              <div className="text-[10px] text-gray-500 font-medium">Team-Ø</div>
              <div className="text-sm font-black tabular-nums text-gray-700">{data.team_avg_reaktionszeit_sek.toFixed(1)} s</div>
            </div>
            <div className="rounded-lg bg-white/70 p-2 text-center">
              <div className="text-[10px] text-gray-500 font-medium">Trend</div>
              <div className="flex items-center justify-center gap-1">
                <TrendIcon trend={f.trend} />
                <span className="text-sm font-bold text-gray-700">
                  {f.trend_delta !== 0 ? `${f.trend_delta > 0 ? '+' : ''}${f.trend_delta.toFixed(1)} s` : '±0'}
                </span>
              </div>
            </div>
            <div className="rounded-lg bg-white/70 p-2 text-center">
              <div className="text-[10px] text-gray-500 font-medium">Angebote</div>
              <div className="text-sm font-black tabular-nums text-gray-700">{f.angebote_anzahl}</div>
            </div>
          </div>

          {/* Coaching tip */}
          <div className="rounded-lg bg-white/60 border border-gray-200 px-3 py-2 text-xs text-gray-600">
            💡 {coachingTipp(f.avg_reaktionszeit_sek)}
          </div>
        </div>
      )}
    </div>
  );
}
