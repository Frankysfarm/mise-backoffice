'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Trophy, Route, MapPin, Zap, TrendingUp, TrendingDown,
  Clock, CheckCircle2, AlertTriangle, Navigation2, Activity,
  ChevronDown, ChevronUp, Star, Banknote, Users, CircleDot,
} from 'lucide-react';

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
  aktiv: boolean;
  delay_risiko: 'niedrig' | 'mittel' | 'hoch';
  stopps: TourStop[];
  route_effizienz: number;
  umsatz: number;
  zone?: string | null;
  bewertung?: number | null;
  profit_per_stopp?: number | null;
}

const MOCK: Driver[] = [
  {
    id:'d1', name:'Marco S.', score:94, score_delta:+3, tier:'platin', aktiv:true, delay_risiko:'niedrig', route_effizienz:95, umsatz:158.50, zone:'Mitte', bewertung:4.9, profit_per_stopp:39.6,
    stopps:[
      { id:'s1', sequence:1, status:'fertig',     adresse:'Hauptstr. 12',  eta_min:null, km:1.2, betrag:28.50, zone:'Mitte' },
      { id:'s2', sequence:2, status:'fertig',     adresse:'Kirchweg 5',    eta_min:null, km:1.5, betrag:34.00, zone:'Mitte' },
      { id:'s3', sequence:3, status:'unterwegs',  adresse:'Marktplatz 3',  eta_min:4,    km:2.1, betrag:22.00, zone:'Mitte' },
      { id:'s4', sequence:4, status:'ausstehend', adresse:'Ringstr. 9',    eta_min:14,   km:1.8, betrag:38.00, zone:'Mitte' },
    ],
  },
  {
    id:'d2', name:'Lena K.', score:81, score_delta:-1, tier:'gold', aktiv:true, delay_risiko:'mittel', route_effizienz:83, umsatz:112.80, zone:'Nord', bewertung:4.6, profit_per_stopp:37.6,
    stopps:[
      { id:'s5', sequence:1, status:'fertig',     adresse:'Bahnhofstr. 8', eta_min:null, km:0.9, betrag:19.00, zone:'Nord' },
      { id:'s6', sequence:2, status:'unterwegs',  adresse:'Rathauspl. 2',  eta_min:7,    km:1.8, betrag:31.50, zone:'Nord' },
      { id:'s7', sequence:3, status:'ausstehend', adresse:'Nordring 15',   eta_min:18,   km:2.3, betrag:29.00, zone:'Nord' },
    ],
  },
  {
    id:'d3', name:'Tom R.', score:52, score_delta:+2, tier:'schwach', aktiv:true, delay_risiko:'hoch', route_effizienz:58, umsatz:67.20, zone:'Süd', bewertung:3.9, profit_per_stopp:33.6,
    stopps:[
      { id:'s8', sequence:1, status:'unterwegs',  adresse:'Lindenallee 8', eta_min:15,   km:2.8, betrag:41.00, zone:'Süd' },
      { id:'s9', sequence:2, status:'ausstehend', adresse:'Bergstr. 19',   eta_min:27,   km:3.2, betrag:38.00, zone:'Süd' },
    ],
  },
  {
    id:'d4', name:'Anna M.', score:87, score_delta:+1, tier:'gut', aktiv:true, delay_risiko:'niedrig', route_effizienz:89, umsatz:134.00, zone:'West', bewertung:4.7, profit_per_stopp:26.8,
    stopps:[
      { id:'s10', sequence:1, status:'fertig',     adresse:'Feldweg 3',     eta_min:null, km:1.1, betrag:26.50, zone:'West' },
      { id:'s11', sequence:2, status:'fertig',     adresse:'Am Park 7',     eta_min:null, km:0.7, betrag:33.00, zone:'West' },
      { id:'s12', sequence:3, status:'unterwegs',  adresse:'Neue Str. 14',  eta_min:6,    km:1.4, betrag:29.00, zone:'West' },
      { id:'s13', sequence:4, status:'ausstehend', adresse:'Waldweg 22',    eta_min:18,   km:2.0, betrag:32.50, zone:'West' },
      { id:'s14', sequence:5, status:'ausstehend', adresse:'Gartenweg 3',   eta_min:28,   km:1.6, betrag:13.00, zone:'West' },
    ],
  },
];

const TIER_STYLES = {
  platin: { bg: 'bg-violet-500/20', text: 'text-violet-200', border: 'border-violet-500/40', label: 'Platin', bar: 'bg-violet-400' },
  gold:   { bg: 'bg-amber-500/20',  text: 'text-amber-200',  border: 'border-amber-500/40',  label: 'Gold',   bar: 'bg-amber-400' },
  gut:    { bg: 'bg-emerald-500/20',text: 'text-emerald-200',border: 'border-emerald-500/40',label: 'Gut',    bar: 'bg-emerald-400' },
  schwach:{ bg: 'bg-slate-500/20',  text: 'text-slate-300',  border: 'border-slate-500/40',  label: 'Schwach',bar: 'bg-slate-500' },
};

const RISIKO_BADGE = {
  niedrig: 'bg-emerald-500/20 text-emerald-300',
  mittel:  'bg-amber-500/20 text-amber-300',
  hoch:    'bg-red-500/20 text-red-300',
};

const STOPP_DOT = {
  fertig:     'bg-emerald-500',
  unterwegs:  'bg-blue-400 animate-pulse',
  ausstehend: 'bg-slate-600',
  problem:    'bg-red-500',
};

const ZONE_COLORS: Record<string, string> = {
  Mitte: 'bg-violet-500/20 text-violet-300',
  Nord:  'bg-blue-500/20 text-blue-300',
  Süd:   'bg-amber-500/20 text-amber-300',
  West:  'bg-emerald-500/20 text-emerald-300',
  Ost:   'bg-rose-500/20 text-rose-300',
};

export function DispatchPhase5142ScoreTourVisualisierungV25() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tab, setTab] = useState<'ranking' | 'fleet' | 'zonen'>('ranking');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const sb = createClient();
        const { data: fahrerData } = await sb
          .from('delivery_drivers')
          .select('id,name,score,tier,aktiv,zone')
          .eq('aktiv', true)
          .limit(10);
        if (active && fahrerData && fahrerData.length) {
          setDrivers(fahrerData.map((d: Driver) => ({
            ...d,
            score_delta: 0,
            delay_risiko: 'niedrig',
            stopps: [],
            route_effizienz: 80,
            umsatz: 0,
            score: d.score ?? 70,
            profit_per_stopp: 0,
          })));
        } else if (active) {
          setDrivers(MOCK);
        }
        if (active) setLoading(false);
      } catch {
        if (active) { setDrivers(MOCK); setLoading(false); }
      }
    }
    load();
    const iv = setInterval(load, 20_000);
    return () => { active = false; clearInterval(iv); };
  }, []);

  const fleetScore = drivers.length ? Math.round(drivers.reduce((s, d) => s + d.score, 0) / drivers.length) : 0;
  const aktivCount = drivers.filter(d => d.aktiv).length;
  const highRisk = drivers.filter(d => d.delay_risiko === 'hoch').length;
  const avgEff = drivers.length ? Math.round(drivers.reduce((s, d) => s + d.route_effizienz, 0) / drivers.length) : 0;
  const gesamtUmsatz = drivers.reduce((s, d) => s + d.umsatz, 0);
  const avgBewertung = drivers.length ? (drivers.reduce((s, d) => s + (d.bewertung ?? 4.5), 0) / drivers.length).toFixed(1) : '—';
  const avgProfitPerStopp = drivers.length ? (drivers.reduce((s, d) => s + (d.profit_per_stopp ?? 0), 0) / drivers.length).toFixed(1) : '—';

  // Zone aggregation
  const zonenMap: Record<string, { fahrer: number; avgScore: number; totalUmsatz: number; risk: number }> = {};
  drivers.forEach(d => {
    const z = d.zone ?? 'Unbekannt';
    if (!zonenMap[z]) zonenMap[z] = { fahrer: 0, avgScore: 0, totalUmsatz: 0, risk: 0 };
    zonenMap[z].fahrer++;
    zonenMap[z].avgScore += d.score;
    zonenMap[z].totalUmsatz += d.umsatz;
    if (d.delay_risiko === 'hoch') zonenMap[z].risk++;
  });
  const zonen = Object.entries(zonenMap).map(([name, z]) => ({
    name,
    fahrer: z.fahrer,
    avgScore: Math.round(z.avgScore / z.fahrer),
    totalUmsatz: z.totalUmsatz,
    risk: z.risk,
  })).sort((a, b) => b.avgScore - a.avgScore);

  if (loading) return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-400 text-sm">Lade Flotte…</div>
  );

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 text-slate-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700 bg-slate-800/60">
        <Trophy className="w-5 h-5 text-violet-400" />
        <div>
          <span className="font-semibold text-sm">Score + Tour-Visualisierung V25</span>
          <span className="ml-2 text-[10px] text-slate-500">Fleet · Zonen-Kapazität · Profit/Stopp</span>
        </div>
        <span className="ml-auto text-xs text-slate-500">20s</span>
      </div>

      {/* 7-KPI-Grid */}
      <div className="grid grid-cols-7 divide-x divide-slate-700 border-b border-slate-700">
        {[
          { label: 'Fleet-Score', value: fleetScore,       color: fleetScore >= 80 ? 'text-emerald-400' : fleetScore >= 60 ? 'text-amber-400' : 'text-red-400' },
          { label: 'Aktiv',       value: aktivCount,        color: 'text-slate-100' },
          { label: 'Risiko',      value: highRisk,          color: highRisk > 0 ? 'text-red-400' : 'text-slate-100' },
          { label: 'Eff%',        value: `${avgEff}%`,      color: avgEff >= 85 ? 'text-emerald-400' : avgEff >= 70 ? 'text-amber-400' : 'text-red-400' },
          { label: '★',           value: avgBewertung,      color: parseFloat(String(avgBewertung)) >= 4.5 ? 'text-amber-400' : 'text-slate-300' },
          { label: '€/Stopp',     value: avgProfitPerStopp, color: 'text-teal-400' },
          { label: '€ gesamt',    value: `${gesamtUmsatz.toFixed(0)}`, color: 'text-emerald-400' },
        ].map(k => (
          <div key={k.label} className="flex flex-col items-center py-2 px-0.5">
            <span className={cn('text-base font-bold tabular-nums', k.color)}>{k.value}</span>
            <span className="text-[8px] text-slate-500 mt-0.5 text-center leading-tight">{k.label}</span>
          </div>
        ))}
      </div>

      {/* High-Risk Alert */}
      {highRisk > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-red-300 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span><strong>{highRisk} Fahrer</strong> mit hohem Verzögerungsrisiko — Eingriff empfohlen</span>
        </div>
      )}

      {/* Tab Nav */}
      <div className="flex border-b border-slate-700">
        {(['ranking', 'fleet', 'zonen'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('flex-1 py-2 text-xs font-medium transition-colors',
              tab === t ? 'text-violet-400 border-b-2 border-violet-400 bg-slate-800/30' : 'text-slate-500 hover:text-slate-300')}>
            {t === 'ranking' ? 'Rangliste' : t === 'fleet' ? 'Fleet' : 'Zonen'}
          </button>
        ))}
      </div>

      {tab === 'ranking' && (
        <div className="divide-y divide-slate-700/50">
          {[...drivers].sort((a, b) => b.score - a.score).map((d, i) => {
            const ts = TIER_STYLES[d.tier];
            const isOpen = expanded === d.id;
            const aktivStopps = d.stopps.filter(s => s.status === 'unterwegs' || s.status === 'ausstehend');
            const fertigCount = d.stopps.filter(s => s.status === 'fertig').length;

            return (
              <div key={d.id}>
                <button
                  className="w-full text-left px-4 py-3 hover:bg-slate-800/40 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : d.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold w-5 text-center text-slate-400">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold truncate">{d.name}</span>
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', ts.bg, ts.text)}>{ts.label}</span>
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded', RISIKO_BADGE[d.delay_risiko])}>
                          {d.delay_risiko}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-700">
                          <div className={cn('h-1.5 rounded-full', ts.bar)} style={{ width: `${d.route_effizienz}%` }} />
                        </div>
                        <span className="text-[10px] text-slate-500 w-10 text-right">{d.route_effizienz}% Eff</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <div className="flex items-center gap-1">
                        <span className="text-lg font-bold tabular-nums">{d.score}</span>
                        {d.score_delta > 0
                          ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                          : d.score_delta < 0
                            ? <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                            : null}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-amber-400">
                        <Star className="w-2.5 h-2.5" />
                        <span>{d.bewertung?.toFixed(1) ?? '—'}</span>
                      </div>
                      {d.profit_per_stopp != null && d.profit_per_stopp > 0 && (
                        <div className="text-[10px] text-teal-400">{d.profit_per_stopp.toFixed(1)}€/Stopp</div>
                      )}
                    </div>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </div>

                  <div className="flex items-center gap-1 mt-2 pl-8">
                    {d.stopps.map((s, si) => (
                      <div key={s.id} className="flex items-center gap-0.5">
                        <div className={cn('w-2.5 h-2.5 rounded-full', STOPP_DOT[s.status])} />
                        {si < d.stopps.length - 1 && <div className="w-3 h-px bg-slate-600" />}
                      </div>
                    ))}
                    <span className="ml-1 text-[10px] text-slate-500">
                      {fertigCount}/{d.stopps.length} erledigt
                    </span>
                    {d.zone && (
                      <span className={cn('ml-1 text-[10px] px-1.5 py-0.5 rounded', ZONE_COLORS[d.zone] ?? 'bg-slate-700 text-slate-400')}>
                        {d.zone}
                      </span>
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="bg-slate-800/50 border-t border-slate-700/50 px-4 py-3 space-y-2">
                    {aktivStopps.map(s => (
                      <div key={s.id} className="flex items-center gap-3 text-xs">
                        <div className={cn('w-2 h-2 rounded-full shrink-0', STOPP_DOT[s.status])} />
                        <div className="flex-1 min-w-0">
                          <span className="text-slate-300 truncate block">{s.adresse}</span>
                        </div>
                        {s.eta_min != null && (
                          <span className="text-blue-300 flex items-center gap-0.5 shrink-0">
                            <Clock className="w-2.5 h-2.5" />{s.eta_min}m
                          </span>
                        )}
                        {s.km != null && <span className="text-slate-500 shrink-0">{s.km}km</span>}
                        {s.betrag != null && <span className="text-emerald-400 shrink-0">{s.betrag.toFixed(2)}€</span>}
                        <button className="text-blue-400 hover:text-blue-300 shrink-0" title="Navigieren">
                          <Navigation2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {aktivStopps.length === 0 && (
                      <div className="text-xs text-slate-500 text-center py-1">Alle Stopps erledigt</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'fleet' && (
        <div className="p-3 grid grid-cols-2 gap-2">
          {drivers.map(d => {
            const ts = TIER_STYLES[d.tier];
            const fertig = d.stopps.filter(s => s.status === 'fertig').length;
            const offen = d.stopps.filter(s => s.status !== 'fertig').length;
            return (
              <div key={d.id} className={cn('rounded-lg border p-2.5', ts.border, ts.bg)}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold truncate">{d.name}</span>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', ts.bg, ts.text)}>{ts.label}</span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-center mt-2">
                  <div>
                    <div className="text-base font-bold">{d.score}</div>
                    <div className="text-[9px] text-slate-500">Score</div>
                  </div>
                  <div>
                    <div className="text-base font-bold text-emerald-400">{fertig}</div>
                    <div className="text-[9px] text-slate-500">Fertig</div>
                  </div>
                  <div>
                    <div className="text-base font-bold text-amber-400">{offen}</div>
                    <div className="text-[9px] text-slate-500">Offen</div>
                  </div>
                </div>
                {d.zone && (
                  <div className={cn('mt-2 text-center text-[10px] px-1.5 py-0.5 rounded', ZONE_COLORS[d.zone] ?? 'bg-slate-700 text-slate-400')}>
                    {d.zone}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'zonen' && (
        <div className="p-3 space-y-2">
          {zonen.map(z => (
            <div key={z.name} className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CircleDot className="w-4 h-4 text-slate-400" />
                  <span className={cn('text-sm font-semibold px-2 py-0.5 rounded', ZONE_COLORS[z.name] ?? 'bg-slate-700 text-slate-300')}>
                    {z.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-slate-500"><Users className="w-3 h-3 inline mr-0.5" />{z.fahrer}</span>
                  {z.risk > 0 && <span className="text-red-400"><AlertTriangle className="w-3 h-3 inline mr-0.5" />{z.risk}</span>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className={cn('text-lg font-bold', z.avgScore >= 80 ? 'text-emerald-400' : z.avgScore >= 60 ? 'text-amber-400' : 'text-red-400')}>
                    {z.avgScore}
                  </div>
                  <div className="text-[9px] text-slate-500">Ø Score</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-teal-400">{z.fahrer}</div>
                  <div className="text-[9px] text-slate-500">Fahrer</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-emerald-400">{z.totalUmsatz.toFixed(0)}€</div>
                  <div className="text-[9px] text-slate-500">Umsatz</div>
                </div>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-slate-700">
                <div
                  className={cn('h-1.5 rounded-full transition-all', z.avgScore >= 80 ? 'bg-emerald-400' : z.avgScore >= 60 ? 'bg-amber-400' : 'bg-red-400')}
                  style={{ width: `${z.avgScore}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
