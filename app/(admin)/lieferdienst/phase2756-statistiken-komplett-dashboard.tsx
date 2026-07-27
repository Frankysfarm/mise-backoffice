'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Clock, Star, Users, AlertTriangle, CheckCircle2, XCircle, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface KPI {
  key: string;
  label: string;
  wert: number;
  einheit: string;
  ziel: number;
  delta: number;
  invertiert: boolean;
}

interface StundeData {
  stunde: string;
  bestellungen: number;
  umsatz: number;
}

interface ZoneRow {
  name: string;
  sla_pct: number;
  bestellungen: number;
}

interface ApiData {
  kpis: KPI[];
  stunden: StundeData[];
  zonen: ZoneRow[];
  aktive_fahrer: number;
  gesamt_score: number;
}

const MOCK: ApiData = {
  gesamt_score: 81,
  aktive_fahrer: 5,
  kpis: [
    { key: 'bestellungen', label: 'Bestellungen', wert: 87,   einheit: '',    ziel: 100, delta: 12,   invertiert: false },
    { key: 'umsatz',       label: 'Umsatz',        wert: 2340, einheit: '€',  ziel: 2800,delta: 8,    invertiert: false },
    { key: 'lieferzeit',   label: 'Ø Lieferzeit',  wert: 24.5, einheit: 'min',ziel: 28,  delta: -3.2, invertiert: true  },
    { key: 'puenktlichkeit',label:'Pünktlichkeit', wert: 88,   einheit: '%',  ziel: 90,  delta: 2,    invertiert: false },
    { key: 'bewertung',    label: 'Bewertung',      wert: 4.4,  einheit: '★',  ziel: 4.5, delta: 0.1,  invertiert: false },
    { key: 'fahrer',       label: 'Akt. Fahrer',    wert: 5,    einheit: '',   ziel: 6,   delta: 0,    invertiert: false },
    { key: 'sla',          label: 'SLA-Rate',       wert: 91,   einheit: '%',  ziel: 95,  delta: 1,    invertiert: false },
    { key: 'storno',       label: 'Stornoquote',    wert: 3.2,  einheit: '%',  ziel: 3,   delta: -0.5, invertiert: true  },
  ],
  stunden: [
    { stunde: '10',  bestellungen: 4,  umsatz: 112 },
    { stunde: '11',  bestellungen: 6,  umsatz: 168 },
    { stunde: '12',  bestellungen: 14, umsatz: 392 },
    { stunde: '13',  bestellungen: 18, umsatz: 504 },
    { stunde: '14',  bestellungen: 11, umsatz: 308 },
    { stunde: '15',  bestellungen: 7,  umsatz: 196 },
    { stunde: '16',  bestellungen: 9,  umsatz: 252 },
    { stunde: '17',  bestellungen: 18, umsatz: 504 },
  ],
  zonen: [
    { name: 'Mitte',  sla_pct: 94, bestellungen: 38 },
    { name: 'Nord',   sla_pct: 89, bestellungen: 22 },
    { name: 'Süd',    sla_pct: 91, bestellungen: 27 },
  ],
};

const JETZT_STUNDE = String(new Date().getHours());

function ampelBg(kpi: KPI): string {
  const ok = kpi.invertiert
    ? kpi.wert <= kpi.ziel
    : kpi.wert >= kpi.ziel * 0.9;
  const warn = kpi.invertiert
    ? kpi.wert <= kpi.ziel * 1.1
    : kpi.wert >= kpi.ziel * 0.75;
  if (ok)   return 'border-emerald-200 bg-emerald-50';
  if (warn) return 'border-yellow-200 bg-yellow-50';
  return          'border-red-200 bg-red-50';
}

function ampelText(kpi: KPI): string {
  const ok = kpi.invertiert
    ? kpi.wert <= kpi.ziel
    : kpi.wert >= kpi.ziel * 0.9;
  const warn = kpi.invertiert
    ? kpi.wert <= kpi.ziel * 1.1
    : kpi.wert >= kpi.ziel * 0.75;
  if (ok)   return 'text-emerald-700';
  if (warn) return 'text-yellow-700';
  return          'text-red-700';
}

function deltaTxt(d: number, inv: boolean) {
  const pos = inv ? d < 0 : d > 0;
  return (
    <span className={`text-[10px] font-medium flex items-center gap-0.5 ${pos ? 'text-emerald-600' : d === 0 ? 'text-gray-400' : 'text-red-500'}`}>
      {d > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : d < 0 ? <TrendingDown className="w-2.5 h-2.5" /> : null}
      {d > 0 ? '+' : ''}{d}{typeof d === 'number' && Math.abs(d) < 10 && d !== Math.floor(d) ? '' : ''}%
    </span>
  );
}

export function LieferdienstPhase2756StatistikenKomplettDashboard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [chartMode, setChartMode] = useState<'bestellungen' | 'umsatz'>('bestellungen');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/lieferdienst/stats?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
    } catch { /* Mock-Fallback */ }
    finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, [load]);

  const kritisch = data.kpis.filter(k => {
    if (k.invertiert) return k.wert > k.ziel * 1.1;
    return k.wert < k.ziel * 0.75;
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-bold text-gray-900">Statistiken Dashboard</span>
          {loading && <span className="w-2.5 h-2.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[11px]">
            <Users className="w-3 h-3 text-gray-400" />
            <span className="text-gray-600 font-medium">{data.aktive_fahrer} Fahrer</span>
          </div>
          <div className={`px-2 py-0.5 rounded-full text-xs font-bold ${data.gesamt_score >= 80 ? 'bg-emerald-100 text-emerald-700' : data.gesamt_score >= 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
            Score {data.gesamt_score}
          </div>
        </div>
      </div>

      {/* KPI-Grid 2-spaltig */}
      <div className="grid grid-cols-2 gap-1.5">
        {data.kpis.map(kpi => (
          <div key={kpi.key} className={`border rounded-lg p-2 ${ampelBg(kpi)}`}>
            <div className="flex items-start justify-between">
              <span className="text-[10px] text-gray-500">{kpi.label}</span>
              {deltaTxt(kpi.delta, kpi.invertiert)}
            </div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className={`text-base font-black ${ampelText(kpi)}`}>
                {kpi.wert}{kpi.einheit}
              </span>
              <span className="text-[10px] text-gray-400">/ Ziel {kpi.ziel}{kpi.einheit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Alert-Strip kritische KPIs */}
      {kritisch.length > 0 && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Kritisch: {kritisch.map(k => k.label).join(', ')}</span>
        </div>
      )}

      {/* Stundenverlauf-Chart */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Stundenverlauf</span>
          <div className="flex gap-1">
            {(['bestellungen', 'umsatz'] as const).map(m => (
              <button
                key={m}
                onClick={() => setChartMode(m)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${chartMode === m ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                {m === 'bestellungen' ? 'Bestellungen' : 'Umsatz'}
              </button>
            ))}
          </div>
        </div>
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.stunden} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="stunde" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                formatter={(v: any) => chartMode === 'umsatz' ? [`€${v}`, 'Umsatz'] : [v, 'Bestellungen']}
              />
              <Bar dataKey={chartMode} radius={[3, 3, 0, 0]} maxBarSize={22}>
                {data.stunden.map((s) => (
                  <Cell key={s.stunde} fill={s.stunde === JETZT_STUNDE ? '#6366f1' : '#c7d2fe'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Zonen-Ranking */}
      <div className="space-y-1">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Zonen-SLA</span>
        {data.zonen.map(z => (
          <div key={z.name} className="flex items-center gap-2">
            <span className="text-[10px] text-gray-600 w-12 shrink-0">{z.name}</span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${z.sla_pct >= 92 ? 'bg-emerald-500' : z.sla_pct >= 85 ? 'bg-yellow-400' : 'bg-red-500'}`}
                style={{ width: `${z.sla_pct}%` }}
              />
            </div>
            <span className={`text-[10px] font-bold w-8 text-right shrink-0 ${z.sla_pct >= 92 ? 'text-emerald-700' : z.sla_pct >= 85 ? 'text-yellow-600' : 'text-red-600'}`}>
              {z.sla_pct}%
            </span>
            <span className="text-[10px] text-gray-400 w-8 text-right shrink-0">{z.bestellungen}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1.5 border-t border-gray-100">
        <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Komplett-Dashboard</span>
        <span>60-Sek-Polling · Mock-Fallback</span>
      </div>
    </div>
  );
}
