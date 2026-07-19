'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Scale } from 'lucide-react';

interface FahrerSingle {
  fahrer_id: string;
  fahrer_name: string;
  balance_score_pct: number;
  balance_score_pct_vw: number;
  regulaer_schichten: number;
  sonder_schichten: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_imbalance: boolean;
}

interface ApiData {
  fahrer_single: FahrerSingle;
  team_avg_balance_pct: number;
}

function ampelStyle(a: string) {
  if (a === 'gruen') return { bg: 'bg-green-50 border-green-200', text: 'text-green-700', val: 'text-green-600', bar: 'bg-green-500' };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', val: 'text-amber-600', bar: 'bg-amber-400' };
  return { bg: 'bg-red-50 border-red-200', text: 'text-red-700', val: 'text-red-600', bar: 'bg-red-500' };
}

function coachingTipp(ampel: string, pct: number): string {
  if (ampel === 'gruen') return `Gut ausgewogen (${pct.toFixed(0)}% regulär). Weiter so!`;
  if (ampel === 'gelb') return `Balance noch akzeptabel, aber Anteil regulärer Schichten erhöhen.`;
  return `Zu viele Sonderschichten (nur ${pct.toFixed(0)}% regulär). Besprich mit der Disposition eine ausgewogenere Einteilung.`;
}

export function FahrerPhase2453MeinSchichtBalanceScore({
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
      fetch(`/api/delivery/admin/fahrer-schicht-balance?location_id=${locationId}&driver_id=${driverId}`)
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
  const pct = f.balance_score_pct;

  return (
    <div className={`border rounded-xl mb-3 overflow-hidden ${st.bg}`}>
      <button
        className={`w-full flex items-center justify-between px-4 py-2 font-semibold text-sm ${st.text}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2">
          <Scale size={14} />
          Mein Schicht-Balance-Score
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="bg-white px-4 pb-3 pt-2 space-y-3">
          {/* Score groß */}
          <div className="text-center">
            <div className={`text-4xl font-black ${st.val}`}>{pct.toFixed(1)}%</div>
            <div className="text-xs text-gray-400 mt-0.5">Regulär-Anteil ({f.regulaer_schichten}R / {f.sonder_schichten}S)</div>
          </div>

          {/* Balken 0–100% mit Ziel-Linien */}
          <div className="space-y-1">
            <div className="relative h-3 rounded-full bg-gray-200">
              <div className={`absolute left-0 top-0 h-full rounded-full ${st.bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
              <div className="absolute top-0 h-full border-l-2 border-dashed border-amber-400" style={{ left: '60%' }} />
              <div className="absolute top-0 h-full border-l-2 border-dashed border-green-500" style={{ left: '80%' }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>0%</span>
              <span className="text-amber-500">60%</span>
              <span className="text-green-600">80%</span>
              <span>100%</span>
            </div>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-2 gap-2 text-center">
            {[
              { label: 'Vorwoche', val: `${f.balance_score_pct_vw.toFixed(1)}%`, color: 'text-gray-600' },
              { label: 'Trend', val: f.trend === 'steigend' ? '↑ besser' : f.trend === 'fallend' ? '↓ schlechter' : '→ stabil', color: f.trend === 'steigend' ? 'text-green-600' : f.trend === 'fallend' ? 'text-red-600' : 'text-gray-500' },
              { label: 'Ziel', val: '≥80%', color: 'text-green-600' },
              { label: 'Team-Ø', val: `${(data.team_avg_balance_pct ?? 0).toFixed(1)}%`, color: 'text-blue-600' },
            ].map(k => (
              <div key={k.label} className="bg-gray-50 rounded-lg py-1.5 px-2">
                <div className="text-xs text-gray-400">{k.label}</div>
                <div className={`font-bold text-sm ${k.color}`}>{k.val}</div>
              </div>
            ))}
          </div>

          {/* Trend-Icon */}
          <div className="flex items-center gap-1 text-xs text-gray-500">
            {f.trend === 'steigend' ? <TrendingUp size={12} className="text-green-600" /> : f.trend === 'fallend' ? <TrendingDown size={12} className="text-red-500" /> : <Minus size={12} />}
            <span>
              {f.trend_delta > 0 ? '+' : ''}{f.trend_delta.toFixed(1)}% vs. Vorwoche
            </span>
          </div>

          {/* Coaching-Tipp */}
          <div className={`rounded-lg px-3 py-2 text-xs ${st.bg} ${st.text} border`}>
            {coachingTipp(f.ampel, pct)}
          </div>
        </div>
      )}
    </div>
  );
}
