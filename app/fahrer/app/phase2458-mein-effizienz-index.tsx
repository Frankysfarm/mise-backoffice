'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';

interface FahrerSingle {
  fahrer_id: string;
  fahrer_name: string;
  effizienz_score: number;
  effizienz_score_vw: number;
  touren_pro_stunde: number;
  puenktlichkeit_pct: number;
  bewertung_sterne: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiData {
  fahrer_single: FahrerSingle;
  team_avg_score: number;
}

function ampelStyle(a: string) {
  if (a === 'gruen') return { bg: 'bg-green-50 border-green-200', text: 'text-green-700', val: 'text-green-600', ring: '#22c55e' };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', val: 'text-amber-600', ring: '#fbbf24' };
  return { bg: 'bg-red-50 border-red-200', text: 'text-red-700', val: 'text-red-600', ring: '#ef4444' };
}

function coachingTipp(ampel: string, score: number): string {
  if (ampel === 'gruen') return `Starke Leistung (Index ${score.toFixed(0)})! Touren-Tempo, Pünktlichkeit und Bewertung alle im grünen Bereich.`;
  if (ampel === 'gelb') return `Index ${score.toFixed(0)} — im Mittelfeldbereich. Schaue auf Pünktlichkeit oder Tempo für schnelle Punkte.`;
  return `Index ${score.toFixed(0)} — Verbesserung nötig. Fokus: pünktliche Lieferung und freundlicher Kundenkontakt.`;
}

function RingGauge({ score, color }: { score: number; color: string }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const filled = (Math.min(100, score) / 100) * circ;
  // Goal line at 80
  const goalAngle = (80 / 100) * 360 - 90;
  const goalRad = (goalAngle * Math.PI) / 180;
  const gx = 50 + (r + 8) * Math.cos(goalRad);
  const gy = 50 + (r + 8) * Math.sin(goalRad);

  return (
    <svg width="120" height="120" viewBox="0 0 100 100" className="mx-auto">
      {/* Track */}
      <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
      {/* Score arc */}
      <circle
        cx="50" cy="50" r={r}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
      />
      {/* Goal marker at 80 */}
      <circle cx={gx} cy={gy} r="3" fill="#22c55e" />
      {/* Center text */}
      <text x="50" y="46" textAnchor="middle" fontSize="18" fontWeight="bold" fill={color}>{score.toFixed(0)}</text>
      <text x="50" y="58" textAnchor="middle" fontSize="8" fill="#9ca3af">/ 100</text>
    </svg>
  );
}

export function FahrerPhase2458MeinEffizienzIndex({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!driverId || !locationId || !isOnline) return;
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-effizienz-index?location_id=${locationId}&driver_id=${driverId}`)
        .then(r => r.json())
        .then(setData)
        .catch(console.error);
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !data?.fahrer_single) return null;

  const f = data.fahrer_single;
  const st = ampelStyle(f.ampel);

  return (
    <div className={`border rounded-xl mb-3 overflow-hidden ${st.bg}`}>
      <button
        className={`w-full flex items-center justify-between px-4 py-2 font-semibold text-sm ${st.text}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2">
          <Zap size={14} />
          Mein Effizienz-Index
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="bg-white px-4 pb-3 pt-2 space-y-3">
          {/* Ring-Gauge */}
          <RingGauge score={f.effizienz_score} color={st.ring} />
          <div className="text-center -mt-2">
            <div className="text-xs text-gray-400">
              {f.touren_pro_stunde.toFixed(1)} T/h · {f.puenktlichkeit_pct.toFixed(0)}% pünktl. · {f.bewertung_sterne.toFixed(1)}★
            </div>
            <div className="text-[10px] text-green-500 mt-0.5">● Ziel 80</div>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-2 gap-2 text-center">
            {[
              { label: 'Vorwoche', val: f.effizienz_score_vw.toFixed(1), color: 'text-gray-600' },
              { label: 'Trend', val: f.trend === 'steigend' ? '↑ besser' : f.trend === 'fallend' ? '↓ schlechter' : '→ stabil', color: f.trend === 'steigend' ? 'text-green-600' : f.trend === 'fallend' ? 'text-red-600' : 'text-gray-500' },
              { label: 'Ziel', val: '≥80', color: 'text-green-600' },
              { label: 'Team-Ø', val: (data.team_avg_score ?? 0).toFixed(1), color: 'text-blue-600' },
            ].map(k => (
              <div key={k.label} className="bg-gray-50 rounded-lg py-1.5 px-2">
                <div className="text-xs text-gray-400">{k.label}</div>
                <div className={`font-bold text-sm ${k.color}`}>{k.val}</div>
              </div>
            ))}
          </div>

          {/* Trend */}
          <div className="flex items-center gap-1 text-xs text-gray-500">
            {f.trend === 'steigend' ? <TrendingUp size={12} className="text-green-600" /> : f.trend === 'fallend' ? <TrendingDown size={12} className="text-red-500" /> : <Minus size={12} />}
            <span>
              {f.trend_delta > 0 ? '+' : ''}{f.trend_delta.toFixed(1)} vs. Vorwoche
            </span>
          </div>

          {/* Coaching-Tipp */}
          <div className={`rounded-lg px-3 py-2 text-xs ${st.bg} ${st.text} border`}>
            {coachingTipp(f.ampel, f.effizienz_score)}
          </div>
        </div>
      )}
    </div>
  );
}
