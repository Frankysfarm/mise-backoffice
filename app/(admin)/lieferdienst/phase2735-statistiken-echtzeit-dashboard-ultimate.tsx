'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity, TrendingUp, TrendingDown, Minus, AlertTriangle, Clock, Users, Euro, Target, Star, Package, ChevronDown, ChevronUp } from 'lucide-react';

interface KpiKachel {
  key: string;
  label: string;
  wert: number;
  einheit: string;
  ziel: number;
  vorwoche: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  inverted: boolean;
}

interface StundenPunkt {
  stunde: string;
  bestellungen: number;
  umsatz: number;
}

interface ZoneKpi {
  zone: string;
  bestellungen: number;
  sla_pct: number;
  avg_lieferzeit: number;
}

interface FahrerKpi {
  name: string;
  score: number;
  stopps: number;
}

interface ApiResponse {
  kpis: KpiKachel[];
  stunden: StundenPunkt[];
  zonen: ZoneKpi[];
  fahrer_top: FahrerKpi[];
  gesamt_score: number;
  insight_tipp: string;
}

const MOCK: ApiResponse = {
  gesamt_score: 81,
  insight_tipp: 'Lieferzeit 18:00–19:00 Uhr überdurchschnittlich — Fahrer-Rotation prüfen.',
  kpis: [
    { key: 'bestellungen', label: 'Bestellungen', wert: 148, einheit: '', ziel: 130, vorwoche: 132, ampel: 'gruen', inverted: false },
    { key: 'umsatz', label: 'Umsatz', wert: 3840, einheit: '€', ziel: 3500, vorwoche: 3620, ampel: 'gruen', inverted: false },
    { key: 'lieferzeit', label: 'Ø Lieferzeit', wert: 28, einheit: 'min', ziel: 30, vorwoche: 31, ampel: 'gruen', inverted: true },
    { key: 'puenktlichkeit', label: 'Pünktlichkeit', wert: 86, einheit: '%', ziel: 90, vorwoche: 84, ampel: 'gelb', inverted: false },
    { key: 'bewertung', label: 'Bewertung', wert: 4.6, einheit: '★', ziel: 4.5, vorwoche: 4.5, ampel: 'gruen', inverted: false },
    { key: 'fahrer', label: 'Aktive Fahrer', wert: 7, einheit: '', ziel: 6, vorwoche: 6, ampel: 'gruen', inverted: false },
    { key: 'sla', label: 'SLA-Rate', wert: 88, einheit: '%', ziel: 92, vorwoche: 87, ampel: 'gelb', inverted: false },
    { key: 'storno', label: 'Stornoquote', wert: 3.2, einheit: '%', ziel: 5, vorwoche: 4.1, ampel: 'gruen', inverted: true },
    { key: 'trinkgeld', label: 'Ø Trinkgeld', wert: 1.4, einheit: '€', ziel: 1.0, vorwoche: 1.2, ampel: 'gruen', inverted: false },
    { key: 'touren', label: 'Touren', wert: 52, einheit: '', ziel: 45, vorwoche: 48, ampel: 'gruen', inverted: false },
  ],
  stunden: [
    { stunde: '11', bestellungen: 8, umsatz: 210 },
    { stunde: '12', bestellungen: 18, umsatz: 480 },
    { stunde: '13', bestellungen: 24, umsatz: 630 },
    { stunde: '14', bestellungen: 15, umsatz: 390 },
    { stunde: '15', bestellungen: 10, umsatz: 260 },
    { stunde: '16', bestellungen: 12, umsatz: 310 },
    { stunde: '17', bestellungen: 22, umsatz: 580 },
    { stunde: '18', bestellungen: 26, umsatz: 680 },
    { stunde: '19', bestellungen: 13, umsatz: 300 },
  ],
  zonen: [
    { zone: 'Innenstadt', bestellungen: 54, sla_pct: 91, avg_lieferzeit: 24 },
    { zone: 'Nordviertel', bestellungen: 38, sla_pct: 88, avg_lieferzeit: 29 },
    { zone: 'Süd', bestellungen: 31, sla_pct: 85, avg_lieferzeit: 32 },
    { zone: 'West', bestellungen: 25, sla_pct: 79, avg_lieferzeit: 36 },
  ],
  fahrer_top: [
    { name: 'Thomas W.', score: 92, stopps: 18 },
    { name: 'Mia S.', score: 87, stopps: 15 },
    { name: 'Jan K.', score: 83, stopps: 14 },
  ],
};

const AMPEL_BG: Record<string, string> = {
  gruen: 'border-emerald-200 dark:border-emerald-800',
  gelb: 'border-yellow-200 dark:border-yellow-800',
  rot: 'border-red-200 dark:border-red-800',
};
const AMPEL_DOT: Record<string, string> = {
  gruen: 'bg-emerald-500',
  gelb: 'bg-yellow-400',
  rot: 'bg-red-500',
};
const AMPEL_VAL: Record<string, string> = {
  gruen: 'text-emerald-600 dark:text-emerald-400',
  gelb: 'text-yellow-600 dark:text-yellow-400',
  rot: 'text-red-600 dark:text-red-400',
};

function TrendArrow({ wert, ziel, inverted }: { wert: number; ziel: number; inverted: boolean }) {
  const besser = inverted ? wert < ziel : wert >= ziel;
  if (besser) return <TrendingUp className="w-3 h-3 text-emerald-600" />;
  return <TrendingDown className="w-3 h-3 text-red-500" />;
}

export function LieferdienstPhase2735StatistikEchtzeitDashboardUltimate({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [chartMode, setChartMode] = useState<'bestellungen' | 'umsatz'>('bestellungen');
  const [open, setOpen] = useState(true);
  const stunde = new Date().getHours().toString();

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/statistiken-live?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) { const d = await r.json(); if (d?.kpis?.length) setData(d); }
    } catch {}
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 60_000); return () => clearInterval(id); }, [load]);

  const alertKpis = data.kpis.filter(k => k.ampel === 'rot');
  const scoreColor = (s: number) => s >= 85 ? 'text-emerald-600' : s >= 70 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="border rounded-xl bg-white dark:bg-gray-900 shadow-sm mb-3 overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-3 text-left bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 border-b border-indigo-100 dark:border-indigo-900"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2 font-semibold text-sm text-gray-900 dark:text-gray-100">
          <Activity className="w-4 h-4 text-indigo-600" />
          Statistiken Echtzeit Dashboard Ultimate
          {alertKpis.length > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 text-xs font-bold">
              {alertKpis.length} Alert
            </span>
          )}
        </span>
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12">
            <svg viewBox="0 0 48 48" className="w-12 h-12 -rotate-90">
              <circle cx="24" cy="24" r="18" fill="none" stroke="#e5e7eb" strokeWidth="5" />
              <circle
                cx="24" cy="24" r="18" fill="none"
                stroke={data.gesamt_score >= 85 ? '#10b981' : data.gesamt_score >= 70 ? '#f59e0b' : '#ef4444'}
                strokeWidth="5" strokeLinecap="round"
                strokeDasharray={`${(data.gesamt_score / 100) * 113} 113`}
              />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-xs font-black ${scoreColor(data.gesamt_score)}`}>
              {data.gesamt_score}
            </span>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="p-3 space-y-3">
          {/* Insight-Tipp */}
          {data.insight_tipp && (
            <div className="flex items-start gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300">
              <Target className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              {data.insight_tipp}
            </div>
          )}

          {/* Alert-Strip */}
          {alertKpis.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-400">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              Kritisch: {alertKpis.map(k => k.label).join(', ')}
            </div>
          )}

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2">
            {data.kpis.map(k => {
              const delta = ((k.wert - k.vorwoche) / Math.max(k.vorwoche, 0.01) * 100).toFixed(1);
              const besser = k.inverted ? k.wert < k.vorwoche : k.wert > k.vorwoche;
              return (
                <div key={k.key} className={`border rounded-lg p-2.5 ${AMPEL_BG[k.ampel]} bg-white dark:bg-gray-800`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{k.label}</span>
                    <div className={`w-2 h-2 rounded-full ${AMPEL_DOT[k.ampel]}`} />
                  </div>
                  <div className={`text-xl font-black ${AMPEL_VAL[k.ampel]}`}>
                    {k.einheit === '€' && k.wert >= 1000 ? `${(k.wert / 1000).toFixed(1)}k` : k.wert}{k.einheit !== '€' || k.wert < 1000 ? '' : ''}{k.einheit === '€' && k.wert >= 1000 ? '€' : k.einheit !== '€' ? k.einheit : `€`}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                    {besser ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-red-500" />}
                    <span className={besser ? 'text-emerald-600' : 'text-red-500'}>{delta}%</span>
                    <span>vs. Vorwoche</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Stunden-Chart */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Stundenverlauf</span>
              <div className="flex gap-1">
                {(['bestellungen', 'umsatz'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setChartMode(m)}
                    className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${chartMode === m ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  >
                    {m === 'bestellungen' ? 'Bestellungen' : 'Umsatz'}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.stunden} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                  <XAxis dataKey="stunde" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: number) => chartMode === 'umsatz' ? [`${v}€`, 'Umsatz'] : [v, 'Bestellungen']}
                    labelFormatter={(l: string) => `${l}:00 Uhr`}
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  />
                  <Bar dataKey={chartMode} radius={[3, 3, 0, 0]}>
                    {data.stunden.map(s => (
                      <Cell key={s.stunde} fill={s.stunde === stunde ? '#6366f1' : '#c7d2fe'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Zonen-Ranking */}
          <div>
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Top-Zonen</div>
            <div className="space-y-1.5">
              {data.zonen.map((z, i) => (
                <div key={z.zone} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-400 w-4">#{i + 1}</span>
                  <span className="flex-1 font-medium text-gray-700 dark:text-gray-300">{z.zone}</span>
                  <span className="text-gray-500">{z.bestellungen} Bestellungen</span>
                  <span className={`font-bold ${z.sla_pct >= 90 ? 'text-emerald-600' : z.sla_pct >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {z.sla_pct}% SLA
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top-Fahrer */}
          <div>
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Top-Fahrer</div>
            <div className="grid grid-cols-3 gap-2">
              {data.fahrer_top.map((f, i) => (
                <div key={f.name} className="text-center p-2 border border-gray-100 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="text-base">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</div>
                  <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{f.name}</div>
                  <div className={`text-sm font-black ${scoreColor(f.score)}`}>{f.score}</div>
                  <div className="text-xs text-gray-400">{f.stopps} Stopps</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>1-Min-Polling · Mock-Fallback aktiv</span>
            <span>Phase 2735</span>
          </div>
        </div>
      )}
    </div>
  );
}
