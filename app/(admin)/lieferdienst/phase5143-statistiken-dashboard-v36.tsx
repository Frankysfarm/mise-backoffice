'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Activity, TrendingUp, TrendingDown, BarChart3, CheckCircle2,
  AlertTriangle, Users, Clock, Euro, Star, Target, Zap, Bell,
  Shield, Package, MapPin, ArrowRight,
} from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, LineChart, Line, YAxis, Cell } from 'recharts';

// Phase 5143 — Statistiken-Dashboard V36
// Gesamt-Score + Qualitäts-Score + Prognose-Score Tri-Ring;
// 9-KPI-Grid 3-spaltig Ampel+Icon+Δ+Ziel-Balken;
// 5-Tab-Nav Stunden/Fahrer/Zonen/Woche/Prognose;
// Prognose-Tab: Revenue-Velocity-Trend, nächste-Spitze-ETA, Fahrer-Bedarf-Schätzung;
// Live-Alert-Strip kritisch/warn/info;
// 60-Sek-Polling; Mock-Fallback

interface KPI {
  key: string;
  label: string;
  value: string | number;
  unit?: string;
  delta?: number;
  ziel?: number;
  aktuell?: number;
  status: 'ok' | 'warn' | 'alert';
  icon: React.ReactNode;
}

interface HourlyData { h: string; bestellungen: number; umsatz: number; puenktlichkeit: number; jetzt?: boolean }
interface FahrerRank { name: string; score: number; touren: number; trinkgeld: number; puenktlichkeit: number; tier: 'platin' | 'gold' | 'gut' | 'schwach'; km_heute?: number }
interface ZoneData { name: string; sla_pct: number; avg_min: number; umsatz: number; kapazitaet_pct: number }
interface AlertItem { id: string; level: 'info' | 'warn' | 'critical'; text: string; zeit: string }
interface WocheData { tag: string; gesamt: number; vorwoche: number }
interface PrognoseData { h: string; prognose: number; trend?: 'up' | 'down' | 'stable' }

interface DashboardData {
  gesamt_score: number;
  score_ziel: number;
  qualitaets_score: number;
  prognose_score: number;
  alerts: string[];
  alert_items?: AlertItem[];
  kpis: KPI[];
  stunden: HourlyData[];
  fahrer: FahrerRank[];
  zonen: ZoneData[];
  woche: WocheData[];
  prognose: PrognoseData[];
  spitze_eta_h: number | null;
  fahrer_bedarf: number;
}

const MOCK_DATA: DashboardData = {
  gesamt_score: 84,
  score_ziel: 90,
  qualitaets_score: 78,
  prognose_score: 82,
  spitze_eta_h: 19,
  fahrer_bedarf: 3,
  alerts: [],
  alert_items: [
    { id:'a1', level:'warn', text:'Zone Süd: SLA-Warnung unter 75%', zeit:'18:42' },
    { id:'a2', level:'info', text:'Neue Spitzenzeit beginnt in ~17 Min', zeit:'18:50' },
  ],
  kpis: [
    { key:'umsatz',     label:'Umsatz',       value:'€ 1.842', delta:+8.4, ziel:100, aktuell:74, status:'warn', icon: <Euro className="w-3 h-3" /> },
    { key:'bestellungen', label:'Bestellungen', value:147,     delta:+12,  ziel:100, aktuell:88, status:'ok',   icon: <Package className="w-3 h-3" /> },
    { key:'lieferzeit', label:'Ø Lieferzeit',  value:'28 Min', delta:-2,  ziel:100, aktuell:82, status:'ok',   icon: <Clock className="w-3 h-3" /> },
    { key:'puenktl',    label:'Pünktlichkeit', value:'87%',    delta:+1,  ziel:100, aktuell:87, status:'warn', icon: <CheckCircle2 className="w-3 h-3" /> },
    { key:'fahrer',     label:'Aktive Fahrer', value:6,        delta:0,   ziel:100, aktuell:75, status:'ok',   icon: <Users className="w-3 h-3" /> },
    { key:'bewertung',  label:'Bewertung',     value:'4.6★',   delta:+0.1,ziel:100, aktuell:92, status:'ok',   icon: <Star className="w-3 h-3" /> },
    { key:'storno',     label:'Storno-Rate',   value:'3.2%',   delta:-0.8,ziel:100, aktuell:84, status:'ok',   icon: <AlertTriangle className="w-3 h-3" /> },
    { key:'marge',      label:'Marge',         value:'28.4%',  delta:+1.2,ziel:100, aktuell:72, status:'warn', icon: <Target className="w-3 h-3" /> },
    { key:'qualitaet',  label:'Qualitäts-Idx', value:'78',     delta:+3,  ziel:100, aktuell:78, status:'warn', icon: <Shield className="w-3 h-3" /> },
  ],
  stunden: [
    { h:'10', bestellungen:8,  umsatz:124, puenktlichkeit:95 },
    { h:'11', bestellungen:12, umsatz:186, puenktlichkeit:92 },
    { h:'12', bestellungen:31, umsatz:478, puenktlichkeit:85, jetzt:false },
    { h:'13', bestellungen:28, umsatz:432, puenktlichkeit:88 },
    { h:'14', bestellungen:19, umsatz:294, puenktlichkeit:91 },
    { h:'15', bestellungen:14, umsatz:217, puenktlichkeit:94 },
    { h:'16', bestellungen:18, umsatz:278, puenktlichkeit:89, jetzt:false },
    { h:'17', bestellungen:22, umsatz:341, puenktlichkeit:86, jetzt:false },
    { h:'18', bestellungen:29, umsatz:449, puenktlichkeit:83, jetzt:true },
    { h:'19', bestellungen:0,  umsatz:0,   puenktlichkeit:0 },
  ],
  fahrer: [
    { name:'Marco S.', score:94, touren:18, trinkgeld:28.50, puenktlichkeit:97, tier:'platin', km_heute:87 },
    { name:'Lena K.',  score:81, touren:14, trinkgeld:18.20, puenktlichkeit:88, tier:'gold',   km_heute:62 },
    { name:'Tom R.',   score:52, touren:9,  trinkgeld:9.80,  puenktlichkeit:72, tier:'schwach', km_heute:41 },
  ],
  zonen: [
    { name:'Mitte', sla_pct:94, avg_min:24, umsatz:612.80, kapazitaet_pct:82 },
    { name:'Nord',  sla_pct:88, avg_min:28, umsatz:398.50, kapazitaet_pct:65 },
    { name:'Süd',   sla_pct:71, avg_min:34, umsatz:189.20, kapazitaet_pct:93 },
  ],
  woche: [
    { tag:'Mo', gesamt:310, vorwoche:285 },
    { tag:'Di', gesamt:340, vorwoche:310 },
    { tag:'Mi', gesamt:298, vorwoche:320 },
    { tag:'Do', gesamt:385, vorwoche:355 },
    { tag:'Fr', gesamt:0,   vorwoche:420 },
    { tag:'Sa', gesamt:0,   vorwoche:512 },
    { tag:'So', gesamt:0,   vorwoche:478 },
  ],
  prognose: [
    { h:'18', prognose:449, trend:'up' },
    { h:'19', prognose:520, trend:'up' },
    { h:'20', prognose:490, trend:'down' },
    { h:'21', prognose:380, trend:'down' },
    { h:'22', prognose:210, trend:'down' },
  ],
};

const TIER_MEDALS: Record<string, string> = { platin:'🥈', gold:'🥇', gut:'🥉', schwach:'—' };
const TIER_COLORS: Record<string, string> = { platin:'text-slate-300', gold:'text-yellow-400', gut:'text-emerald-400', schwach:'text-red-400' };
const STATUS_COLORS: Record<string, string> = { ok:'text-emerald-400 border-emerald-700/30 bg-emerald-900/10', warn:'text-amber-400 border-amber-700/30 bg-amber-900/10', alert:'text-red-400 border-red-700/30 bg-red-900/10' };
const STATUS_BAR: Record<string, string> = { ok:'bg-emerald-400', warn:'bg-amber-400', alert:'bg-red-400' };
const ALERT_COLORS: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  critical: { bg:'bg-red-900/30 border-red-700/40', text:'text-red-300', icon:<AlertTriangle className="w-3 h-3 text-red-400" /> },
  warn: { bg:'bg-amber-900/30 border-amber-700/40', text:'text-amber-300', icon:<Bell className="w-3 h-3 text-amber-400" /> },
  info: { bg:'bg-blue-900/30 border-blue-700/40', text:'text-blue-300', icon:<Activity className="w-3 h-3 text-blue-400" /> },
};

type Tab = 'stunden' | 'fahrer' | 'zonen' | 'woche' | 'prognose';
type ChartMode = 'bestellungen' | 'umsatz' | 'puenktlichkeit';

function ScoreRing({ val, ziel, color, label }: { val: number; ziel: number; color: string; label: string }) {
  const pct = Math.round((val / ziel) * 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-14 h-14">
        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="22" fill="none" stroke="#1e293b" strokeWidth="5" />
          <circle cx="28" cy="28" r="22" fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={`${2 * Math.PI * 22}`}
            strokeDashoffset={`${2 * Math.PI * 22 * (1 - pct / 100)}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-white">{val}</span>
        </div>
      </div>
      <div className="text-[10px] text-gray-500 text-center leading-tight">{label}</div>
    </div>
  );
}

export function LieferdienstPhase5143StatistikenDashboardV36({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<DashboardData>(MOCK_DATA);
  const [tab, setTab] = useState<Tab>('stunden');
  const [chartMode, setChartMode] = useState<ChartMode>('bestellungen');
  const [useMock, setUseMock] = useState(false);

  async function load() {
    try {
      const params = locationId ? `?location_id=${locationId}` : '';
      const res = await fetch(`/api/delivery/admin/statistiken-dashboard${params}`);
      if (!res.ok) { setUseMock(true); return; }
      const d = await res.json();
      setData(d);
      setUseMock(false);
    } catch { setUseMock(true); }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const alerts = data.alert_items ?? [];

  return (
    <div className="rounded-2xl border border-teal-700/40 bg-teal-950/20 overflow-hidden mb-4">
      {/* Header */}
      <div className="px-4 py-3 border-b border-teal-700/30 bg-teal-900/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-teal-400" />
          <span className="text-sm font-semibold text-teal-200">Statistiken-Dashboard V36</span>
          {useMock && <span className="text-[10px] text-gray-500 bg-slate-800 px-1.5 rounded">Mock</span>}
        </div>
        <div className="text-[10px] text-gray-500">60s Polling</div>
      </div>

      {/* Score Rings */}
      <div className="px-4 py-4 flex items-center justify-around border-b border-teal-700/20">
        <ScoreRing val={data.gesamt_score} ziel={data.score_ziel} color="#14b8a6" label="Gesamt-Score" />
        <ScoreRing val={data.qualitaets_score} ziel={100} color="#8b5cf6" label="Qualitäts-Score" />
        <ScoreRing val={data.prognose_score} ziel={100} color="#f59e0b" label="Prognose-Score" />
        {/* Ziel-Balken */}
        <div className="flex-1 ml-4">
          <div className="text-[10px] text-gray-500 mb-1">Tages-Ziel</div>
          <div className="h-2 rounded-full bg-slate-700/50 overflow-hidden">
            <div className="h-full rounded-full bg-teal-400 transition-all" style={{ width: `${Math.round((data.gesamt_score / data.score_ziel) * 100)}%` }} />
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">{data.gesamt_score} / {data.score_ziel} Ziel</div>
        </div>
      </div>

      {/* Alert Strip */}
      {alerts.length > 0 && (
        <div className="px-4 py-2 space-y-1.5 border-b border-teal-700/20">
          {alerts.map(a => {
            const ac = ALERT_COLORS[a.level];
            return (
              <div key={a.id} className={cn('flex items-center gap-2 rounded-lg px-3 py-1.5 border text-xs', ac.bg, ac.text)}>
                {ac.icon}
                <span className="flex-1">{a.text}</span>
                <span className="text-gray-500 shrink-0">{a.zeit}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* 9-KPI-Grid */}
      <div className="px-4 py-3 grid grid-cols-3 gap-2 border-b border-teal-700/20">
        {data.kpis.map(kpi => {
          const sc = STATUS_COLORS[kpi.status];
          const sb = STATUS_BAR[kpi.status];
          return (
            <div key={kpi.key} className={cn('rounded-xl border p-2.5 flex flex-col gap-1', sc)}>
              <div className="flex items-center gap-1 text-[10px] text-gray-400">{kpi.icon}<span>{kpi.label}</span></div>
              <div className="text-sm font-bold text-white">{kpi.value}</div>
              {kpi.aktuell != null && kpi.ziel != null && (
                <div className="h-1 rounded-full bg-slate-700/50 overflow-hidden">
                  <div className={cn('h-full rounded-full', sb)} style={{ width: `${kpi.aktuell}%` }} />
                </div>
              )}
              {kpi.delta != null && (
                <div className={cn('text-[10px] flex items-center gap-0.5', kpi.delta >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {kpi.delta >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                  {kpi.delta > 0 ? '+' : ''}{kpi.delta}{kpi.unit ?? ''}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-teal-700/20">
        {(['stunden', 'fahrer', 'zonen', 'woche', 'prognose'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={cn('flex-1 py-1.5 text-[11px] font-medium transition-colors capitalize', tab === t ? 'text-teal-300 border-b-2 border-teal-400 bg-teal-900/20' : 'text-gray-500 hover:text-gray-300')}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab: Stunden */}
      {tab === 'stunden' && (
        <div className="px-4 py-3">
          <div className="flex gap-2 mb-3">
            {(['bestellungen', 'umsatz', 'puenktlichkeit'] as ChartMode[]).map(m => (
              <button key={m} onClick={() => setChartMode(m)} className={cn('px-2 py-0.5 rounded text-[10px] font-medium', chartMode === m ? 'bg-teal-600 text-white' : 'bg-slate-800 text-gray-400')}>
                {m === 'bestellungen' ? 'Bestellungen' : m === 'umsatz' ? 'Umsatz' : 'Pünktlichkeit'}
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={data.stunden} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
              <XAxis dataKey="h" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey={chartMode} radius={[4, 4, 0, 0]}>
                {data.stunden.map((e, i) => <Cell key={i} fill={e.jetzt ? '#14b8a6' : '#1e3a5f'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tab: Fahrer */}
      {tab === 'fahrer' && (
        <div className="divide-y divide-slate-700/30">
          {data.fahrer.map((f, i) => (
            <div key={f.name} className="px-4 py-3 flex items-center gap-3">
              <span className="text-base">{TIER_MEDALS[f.tier]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-white">{f.name}</span>
                  <span className={cn('text-xs font-bold', TIER_COLORS[f.tier])}>{f.score}/100</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden mb-1">
                  <div className={cn('h-full rounded-full', STATUS_BAR[f.puenktlichkeit >= 90 ? 'ok' : f.puenktlichkeit >= 80 ? 'warn' : 'alert'])} style={{ width: `${f.score}%` }} />
                </div>
                <div className="flex items-center gap-3 text-[10px] text-gray-500">
                  <span>{f.touren} Touren</span>
                  <span>+{f.trinkgeld.toFixed(2)}€ TG</span>
                  <span>{f.puenktlichkeit}% pünktl.</span>
                  {f.km_heute != null && <span>{f.km_heute} km</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Zonen */}
      {tab === 'zonen' && (
        <div className="px-4 py-3 space-y-3">
          {data.zonen.map(z => {
            const slaColor = z.sla_pct >= 90 ? 'bg-emerald-400' : z.sla_pct >= 80 ? 'bg-amber-400' : 'bg-red-400';
            const capColor = z.kapazitaet_pct >= 85 ? 'bg-red-400' : z.kapazitaet_pct >= 65 ? 'bg-amber-400' : 'bg-emerald-400';
            return (
              <div key={z.name} className="rounded-xl border border-slate-700/40 bg-slate-800/20 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-white flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-blue-400" />{z.name}</span>
                  <span className="text-[10px] text-emerald-300">{z.umsatz.toFixed(2)}€</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <div className="text-gray-500 mb-0.5">SLA ({z.sla_pct}%)</div>
                    <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                      <div className={cn('h-full rounded-full', slaColor)} style={{ width: `${z.sla_pct}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-0.5">Kapazität ({z.kapazitaet_pct}%)</div>
                    <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                      <div className={cn('h-full rounded-full', capColor)} style={{ width: `${z.kapazitaet_pct}%` }} />
                    </div>
                  </div>
                </div>
                <div className="mt-1.5 text-[10px] text-gray-500">Ø Lieferzeit: <span className="text-white">{z.avg_min} Min</span></div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: Woche */}
      {tab === 'woche' && (
        <div className="px-4 py-3">
          <ResponsiveContainer width="100%" height={130}>
            <LineChart data={data.woche} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
              <XAxis dataKey="tag" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} width={32} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="gesamt" stroke="#14b8a6" strokeWidth={2} dot={{ fill: '#14b8a6', r: 3 }} name="Diese Woche" />
              <Line type="monotone" dataKey="vorwoche" stroke="#334155" strokeWidth={2} dot={{ fill: '#475569', r: 2 }} name="Vorwoche" strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-teal-400 inline-block" /> Diese Woche</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-slate-500 inline-block" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #64748b 0 4px, transparent 4px 8px)' }} /> Vorwoche</span>
          </div>
        </div>
      )}

      {/* Tab: Prognose */}
      {tab === 'prognose' && (
        <div className="px-4 py-3 space-y-4">
          {/* Revenue Velocity */}
          <div>
            <div className="text-xs text-gray-400 mb-2 flex items-center gap-1"><Zap className="w-3 h-3 text-amber-400" />Revenue-Prognose nächste Stunden</div>
            <ResponsiveContainer width="100%" height={90}>
              <BarChart data={data.prognose} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                <XAxis dataKey="h" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} formatter={(v) => [`€ ${v}`, 'Prognose']} />
                <Bar dataKey="prognose" radius={[4, 4, 0, 0]}>
                  {data.prognose.map((e, i) => <Cell key={i} fill={e.trend === 'up' ? '#10b981' : '#f59e0b'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Insights */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-amber-700/30 bg-amber-900/10 p-3 text-center">
              <div className="text-[10px] text-gray-400 mb-1">Nächste Spitze</div>
              <div className="text-lg font-bold text-amber-300">{data.spitze_eta_h != null ? `${data.spitze_eta_h}:00 Uhr` : '—'}</div>
              <div className="text-[10px] text-gray-500">ETA Hochbetrieb</div>
            </div>
            <div className="rounded-xl border border-blue-700/30 bg-blue-900/10 p-3 text-center">
              <div className="text-[10px] text-gray-400 mb-1">Fahrer-Bedarf</div>
              <div className="text-lg font-bold text-blue-300">+{data.fahrer_bedarf}</div>
              <div className="text-[10px] text-gray-500">für Spitzenzeit</div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 p-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1"><ArrowRight className="w-3 h-3 text-teal-400" />Prognose-Basis</div>
            <div className="text-[10px] text-gray-500">Ø letzter 4 Wochen · Wetter-Faktor · Wochentag-Pattern · SLA-Trend</div>
          </div>
        </div>
      )}
    </div>
  );
}
