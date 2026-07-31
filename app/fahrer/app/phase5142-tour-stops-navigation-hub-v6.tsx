'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Route, Navigation2, Phone, Clock, MapPin, CheckCircle2, AlertTriangle,
  Banknote, CreditCard, Wifi, WifiOff, Package, ChevronDown, ChevronUp,
  Star, MessageSquare, TrendingUp, Zap, ExternalLink, Target, Activity,
} from 'lucide-react';

interface TourStop {
  id: string;
  sequence: number;
  status: 'fertig' | 'unterwegs' | 'ausstehend' | 'problem';
  kunde: string;
  adresse: string;
  eta_min?: number | null;
  km?: number | null;
  betrag?: number | null;
  zahlungsart: 'bar' | 'karte' | 'online';
  notiz?: string | null;
  prio: 'normal' | 'hoch' | 'express';
  telefon?: string | null;
  bewertung_ausstehend?: boolean;
  trinkgeld_prognose?: number | null;
}

interface TourData {
  tour_id: string;
  fahrer_name: string;
  stopps: TourStop[];
  eingenommen: number;
  trinkgeld: number;
  offen_count: number;
  restzeit_min: number;
  dispatch_nachricht?: string | null;
  verdienst_ziel?: number | null;
}

const MOCK: TourData = {
  tour_id: 'T-1071',
  fahrer_name: 'Du',
  eingenommen: 107.50,
  trinkgeld: 16.50,
  offen_count: 3,
  restzeit_min: 24,
  verdienst_ziel: 200,
  dispatch_nachricht: 'Zone Mitte stark nachgefragt — bitte schnell zurückfahren nach Lieferung!',
  stopps: [
    { id:'st1', sequence:1, status:'fertig',     kunde:'Familie Müller',  adresse:'Hauptstr. 12',    eta_min:null, km:1.2, betrag:28.50, zahlungsart:'online', prio:'normal',  bewertung_ausstehend:true, trinkgeld_prognose:3.50 },
    { id:'st2', sequence:2, status:'fertig',     kunde:'Schmidt Anna',    adresse:'Kirchweg 5',      eta_min:null, km:0.8, betrag:19.00, zahlungsart:'karte',  prio:'normal',  bewertung_ausstehend:false, trinkgeld_prognose:2.00 },
    { id:'st3', sequence:3, status:'unterwegs',  kunde:'Weber Gastro',    adresse:'Marktplatz 3',    eta_min:5,    km:1.5, betrag:34.00, zahlungsart:'bar',    prio:'express', notiz:'2. Etage, Klingel links', telefon:'+49 172 3456789', trinkgeld_prognose:4.50 },
    { id:'st4', sequence:4, status:'ausstehend', kunde:'Koch Familie',    adresse:'Lindenallee 8',   eta_min:15,   km:2.1, betrag:22.00, zahlungsart:'online', prio:'hoch',    notiz:'Bitte klingeln', trinkgeld_prognose:2.50 },
    { id:'st5', sequence:5, status:'ausstehend', kunde:'Bauer Thomas',    adresse:'Rathausstr. 21',  eta_min:23,   km:1.8, betrag:41.00, zahlungsart:'karte',  prio:'normal', trinkgeld_prognose:5.00 },
    { id:'st6', sequence:6, status:'ausstehend', kunde:'Fischer Hotel',   adresse:'Bahnhofstr. 44',  eta_min:32,   km:2.4, betrag:55.00, zahlungsart:'bar',    prio:'normal',  telefon:'+49 151 7654321', trinkgeld_prognose:6.50 },
  ],
};

const PRIO_BADGE: Record<string, string> = {
  express: 'bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
  hoch:    'bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
  normal:  '',
};

const ZAHLUNG_ICON: Record<string, React.ReactNode> = {
  bar:    <Banknote className="w-3 h-3 text-amber-400" />,
  karte:  <CreditCard className="w-3 h-3 text-blue-400" />,
  online: <Wifi className="w-3 h-3 text-emerald-400" />,
};

const STATUS_DOT: Record<string, string> = {
  fertig:     'bg-emerald-500',
  unterwegs:  'bg-blue-400 animate-pulse',
  ausstehend: 'bg-slate-600',
  problem:    'bg-red-500',
};

export function FahrerPhase5142TourStopsNavigationHubV6() {
  const [data, setData] = useState<TourData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tab, setTab] = useState<'stopps' | 'uebersicht'>('stopps');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) throw new Error('no user');
        const { data: tourData } = await sb
          .from('delivery_tours')
          .select('id,driver_id,status,stops')
          .eq('driver_id', user.id)
          .eq('status', 'aktiv')
          .maybeSingle();
        if (active) {
          setData(tourData ? { ...MOCK, tour_id: tourData.id } : MOCK);
          setLoading(false);
        }
      } catch {
        if (active) { setData(MOCK); setLoading(false); }
      }
    }
    load();
    const iv = setInterval(load, 30_000);
    return () => { active = false; clearInterval(iv); };
  }, []);

  if (loading || !data) return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-400 text-sm">Lade Tour…</div>
  );

  const fertig = data.stopps.filter(s => s.status === 'fertig').length;
  const offen = data.stopps.filter(s => s.status === 'ausstehend' || s.status === 'unterwegs').length;
  const fortschritt = Math.round((fertig / Math.max(1, data.stopps.length)) * 100);
  const gesamtBetrag = data.stopps.reduce((s, st) => s + (st.betrag ?? 0), 0);
  const trinkgeldPrognose = data.stopps.reduce((s, st) => s + (st.trinkgeld_prognose ?? 0), 0);
  const verdienstPct = data.verdienst_ziel ? Math.round((data.eingenommen / data.verdienst_ziel) * 100) : null;

  const naechsterStopp = data.stopps.find(s => s.status === 'unterwegs' || s.status === 'ausstehend');

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 text-slate-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700 bg-slate-800/60">
        <Route className="w-5 h-5 text-blue-400" />
        <div>
          <span className="font-semibold text-sm">Tour-Navigation V6</span>
          <span className="ml-2 text-[10px] text-slate-500">Stopps · Trinkgeld-Prognose · Verdienst-Ziel</span>
        </div>
        <span className="ml-auto text-xs text-slate-500 font-mono">{data.tour_id}</span>
      </div>

      {/* Fortschritts-Ring (simplified bar) + KPIs */}
      <div className="px-4 py-3 border-b border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-slate-500">Tour-Fortschritt</span>
          <span className="text-[11px] text-slate-400">{fertig}/{data.stopps.length} Stopps</span>
        </div>
        <div className="h-2.5 rounded-full bg-slate-700 mb-3">
          <div className="h-2.5 rounded-full bg-blue-500 transition-all" style={{ width: `${fortschritt}%` }} />
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-lg font-bold text-blue-400">{fertig}</div>
            <div className="text-[9px] text-slate-500">Fertig</div>
          </div>
          <div>
            <div className="text-lg font-bold text-amber-400">{offen}</div>
            <div className="text-[9px] text-slate-500">Offen</div>
          </div>
          <div>
            <div className="text-lg font-bold text-emerald-400">{data.eingenommen.toFixed(0)}€</div>
            <div className="text-[9px] text-slate-500">Eingenommen</div>
          </div>
          <div>
            <div className="text-lg font-bold text-amber-300">{trinkgeldPrognose.toFixed(0)}€</div>
            <div className="text-[9px] text-slate-500">Trinkgeld⌀</div>
          </div>
        </div>

        {/* Verdienst-Ziel */}
        {verdienstPct != null && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
              <span className="flex items-center gap-1"><Target className="w-3 h-3" /> Ziel: {data.verdienst_ziel}€</span>
              <span>{verdienstPct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-700">
              <div className={cn('h-1.5 rounded-full transition-all', verdienstPct >= 100 ? 'bg-emerald-400' : verdienstPct >= 70 ? 'bg-amber-400' : 'bg-blue-400')}
                   style={{ width: `${Math.min(100, verdienstPct)}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Dispatch-Nachricht */}
      {data.dispatch_nachricht && (
        <div className="flex items-start gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-xs">
          <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{data.dispatch_nachricht}</span>
        </div>
      )}

      {/* Tab Nav */}
      <div className="flex border-b border-slate-700">
        {(['stopps', 'uebersicht'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('flex-1 py-2 text-xs font-medium transition-colors',
              tab === t ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-800/30' : 'text-slate-500 hover:text-slate-300')}>
            {t === 'stopps' ? `Stopp-Liste (${data.stopps.length})` : 'Übersicht'}
          </button>
        ))}
      </div>

      {tab === 'stopps' && (
        <div className="divide-y divide-slate-700/40">
          {data.stopps.map(stopp => {
            const isOpen = expanded === stopp.id;
            const isNaechster = naechsterStopp?.id === stopp.id;

            return (
              <div key={stopp.id} className={cn(isNaechster && stopp.status !== 'fertig' ? 'bg-blue-500/5' : '')}>
                <button
                  className="w-full text-left px-4 py-3 hover:bg-slate-800/30 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : stopp.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <div className={cn('w-3 h-3 rounded-full', STATUS_DOT[stopp.status])} />
                      <span className="text-[10px] text-slate-500 font-mono">{stopp.sequence}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn('text-sm font-semibold truncate', stopp.status === 'fertig' ? 'text-slate-400 line-through' : 'text-slate-100')}>
                          {stopp.kunde}
                        </span>
                        {stopp.prio !== 'normal' && (
                          <span className={PRIO_BADGE[stopp.prio]}>{stopp.prio.toUpperCase()}</span>
                        )}
                        {isNaechster && stopp.status !== 'fertig' && (
                          <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded-full">Nächster</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500">
                        <MapPin className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{stopp.adresse}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0 gap-0.5">
                      {stopp.eta_min != null && (
                        <span className="text-xs text-blue-300 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />{stopp.eta_min}m
                        </span>
                      )}
                      {stopp.betrag != null && (
                        <span className="text-xs text-emerald-400 font-semibold">{stopp.betrag.toFixed(2)}€</span>
                      )}
                      <span>{ZAHLUNG_ICON[stopp.zahlungsart]}</span>
                    </div>

                    {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="bg-slate-800/50 border-t border-slate-700/50 px-4 py-3 space-y-2">
                    {stopp.notiz && (
                      <div className="flex items-start gap-2 text-xs text-amber-300">
                        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                        <span>{stopp.notiz}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      {stopp.telefon && (
                        <a href={`tel:${stopp.telefon}`}
                           className="flex items-center gap-1 text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">
                          <Phone className="w-3 h-3" /> Anrufen
                        </a>
                      )}
                      <a href={`https://maps.google.com/?q=${encodeURIComponent(stopp.adresse)}`}
                         target="_blank" rel="noopener noreferrer"
                         className="flex items-center gap-1 text-xs bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-full">
                        <Navigation2 className="w-3 h-3" /> Navigation
                      </a>
                      {stopp.trinkgeld_prognose != null && stopp.trinkgeld_prognose > 0 && (
                        <span className="flex items-center gap-1 text-xs text-amber-300">
                          <Star className="w-3 h-3" /> ~{stopp.trinkgeld_prognose.toFixed(2)}€ Trinkgeld
                        </span>
                      )}
                    </div>
                    {stopp.bewertung_ausstehend && (
                      <div className="flex items-center gap-1 text-xs text-violet-300">
                        <Star className="w-3 h-3" /> Bewertung noch ausstehend
                      </div>
                    )}
                    {stopp.km != null && (
                      <div className="text-[10px] text-slate-500">{stopp.km}km · {stopp.zahlungsart}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'uebersicht' && (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-800 p-3 text-center">
              <div className="text-2xl font-bold text-emerald-400">{gesamtBetrag.toFixed(2)}€</div>
              <div className="text-xs text-slate-500 mt-0.5">Gesamtbetrag Tour</div>
            </div>
            <div className="rounded-lg bg-slate-800 p-3 text-center">
              <div className="text-2xl font-bold text-amber-400">{trinkgeldPrognose.toFixed(2)}€</div>
              <div className="text-xs text-slate-500 mt-0.5">Trinkgeld-Prognose</div>
            </div>
          </div>

          <div className="rounded-lg bg-slate-800 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-medium">Zahlungsarten</span>
            </div>
            <div className="space-y-1.5">
              {(['bar', 'karte', 'online'] as const).map(z => {
                const count = data.stopps.filter(s => s.zahlungsart === z).length;
                const betrag = data.stopps.filter(s => s.zahlungsart === z).reduce((s, st) => s + (st.betrag ?? 0), 0);
                if (count === 0) return null;
                return (
                  <div key={z} className="flex items-center gap-2 text-xs">
                    {ZAHLUNG_ICON[z]}
                    <span className="capitalize text-slate-300">{z}</span>
                    <span className="text-slate-500 ml-auto">{count}× · {betrag.toFixed(2)}€</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg bg-slate-800 p-3">
            <div className="text-xs text-slate-400 font-medium mb-2">Express & Prioritäts-Stopps</div>
            {data.stopps.filter(s => s.prio !== 'normal').length === 0 ? (
              <div className="text-xs text-slate-500">Keine</div>
            ) : (
              <div className="space-y-1">
                {data.stopps.filter(s => s.prio !== 'normal').map(s => (
                  <div key={s.id} className="flex items-center gap-2 text-xs">
                    <span className={PRIO_BADGE[s.prio]}>{s.prio}</span>
                    <span className="text-slate-300">{s.kunde}</span>
                    {s.eta_min != null && <span className="text-slate-500 ml-auto">{s.eta_min}m</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
