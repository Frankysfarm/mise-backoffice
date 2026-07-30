'use client';

import { useEffect, useState } from 'react';
import { BarChart2, TrendingUp, TrendingDown, AlertTriangle, Clock, Star, Users, Activity, Zap, Package, Euro } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis } from 'recharts';

interface StundenDaten {
  stunde: number;
  bestellungen: number;
  umsatz: number;
  puenktlichkeit_pct: number;
  ist_jetzt: boolean;
}

interface WochenDaten {
  tag: string;
  bestellungen: number;
  umsatz: number;
}

interface TopFahrer {
  rang: number;
  name: string;
  score: number;
  touren: number;
  trinkgeld: number;
  puenktlichkeit_pct: number;
  score_delta: number;
}

interface ZoneKpi {
  zone: string;
  sla_pct: number;
  avg_min: number;
  umsatz: number;
  marge_pct: number;
}

interface KpiKachel {
  label: string;
  wert: number | string;
  ziel: number | null;
  trend: number;
  einheit: string;
  invertiert: boolean;
}

interface ApiResponse {
  score: number;
  score_delta: number;
  score_ziel: number;
  alert: string | null;
  kpis: KpiKachel[];
  stunden: StundenDaten[];
  wochen: WochenDaten[];
  top_fahrer: TopFahrer[];
  zonen: ZoneKpi[];
  chart_modus: 'bestellungen' | 'umsatz' | 'puenktlichkeit';
}

function euro(v: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

const MOCK: ApiResponse = {
  score: 88,
  score_delta: 3,
  score_ziel: 90,
  alert: null,
  kpis: [
    { label: 'Bestellungen', wert: 94, ziel: 100, trend: 6, einheit: '', invertiert: false },
    { label: 'Umsatz', wert: 2540, ziel: 2800, trend: 8, einheit: '€', invertiert: false },
    { label: 'Pünktlichkeit', wert: 84, ziel: 85, trend: -1, einheit: '%', invertiert: false },
    { label: 'Ø Lieferzeit', wert: 26, ziel: 30, trend: -2, einheit: 'min', invertiert: true },
    { label: 'Stornoquote', wert: 2.8, ziel: 3, trend: -0.4, einheit: '%', invertiert: true },
    { label: 'Bewertung', wert: 4.7, ziel: 4.5, trend: 0.1, einheit: '★', invertiert: false },
    { label: 'Fahrer aktiv', wert: 6, ziel: null, trend: 0, einheit: '', invertiert: false },
    { label: 'SLA-Rate', wert: 87, ziel: 85, trend: 2, einheit: '%', invertiert: false },
  ],
  stunden: [
    { stunde: 11, bestellungen: 7,  umsatz: 190,  puenktlichkeit_pct: 90, ist_jetzt: false },
    { stunde: 12, bestellungen: 15, umsatz: 410,  puenktlichkeit_pct: 86, ist_jetzt: false },
    { stunde: 13, bestellungen: 20, umsatz: 550,  puenktlichkeit_pct: 80, ist_jetzt: false },
    { stunde: 14, bestellungen: 13, umsatz: 350,  puenktlichkeit_pct: 83, ist_jetzt: false },
    { stunde: 17, bestellungen: 11, umsatz: 300,  puenktlichkeit_pct: 87, ist_jetzt: false },
    { stunde: 18, bestellungen: 17, umsatz: 460,  puenktlichkeit_pct: 82, ist_jetzt: true  },
    { stunde: 19, bestellungen: 11, umsatz: 280,  puenktlichkeit_pct: 80, ist_jetzt: false },
  ],
  wochen: [
    { tag: 'Mo', bestellungen: 78,  umsatz: 2100 },
    { tag: 'Di', bestellungen: 85,  umsatz: 2280 },
    { tag: 'Mi', bestellungen: 91,  umsatz: 2450 },
    { tag: 'Do', bestellungen: 88,  umsatz: 2370 },
    { tag: 'Fr', bestellungen: 112, umsatz: 3020 },
    { tag: 'Sa', bestellungen: 130, umsatz: 3500 },
    { tag: 'So', bestellungen: 94,  umsatz: 2540 },
  ],
  top_fahrer: [
    { rang: 1, name: 'Jonas M.', score: 96, touren: 13, trinkgeld: 19.40, puenktlichkeit_pct: 94, score_delta: 3 },
    { rang: 2, name: 'Sara K.',  score: 89, touren: 10, trinkgeld: 15.20, puenktlichkeit_pct: 86, score_delta: -1 },
    { rang: 3, name: 'Max L.',   score: 82, touren: 9,  trinkgeld: 12.60, puenktlichkeit_pct: 80, score_delta: 2 },
  ],
  zonen: [
    { zone: 'Innenstadt', sla_pct: 90, avg_min: 23, umsatz: 1120, marge_pct: 28 },
    { zone: 'Nord',       sla_pct: 78, avg_min: 29, umsatz:  820, marge_pct: 22 },
    { zone: 'Süd',        sla_pct: 93, avg_min: 22, umsatz:  600, marge_pct: 31 },
  ],
  chart_modus: 'bestellungen',
};

export function LieferdienstPhase4941StatistikDashboardV20() {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [modus, setModus] = useState<'bestellungen' | 'umsatz' | 'puenktlichkeit'>('bestellungen');
  const [ansicht, setAnsicht] = useState<'heute' | 'woche'>('heute');

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch('/api/delivery/lieferdienst/statistiken?v=20', { cache: 'no-store' });
        if (r.ok) setData(await r.json());
      } catch {}
    }
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  const scorePct = Math.min(100, Math.round((data.score / Math.max(data.score_ziel, 1)) * 100));

  const chartDaten = ansicht === 'heute'
    ? data.stunden.map(s => ({
        name: `${s.stunde}h`,
        wert: modus === 'bestellungen' ? s.bestellungen : modus === 'umsatz' ? s.umsatz : s.puenktlichkeit_pct,
        istJetzt: s.ist_jetzt,
      }))
    : data.wochen.map(w => ({
        name: w.tag,
        wert: modus === 'bestellungen' ? w.bestellungen : w.umsatz,
        istJetzt: false,
      }));

  return (
    <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-4 text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-emerald-400" />
          <span className="font-bold text-emerald-200">Statistiken V20</span>
          <span className="text-xs text-slate-500">Live · Woche</span>
        </div>
        <div className="flex items-center gap-2">
          {data.score_delta > 0 ? <TrendingUp className="w-4 h-4 text-green-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
          <span className="text-2xl font-bold tabular-nums text-emerald-300">{data.score}</span>
          <span className="text-xs text-slate-500">/ {data.score_ziel}</span>
        </div>
      </div>

      {data.alert && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 text-xs text-red-300 animate-pulse">
          <AlertTriangle className="w-3 h-3 shrink-0" />{data.alert}
        </div>
      )}

      {/* Score-Balken */}
      <div className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-800">
        <div className="flex items-center justify-between mb-1 text-xs">
          <span className="text-slate-500">Gesamt-Score</span>
          <span className="text-slate-400">{scorePct}%</span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${scorePct >= 90 ? 'bg-green-500' : scorePct >= 70 ? 'bg-emerald-500' : 'bg-yellow-500'}`}
            style={{ width: `${scorePct}%` }}
          />
        </div>
      </div>

      {/* 8-KPI-Grid */}
      <div className="grid grid-cols-4 gap-2">
        {data.kpis.map(k => {
          const numWert = typeof k.wert === 'number' ? k.wert : parseFloat(String(k.wert));
          const hatZiel = k.ziel !== null;
          const erfuellt = hatZiel && (k.invertiert ? numWert <= k.ziel! : numWert >= k.ziel!);
          const trendPos = k.invertiert ? k.trend < 0 : k.trend > 0;

          return (
            <div key={k.label} className={`rounded-lg p-2 border text-center ${erfuellt ? 'border-green-700/40 bg-green-950/20' : hatZiel ? 'border-amber-700/40 bg-amber-950/20' : 'border-slate-800 bg-slate-900/40'}`}>
              <div className={`text-sm font-bold tabular-nums ${erfuellt ? 'text-green-300' : hatZiel ? 'text-amber-300' : 'text-slate-300'}`}>
                {k.einheit === '€' ? euro(numWert) : `${k.wert}${k.einheit}`}
              </div>
              <div className="text-xs text-slate-500 truncate">{k.label}</div>
              {k.trend !== 0 && (
                <div className={`text-xs flex items-center justify-center gap-0.5 ${trendPos ? 'text-green-400' : 'text-red-400'}`}>
                  {trendPos ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                  {Math.abs(k.trend)}{k.einheit}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex gap-1">
            {(['heute', 'woche'] as const).map(a => (
              <button
                key={a}
                onClick={() => setAnsicht(a)}
                className={`text-xs px-2 py-1 rounded-lg transition-colors ${ansicht === a ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
              >
                {a === 'heute' ? 'Heute' : 'Diese Woche'}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {(['bestellungen', 'umsatz'] as const).map(m => (
              <button
                key={m}
                onClick={() => setModus(m)}
                className={`text-xs px-2 py-1 rounded-lg transition-colors ${modus === m ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}
              >
                {m === 'bestellungen' ? 'Best.' : 'Umsatz'}
              </button>
            ))}
            {ansicht === 'heute' && (
              <button
                onClick={() => setModus('puenktlichkeit')}
                className={`text-xs px-2 py-1 rounded-lg transition-colors ${modus === 'puenktlichkeit' ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}
              >
                Pünktl
              </button>
            )}
          </div>
        </div>

        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartDaten} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 11 }}
                cursor={{ fill: 'rgba(100,116,139,0.1)' }}
              />
              <Bar dataKey="wert" radius={[3, 3, 0, 0]}>
                {chartDaten.map((d, i) => (
                  <Cell key={i} fill={d.istJetzt ? '#10b981' : '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top-3-Fahrer */}
      <div>
        <div className="flex items-center gap-1 mb-2">
          <Users className="w-3 h-3 text-slate-400" />
          <span className="text-xs text-slate-400 font-medium">Top-3 Fahrer</span>
        </div>
        <div className="space-y-1.5">
          {data.top_fahrer.map(f => {
            const medal = f.rang === 1 ? '🥇' : f.rang === 2 ? '🥈' : '🥉';
            return (
              <div key={f.name} className="flex items-center gap-3 bg-slate-900/60 rounded-lg px-3 py-2 border border-slate-800">
                <span className="text-base">{medal}</span>
                <span className="text-sm text-white font-medium flex-1">{f.name}</span>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="text-slate-300 font-bold tabular-nums">{f.score}</span>
                  <span>{f.touren}T</span>
                  <span className="text-yellow-400">{f.trinkgeld.toFixed(2)}€</span>
                  <span>{f.puenktlichkeit_pct}%</span>
                  {f.score_delta !== 0 && (
                    f.score_delta > 0
                      ? <TrendingUp className="w-3 h-3 text-green-400" />
                      : <TrendingDown className="w-3 h-3 text-red-400" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Zonen-Effizienz */}
      <div>
        <div className="flex items-center gap-1 mb-2">
          <Activity className="w-3 h-3 text-slate-400" />
          <span className="text-xs text-slate-400 font-medium">Zonen-Effizienz</span>
        </div>
        <div className="space-y-1.5">
          {data.zonen.map(z => (
            <div key={z.zone} className="flex items-center gap-2">
              <span className="text-xs text-slate-400 w-20 shrink-0">{z.zone}</span>
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${z.sla_pct >= 85 ? 'bg-green-500' : z.sla_pct >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${z.sla_pct}%` }}
                />
              </div>
              <span className={`text-xs font-bold w-8 text-right tabular-nums ${z.sla_pct >= 85 ? 'text-green-400' : z.sla_pct >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                {z.sla_pct}%
              </span>
              <span className="text-xs text-slate-600 w-16 text-right">{z.avg_min}m · {euro(z.umsatz)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs text-slate-600 text-right">60s Polling · Mock-Fallback</div>
    </div>
  );
}
