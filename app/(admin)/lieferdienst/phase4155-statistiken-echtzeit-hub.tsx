'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Minus, AlertTriangle, Award, Users, Clock, Euro, Star, XCircle, Target } from 'lucide-react';

interface KpiKachel {
  key: string;
  label: string;
  wert: string;
  delta_pct: number | null;
  ampel: 'gruen' | 'gelb' | 'rot';
  ziel: string | null;
}

interface StundenPunkt { stunde: string; bestellungen: number; umsatz: number; ist_jetzt: boolean; }

interface FahrerRow { name: string; score: number; touren: number; bewertung: number; }

interface ZoneRow { zone: string; sla_pct: number; ampel: 'gruen' | 'gelb' | 'rot'; }

interface ApiData {
  kpis: KpiKachel[];
  gesamt_score: number;
  insight_tipp: string;
  alert_kpis: string[];
  stunden_verlauf: StundenPunkt[];
  top_fahrer: FahrerRow[];
  zonen: ZoneRow[];
}

const MOCK: ApiData = {
  gesamt_score: 76,
  insight_tipp: 'Pünktlichkeit gesunken – Fahrer Tim B. prüfen',
  alert_kpis: ['Pünktlichkeit', 'Storno-Rate'],
  kpis: [
    { key: 'bestellungen', label: 'Bestellungen', wert: '142', delta_pct: 8, ampel: 'gruen', ziel: '150' },
    { key: 'umsatz', label: 'Umsatz', wert: '4.820€', delta_pct: 5, ampel: 'gruen', ziel: '5.000€' },
    { key: 'lieferzeit', label: 'Ø Lieferzeit', wert: '28min', delta_pct: -3, ampel: 'gelb', ziel: '≤25min' },
    { key: 'puenktlichkeit', label: 'Pünktlichkeit', wert: '74%', delta_pct: -6, ampel: 'rot', ziel: '≥85%' },
    { key: 'bewertung', label: 'Ø Bewertung', wert: '4.3★', delta_pct: 0, ampel: 'gruen', ziel: '≥4.5★' },
    { key: 'storno', label: 'Storno-Rate', wert: '5.2%', delta_pct: 2, ampel: 'rot', ziel: '≤3%' },
    { key: 'trinkgeld', label: 'Trinkgeld', wert: '124€', delta_pct: 10, ampel: 'gruen', ziel: null },
    { key: 'fahrer_aktiv', label: 'Aktive Fahrer', wert: '5', delta_pct: null, ampel: 'gruen', ziel: null },
  ],
  stunden_verlauf: [
    { stunde: '10', bestellungen: 8, umsatz: 280, ist_jetzt: false },
    { stunde: '11', bestellungen: 14, umsatz: 490, ist_jetzt: false },
    { stunde: '12', bestellungen: 31, umsatz: 1085, ist_jetzt: false },
    { stunde: '13', bestellungen: 28, umsatz: 980, ist_jetzt: false },
    { stunde: '14', bestellungen: 22, umsatz: 770, ist_jetzt: true },
    { stunde: '15', bestellungen: 18, umsatz: 630, ist_jetzt: false },
  ],
  top_fahrer: [
    { name: 'Max M.', score: 94, touren: 8, bewertung: 4.9 },
    { name: 'Julia F.', score: 82, touren: 6, bewertung: 4.6 },
    { name: 'Sara K.', score: 74, touren: 5, bewertung: 4.2 },
  ],
  zonen: [
    { zone: 'A', sla_pct: 92, ampel: 'gruen' },
    { zone: 'B', sla_pct: 78, ampel: 'gelb' },
    { zone: 'C', sla_pct: 61, ampel: 'rot' },
  ],
};

function DeltaIcon({ val }: { val: number | null }) {
  if (val === null) return <Minus className="w-3 h-3 text-gray-300" />;
  if (val > 0) return <TrendingUp className="w-3 h-3 text-emerald-500" />;
  if (val < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-300" />;
}

interface Props { locationId?: string | null; }

export function LieferdienstPhase4155StatistikenEchtzeitHub({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [modus, setModus] = useState<'bestellungen' | 'umsatz'>('bestellungen');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/statistiken-echtzeit?location_id=${locationId}`);
      if (res.ok) { const j = await res.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 60_000); return () => clearInterval(iv); }, [load]);

  const scoreColor = data.gesamt_score >= 85 ? 'text-emerald-600' : data.gesamt_score >= 70 ? 'text-yellow-600' : 'text-red-600';
  const scoreBarColor = data.gesamt_score >= 85 ? 'bg-emerald-500' : data.gesamt_score >= 70 ? 'bg-yellow-400' : 'bg-red-500';
  const maxBar = Math.max(...data.stunden_verlauf.map(s => modus === 'bestellungen' ? s.bestellungen : s.umsatz), 1);

  return (
    <div className="bg-white rounded-xl border border-indigo-200 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-semibold text-gray-900">Statistiken Echtzeit-Hub</span>
          {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-black ${scoreColor}`}>{data.gesamt_score}</span>
          <span className="text-[10px] text-gray-400">Score</span>
        </div>
      </div>

      {/* Alert-Strip */}
      {data.alert_kpis.length > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
          <span className="text-xs text-amber-800 font-medium">{data.insight_tipp}</span>
        </div>
      )}

      {/* Score-Balken */}
      <div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${scoreBarColor}`} style={{ width: `${data.gesamt_score}%` }} />
        </div>
      </div>

      {/* KPI-Grid 2-spaltig */}
      <div className="grid grid-cols-2 gap-2">
        {data.kpis.map(k => {
          const isAlert = data.alert_kpis.includes(k.label);
          const bg = k.ampel === 'gruen' ? 'bg-emerald-50 border-emerald-200' : k.ampel === 'gelb' ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';
          const txtWert = k.ampel === 'gruen' ? 'text-emerald-700' : k.ampel === 'gelb' ? 'text-yellow-700' : 'text-red-700';
          return (
            <div key={k.key} className={`rounded-lg border p-2.5 ${bg} ${isAlert ? 'ring-1 ring-red-300' : ''}`}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] text-gray-500 font-medium">{k.label}</span>
                <DeltaIcon val={k.delta_pct} />
              </div>
              <div className="flex items-end gap-1">
                <span className={`text-base font-black ${txtWert}`}>{k.wert}</span>
                {k.delta_pct !== null && (
                  <span className={`text-[9px] mb-0.5 ${k.delta_pct > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {k.delta_pct > 0 ? '+' : ''}{k.delta_pct}%
                  </span>
                )}
              </div>
              {k.ziel && <span className="text-[9px] text-gray-400">Ziel: {k.ziel}</span>}
            </div>
          );
        })}
      </div>

      {/* Stunden-Verlauf */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-700">Stundenverlauf</span>
          <div className="flex gap-1">
            <button onClick={() => setModus('bestellungen')} className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition ${modus === 'bestellungen' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>Bestellungen</button>
            <button onClick={() => setModus('umsatz')} className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition ${modus === 'umsatz' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>Umsatz</button>
          </div>
        </div>
        <div className="flex items-end gap-1 h-16">
          {data.stunden_verlauf.map(s => {
            const val = modus === 'bestellungen' ? s.bestellungen : s.umsatz;
            const h = Math.round((val / maxBar) * 100);
            return (
              <div key={s.stunde} className="flex-1 flex flex-col items-center gap-0.5">
                <div
                  className={`w-full rounded-t transition-all duration-500 ${s.ist_jetzt ? 'bg-indigo-500' : 'bg-indigo-200'}`}
                  style={{ height: `${h}%`, minHeight: '4px' }}
                />
                <span className="text-[8px] text-gray-400">{s.stunde}h</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top-Fahrer */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Award className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-xs font-semibold text-gray-700">Top-Fahrer</span>
        </div>
        <div className="space-y-1">
          {data.top_fahrer.map((f, i) => (
            <div key={f.name} className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 w-3">#{i + 1}</span>
              <span className="text-[10px] text-gray-700 flex-1 truncate">{f.name}</span>
              <span className="text-[10px] text-amber-600 font-bold">Score {f.score}</span>
              <span className="text-[10px] text-gray-400">★{f.bewertung}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Zonen-SLA */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Target className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-xs font-semibold text-gray-700">Zonen-SLA</span>
        </div>
        <div className="space-y-1.5">
          {data.zonen.map(z => {
            const barColor = z.ampel === 'gruen' ? 'bg-emerald-400' : z.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
            const txtColor = z.ampel === 'gruen' ? 'text-emerald-600' : z.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-600';
            return (
              <div key={z.zone} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 w-8">Zone {z.zone}</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${barColor} transition-all duration-700`} style={{ width: `${z.sla_pct}%` }} />
                </div>
                <span className={`text-[10px] font-bold ${txtColor} w-8 text-right`}>{z.sla_pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-100">
        <span>Echtzeit-Statistiken</span>
        <span>60-Sek-Polling</span>
      </div>
    </div>
  );
}
