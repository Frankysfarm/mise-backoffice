'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Trophy, Route, MapPin, Zap, TrendingUp, TrendingDown,
  Clock, CheckCircle2, AlertTriangle, Navigation2, Activity,
  ChevronDown, ChevronUp, Star, Banknote, Users, CircleDot, Shield,
} from 'lucide-react';

// Phase 5163 — Score + Tour-Visualisierung V26
// 8-KPI-Grid Fleet-Score/Aktiv/Risiko/Eff%/★/€Stopp/€gesamt/Zonen;
// 3-Tab-Nav Rangliste/Fleet/Zonen-Profit;
// Zonen-Profitabilitäts-Overlay mit SLA+Fahrer+Umsatz;
// Fahrer-Tier-Fortschrittsbalken zum nächsten Tier;
// Route-Deviation-Alert Badge;
// 20-Sek-Polling; Mock-Fallback

interface TourStop {
  id: string;
  sequence: number;
  status: 'fertig' | 'unterwegs' | 'ausstehend' | 'problem';
  adresse: string;
  eta_min?: number | null;
  km?: number | null;
  betrag?: number | null;
  zone?: string | null;
}

interface Driver {
  id: string;
  name: string;
  score: number;
  score_delta: number;
  tier: 'platin' | 'gold' | 'gut' | 'schwach';
  tier_pct: number;
  aktiv: boolean;
  delay_risiko: 'niedrig' | 'mittel' | 'hoch';
  stopps: TourStop[];
  route_effizienz: number;
  umsatz: number;
  zone?: string | null;
  bewertung?: number | null;
  profit_per_stopp?: number | null;
  route_abweichung?: boolean;
}

interface ZoneProfit {
  name: string;
  sla_pct: number;
  fahrer_count: number;
  umsatz: number;
  profit_index: number;
}

const ZONES: ZoneProfit[] = [
  { name: 'Mitte',  sla_pct: 94, fahrer_count: 3, umsatz: 312.80, profit_index: 0.91 },
  { name: 'Nord',   sla_pct: 88, fahrer_count: 2, umsatz: 198.50, profit_index: 0.76 },
  { name: 'Süd',    sla_pct: 71, fahrer_count: 1, umsatz: 89.20,  profit_index: 0.52 },
  { name: 'Ost',    sla_pct: 83, fahrer_count: 2, umsatz: 145.60, profit_index: 0.68 },
];

const MOCK: Driver[] = [
  {
    id:'d1', name:'Marco S.', score:94, score_delta:+3, tier:'platin', tier_pct:88, aktiv:true, delay_risiko:'niedrig', route_effizienz:95, umsatz:158.50, zone:'Mitte', bewertung:4.9, profit_per_stopp:39.6, route_abweichung:false,
    stopps:[
      { id:'s1', sequence:1, status:'fertig',     adresse:'Hauptstr. 12',  eta_min:null, km:1.2, betrag:28.50, zone:'Mitte' },
      { id:'s2', sequence:2, status:'fertig',     adresse:'Kirchweg 5',    eta_min:null, km:1.5, betrag:34.00, zone:'Mitte' },
      { id:'s3', sequence:3, status:'unterwegs',  adresse:'Marktplatz 3',  eta_min:4,    km:2.1, betrag:22.00, zone:'Mitte' },
      { id:'s4', sequence:4, status:'ausstehend', adresse:'Ringstr. 9',    eta_min:14,   km:1.8, betrag:38.00, zone:'Mitte' },
    ],
  },
  {
    id:'d2', name:'Lena K.', score:81, score_delta:-1, tier:'gold', tier_pct:52, aktiv:true, delay_risiko:'mittel', route_effizienz:83, umsatz:112.80, zone:'Nord', bewertung:4.6, profit_per_stopp:37.6, route_abweichung:true,
    stopps:[
      { id:'s5', sequence:1, status:'fertig',     adresse:'Bahnhofstr. 8', eta_min:null, km:0.9, betrag:19.00, zone:'Nord' },
      { id:'s6', sequence:2, status:'unterwegs',  adresse:'Rathauspl. 2',  eta_min:7,    km:1.8, betrag:31.50, zone:'Nord' },
      { id:'s7', sequence:3, status:'ausstehend', adresse:'Nordring 15',   eta_min:18,   km:2.3, betrag:29.00, zone:'Nord' },
    ],
  },
  {
    id:'d3', name:'Tom R.', score:52, score_delta:+2, tier:'schwach', tier_pct:22, aktiv:true, delay_risiko:'hoch', route_effizienz:58, umsatz:67.20, zone:'Süd', bewertung:3.9, profit_per_stopp:33.6, route_abweichung:false,
    stopps:[
      { id:'s8', sequence:1, status:'unterwegs',  adresse:'Lindenallee 8', eta_min:15,   km:2.8, betrag:41.00, zone:'Süd' },
      { id:'s9', sequence:2, status:'ausstehend', adresse:'Bergstr. 19',   eta_min:27,   km:3.2, betrag:38.00, zone:'Süd' },
    ],
  },
];

const TIER_COLORS: Record<string, { bg: string; text: string; bar: string; next: string }> = {
  platin: { bg: 'bg-slate-400/20', text: 'text-slate-200', bar: 'bg-slate-300', next: 'Max' },
  gold:   { bg: 'bg-yellow-400/20', text: 'text-yellow-300', bar: 'bg-yellow-400', next: 'Platin' },
  gut:    { bg: 'bg-emerald-500/20', text: 'text-emerald-300', bar: 'bg-emerald-400', next: 'Gold' },
  schwach:{ bg: 'bg-red-500/15', text: 'text-red-300', bar: 'bg-red-400', next: 'Gut' },
};

const RISIKO_COLORS: Record<string, string> = {
  niedrig: 'text-emerald-400',
  mittel: 'text-amber-400',
  hoch: 'text-red-400',
};

function stopColor(s: TourStop['status']) {
  if (s === 'fertig') return 'bg-emerald-500';
  if (s === 'unterwegs') return 'bg-blue-500 animate-pulse';
  if (s === 'problem') return 'bg-red-500';
  return 'bg-slate-600';
}

function KpiBox({ label, val, sub, icon, hi }: { label: string; val: string | number; sub?: string; icon: React.ReactNode; hi?: boolean }) {
  return (
    <div className={cn('rounded-xl px-2.5 py-2 border flex flex-col gap-0.5', hi ? 'border-purple-700/40 bg-purple-900/20' : 'border-slate-700/40 bg-slate-800/30')}>
      <div className="flex items-center gap-1 text-[10px] text-gray-400">{icon}{label}</div>
      <div className="text-sm font-bold text-white leading-tight">{val}</div>
      {sub && <div className="text-[10px] text-gray-500">{sub}</div>}
    </div>
  );
}

export function DispatchPhase5163ScoreTourVisualisierungV26() {
  const [drivers, setDrivers] = useState<Driver[]>(MOCK);
  const [tab, setTab] = useState<'rangliste' | 'fleet' | 'zonen'>('rangliste');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [useMock, setUseMock] = useState(false);

  async function load() {
    try {
      const res = await fetch('/api/delivery/dispatch/tour-score-visualisierung');
      if (!res.ok) { setUseMock(true); return; }
      const d = await res.json();
      if (d.drivers?.length) { setDrivers(d.drivers); setUseMock(false); }
      else setUseMock(true);
    } catch { setUseMock(true); }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, []);

  const aktiv = drivers.filter(d => d.aktiv);
  const fleetScore = aktiv.length ? Math.round(aktiv.reduce((s, d) => s + d.score, 0) / aktiv.length) : 0;
  const risikoHoch = aktiv.filter(d => d.delay_risiko === 'hoch').length;
  const avgEff = aktiv.length ? Math.round(aktiv.reduce((s, d) => s + d.route_effizienz, 0) / aktiv.length) : 0;
  const avgRating = aktiv.length ? (aktiv.reduce((s, d) => s + (d.bewertung ?? 0), 0) / aktiv.length).toFixed(1) : '–';
  const avgPps = aktiv.length ? (aktiv.reduce((s, d) => s + (d.profit_per_stopp ?? 0), 0) / aktiv.length).toFixed(2) : '–';
  const gesamtUmsatz = aktiv.reduce((s, d) => s + d.umsatz, 0).toFixed(2);
  const zoneCount = new Set(aktiv.map(d => d.zone).filter(Boolean)).size;
  const abweichend = aktiv.filter(d => d.route_abweichung).length;

  const toggle = (id: string) => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="rounded-2xl border border-purple-700/40 bg-purple-950/30 overflow-hidden mb-4">
      {/* Header */}
      <div className="px-4 py-3 border-b border-purple-700/30 bg-purple-900/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-semibold text-purple-200">Score + Tour-Visualisierung V26</span>
          {useMock && <span className="text-[10px] text-gray-500 bg-slate-800 px-1.5 rounded">Mock</span>}
        </div>
        <div className="flex items-center gap-2">
          {abweichend > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-amber-300 bg-amber-900/30 px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" />{abweichend} Abweichung
            </span>
          )}
          {risikoHoch > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-red-300 bg-red-900/30 px-2 py-0.5 rounded-full">
              <Shield className="w-3 h-3" />{risikoHoch} Hochrisiko
            </span>
          )}
        </div>
      </div>

      {/* 8-KPI-Grid */}
      <div className="px-4 py-3 grid grid-cols-4 gap-2 border-b border-purple-700/20">
        <KpiBox label="Fleet-Score" val={fleetScore} sub="/100" icon={<Trophy className="w-3 h-3 text-purple-400" />} hi />
        <KpiBox label="Aktiv" val={aktiv.length} icon={<Users className="w-3 h-3" />} />
        <KpiBox label="Risiko" val={risikoHoch} icon={<Shield className="w-3 h-3 text-red-400" />} />
        <KpiBox label="Effizienz" val={`${avgEff}%`} icon={<Route className="w-3 h-3 text-emerald-400" />} />
        <KpiBox label="Bewertung" val={`${avgRating}★`} icon={<Star className="w-3 h-3 text-amber-400" />} />
        <KpiBox label="€/Stopp" val={`${avgPps}`} icon={<Banknote className="w-3 h-3 text-teal-400" />} />
        <KpiBox label="€ gesamt" val={gesamtUmsatz} icon={<Zap className="w-3 h-3 text-violet-400" />} />
        <KpiBox label="Zonen" val={zoneCount} icon={<MapPin className="w-3 h-3 text-blue-400" />} />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-purple-700/20">
        {(['rangliste', 'fleet', 'zonen'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={cn('flex-1 py-1.5 text-xs font-medium transition-colors', tab === t ? 'text-purple-300 border-b-2 border-purple-400 bg-purple-900/20' : 'text-gray-500 hover:text-gray-300')}>
            {t === 'rangliste' ? 'Rangliste' : t === 'fleet' ? 'Fleet' : 'Zonen-Profit'}
          </button>
        ))}
      </div>

      {/* Rangliste */}
      {tab === 'rangliste' && (
        <div className="divide-y divide-slate-700/30">
          {[...drivers].sort((a, b) => b.score - a.score).map((d, i) => {
            const tc = TIER_COLORS[d.tier];
            const isOpen = expanded.has(d.id);
            return (
              <div key={d.id}>
                <button className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-800/30 transition-colors text-left" onClick={() => toggle(d.id)}>
                  <span className="text-sm font-bold text-gray-500 w-5">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white truncate">{d.name}</span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', tc.bg, tc.text)}>{d.tier}</span>
                      {d.route_abweichung && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                    {/* Score Bar */}
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all', tc.bar)} style={{ width: `${d.score}%` }} />
                      </div>
                      <span className="text-xs font-bold text-white tabular-nums">{d.score}</span>
                      {d.score_delta !== 0 && (
                        <span className={cn('text-[10px] flex items-center', d.score_delta > 0 ? 'text-emerald-400' : 'text-red-400')}>
                          {d.score_delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {Math.abs(d.score_delta)}
                        </span>
                      )}
                    </div>
                    {/* Tier Progress */}
                    <div className="flex items-center gap-1 mt-1">
                      <div className="text-[9px] text-gray-600">→ {tc.next}</div>
                      <div className="flex-1 h-0.5 rounded-full bg-slate-700/50 overflow-hidden">
                        <div className={cn('h-full rounded-full', tc.bar, 'opacity-50')} style={{ width: `${d.tier_pct}%` }} />
                      </div>
                      <div className="text-[9px] text-gray-600">{d.tier_pct}%</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={cn('text-[10px] font-medium', RISIKO_COLORS[d.delay_risiko])}>{d.delay_risiko}</span>
                    <span className="text-[10px] text-gray-500">{d.bewertung != null ? `${d.bewertung}★` : '–'}</span>
                    {isOpen ? <ChevronUp className="w-3 h-3 text-gray-500" /> : <ChevronDown className="w-3 h-3 text-gray-500" />}
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-3 bg-slate-800/20">
                    <div className="text-[10px] text-gray-500 mb-2">Tour-Stopps</div>
                    <div className="flex items-center gap-1 mb-2">
                      {d.stopps.map(s => (
                        <div key={s.id} className={cn('w-3 h-3 rounded-full', stopColor(s.status))} title={s.adresse} />
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      {d.stopps.map(s => (
                        <div key={s.id} className="flex items-start gap-2 text-xs">
                          <span className="text-gray-600 w-4 tabular-nums">{s.sequence}.</span>
                          <span className="flex-1 text-gray-300 truncate">{s.adresse}</span>
                          {s.eta_min != null && <span className="text-blue-400 tabular-nums shrink-0">{s.eta_min}min</span>}
                          {s.betrag != null && <span className="text-emerald-400 tabular-nums shrink-0">{s.betrag.toFixed(2)}€</span>}
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-700/30 flex items-center justify-between text-[10px] text-gray-500">
                      <span>Effizienz: <span className="text-white">{d.route_effizienz}%</span></span>
                      <span>Umsatz: <span className="text-emerald-300">{d.umsatz.toFixed(2)}€</span></span>
                      <span>€/Stopp: <span className="text-teal-300">{d.profit_per_stopp?.toFixed(2)}€</span></span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Fleet */}
      {tab === 'fleet' && (
        <div className="px-4 py-3">
          <div className="grid grid-cols-2 gap-3">
            {drivers.map(d => {
              const tc = TIER_COLORS[d.tier];
              const fertigStopps = d.stopps.filter(s => s.status === 'fertig').length;
              return (
                <div key={d.id} className={cn('rounded-xl border p-3', d.aktiv ? 'border-slate-600/50 bg-slate-800/20' : 'border-slate-700/30 bg-slate-800/10 opacity-50')}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-white truncate">{d.name}</span>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', tc.bg, tc.text)}>{d.score}</span>
                  </div>
                  <div className="flex gap-1 mb-1">
                    {d.stopps.map(s => <div key={s.id} className={cn('w-2.5 h-2.5 rounded-full', stopColor(s.status))} />)}
                  </div>
                  <div className="text-[10px] text-gray-500">{fertigStopps}/{d.stopps.length} Stopps · {d.route_effizienz}% Eff.</div>
                  {d.route_abweichung && <div className="text-[10px] text-amber-400 flex items-center gap-0.5 mt-1"><AlertTriangle className="w-2.5 h-2.5" />Route-Abweichung</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Zonen-Profit */}
      {tab === 'zonen' && (
        <div className="px-4 py-3 space-y-3">
          {ZONES.map(z => {
            const profitColor = z.profit_index >= 0.8 ? 'text-emerald-400' : z.profit_index >= 0.6 ? 'text-amber-400' : 'text-red-400';
            const barColor = z.profit_index >= 0.8 ? 'bg-emerald-400' : z.profit_index >= 0.6 ? 'bg-amber-400' : 'bg-red-400';
            return (
              <div key={z.name} className="rounded-xl border border-slate-700/40 bg-slate-800/20 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-sm font-semibold text-white">{z.name}</span>
                  </div>
                  <span className={cn('text-sm font-bold', profitColor)}>{Math.round(z.profit_index * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden mb-2">
                  <div className={cn('h-full rounded-full', barColor)} style={{ width: `${z.profit_index * 100}%` }} />
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-500">
                  <span>SLA: <span className="text-white">{z.sla_pct}%</span></span>
                  <span>Fahrer: <span className="text-white">{z.fahrer_count}</span></span>
                  <span>Umsatz: <span className="text-emerald-300">{z.umsatz.toFixed(2)}€</span></span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
