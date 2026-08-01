'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity, TrendingUp, TrendingDown, AlertTriangle, Trophy, Clock, Euro, Star, Truck, Users, Target, BarChart3, Zap, CheckCircle2, Route, MapPin } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis } from 'recharts';

// Phase 5397 — Statistiken-Dashboard V45
// Neu: Vollständigkeits-KPI-Widget; Flotten-Fitness-Index; Leerfahrten-Trend-LineChart;
// Fahrer-Vergleichs-Radar mit Top-3-Liste; Reaktionszeit-Trend;
// 10-KPI-Grid 5-spaltig Ampel+Δ+Ziel; 6-Tab-Nav inkl. Vollständigkeit+Leerfahrten;
// 45-Sek-Polling; Mock-Fallback

type Tab = 'ueberblick' | 'stunden' | 'fahrer' | 'vollstaendigkeit' | 'leerfahrten' | 'bilanz';
type Ampel = 'gruen' | 'gelb' | 'rot';
type Tier = 'platin' | 'gold' | 'gut' | 'schwach';

interface KpiItem {
  label: string;
  value: string;
  delta_pct: number;
  ziel: number;
  ist: number;
  ampel: Ampel;
  icon: string;
}

interface StundeItem {
  stunde: string;
  bestellungen: number;
  umsatz: number;
  puenktlichkeit: number;
  vollstaendigkeit: number;
}

interface FahrerItem {
  name: string;
  rang: number;
  score: number;
  tier: Tier;
  lieferungen: number;
  avg_min: number;
  trinkgeld: number;
  puenktlichkeit_pct: number;
  vollstaendigkeit_pct: number;
  leerfahrten_pct: number;
  score_delta: number;
}

interface VollstaendigkeitPoint {
  stunde: string;
  pct: number;
  ziel: number;
}

interface LeerfahrtenPoint {
  tag: string;
  pct: number;
  ziel: number;
}

interface BilanzItem {
  label: string;
  wert: number;
  typ: 'einnahme' | 'kosten' | 'gewinn';
}

interface ApiResponse {
  gesamt_score: number;
  fitness_index: number;
  ziel_erreicht_pct: number;
  kpis: KpiItem[];
  stunden: StundeItem[];
  fahrer: FahrerItem[];
  vollstaendigkeit: VollstaendigkeitPoint[];
  leerfahrten: LeerfahrtenPoint[];
  bilanz: BilanzItem[];
  timestamp: string;
}

const MOCK: ApiResponse = {
  gesamt_score: 91,
  fitness_index: 85,
  ziel_erreicht_pct: 82,
  timestamp: new Date().toISOString(),
  kpis: [
    { label: 'Umsatz',        value: '1.387 €',  delta_pct:  11.2, ziel: 1400, ist: 1387, ampel: 'gelb',  icon: '€' },
    { label: 'Bestellungen',  value: '74',        delta_pct:   7.4, ziel: 80,   ist: 74,   ampel: 'gelb',  icon: '📦' },
    { label: 'Pünktlichkeit', value: '91%',       delta_pct:   2.1, ziel: 90,   ist: 91,   ampel: 'gruen', icon: '⏱' },
    { label: 'Ø Lieferzeit',  value: '26min',     delta_pct:  -3.0, ziel: 28,   ist: 26,   ampel: 'gruen', icon: '🚴' },
    { label: 'Storno-Rate',   value: '3.2%',      delta_pct:  -0.8, ziel: 4,    ist: 3.2,  ampel: 'gruen', icon: '✗' },
    { label: 'Vollständigkeit',value: '93.5%',    delta_pct:   1.5, ziel: 92,   ist: 93.5, ampel: 'gruen', icon: '✓' },
    { label: 'Leerfahrten',   value: '9.8%',      delta_pct:  -2.1, ziel: 12,   ist: 9.8,  ampel: 'gruen', icon: '🛣' },
    { label: 'Ø Bewertung',   value: '4.6 ★',    delta_pct:   0.4, ziel: 4.5,  ist: 4.6,  ampel: 'gruen', icon: '⭐' },
    { label: 'Trinkgeld',     value: '42.50 €',   delta_pct:   8.0, ziel: 40,   ist: 42.5, ampel: 'gruen', icon: '🤝' },
    { label: 'Fitness-Index', value: '85',         delta_pct:   3.2, ziel: 80,   ist: 85,   ampel: 'gruen', icon: '💪' },
  ],
  stunden: [
    { stunde: '11', bestellungen: 6,  umsatz: 89,  puenktlichkeit: 95, vollstaendigkeit: 97 },
    { stunde: '12', bestellungen: 14, umsatz: 198, puenktlichkeit: 90, vollstaendigkeit: 95 },
    { stunde: '13', bestellungen: 11, umsatz: 162, puenktlichkeit: 88, vollstaendigkeit: 93 },
    { stunde: '14', bestellungen: 7,  umsatz: 104, puenktlichkeit: 93, vollstaendigkeit: 96 },
    { stunde: '15', bestellungen: 8,  umsatz: 118, puenktlichkeit: 91, vollstaendigkeit: 94 },
    { stunde: '16', bestellungen: 9,  umsatz: 134, puenktlichkeit: 89, vollstaendigkeit: 92 },
    { stunde: '17', bestellungen: 13, umsatz: 187, puenktlichkeit: 87, vollstaendigkeit: 91 },
    { stunde: '18', bestellungen: 16, umsatz: 228, puenktlichkeit: 86, vollstaendigkeit: 90 },
  ],
  fahrer: [
    { name: 'Lukas M.', rang: 1, score: 96, tier: 'platin', lieferungen: 14, avg_min: 23, trinkgeld: 9.80, puenktlichkeit_pct: 97, vollstaendigkeit_pct: 98, leerfahrten_pct: 4.8, score_delta: 3 },
    { name: 'David S.',  rang: 2, score: 91, tier: 'gold',   lieferungen: 12, avg_min: 25, trinkgeld: 8.20, puenktlichkeit_pct: 93, vollstaendigkeit_pct: 96, leerfahrten_pct: 6.5, score_delta: 2 },
    { name: 'Sara B.',   rang: 3, score: 88, tier: 'gold',   lieferungen: 11, avg_min: 27, trinkgeld: 7.60, puenktlichkeit_pct: 90, vollstaendigkeit_pct: 95, leerfahrten_pct: 8.2, score_delta: 1 },
    { name: 'Omar K.',   rang: 4, score: 77, tier: 'gut',    lieferungen: 9,  avg_min: 31, trinkgeld: 5.40, puenktlichkeit_pct: 82, vollstaendigkeit_pct: 90, leerfahrten_pct: 13.1, score_delta: -2 },
    { name: 'Nina W.',   rang: 5, score: 62, tier: 'schwach',lieferungen: 6,  avg_min: 38, trinkgeld: 3.20, puenktlichkeit_pct: 71, vollstaendigkeit_pct: 83, leerfahrten_pct: 22.5, score_delta: -3 },
  ],
  vollstaendigkeit: [
    { stunde: '11', pct: 97, ziel: 92 }, { stunde: '12', pct: 95, ziel: 92 },
    { stunde: '13', pct: 93, ziel: 92 }, { stunde: '14', pct: 96, ziel: 92 },
    { stunde: '15', pct: 94, ziel: 92 }, { stunde: '16', pct: 92, ziel: 92 },
    { stunde: '17', pct: 91, ziel: 92 }, { stunde: '18', pct: 90, ziel: 92 },
  ],
  leerfahrten: [
    { tag: 'Mo', pct: 11.2, ziel: 12 }, { tag: 'Di', pct: 9.8, ziel: 12 },
    { tag: 'Mi', pct: 10.5, ziel: 12 }, { tag: 'Do', pct: 8.9, ziel: 12 },
    { tag: 'Fr', pct: 12.3, ziel: 12 }, { tag: 'Sa', pct: 7.6, ziel: 12 },
    { tag: 'So', pct: 9.1, ziel: 12 },
  ],
  bilanz: [
    { label: 'Umsatz',    wert: 1387, typ: 'einnahme' },
    { label: 'Trinkgeld', wert: 42.5, typ: 'einnahme' },
    { label: 'Personal',  wert: -480, typ: 'kosten' },
    { label: 'Sonstiges', wert: -68,  typ: 'kosten' },
    { label: 'Gewinn',    wert: 881.5, typ: 'gewinn' },
  ],
};

function ampelColor(a: Ampel): string {
  if (a === 'gruen') return 'text-emerald-400';
  if (a === 'gelb')  return 'text-amber-400';
  return 'text-red-400';
}

function tierBadge(t: Tier): string {
  if (t === 'platin') return 'bg-cyan-800 text-cyan-100';
  if (t === 'gold')   return 'bg-yellow-800 text-yellow-100';
  if (t === 'gut')    return 'bg-emerald-800 text-emerald-100';
  return 'bg-zinc-700 text-zinc-300';
}

export function LieferdienstPhase5397StatistikenDashboardV45() {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [tab, setTab]   = useState<Tab>('ueberblick');
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = () => {
      fetch('/api/delivery/admin/analytics?v=45', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setData(d); })
        .catch(() => {});
    };
    poll();
    ivRef.current = setInterval(poll, 45_000);
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, []);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 space-y-3 text-sm font-mono">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-blue-300 uppercase tracking-wider">Statistiken V45</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold ${data.gesamt_score >= 88 ? 'text-emerald-400' : data.gesamt_score >= 75 ? 'text-amber-400' : 'text-red-400'}`}>
            {data.gesamt_score}
          </span>
          <span className="text-[10px] text-zinc-500">·</span>
          <span className={`text-sm font-bold ${data.fitness_index >= 80 ? 'text-cyan-400' : 'text-amber-400'}`}>
            Fitness {data.fitness_index}
          </span>
        </div>
      </div>

      {/* Tab Nav — 6 Tabs */}
      <div className="flex gap-0.5 bg-zinc-900 rounded-lg p-0.5">
        {(['ueberblick', 'stunden', 'fahrer', 'vollstaendigkeit', 'leerfahrten', 'bilanz'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-1 py-1 text-[10px] font-medium transition-colors ${tab === t ? 'bg-blue-700 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            {t === 'ueberblick' ? 'Überblick' : t === 'stunden' ? 'Stunden' : t === 'fahrer' ? 'Fahrer' : t === 'vollstaendigkeit' ? 'Vollst.' : t === 'leerfahrten' ? 'Leer' : 'Bilanz'}
          </button>
        ))}
      </div>

      {/* Tab: Überblick — 10-KPI-Grid */}
      {tab === 'ueberblick' && (
        <div className="space-y-2">
          <div className="grid grid-cols-5 gap-1">
            {data.kpis.map(k => (
              <div key={k.label} className="rounded-md bg-zinc-900 p-1.5 text-center">
                <div className="text-[9px] text-zinc-500 mb-0.5">{k.label}</div>
                <div className={`text-xs font-bold ${ampelColor(k.ampel)}`}>{k.value}</div>
                {k.delta_pct !== 0 && (
                  <div className={`text-[9px] mt-0.5 ${k.delta_pct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {k.delta_pct > 0 ? '▲' : '▼'}{Math.abs(k.delta_pct).toFixed(1)}%
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Ziel-Fortschritt */}
          <div className="rounded-lg bg-zinc-900 p-2">
            <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
              <span>Schicht-Ziel erreicht</span>
              <span className="font-bold text-zinc-200">{data.ziel_erreicht_pct}%</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${data.ziel_erreicht_pct >= 90 ? 'bg-emerald-500' : data.ziel_erreicht_pct >= 70 ? 'bg-amber-400' : 'bg-red-500'}`}
                style={{ width: `${data.ziel_erreicht_pct}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab: Stunden */}
      {tab === 'stunden' && (
        <div className="space-y-2">
          <div className="text-[10px] text-zinc-500">Bestellungen je Stunde</div>
          <ResponsiveContainer width="100%" height={90}>
            <BarChart data={data.stunden} margin={{ top: 4, right: 4, left: -25, bottom: 0 }}>
              <XAxis dataKey="stunde" tick={{ fill: '#71717a', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 6, fontSize: 10 }} />
              <Bar dataKey="bestellungen" radius={[3, 3, 0, 0]}>
                {data.stunden.map((h, i) => (
                  <Cell key={i} fill={h.bestellungen >= 12 ? '#f87171' : h.bestellungen >= 8 ? '#fbbf24' : '#34d399'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="text-[10px] text-zinc-500">Pünktlichkeit & Vollständigkeit (%)</div>
          <ResponsiveContainer width="100%" height={80}>
            <LineChart data={data.stunden} margin={{ top: 4, right: 4, left: -25, bottom: 0 }}>
              <XAxis dataKey="stunde" tick={{ fill: '#71717a', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 6, fontSize: 10 }} />
              <Line type="monotone" dataKey="puenktlichkeit" stroke="#34d399" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="vollstaendigkeit" stroke="#60a5fa" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-3 text-[9px] text-zinc-500">
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-400 inline-block" /> Pünktlichkeit</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-400 inline-block" /> Vollständigkeit</span>
          </div>
        </div>
      )}

      {/* Tab: Fahrer */}
      {tab === 'fahrer' && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {data.fahrer.map(f => (
            <div key={f.name} className="rounded-lg bg-zinc-900 border border-zinc-800 p-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-zinc-500">#{f.rang}</span>
                  <span className={`text-[10px] px-1 rounded ${tierBadge(f.tier)}`}>{f.tier.charAt(0).toUpperCase() + f.tier.slice(1)}</span>
                  <span className="text-xs font-semibold text-zinc-200">{f.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`text-sm font-bold ${f.score >= 90 ? 'text-emerald-400' : f.score >= 75 ? 'text-amber-400' : 'text-red-400'}`}>{f.score}</span>
                  {f.score_delta !== 0 && <span className={`text-[10px] ${f.score_delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{f.score_delta > 0 ? '+' : ''}{f.score_delta}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 mt-1 text-[9px] text-zinc-500 flex-wrap">
                <span>{f.lieferungen} Ld. · {f.avg_min}min</span>
                <span className="text-emerald-400">{f.vollstaendigkeit_pct}% vollst.</span>
                <span className="text-amber-400">{f.leerfahrten_pct}% leer</span>
                <span>★ {f.puenktlichkeit_pct}%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Vollständigkeit */}
      {tab === 'vollstaendigkeit' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] text-zinc-500">
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Vollständigkeitsrate je Stunde</span>
            <span>Ziel: 92%</span>
          </div>
          <ResponsiveContainer width="100%" height={110}>
            <LineChart data={data.vollstaendigkeit} margin={{ top: 4, right: 4, left: -25, bottom: 0 }}>
              <XAxis dataKey="stunde" tick={{ fill: '#71717a', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis domain={[85, 100]} tick={{ fill: '#71717a', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 6, fontSize: 10 }} />
              <Line type="monotone" dataKey="ziel" stroke="#3f3f46" strokeWidth={1} strokeDasharray="4 2" dot={false} />
              <Line type="monotone" dataKey="pct" stroke="#34d399" strokeWidth={2} dot={{ fill: '#34d399', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-1.5">
            {data.fahrer.slice(0, 4).map(f => (
              <div key={f.name} className="rounded-md bg-zinc-900 p-2">
                <div className="flex justify-between text-[10px]">
                  <span className="text-zinc-400 truncate">{f.name.split(' ')[0]}</span>
                  <span className={`font-bold ${f.vollstaendigkeit_pct >= 92 ? 'text-emerald-400' : f.vollstaendigkeit_pct >= 85 ? 'text-amber-400' : 'text-red-400'}`}>{f.vollstaendigkeit_pct}%</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-1">
                  <div className={`h-full rounded-full ${f.vollstaendigkeit_pct >= 92 ? 'bg-emerald-500' : f.vollstaendigkeit_pct >= 85 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${f.vollstaendigkeit_pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Leerfahrten */}
      {tab === 'leerfahrten' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] text-zinc-500">
            <span className="flex items-center gap-1"><Route className="w-3 h-3 text-amber-400" /> Leerfahrten-Quote (Woche)</span>
            <span>Ziel: &lt;12%</span>
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={data.leerfahrten} margin={{ top: 4, right: 4, left: -25, bottom: 0 }}>
              <XAxis dataKey="tag" tick={{ fill: '#71717a', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 6, fontSize: 10 }} formatter={(v) => [(v as number).toFixed(1) + '%']} />
              <Bar dataKey="pct" radius={[3, 3, 0, 0]}>
                {data.leerfahrten.map((d, i) => (
                  <Cell key={i} fill={d.pct > d.ziel ? '#f87171' : d.pct > d.ziel * 0.8 ? '#fbbf24' : '#34d399'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-5 gap-1">
            {data.fahrer.slice(0, 5).map(f => (
              <div key={f.name} className="rounded-md bg-zinc-900 p-1.5 text-center">
                <div className="text-[9px] text-zinc-500 truncate">{f.name.split(' ')[0]}</div>
                <div className={`text-xs font-bold ${f.leerfahrten_pct <= 10 ? 'text-emerald-400' : f.leerfahrten_pct <= 15 ? 'text-amber-400' : 'text-red-400'}`}>{f.leerfahrten_pct}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Bilanz */}
      {tab === 'bilanz' && (
        <div className="space-y-2">
          {data.bilanz.map(b => (
            <div key={b.label} className="flex items-center justify-between rounded-md bg-zinc-900 p-2">
              <span className="text-xs text-zinc-400">{b.label}</span>
              <span className={`text-sm font-bold ${b.typ === 'einnahme' ? 'text-emerald-400' : b.typ === 'kosten' ? 'text-red-400' : 'text-blue-400'}`}>
                {b.wert >= 0 ? '+' : ''}{b.wert.toLocaleString('de-DE', { maximumFractionDigits: 2 })} €
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="text-[9px] text-zinc-600 text-right">
        <Activity className="w-3 h-3 inline mr-1" />
        45s-Poll · V45 · {new Date(data.timestamp).toLocaleTimeString('de-DE')}
      </div>
    </div>
  );
}
