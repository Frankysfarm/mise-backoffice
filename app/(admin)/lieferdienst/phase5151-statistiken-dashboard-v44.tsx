'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity, TrendingUp, TrendingDown, AlertTriangle, Trophy, Clock, Euro, Star, Truck, Users, Target, BarChart3, Zap, Heart } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';

// Phase 5151 — Statistiken-Dashboard V44
// Neu: Live-Kunden-Zufriedenheits-Trend (NPS+Rating+Kommentar-Sentiment);
// Schicht-Bilanz-Panel (Kosten vs. Einnahmen vs. Gewinn); KI-Prognose-Score;
// 9-KPI-Grid 3-spaltig Ampel+Δ+Ziel; 5-Tab-Nav Überblick/Stunden/Fahrer/Zufriedenheit/Bilanz;
// Stunden-BarChart 3-Modi farbkodiert; Fahrer-Tier-Ranking;
// Sentiment-Trend-LineChart; 45-Sek-Polling; Mock-Fallback

type Tab = 'ueberblick' | 'stunden' | 'fahrer' | 'zufriedenheit' | 'bilanz';
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
  ziel: number;
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
  score_delta: number;
}

interface SentimentPoint {
  stunde: string;
  nps: number;
  rating: number;
  positiv_pct: number;
}

interface BilanzItem {
  label: string;
  wert: number;
  typ: 'einnahme' | 'kosten' | 'gewinn';
}

interface ApiResponse {
  gesamt_score: number;
  ki_prognose_score: number;
  ziel_erreicht_pct: number;
  kpis: KpiItem[];
  stunden: StundeItem[];
  fahrer: FahrerItem[];
  sentiment: SentimentPoint[];
  bilanz: BilanzItem[];
  timestamp: string;
}

const MOCK: ApiResponse = {
  gesamt_score: 89,
  ki_prognose_score: 92,
  ziel_erreicht_pct: 78,
  timestamp: new Date().toISOString(),
  kpis: [
    { label: 'Umsatz',      value: '1.342 €',  delta_pct:  9.1, ziel: 1400, ist: 1342, ampel: 'gelb',  icon: '€' },
    { label: 'Bestellungen',value: '148',       delta_pct: 14.2, ziel: 160,  ist: 148,  ampel: 'gelb',  icon: '📦' },
    { label: 'Fahrer',      value: '7 aktiv',   delta_pct:  0,   ziel: 7,    ist: 7,    ampel: 'gruen', icon: '🚴' },
    { label: 'Ø Zeit',      value: '26 min',    delta_pct: -6.2, ziel: 30,   ist: 26,   ampel: 'gruen', icon: '⏱' },
    { label: 'Pünktl.',     value: '91%',       delta_pct:  3.4, ziel: 90,   ist: 91,   ampel: 'gruen', icon: '✓' },
    { label: 'Bewertung',   value: '4.7 ★',    delta_pct:  0.9, ziel: 4.5,  ist: 4.7,  ampel: 'gruen', icon: '⭐' },
    { label: 'Storno',      value: '3.8%',      delta_pct: -1.8, ziel: 5,    ist: 3.8,  ampel: 'gruen', icon: '✗' },
    { label: 'Marge',       value: '24%',       delta_pct:  2.1, ziel: 25,   ist: 24,   ampel: 'gelb',  icon: '📈' },
    { label: 'NPS',         value: '62',        delta_pct:  5.0, ziel: 60,   ist: 62,   ampel: 'gruen', icon: '💚' },
  ],
  stunden: [
    { stunde: '11', bestellungen: 12, umsatz: 110, puenktlichkeit: 94, ziel: 15 },
    { stunde: '12', bestellungen: 28, umsatz: 260, puenktlichkeit: 89, ziel: 25 },
    { stunde: '13', bestellungen: 34, umsatz: 320, puenktlichkeit: 91, ziel: 30 },
    { stunde: '14', bestellungen: 22, umsatz: 200, puenktlichkeit: 95, ziel: 20 },
    { stunde: '15', bestellungen: 18, umsatz: 165, puenktlichkeit: 92, ziel: 18 },
    { stunde: '16', bestellungen: 34, umsatz: 287, puenktlichkeit: 88, ziel: 30 },
  ],
  fahrer: [
    { name: 'Lukas M.',  rang: 1, score: 96, tier: 'platin', lieferungen: 14, avg_min: 23, trinkgeld: 28.50, puenktlichkeit_pct: 97, score_delta: +4 },
    { name: 'Sara B.',   rang: 2, score: 91, tier: 'gold',   lieferungen: 12, avg_min: 26, trinkgeld: 22.10, puenktlichkeit_pct: 93, score_delta: +2 },
    { name: 'David S.',  rang: 3, score: 88, tier: 'gold',   lieferungen: 13, avg_min: 25, trinkgeld: 19.40, puenktlichkeit_pct: 91, score_delta: +1 },
    { name: 'Omar K.',   rang: 4, score: 77, tier: 'gut',    lieferungen: 10, avg_min: 30, trinkgeld: 15.20, puenktlichkeit_pct: 84, score_delta: -2 },
    { name: 'Nina W.',   rang: 5, score: 62, tier: 'schwach',lieferungen:  8, avg_min: 37, trinkgeld:  9.80, puenktlichkeit_pct: 73, score_delta: -5 },
  ],
  sentiment: [
    { stunde: '11', nps: 58, rating: 4.5, positiv_pct: 81 },
    { stunde: '12', nps: 61, rating: 4.6, positiv_pct: 84 },
    { stunde: '13', nps: 65, rating: 4.7, positiv_pct: 87 },
    { stunde: '14', nps: 59, rating: 4.6, positiv_pct: 82 },
    { stunde: '15', nps: 63, rating: 4.8, positiv_pct: 89 },
    { stunde: '16', nps: 62, rating: 4.7, positiv_pct: 86 },
  ],
  bilanz: [
    { label: 'Umsatz',         wert: 1342, typ: 'einnahme' },
    { label: 'Liefergebühren', wert:  387, typ: 'einnahme' },
    { label: 'Fahrerkosten',   wert:  620, typ: 'kosten' },
    { label: 'Verpackung',     wert:   85, typ: 'kosten' },
    { label: 'Platform-Fee',   wert:   98, typ: 'kosten' },
    { label: 'Rohgewinn',      wert:  926, typ: 'gewinn' },
  ],
};

const AMPEL: Record<Ampel, string> = {
  gruen: 'bg-emerald-500',
  gelb:  'bg-amber-400',
  rot:   'bg-red-500',
};

const TIER_MEDAL: Record<Tier, string> = { platin: '🥇', gold: '🥈', gut: '🥉', schwach: '' };
const TIER_COLOR: Record<Tier, string> = {
  platin: 'text-cyan-300',
  gold:   'text-yellow-300',
  gut:    'text-emerald-300',
  schwach:'text-zinc-400',
};

export function LieferdienstPhase5151StatistikenDashboardV44() {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [tab, setTab]   = useState<Tab>('ueberblick');
  const [stundenMode, setStundenMode] = useState<'bestellungen' | 'umsatz' | 'puenktlichkeit'>('bestellungen');
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = () => {
      fetch('/api/lieferdienst/statistiken?include_sentiment=1&include_bilanz=1', { cache: 'no-store' })
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
          <Activity className="w-4 h-4 text-teal-400" />
          <span className="text-xs font-semibold text-teal-300 uppercase tracking-wider">Statistiken V44</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-center">
            <div className="text-[9px] text-zinc-500">Score</div>
            <div className="text-sm font-bold text-teal-400">{data.gesamt_score}</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-zinc-500">KI-Prognose</div>
            <div className="text-sm font-bold text-violet-400">{data.ki_prognose_score}</div>
          </div>
        </div>
      </div>

      {/* Ziel-Fortschrittsbalken */}
      <div>
        <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
          <span>Tagesziel-Erreichung</span>
          <span className="text-teal-400 font-semibold">{data.ziel_erreicht_pct}%</span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-teal-600 transition-all"
            style={{ width: `${data.ziel_erreicht_pct}%` }}
          />
        </div>
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1 bg-zinc-900 rounded-lg p-1 overflow-x-auto">
        {(['ueberblick', 'stunden', 'fahrer', 'zufriedenheit', 'bilanz'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-shrink-0 rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${tab === t ? 'bg-teal-700 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            {t === 'ueberblick' ? 'Überblick' : t === 'stunden' ? 'Stunden' : t === 'fahrer' ? 'Fahrer' : t === 'zufriedenheit' ? 'Feedback' : 'Bilanz'}
          </button>
        ))}
      </div>

      {/* Tab: Überblick – 9-KPI Grid */}
      {tab === 'ueberblick' && (
        <div className="grid grid-cols-3 gap-1.5">
          {data.kpis.map(k => (
            <div key={k.label} className="rounded-lg bg-zinc-900 p-2">
              <div className="flex items-center gap-1 mb-0.5">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${AMPEL[k.ampel]}`} />
                <span className="text-[10px] text-zinc-500 truncate">{k.label}</span>
              </div>
              <div className="text-sm font-bold text-zinc-100">{k.value}</div>
              <div className={`text-[10px] flex items-center gap-0.5 mt-0.5 ${k.delta_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {k.delta_pct >= 0
                  ? <TrendingUp className="w-2.5 h-2.5" />
                  : <TrendingDown className="w-2.5 h-2.5" />}
                {Math.abs(k.delta_pct)}%
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Stunden */}
      {tab === 'stunden' && (
        <div>
          <div className="flex gap-1 mb-2">
            {(['bestellungen', 'umsatz', 'puenktlichkeit'] as const).map(m => (
              <button
                key={m}
                onClick={() => setStundenMode(m)}
                className={`flex-1 rounded px-1.5 py-0.5 text-[10px] transition-colors ${stundenMode === m ? 'bg-teal-800 text-teal-100' : 'bg-zinc-800 text-zinc-400'}`}
              >
                {m === 'bestellungen' ? 'Bestellungen' : m === 'umsatz' ? 'Umsatz' : 'Pünktl.'}
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={data.stunden} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="stunde" tick={{ fill: '#71717a', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 6, fontSize: 10 }}
                formatter={(v) => { const n = v as number; return [stundenMode === 'umsatz' ? `${n}€` : stundenMode === 'puenktlichkeit' ? `${n}%` : n, stundenMode]; }}
              />
              <Bar dataKey={stundenMode} radius={[3, 3, 0, 0]}>
                {data.stunden.map((s, i) => {
                  const v = s[stundenMode];
                  const fill = stundenMode === 'puenktlichkeit'
                    ? v >= 90 ? '#14b8a6' : v >= 80 ? '#fbbf24' : '#f87171'
                    : '#14b8a6';
                  return <Cell key={i} fill={fill} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tab: Fahrer */}
      {tab === 'fahrer' && (
        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
          {data.fahrer.map(f => (
            <div key={f.name} className="rounded-lg bg-zinc-900 border border-zinc-800 p-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{TIER_MEDAL[f.tier]}</span>
                  <span className={`text-xs font-semibold ${TIER_COLOR[f.tier]}`}>{f.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-sm font-bold ${TIER_COLOR[f.tier]}`}>{f.score}</span>
                  <span className={`text-[10px] ${f.score_delta > 0 ? 'text-emerald-400' : f.score_delta < 0 ? 'text-red-400' : 'text-zinc-500'}`}>
                    {f.score_delta > 0 ? '+' : ''}{f.score_delta}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-1 text-[10px] text-zinc-500">
                <span>{f.lieferungen} Tour.</span>
                <span>{f.avg_min}min</span>
                <span className="text-amber-400">{f.trinkgeld.toFixed(2)}€ TG</span>
                <span className={f.puenktlichkeit_pct >= 90 ? 'text-emerald-400' : 'text-amber-400'}>{f.puenktlichkeit_pct}%</span>
              </div>
              <div className="mt-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${TIER_COLOR[f.tier].replace('text-', 'bg-').replace('-300', '-600')}`} style={{ width: `${f.score}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Zufriedenheit (Sentiment) */}
      {tab === 'zufriedenheit' && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Heart className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-[10px] text-zinc-400">Kunden-Zufriedenheits-Trend</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            <div className="rounded-lg bg-zinc-900 p-2 text-center">
              <div className="text-[10px] text-zinc-500 mb-0.5">Akt. NPS</div>
              <div className="text-base font-bold text-teal-400">{data.sentiment[data.sentiment.length - 1]?.nps ?? '–'}</div>
            </div>
            <div className="rounded-lg bg-zinc-900 p-2 text-center">
              <div className="text-[10px] text-zinc-500 mb-0.5">Positiv</div>
              <div className="text-base font-bold text-emerald-400">{data.sentiment[data.sentiment.length - 1]?.positiv_pct ?? '–'}%</div>
            </div>
          </div>
          <div className="text-[10px] text-zinc-500 mb-1">NPS-Verlauf</div>
          <ResponsiveContainer width="100%" height={90}>
            <LineChart data={data.sentiment} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="stunde" tick={{ fill: '#71717a', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 6, fontSize: 10 }}
                formatter={(v) => [v as number, 'NPS']}
              />
              <Line type="monotone" dataKey="nps" stroke="#14b8a6" strokeWidth={2} dot={{ fill: '#14b8a6', r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tab: Bilanz */}
      {tab === 'bilanz' && (
        <div className="space-y-1.5">
          {data.bilanz.map(b => (
            <div key={b.label} className="flex items-center justify-between rounded-lg bg-zinc-900 px-2.5 py-2">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${b.typ === 'einnahme' ? 'bg-emerald-500' : b.typ === 'kosten' ? 'bg-red-500' : 'bg-teal-400'}`} />
                <span className="text-xs text-zinc-300">{b.label}</span>
              </div>
              <span className={`text-xs font-bold ${b.typ === 'einnahme' ? 'text-emerald-400' : b.typ === 'kosten' ? 'text-red-400' : 'text-teal-400'}`}>
                {b.typ === 'kosten' ? '-' : '+'}{b.wert.toLocaleString('de-DE')} €
              </span>
            </div>
          ))}
          <div className="border-t border-zinc-700 mt-2 pt-2 flex justify-between items-center">
            <span className="text-xs font-semibold text-zinc-300">Rohgewinn</span>
            <span className="text-base font-bold text-teal-400">
              {(data.bilanz.find(b => b.typ === 'gewinn')?.wert ?? 0).toLocaleString('de-DE')} €
            </span>
          </div>
        </div>
      )}

      <div className="text-[9px] text-zinc-600 text-right">
        <BarChart3 className="w-3 h-3 inline mr-1" />
        45s-Poll · {new Date(data.timestamp).toLocaleTimeString('de-DE')}
      </div>
    </div>
  );
}
