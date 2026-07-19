'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Package } from 'lucide-react';

interface SparkDayLV { datum: string; lieferungen: number }

interface SingleEntry {
  fahrer_id: string;
  fahrer_name: string;
  lieferungen_heute: number;
  lieferungen_gestern: number | null;
  lieferungen_vw: number | null;
  sparkline: SparkDayLV[];
  trend: 'steigend' | 'fallend' | 'stabil';
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
  if (ampel === 'rot')  return `Weniger als 10 Lieferungen heute. Kannst du noch offene Touren übernehmen? Ziel: ${ziel} Lieferungen.`;
  if (ampel === 'gelb') return `Du bist auf Kurs, aber noch unter dem Ziel von ${ziel}. Bleib dran — mit jeder Tour kommst du näher ans Ziel!`;
  return `Stark! Du hast das Ziel von ${ziel} Lieferungen erreicht oder übertroffen. Weiter so!`;
}

function TrendIcon({ trend }: { trend: 'steigend' | 'fallend' | 'stabil' }) {
  if (trend === 'steigend') return <TrendingUp size={14} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-red-500" />;
  return <Minus size={14} className="text-gray-400" />;
}

function VolumenBalken({ n, ziel, barClass }: { n: number; ziel: number; barClass: string }) {
  const MAX     = Math.max(n, ziel) * 1.3;
  const fill    = Math.min(100, Math.round((n / MAX) * 100));
  const goalPct = Math.round((ziel / MAX) * 100);
  return (
    <div className="relative h-3 rounded-full bg-gray-200">
      <div className={`absolute top-0 left-0 h-full rounded-full ${barClass}`} style={{ width: `${fill}%` }} />
      <div className="absolute top-0 h-full border-l-2 border-dashed border-green-500" style={{ left: `${goalPct}%` }} title={`Ziel ${ziel}`} />
    </div>
  );
}

function MiniSparkline({ data, ziel }: { data: SparkDayLV[]; ziel: number }) {
  if (!data.length) return <div className="h-8 w-full bg-gray-100 rounded" />;
  const vals  = data.map(d => d.lieferungen);
  const min   = Math.min(...vals, 0);
  const max   = Math.max(...vals, ziel + 5);
  const range = max - min || 1;
  const W = 200; const H = 32; const n = vals.length;
  const pts = vals.map((v, i) => {
    const x = (i / (n - 1)) * (W - 4) + 2;
    const y = H - 2 - ((v - min) / range) * (H - 4);
    return `${x},${y}`;
  }).join(' ');
  const goalY = H - 2 - ((ziel - min) / range) * (H - 4);
  const last  = vals[vals.length - 1];
  const color = last >= ziel ? '#22c55e' : last >= 10 ? '#f59e0b' : '#ef4444';
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full">
      {goalY >= 0 && goalY <= H && (
        <line x1="0" y1={goalY} x2={W} y2={goalY} stroke="#22c55e" strokeWidth="1" strokeDasharray="4,3" opacity="0.7" />
      )}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

const MOCK: SingleData = {
  fahrer_single: {
    fahrer_id: 'me', fahrer_name: 'Ich',
    lieferungen_heute: 12, lieferungen_gestern: 13, lieferungen_vw: 12,
    sparkline: [11,12,13,12,14,13,12].map((v,i)=>({ datum:`07-${13+i}`, lieferungen:v })),
    trend: 'stabil', trend_delta: -1, ampel: 'gelb', alert: false,
  },
  team_avg_heute: 13.0,
  ziel: 15,
};

export function FahrerPhase2586MeinLiefervolumenTrend({
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
      fetch(`/api/delivery/admin/fahrer-liefervolumen-trend?${params}`)
        .then(r => r.json())
        .then((res: SingleData | { fahrer: SingleEntry[]; team_avg_heute: number; ziel: number }) => {
          if ('fahrer_single' in res && res.fahrer_single) {
            setData(res as SingleData);
          } else if ('fahrer' in res && Array.isArray(res.fahrer) && res.fahrer.length > 0) {
            const all = res as { fahrer: SingleEntry[]; team_avg_heute: number; ziel: number };
            const me  = driverId ? all.fahrer.find(f => f.fahrer_id === driverId) : null;
            setData({ fahrer_single: me ?? all.fahrer[0], team_avg_heute: all.team_avg_heute, ziel: all.ziel ?? 15 });
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
          <Package size={16} className={st.text} />
          <span className="font-semibold text-sm text-gray-800">Mein Liefervolumen</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${st.text}`}>{e.lieferungen_heute}</span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Hauptwert */}
          <div className="text-center py-2">
            <div className={`text-4xl font-black ${st.text}`}>{e.lieferungen_heute}</div>
            <div className="text-xs text-gray-500 mt-1">Lieferungen heute (Ziel: {data.ziel})</div>
          </div>

          {/* Balken */}
          <VolumenBalken n={e.lieferungen_heute} ziel={data.ziel} barClass={st.bar} />
          <div className="flex justify-between text-xs text-gray-400">
            <span>0</span>
            <span className="text-green-600">Ziel {data.ziel}</span>
            <span>{Math.max(e.lieferungen_heute, data.ziel) + 5}</span>
          </div>

          {/* 7-Tage-Sparkline */}
          <div className="bg-white rounded-lg border border-gray-100 p-2">
            <div className="text-xs text-gray-400 mb-1">7-Tage-Verlauf</div>
            <MiniSparkline data={e.sparkline} ziel={data.ziel} />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{e.sparkline[0]?.datum ?? ''}</span>
              <span className="text-green-600">Ziel ≥{data.ziel}</span>
              <span>{e.sparkline[e.sparkline.length - 1]?.datum ?? ''}</span>
            </div>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-gray-700">
                {e.lieferungen_gestern !== null ? e.lieferungen_gestern : '—'}
              </div>
              <div className="text-xs text-gray-400">Gestern</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="flex items-center justify-center gap-1">
                <TrendIcon trend={e.trend} />
                <span className="text-base font-bold text-gray-700">
                  {e.trend_delta > 0 ? '+' : ''}{e.trend_delta}
                </span>
              </div>
              <div className="text-xs text-gray-400">Trend</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-green-600">≥{data.ziel}</div>
              <div className="text-xs text-gray-400">Ziel</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-gray-700">{data.team_avg_heute.toFixed(1)}</div>
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
