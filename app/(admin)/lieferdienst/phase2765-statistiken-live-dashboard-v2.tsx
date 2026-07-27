'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  BarChart2, Clock, Euro, Star, Target, TrendingUp, TrendingDown,
  Minus, Users, AlertTriangle, CheckCircle2, Zap, RefreshCw,
} from 'lucide-react';

interface KpiKachel {
  key: string;
  label: string;
  wert: string;
  ziel: string;
  delta_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  trend: 'up' | 'down' | 'neutral';
}

interface StundeEintrag {
  stunde: string;
  bestellungen: number;
  umsatz: number;
}

interface ZonenZeile {
  zone: string;
  bestellungen: number;
  avg_min: number;
  sla_pct: number;
}

interface DashboardData {
  kpis: KpiKachel[];
  gesamt_score: number;
  insight: string;
  stunden: StundeEintrag[];
  zonen: ZonenZeile[];
  alert_keys: string[];
}

const MOCK: DashboardData = {
  gesamt_score: 78,
  insight: 'Lieferzeit liegt 2 min über Ziel — überprüfe Routenzuweisung Zone Nord.',
  alert_keys: ['avg_lieferzeit', 'storno_rate'],
  kpis: [
    { key: 'bestellungen',   label: 'Bestellungen',      wert: '47',      ziel: '≥50',    delta_pct: -6,   ampel: 'gelb',   trend: 'down' },
    { key: 'umsatz',         label: 'Umsatz',            wert: '€ 1.284', ziel: '≥€1.500', delta_pct: -14,  ampel: 'rot',    trend: 'down' },
    { key: 'avg_bestellwert',label: 'Ø Bestellwert',     wert: '€ 27,30', ziel: '≥€25',   delta_pct: +9,   ampel: 'gruen',  trend: 'up'   },
    { key: 'avg_lieferzeit', label: 'Ø Lieferzeit',      wert: '27 min',  ziel: '≤25 min', delta_pct: +8,   ampel: 'rot',    trend: 'down' },
    { key: 'on_time_pct',    label: 'Pünktlichkeit',     wert: '81%',     ziel: '≥85%',   delta_pct: -5,   ampel: 'gelb',   trend: 'down' },
    { key: 'bewertung',      label: 'Ø Bewertung',       wert: '4,6 ★',   ziel: '≥4,5',   delta_pct: +2,   ampel: 'gruen',  trend: 'up'   },
    { key: 'storno_rate',    label: 'Storno-Rate',       wert: '3,4%',    ziel: '≤3%',    delta_pct: +13,  ampel: 'rot',    trend: 'down' },
    { key: 'aktive_fahrer',  label: 'Aktive Fahrer',     wert: '5',       ziel: '≥4',     delta_pct: +25,  ampel: 'gruen',  trend: 'up'   },
  ],
  stunden: [
    { stunde: '10', bestellungen: 3,  umsatz: 82  },
    { stunde: '11', bestellungen: 7,  umsatz: 191 },
    { stunde: '12', bestellungen: 14, umsatz: 383 },
    { stunde: '13', bestellungen: 11, umsatz: 300 },
    { stunde: '14', bestellungen: 6,  umsatz: 164 },
    { stunde: '15', bestellungen: 6,  umsatz: 164 },
  ],
  zonen: [
    { zone: 'Innenstadt', bestellungen: 21, avg_min: 22, sla_pct: 90 },
    { zone: 'Nord',       bestellungen: 13, avg_min: 29, sla_pct: 72 },
    { zone: 'Süd',        bestellungen: 8,  avg_min: 25, sla_pct: 85 },
    { zone: 'West',       bestellungen: 5,  avg_min: 31, sla_pct: 70 },
  ],
};

const AKTUELLE_STUNDE = new Date().getHours().toString();

function AmpelDot({ ampel }: { ampel: 'gruen' | 'gelb' | 'rot' }) {
  return (
    <span className={`inline-block h-2 w-2 rounded-full ${ampel === 'gruen' ? 'bg-emerald-500' : ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-500'}`} />
  );
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'neutral' }) {
  if (trend === 'up')   return <TrendingUp className="h-3 w-3 text-emerald-500" />;
  if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-slate-400" />;
}

function ScoreRing({ score }: { score: number }) {
  const farbe = score >= 80 ? '#10b981' : score >= 65 ? '#f59e0b' : '#ef4444';
  const r = 28;
  const umfang = 2 * Math.PI * r;
  const dash = (score / 100) * umfang;

  return (
    <div className="relative flex items-center justify-center">
      <svg width="70" height="70" viewBox="0 0 70 70" className="-rotate-90">
        <circle cx="35" cy="35" r={r} fill="none" stroke="#f1f5f9" strokeWidth="6" />
        <circle cx="35" cy="35" r={r} fill="none" stroke={farbe} strokeWidth="6"
          strokeDasharray={`${dash} ${umfang}`} strokeLinecap="round" />
      </svg>
      <div className="absolute text-center">
        <div className="text-lg font-bold tabular-nums" style={{ color: farbe }}>{score}</div>
        <div className="text-[8px] text-slate-400">Score</div>
      </div>
    </div>
  );
}

export function LieferdienstPhase2765StatistikenLiveDashboardV2({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<DashboardData>(MOCK);
  const [modus, setModus] = useState<'bestellungen' | 'umsatz'>('bestellungen');
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/overview?location_id=${locationId}`);
      if (res.ok) {
        const d = await res.json();
        if (d.kpis && d.stunden) { setData(d); setLastUpdate(new Date()); }
      }
    } catch { /* Mock-Fallback */ }
    finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 60_000); return () => clearInterval(id); }, [load]);

  const alertKpis = data.kpis.filter(k => data.alert_keys.includes(k.key));

  return (
    <div className="rounded-xl border border-indigo-100 bg-white p-4 space-y-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-indigo-600 shrink-0" />
          <span className="font-semibold text-sm text-slate-800">Statistiken · Live Dashboard v2</span>
          {loading && <RefreshCw className="h-3 w-3 text-indigo-400 animate-spin" />}
        </div>
        <span className="text-[10px] text-slate-400">
          {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
        </span>
      </div>

      {/* Alert Strip */}
      {alertKpis.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
          <div className="text-xs text-red-700">
            <span className="font-semibold">Kritisch: </span>
            {alertKpis.map(k => k.label).join(', ')} — sofort prüfen
          </div>
        </div>
      )}

      {/* Score Ring + Insight */}
      <div className="flex items-center gap-3">
        <ScoreRing score={data.gesamt_score} />
        <div className="flex-1 text-xs text-slate-600 italic leading-relaxed">{data.insight}</div>
      </div>

      {/* KPI Grid 2-spaltig */}
      <div className="grid grid-cols-2 gap-2">
        {data.kpis.map((k) => (
          <div
            key={k.key}
            className={`rounded-lg border p-2.5 ${k.ampel === 'rot' ? 'border-red-200 bg-red-50' : k.ampel === 'gelb' ? 'border-yellow-200 bg-yellow-50' : 'border-emerald-100 bg-emerald-50'}`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <AmpelDot ampel={k.ampel} />
                <span className="text-[10px] text-slate-500">{k.label}</span>
              </div>
              <TrendIcon trend={k.trend} />
            </div>
            <div className="text-sm font-bold text-slate-800 tabular-nums">{k.wert}</div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-[9px] text-slate-400">Ziel {k.ziel}</span>
              <span className={`text-[9px] font-semibold ${k.delta_pct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {k.delta_pct >= 0 ? '+' : ''}{k.delta_pct}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Stundenverlauf Chart */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">Stundenverlauf</span>
          <div className="flex gap-1">
            {(['bestellungen', 'umsatz'] as const).map((m) => (
              <button
                key={m}
                className={`px-2 py-0.5 text-[10px] rounded font-semibold transition-colors ${modus === m ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                onClick={() => setModus(m)}
              >
                {m === 'bestellungen' ? 'Bestellungen' : 'Umsatz'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={data.stunden} barSize={16} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="stunde" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
              formatter={(v: any) => modus === 'umsatz' ? [`€ ${v}`, 'Umsatz'] : [`${v}`, 'Bestellungen']}
            />
            <Bar dataKey={modus} radius={[4, 4, 0, 0]}>
              {data.stunden.map((s) => (
                <Cell key={s.stunde} fill={s.stunde === AKTUELLE_STUNDE ? '#6366f1' : '#c7d2fe'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Zonen Ranking */}
      <div>
        <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Zonen-SLA</div>
        <div className="space-y-1.5">
          {data.zonen.map((z) => (
            <div key={z.zone} className="flex items-center gap-2">
              <span className="text-[11px] text-slate-600 w-20 shrink-0">{z.zone}</span>
              <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${z.sla_pct >= 85 ? 'bg-emerald-500' : z.sla_pct >= 70 ? 'bg-yellow-400' : 'bg-red-500'}`}
                  style={{ width: `${z.sla_pct}%` }}
                />
              </div>
              <span className={`text-[10px] font-semibold w-8 text-right ${z.sla_pct >= 85 ? 'text-emerald-600' : z.sla_pct >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                {z.sla_pct}%
              </span>
              <span className="text-[10px] text-slate-400 w-12 text-right">{z.avg_min} min</span>
            </div>
          ))}
        </div>
      </div>

      {!locationId && (
        <div className="text-xs text-slate-400 text-center">Filiale auswählen für Live-Daten</div>
      )}
    </div>
  );
}
