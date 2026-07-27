'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis } from 'recharts';
import { BarChart3, TrendingUp, TrendingDown, AlertTriangle, Users, Euro, Clock, Target, Star, Route, Package, XCircle } from 'lucide-react';

interface KpiKachel {
  key: string;
  label: string;
  wert: string;
  einheit: string;
  delta_pct: number;
  ziel: number | null;
  ziel_einheit: string;
  ampel: 'gruen' | 'gelb' | 'rot';
  inverted: boolean;
}

interface StundenPunkt {
  stunde: string;
  bestellungen: number;
  umsatz: number;
}

interface TopFahrer {
  name: string;
  score: number;
  touren: number;
  umsatz: number;
}

interface ZoneRow {
  name: string;
  sla_pct: number;
  bestellungen: number;
  umsatz: number;
}

interface DashData {
  kpis: KpiKachel[];
  stunden: StundenPunkt[];
  top_fahrer: TopFahrer[];
  zonen: ZoneRow[];
  gesamt_score: number;
  insight: string;
  alert_kpis: string[];
}

const MOCK: DashData = {
  gesamt_score: 76,
  insight: 'Lieferzeit 2 Min über Ziel — Fahrerzuteilung prüfen.',
  alert_kpis: ['Lieferzeit', 'SLA'],
  kpis: [
    { key: 'bestellungen', label: 'Bestellungen',  wert: '84',   einheit: '',    delta_pct: 12,  ziel: 100, ziel_einheit: '',    ampel: 'gelb',  inverted: false },
    { key: 'umsatz',       label: 'Umsatz',         wert: '1.284',einheit: '€',   delta_pct: 8,   ziel: 1500,ziel_einheit: '€',   ampel: 'gelb',  inverted: false },
    { key: 'lieferzeit',   label: 'Ø Lieferzeit',   wert: '32',   einheit: 'min', delta_pct: -7,  ziel: 30,  ziel_einheit: 'min', ampel: 'rot',   inverted: true  },
    { key: 'puenktlich',   label: 'Pünktlichkeit',  wert: '88',   einheit: '%',   delta_pct: 2,   ziel: 90,  ziel_einheit: '%',   ampel: 'gelb',  inverted: false },
    { key: 'bewertung',    label: 'Bewertung',       wert: '4.6',  einheit: '★',   delta_pct: 0.5, ziel: 4.7, ziel_einheit: '★',   ampel: 'gelb',  inverted: false },
    { key: 'fahrer',       label: 'Aktive Fahrer',  wert: '5',    einheit: '',    delta_pct: 0,   ziel: null,ziel_einheit: '',    ampel: 'gruen', inverted: false },
    { key: 'sla',          label: 'SLA-Rate',        wert: '82',   einheit: '%',   delta_pct: -3,  ziel: 90,  ziel_einheit: '%',   ampel: 'rot',   inverted: true  },
    { key: 'storno',       label: 'Stornoquote',     wert: '1.8',  einheit: '%',   delta_pct: -0.5,ziel: 2,   ziel_einheit: '%',   ampel: 'gruen', inverted: true  },
  ],
  stunden: [
    { stunde: '10', bestellungen: 6,  umsatz: 88  },
    { stunde: '11', bestellungen: 9,  umsatz: 135 },
    { stunde: '12', bestellungen: 17, umsatz: 255 },
    { stunde: '13', bestellungen: 21, umsatz: 315 },
    { stunde: '14', bestellungen: 14, umsatz: 210 },
    { stunde: '15', bestellungen: 8,  umsatz: 124 },
    { stunde: '16', bestellungen: 9,  umsatz: 157 },
  ],
  top_fahrer: [
    { name: 'Lisa W.', score: 94, touren: 6, umsatz: 312 },
    { name: 'Marco T.',score: 82, touren: 5, umsatz: 268 },
    { name: 'Ben K.',  score: 63, touren: 4, umsatz: 204 },
  ],
  zonen: [
    { name: 'Innenstadt', sla_pct: 92, bestellungen: 38, umsatz: 590 },
    { name: 'West',       sla_pct: 85, bestellungen: 24, umsatz: 380 },
    { name: 'Ost',        sla_pct: 74, bestellungen: 16, umsatz: 244 },
    { name: 'Nord',       sla_pct: 68, bestellungen: 6,  umsatz: 70  },
  ],
};

const KPI_ICONS: Record<string, React.ReactNode> = {
  bestellungen: <Package className="w-3 h-3" />,
  umsatz:       <Euro className="w-3 h-3" />,
  lieferzeit:   <Clock className="w-3 h-3" />,
  puenktlich:   <Target className="w-3 h-3" />,
  bewertung:    <Star className="w-3 h-3" />,
  fahrer:       <Users className="w-3 h-3" />,
  sla:          <Route className="w-3 h-3" />,
  storno:       <XCircle className="w-3 h-3" />,
};

const AMPEL_STYLE = {
  gruen: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', icon: 'text-green-500' },
  gelb:  { bg: 'bg-yellow-50',text: 'text-yellow-700',border: 'border-yellow-200',icon: 'text-yellow-500'},
  rot:   { bg: 'bg-red-50',   text: 'text-red-700',   border: 'border-red-200',   icon: 'text-red-500'  },
} as const;

type ChartModus = 'bestellungen' | 'umsatz';

interface Props { locationId: string | null; }

export function LieferdienstPhase4210StatistikenDashboardV2({ locationId }: Props) {
  const [data, setData] = useState<DashData>(MOCK);
  const [loading, setLoading] = useState(false);
  const [modus, setModus] = useState<ChartModus>('bestellungen');
  const now = new Date().getHours().toString();

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/analytics?location_id=${locationId}&modus=schicht`);
      if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 60_000); return () => clearInterval(id); }, [load]);

  const scoreColor = data.gesamt_score >= 85 ? '#22c55e' : data.gesamt_score >= 70 ? '#eab308' : '#ef4444';
  const r = 28, circ = 2 * Math.PI * r;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-bold text-gray-900">Statistiken Dashboard V2</span>
          {loading && <span className="w-2 h-2 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />}
        </div>
      </div>

      {/* Alert Strip */}
      {data.alert_kpis.length > 0 && (
        <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 text-[10px] text-amber-700 font-medium">
          <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
          <span>Achtung: {data.alert_kpis.join(', ')} unter Zielwert</span>
        </div>
      )}

      {/* Score + Insight */}
      <div className="flex items-center gap-3">
        <svg width="68" height="68" viewBox="0 0 68 68">
          <circle cx="34" cy="34" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
          <circle cx="34" cy="34" r={r} fill="none" stroke={scoreColor} strokeWidth="6"
            strokeDasharray={`${(data.gesamt_score / 100) * circ} ${circ}`} strokeLinecap="round"
            transform="rotate(-90 34 34)" />
          <text x="34" y="38" textAnchor="middle" fontSize="14" fontWeight="bold" fill={scoreColor}>{data.gesamt_score}</text>
          <text x="34" y="50" textAnchor="middle" fontSize="7" fill="#9ca3af">Score</text>
        </svg>
        <div className="flex-1">
          <p className="text-[10px] text-gray-600 leading-snug">{data.insight}</p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-1.5">
        {data.kpis.map((k) => {
          const st = AMPEL_STYLE[k.ampel];
          const up = k.delta_pct >= 0;
          const goodDir = k.inverted ? !up : up;
          return (
            <div key={k.key} className={`rounded-lg border ${st.bg} ${st.border} px-2 py-1.5`}>
              <div className="flex items-center justify-between mb-0.5">
                <span className={`${st.icon}`}>{KPI_ICONS[k.key]}</span>
                <span className={`flex items-center gap-0.5 text-[9px] font-bold ${goodDir ? 'text-green-600' : 'text-red-500'}`}>
                  {up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                  {up ? '+' : ''}{k.delta_pct}%
                </span>
              </div>
              <p className={`text-sm font-bold ${st.text}`}>{k.wert}{k.einheit}</p>
              <p className="text-[9px] text-gray-500">{k.label}{k.ziel ? ` · Ziel ${k.ziel}${k.ziel_einheit}` : ''}</p>
            </div>
          );
        })}
      </div>

      {/* Stunden Chart */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold text-gray-700">Stundenverlauf</span>
          <div className="flex gap-1">
            {(['bestellungen', 'umsatz'] as ChartModus[]).map((m) => (
              <button key={m} onClick={() => setModus(m)}
                className={`text-[9px] px-1.5 py-0.5 rounded font-medium transition ${modus === m ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400 hover:text-gray-600'}`}>
                {m === 'bestellungen' ? 'Bestell.' : 'Umsatz'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={64}>
          <BarChart data={data.stunden} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="stunde" tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v) => modus === 'umsatz' ? [`${v} €`, 'Umsatz'] : [v, 'Bestellungen']}
              contentStyle={{ fontSize: 9, padding: '2px 6px' }}
            />
            <Bar dataKey={modus} radius={[3,3,0,0]}>
              {data.stunden.map((s) => (
                <Cell key={s.stunde} fill={s.stunde === now ? '#6366f1' : '#a5b4fc'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top Fahrer */}
      <div>
        <p className="text-[10px] font-semibold text-gray-700 mb-1">Top Fahrer</p>
        <div className="space-y-1">
          {data.top_fahrer.map((f, i) => (
            <div key={f.name} className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-gray-400 w-3">{i + 1}.</span>
              <span className="text-[10px] text-gray-700 flex-1">{f.name}</span>
              <span className={`text-[9px] font-bold rounded px-1 ${f.score >= 85 ? 'text-green-700 bg-green-50' : f.score >= 70 ? 'text-yellow-700 bg-yellow-50' : 'text-red-700 bg-red-50'}`}>
                {f.score}
              </span>
              <span className="text-[9px] text-gray-500">{f.touren} Touren</span>
              <span className="text-[9px] font-medium text-gray-700">{f.umsatz} €</span>
            </div>
          ))}
        </div>
      </div>

      {/* Zonen */}
      <div>
        <p className="text-[10px] font-semibold text-gray-700 mb-1">Zonen-SLA</p>
        <div className="space-y-1">
          {data.zonen.map((z) => {
            const slaColor = z.sla_pct >= 90 ? 'bg-green-400' : z.sla_pct >= 80 ? 'bg-yellow-400' : 'bg-red-400';
            return (
              <div key={z.name} className="flex items-center gap-2">
                <span className="text-[9px] text-gray-600 w-16 truncate">{z.name}</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${slaColor}`} style={{ width: `${z.sla_pct}%` }} />
                </div>
                <span className="text-[9px] font-bold text-gray-600 w-8 text-right">{z.sla_pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-[9px] text-gray-400 text-right border-t border-gray-100 pt-1">60s Polling · Mock-Fallback</div>
    </div>
  );
}
