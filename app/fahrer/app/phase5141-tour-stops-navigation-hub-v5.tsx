'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Route, Navigation2, Phone, Clock, MapPin, CheckCircle2, AlertTriangle,
  Banknote, CreditCard, Wifi, WifiOff, Package, ChevronDown, ChevronUp,
  Star, MessageSquare, TrendingUp, Zap, ExternalLink,
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
}

const MOCK: TourData = {
  tour_id: 'T-1071',
  fahrer_name: 'Du',
  eingenommen: 107.50,
  trinkgeld: 16.50,
  offen_count: 3,
  restzeit_min: 24,
  dispatch_nachricht: 'Zone Mitte stark nachgefragt — bitte schnell zurückfahren nach Lieferung!',
  stopps: [
    { id:'st1', sequence:1, status:'fertig',     kunde:'Familie Müller',  adresse:'Hauptstr. 12',    eta_min:null, km:1.2, betrag:28.50, zahlungsart:'online', prio:'normal',  bewertung_ausstehend:true },
    { id:'st2', sequence:2, status:'fertig',     kunde:'Schmidt Anna',    adresse:'Kirchweg 5',      eta_min:null, km:0.8, betrag:19.00, zahlungsart:'karte',  prio:'normal',  bewertung_ausstehend:false },
    { id:'st3', sequence:3, status:'unterwegs',  kunde:'Weber Gastro',    adresse:'Marktplatz 3',    eta_min:5,    km:1.5, betrag:34.00, zahlungsart:'bar',    prio:'express', notiz:'2. Etage, Klingel links', telefon:'+49 172 3456789' },
    { id:'st4', sequence:4, status:'ausstehend', kunde:'Koch Familie',    adresse:'Lindenallee 8',   eta_min:15,   km:2.1, betrag:22.00, zahlungsart:'online', prio:'hoch',    notiz:'Bitte klingeln' },
    { id:'st5', sequence:5, status:'ausstehend', kunde:'Bauer Thomas',    adresse:'Rathausstr. 21',  eta_min:23,   km:1.8, betrag:41.00, zahlungsart:'karte',  prio:'normal' },
    { id:'st6', sequence:6, status:'ausstehend', kunde:'Fischer Hotel',   adresse:'Bahnhofstr. 44',  eta_min:32,   km:2.4, betrag:55.00, zahlungsart:'bar',    prio:'normal',  telefon:'+49 151 7654321' },
  ],
};

const PRIO_BADGE: Record<string, string> = {
  express: 'bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
  hoch:    'bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
  normal:  '',
};

const STATUS_DOT: Record<string, string> = {
  fertig:     'bg-emerald-500',
  unterwegs:  'bg-blue-400 animate-pulse',
  ausstehend: 'bg-slate-600',
  problem:    'bg-red-500',
};

const ZAHLUNG_ICON: Record<string, React.ReactNode> = {
  bar:    <Banknote className="w-3 h-3" />,
  karte:  <CreditCard className="w-3 h-3" />,
  online: <Wifi className="w-3 h-3" />,
};

type NavApp = 'google' | 'waze';

function buildNavUrl(adresse: string, app: NavApp) {
  const encoded = encodeURIComponent(adresse);
  return app === 'google'
    ? `https://maps.google.com/?q=${encoded}&dirflg=d`
    : `https://waze.com/ul?q=${encoded}&navigate=yes`;
}

export function FahrerPhase5141TourStopsNavigationHubV5() {
  const [tour, setTour] = useState<TourData>(MOCK);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [navApp, setNavApp] = useState<NavApp>('google');
  const [showDispatch, setShowDispatch] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) { if (active) { setTour(MOCK); setLoading(false); } return; }
        const { data: tourData } = await sb
          .from('delivery_tours')
          .select('id,stopps,eingenommen,trinkgeld,restzeit_min')
          .eq('fahrer_id', user.id)
          .eq('status', 'aktiv')
          .single();
        if (active) {
          if (tourData) {
            setTour({
              ...MOCK,
              tour_id: tourData.id,
              eingenommen: tourData.eingenommen ?? MOCK.eingenommen,
              trinkgeld: tourData.trinkgeld ?? MOCK.trinkgeld,
              stopps: tourData.stopps ?? MOCK.stopps,
            });
          } else {
            setTour(MOCK);
          }
          setLoading(false);
        }
      } catch {
        if (active) { setTour(MOCK); setLoading(false); }
      }
    }
    load();
    const iv = setInterval(load, 15_000);
    return () => { active = false; clearInterval(iv); };
  }, []);

  const aktuellerStopp = tour.stopps.find(s => s.status === 'unterwegs');
  const ausstehend = tour.stopps.filter(s => s.status === 'ausstehend');
  const fertig = tour.stopps.filter(s => s.status === 'fertig');
  const totalStopps = tour.stopps.length;
  const fortschritt = Math.round((fertig.length / Math.max(1, totalStopps)) * 100);

  if (loading) return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-400 text-sm">Lade Tour…</div>
  );

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 text-slate-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700 bg-slate-800/60">
        <Route className="w-5 h-5 text-blue-400" />
        <div>
          <span className="font-semibold text-sm">Tour-Navigation V5</span>
          <span className="ml-2 text-[10px] text-slate-500">{tour.tour_id} · {tour.fahrer_name}</span>
        </div>
        {/* Nav-App Auswahl */}
        <div className="ml-auto flex items-center gap-1 bg-slate-800 rounded-full p-0.5">
          {(['google', 'waze'] as const).map(app => (
            <button key={app} onClick={() => setNavApp(app)}
              className={cn('text-[10px] px-2 py-0.5 rounded-full transition-colors',
                navApp === app ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200')}>
              {app === 'google' ? 'Google' : 'Waze'}
            </button>
          ))}
        </div>
      </div>

      {/* 4-KPI-Grid */}
      <div className="grid grid-cols-4 divide-x divide-slate-700 border-b border-slate-700">
        {[
          { label: 'Eingenommen', value: `${tour.eingenommen.toFixed(0)}€`, color: 'text-emerald-400' },
          { label: 'Trinkgeld',   value: `${tour.trinkgeld.toFixed(0)}€`,  color: 'text-amber-400' },
          { label: 'Restzeit',    value: `${tour.restzeit_min}m`,           color: tour.restzeit_min < 20 ? 'text-red-400' : 'text-blue-400' },
          { label: 'Offen',       value: ausstehend.length,                  color: 'text-slate-100' },
        ].map(k => (
          <div key={k.label} className="flex flex-col items-center py-2 px-1">
            <span className={cn('text-lg font-bold tabular-nums', k.color)}>{k.value}</span>
            <span className="text-[9px] text-slate-500 mt-0.5">{k.label}</span>
          </div>
        ))}
      </div>

      {/* Fortschrittsbalken */}
      <div className="px-4 py-2 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-slate-500">{fertig.length}/{totalStopps} Stopps erledigt</span>
          <span className="text-[10px] text-blue-400 font-semibold">{fortschritt}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-700">
          <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: `${fortschritt}%` }} />
        </div>
      </div>

      {/* Dispatch-Nachricht */}
      {tour.dispatch_nachricht && showDispatch && (
        <div className="flex items-start gap-2 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20">
          <MessageSquare className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300 flex-1">{tour.dispatch_nachricht}</p>
          <button onClick={() => setShowDispatch(false)} className="text-slate-500 hover:text-slate-300 text-xs">✕</button>
        </div>
      )}

      {/* Aktueller Stopp — Hero */}
      {aktuellerStopp && (
        <div className="px-4 py-4 border-b border-slate-700 bg-blue-500/5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-xs font-semibold text-blue-300 uppercase tracking-wide">Jetzt liefern</span>
            {aktuellerStopp.prio !== 'normal' && (
              <span className={PRIO_BADGE[aktuellerStopp.prio]}>{aktuellerStopp.prio}</span>
            )}
          </div>

          <div className="mb-3">
            <p className="text-base font-semibold text-slate-100">{aktuellerStopp.kunde}</p>
            <div className="flex items-center gap-1.5 mt-0.5 text-sm text-blue-300">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>{aktuellerStopp.adresse}</span>
            </div>
            {aktuellerStopp.notiz && (
              <div className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-300">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                <span>{aktuellerStopp.notiz}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mb-3 text-xs text-slate-400">
            {aktuellerStopp.eta_min != null && (
              <span className="flex items-center gap-1 text-blue-300"><Clock className="w-3 h-3" />{aktuellerStopp.eta_min} min</span>
            )}
            {aktuellerStopp.km != null && (
              <span>{aktuellerStopp.km} km</span>
            )}
            <span className="flex items-center gap-1">{ZAHLUNG_ICON[aktuellerStopp.zahlungsart]} {aktuellerStopp.zahlungsart}</span>
            {aktuellerStopp.betrag != null && (
              <span className="text-emerald-400 font-semibold">{aktuellerStopp.betrag.toFixed(2)}€</span>
            )}
          </div>

          {/* CTAs */}
          <div className="flex gap-2">
            <a
              href={buildNavUrl(aktuellerStopp.adresse, navApp)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
            >
              <Navigation2 className="w-4 h-4" />
              Navigieren
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
            {aktuellerStopp.telefon && (
              <a
                href={`tel:${aktuellerStopp.telefon}`}
                className="flex items-center justify-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
              >
                <Phone className="w-4 h-4" />
              </a>
            )}
            <button className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors">
              <CheckCircle2 className="w-4 h-4" />
              Geliefert
            </button>
          </div>
        </div>
      )}

      {/* Ausstehende Stopps */}
      {ausstehend.length > 0 && (
        <div className="border-b border-slate-700/50">
          <p className="px-4 py-2 text-[10px] text-slate-500 uppercase tracking-wide">Nächste Stopps ({ausstehend.length})</p>
          {ausstehend.map(s => {
            const isOpen = expanded === s.id;
            return (
              <div key={s.id}>
                <button
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-800/40 transition-colors border-t border-slate-700/30"
                  onClick={() => setExpanded(isOpen ? null : s.id)}
                >
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-500 w-3">{s.sequence}</span>
                    <div className={cn('w-2 h-2 rounded-full', STATUS_DOT[s.status])} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{s.kunde}</p>
                    <p className="text-xs text-slate-500 truncate">{s.adresse}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.prio !== 'normal' && <span className={cn(PRIO_BADGE[s.prio], 'text-[9px]')}>{s.prio}</span>}
                    {s.eta_min != null && <span className="text-xs text-blue-300">{s.eta_min}m</span>}
                    {s.betrag != null && <span className="text-xs text-emerald-400">{s.betrag.toFixed(0)}€</span>}
                    {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-3 pt-1 bg-slate-800/30 border-t border-slate-700/30 flex items-center gap-3">
                    {s.km != null && <span className="text-xs text-slate-500">{s.km} km</span>}
                    <span className="flex items-center gap-1 text-xs text-slate-400">{ZAHLUNG_ICON[s.zahlungsart]} {s.zahlungsart}</span>
                    {s.notiz && <span className="text-xs text-amber-300 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{s.notiz}</span>}
                    <div className="ml-auto flex gap-2">
                      <a
                        href={buildNavUrl(s.adresse, navApp)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300"
                      >
                        <Navigation2 className="w-3 h-3" />Navi
                      </a>
                      {s.telefon && (
                        <a href={`tel:${s.telefon}`} className="text-xs flex items-center gap-1 text-slate-400 hover:text-slate-200">
                          <Phone className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Fertige Stopps + Bewertungs-CTA */}
      {fertig.length > 0 && (
        <div className="px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {fertig.map(s => (
              <div key={s.id} className={cn(
                'flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5',
                s.bewertung_ausstehend ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/10 text-emerald-400'
              )}>
                {s.bewertung_ausstehend ? <Star className="w-2.5 h-2.5" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
                {s.kunde.split(' ')[0]}
                {s.bewertung_ausstehend && <span className="ml-0.5">★?</span>}
              </div>
            ))}
          </div>
          {fertig.some(s => s.bewertung_ausstehend) && (
            <p className="text-[10px] text-amber-400 mt-2 flex items-center gap-1">
              <Star className="w-3 h-3" />Bewertungsanfrage nach Abschluss senden
            </p>
          )}
        </div>
      )}
    </div>
  );
}
