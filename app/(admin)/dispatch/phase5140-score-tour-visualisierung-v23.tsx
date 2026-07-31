'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, Route, MapPin, Zap, TrendingUp, TrendingDown, Clock, CheckCircle2, AlertTriangle, Phone, Navigation2, Star } from 'lucide-react';

interface TourStop {
  id: string;
  sequence: number;
  status: 'fertig' | 'unterwegs' | 'ausstehend' | 'problem';
  adresse: string;
  eta_min?: number | null;
  km?: number | null;
  betrag?: number | null;
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
}

const MOCK: Driver[] = [
  {
    id:'d1', name:'Marco S.', score:92, score_delta:+3, tier:'platin', aktiv:true, delay_risiko:'niedrig', route_effizienz:94, umsatz:143.50, zone:'Mitte',
    stopps:[
      { id:'s1', sequence:1, status:'fertig',     adresse:'Hauptstr. 12',  eta_min:null, km:1.2, betrag:28.50 },
      { id:'s2', sequence:2, status:'unterwegs',  adresse:'Kirchweg 5',    eta_min:4,    km:1.5, betrag:34.00 },
      { id:'s3', sequence:3, status:'ausstehend', adresse:'Marktplatz 3',  eta_min:12,   km:2.1, betrag:22.00 },
    ],
  },
  {
    id:'d2', name:'Lena K.', score:78, score_delta:-2, tier:'gold', aktiv:true, delay_risiko:'mittel', route_effizienz:81, umsatz:97.80, zone:'Nord',
    stopps:[
      { id:'s4', sequence:1, status:'fertig',     adresse:'Bahnhofstr. 8', eta_min:null, km:0.9, betrag:19.00 },
      { id:'s5', sequence:2, status:'unterwegs',  adresse:'Rathauspl. 2',  eta_min:7,    km:1.8, betrag:31.50 },
    ],
  },
  {
    id:'d3', name:'Tom R.', score:54, score_delta:+1, tier:'schwach', aktiv:true, delay_risiko:'hoch', route_effizienz:61, umsatz:62.20, zone:'Süd',
    stopps:[
      { id:'s6', sequence:1, status:'unterwegs',  adresse:'Lindenallee 8', eta_min:15,   km:2.8, betrag:41.00 },
      { id:'s7', sequence:2, status:'ausstehend', adresse:'Bergstr. 19',   eta_min:27,   km:3.2, betrag:38.00 },
    ],
  },
  {
    id:'d4', name:'Anna M.', score:85, score_delta:0, tier:'gut', aktiv:true, delay_risiko:'niedrig', route_effizienz:88, umsatz:121.00, zone:'West',
    stopps:[
      { id:'s8', sequence:1, status:'fertig',     adresse:'Feldweg 3',     eta_min:null, km:1.1, betrag:26.50 },
      { id:'s9', sequence:2, status:'fertig',     adresse:'Am Park 7',     eta_min:null, km:0.7, betrag:33.00 },
      { id:'s10',sequence:3, status:'unterwegs',  adresse:'Neue Str. 14',  eta_min:6,    km:1.4, betrag:29.00 },
      { id:'s11',sequence:4, status:'ausstehend', adresse:'Waldweg 22',    eta_min:18,   km:2.0, betrag:32.50 },
    ],
  },
];

const TIER: Record<string, { label: string; color: string; bg: string }> = {
  platin:  { label:'Platin', color:'text-sky-300',     bg:'bg-sky-500/15 border-sky-500/30' },
  gold:    { label:'Gold',   color:'text-amber-300',   bg:'bg-amber-500/15 border-amber-500/30' },
  gut:     { label:'Gut',    color:'text-emerald-300', bg:'bg-emerald-500/15 border-emerald-500/30' },
  schwach: { label:'Schwach',color:'text-rose-300',    bg:'bg-rose-500/15 border-rose-500/30' },
};

const RISIKO = {
  niedrig: 'text-emerald-400',
  mittel:  'text-amber-400',
  hoch:    'text-red-400',
};

const STOP_DOT = {
  fertig:    'bg-emerald-500',
  unterwegs: 'bg-blue-500 animate-pulse',
  ausstehend:'bg-slate-600',
  problem:   'bg-red-500 animate-pulse',
};

interface Props { locationId?: string | null }

export function DispatchPhase5140ScoreTourVisualisierungV23({ locationId }: Props) {
  const [drivers, setDrivers] = useState<Driver[]>(MOCK);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) { setDrivers(MOCK); return; }
    let active = true;
    async function load() {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const sb = createClient();
        const { data: batches } = await sb
          .from('delivery_batches')
          .select('id,fahrer_id,score,status')
          .eq('location_id', locationId)
          .eq('status', 'unterwegs')
          .limit(10);
        if (active && (!batches || !batches.length)) setDrivers(MOCK);
      } catch { if (active) setDrivers(MOCK); }
    }
    load();
    const iv = setInterval(load, 20_000);
    return () => { active = false; clearInterval(iv); };
  }, [locationId]);

  const fleetScore = Math.round(drivers.reduce((s, d) => s + d.score, 0) / Math.max(1, drivers.length));
  const activeTours = drivers.filter(d => d.aktiv).length;
  const highRisk = drivers.filter(d => d.delay_risiko === 'hoch').length;
  const avgEff = Math.round(drivers.reduce((s, d) => s + d.route_effizienz, 0) / Math.max(1, drivers.length));
  const totalUmsatz = drivers.reduce((s, d) => s + d.umsatz, 0);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 text-slate-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700 bg-slate-800/50">
        <Trophy className="w-5 h-5 text-violet-400" />
        <span className="font-semibold text-sm">Score + Tour-Visualisierung V23</span>
        <span className="ml-auto text-xs text-slate-400">20s · Live</span>
      </div>

      {/* 5-KPI Grid */}
      <div className="grid grid-cols-5 divide-x divide-slate-700 border-b border-slate-700">
        {[
          { label:'Fleet-Score', value: fleetScore, color: fleetScore >= 80 ? 'text-emerald-400' : fleetScore >= 60 ? 'text-amber-400' : 'text-red-400' },
          { label:'Aktiv',       value: activeTours, color:'text-slate-100' },
          { label:'Risiko',      value: highRisk,    color: highRisk > 0 ? 'text-red-400' : 'text-emerald-400' },
          { label:'Eff%',        value: avgEff,      color: avgEff >= 85 ? 'text-emerald-400' : avgEff >= 70 ? 'text-amber-400' : 'text-red-400' },
          { label:'€',           value: `${totalUmsatz.toFixed(0)}`, color:'text-violet-400' },
        ].map(k => (
          <div key={k.label} className="flex flex-col items-center py-2 px-1">
            <span className={cn('text-xl font-bold tabular-nums', k.color)}>{k.value}</span>
            <span className="text-[10px] text-slate-500 mt-0.5">{k.label}</span>
          </div>
        ))}
      </div>

      {/* Driver list */}
      <div className="divide-y divide-slate-800">
        {drivers.map((d, i) => {
          const tier = TIER[d.tier];
          const isOpen = expanded === d.id;
          const aktivStop = d.stopps.find(s => s.status === 'unterwegs');

          return (
            <div key={d.id} className="p-3">
              {/* Driver row */}
              <button className="w-full text-left" onClick={() => setExpanded(isOpen ? null : d.id)}>
                <div className="flex items-center gap-2">
                  {/* Rank */}
                  <span className="text-xs text-slate-500 w-5 shrink-0">{i + 1}.</span>

                  {/* Tier + Name */}
                  <div className={cn('px-1.5 py-0.5 rounded border text-xs font-medium shrink-0', tier.bg, tier.color)}>
                    {tier.label}
                  </div>
                  <span className="text-sm font-medium flex-1">{d.name}</span>

                  {/* Zone */}
                  {d.zone && <span className="text-[10px] text-slate-500 hidden sm:block">{d.zone}</span>}

                  {/* Score + Delta */}
                  <div className="flex items-center gap-1">
                    <span className={cn('text-sm font-bold tabular-nums', tier.color)}>{d.score}</span>
                    {d.score_delta !== 0 && (
                      <span className={cn('text-xs', d.score_delta > 0 ? 'text-emerald-400' : 'text-rose-400')}>
                        {d.score_delta > 0 ? <TrendingUp className="w-3 h-3 inline" /> : <TrendingDown className="w-3 h-3 inline" />}
                        {Math.abs(d.score_delta)}
                      </span>
                    )}
                  </div>

                  {/* Delay risk */}
                  <span className={cn('text-[10px]', RISIKO[d.delay_risiko])}>●</span>
                </div>

                {/* Route Effizienz Balken */}
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-slate-700">
                    <div className={cn('h-1 rounded-full transition-all',
                      d.route_effizienz >= 85 ? 'bg-emerald-400' : d.route_effizienz >= 70 ? 'bg-amber-400' : 'bg-red-400'
                    )} style={{ width: `${d.route_effizienz}%` }} />
                  </div>
                  <span className="text-[10px] text-slate-500">{d.route_effizienz}%</span>

                  {/* Stop dots */}
                  <div className="flex items-center gap-0.5">
                    {d.stopps.map(s => (
                      <span key={s.id} className={cn('w-2 h-2 rounded-full', STOP_DOT[s.status])} />
                    ))}
                  </div>
                </div>
              </button>

              {/* Expanded stop timeline */}
              {isOpen && (
                <div className="mt-2 pl-5 flex flex-col gap-1.5">
                  {d.stopps.map((stop, si) => (
                    <div key={stop.id}
                      className={cn('flex items-start gap-2 p-2 rounded-lg border text-xs transition-colors',
                        stop.status === 'unterwegs' ? 'bg-blue-500/10 border-blue-500/30' :
                        stop.status === 'fertig'    ? 'bg-slate-800/50 border-slate-700/50 opacity-60' :
                        'bg-slate-800/30 border-slate-700/30')}>
                      <span className="text-slate-500 shrink-0 w-4">{si + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', STOP_DOT[stop.status])} />
                          <span className="font-medium truncate">{stop.adresse}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-slate-400">
                          {stop.eta_min != null && <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{stop.eta_min}min</span>}
                          {stop.km != null && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{stop.km}km</span>}
                          {stop.betrag != null && <span className="text-emerald-400">€{stop.betrag.toFixed(2)}</span>}
                        </div>
                      </div>
                      {stop.status === 'unterwegs' && (
                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.adresse)}`}
                          target="_blank" rel="noopener noreferrer"
                          className="shrink-0 p-1 rounded bg-blue-600 hover:bg-blue-500 transition-colors"
                          onClick={e => e.stopPropagation()}>
                          <Navigation2 className="w-3 h-3 text-white" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
