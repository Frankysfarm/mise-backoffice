'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, XCircle } from 'lucide-react';

interface SparkDay { datum: string; storno_quote_pct: number }

interface SingleEntry {
  fahrer_id: string;
  fahrer_name: string;
  storno_quote_heute: number;
  storno_quote_gestern: number | null;
  storno_quote_vw: number | null;
  sparkline: SparkDay[];
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface SingleData {
  fahrer_single: SingleEntry;
  team_avg_heute: number;
}

function ampelStyle(ampel: string) {
  if (ampel === 'rot')  return { text: 'text-red-600', bg: 'bg-red-50 border-red-200', spark: '#ef4444' };
  if (ampel === 'gelb') return { text: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', spark: '#f59e0b' };
  return { text: 'text-green-600', bg: 'bg-green-50 border-green-200', spark: '#22c55e' };
}

function coachingTipp(ampel: string): string {
  if (ampel === 'rot')  return 'Deine Storno-Quote ist kritisch hoch (>15%). Spreche Probleme frühzeitig an und bestätige nur Touren, die du sicher schaffen kannst.';
  if (ampel === 'gelb') return 'Deine Storno-Quote liegt im gelben Bereich (6–15%). Achte auf realistische Tourenplanung und melde Engpässe rechtzeitig.';
  return 'Top! Deine Storno-Quote liegt im grünen Bereich (≤5%). Weiter so — du planst zuverlässig!';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp size={14} className="text-red-500" />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-green-600" />;
  return <Minus size={14} className="text-gray-400" />;
}

function MiniSparkline({ data, color }: { data: SparkDay[]; color: string }) {
  if (!data.length) return <div className="h-8 w-full bg-gray-100 rounded" />;
  const vals  = data.map(d => d.storno_quote_pct);
  const min   = Math.min(...vals);
  const max   = Math.max(...vals, 5);
  const range = max - min || 1;
  const W = 200; const H = 32; const n = vals.length;
  const pts = vals.map((v, i) => {
    const x = (i / (n - 1)) * (W - 4) + 2;
    const y = H - 2 - ((v - min) / range) * (H - 4);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {/* Ziel-Linie 5% */}
      {(() => {
        const y5 = H - 2 - ((5 - min) / range) * (H - 4);
        return y5 >= 0 && y5 <= H ? (
          <line x1="0" y1={y5} x2={W} y2={y5} stroke="#22c55e" strokeWidth="1" strokeDasharray="4,3" opacity="0.6" />
        ) : null;
      })()}
    </svg>
  );
}

const MOCK: SingleData = {
  fahrer_single: {
    fahrer_id: 'me', fahrer_name: 'Ich',
    storno_quote_heute: 8.7, storno_quote_gestern: 9.5, storno_quote_vw: 7.5,
    sparkline: [7.0,7.5,8.0,9.0,9.8,9.5,8.7].map((v,i)=>({ datum:`07-${13+i}`, storno_quote_pct:v })),
    trend: 'fallend', trend_delta: -0.8, ampel: 'gelb',
  },
  team_avg_heute: 10.8,
};

export function FahrerPhase2581MeineStornoQuoteTrend({
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
      fetch(`/api/delivery/admin/fahrer-storno-quote-trend?${params}`)
        .then(r => r.json())
        .then((res: SingleData | { fahrer: SingleEntry[]; team_avg_heute: number }) => {
          if ('fahrer_single' in res && res.fahrer_single) {
            setData(res as SingleData);
          } else if ('fahrer' in res && Array.isArray(res.fahrer) && res.fahrer.length > 0) {
            const all = res as { fahrer: SingleEntry[]; team_avg_heute: number };
            const me  = driverId ? all.fahrer.find(f => f.fahrer_id === driverId) : null;
            setData({ fahrer_single: me ?? all.fahrer[0], team_avg_heute: all.team_avg_heute });
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

  const e   = data.fahrer_single;
  const st  = ampelStyle(e.ampel);

  return (
    <div className={`rounded-xl border ${st.bg} shadow-sm mb-3`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <XCircle size={16} className={st.text} />
          <span className="font-semibold text-sm text-gray-800">Meine Storno-Quote-Trend</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${st.text}`}>{e.storno_quote_heute.toFixed(1)}%</span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Hauptwert */}
          <div className="text-center py-2">
            <div className={`text-4xl font-black ${st.text}`}>{e.storno_quote_heute.toFixed(1)}%</div>
            <div className="text-xs text-gray-500 mt-1">Storno-Quote heute</div>
          </div>

          {/* Sparkline 7 Tage */}
          <div className="bg-white rounded-lg border border-gray-100 p-2">
            <div className="text-xs text-gray-400 mb-1">7-Tage-Verlauf</div>
            <MiniSparkline data={e.sparkline} color={st.spark} />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{e.sparkline[0]?.datum ?? ''}</span>
              <span className="text-green-600">Ziel ≤5%</span>
              <span>{e.sparkline[e.sparkline.length - 1]?.datum ?? ''}</span>
            </div>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-gray-700">
                {e.storno_quote_gestern !== null ? `${e.storno_quote_gestern.toFixed(1)}%` : '—'}
              </div>
              <div className="text-xs text-gray-400">Gestern</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="flex items-center justify-center gap-1">
                <TrendIcon trend={e.trend} />
                <span className="text-base font-bold text-gray-700">
                  {e.trend_delta > 0 ? '+' : ''}{e.trend_delta.toFixed(1)}%
                </span>
              </div>
              <div className="text-xs text-gray-400">Trend vs. gestern</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-green-600">≤5%</div>
              <div className="text-xs text-gray-400">Ziel</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-gray-700">{data.team_avg_heute.toFixed(1)}%</div>
              <div className="text-xs text-gray-400">Team Ø</div>
            </div>
          </div>

          {/* Coaching */}
          <div className={`rounded-lg p-2.5 text-xs ${
            e.ampel === 'rot' ? 'bg-red-100 text-red-800' :
            e.ampel === 'gelb' ? 'bg-amber-50 text-amber-800' :
            'bg-green-50 text-green-800'
          }`}>
            {coachingTipp(e.ampel)}
          </div>
        </div>
      )}
    </div>
  );
}
