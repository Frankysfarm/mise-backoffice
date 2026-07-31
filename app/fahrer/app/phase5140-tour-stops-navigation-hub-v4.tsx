'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Route, Navigation2, Phone, Clock, MapPin, CheckCircle2, AlertTriangle,
  Banknote, CreditCard, Wifi, Zap, Package, ChevronDown, ChevronUp, Star,
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
  bewertung_abgegeben?: boolean;
}

interface TourData {
  tour_id: string;
  fahrer_name: string;
  stopps: TourStop[];
  eingenommen: number;
  trinkgeld: number;
  offen_count: number;
  restzeit_min: number;
}

const MOCK: TourData = {
  tour_id: 'T-1055',
  fahrer_name: 'Du',
  eingenommen: 93.50,
  trinkgeld: 14.00,
  offen_count: 3,
  restzeit_min: 26,
  stopps: [
    { id:'st1', sequence:1, status:'fertig',     kunde:'Familie Müller', adresse:'Hauptstr. 12',   eta_min:null, km:1.2,  betrag:28.50, zahlungsart:'online', prio:'normal',  bewertung_abgegeben:true },
    { id:'st2', sequence:2, status:'fertig',     kunde:'Schmidt Anna',   adresse:'Kirchweg 5',     eta_min:null, km:0.8,  betrag:19.00, zahlungsart:'karte',  prio:'normal',  bewertung_abgegeben:false },
    { id:'st3', sequence:3, status:'unterwegs',  kunde:'Weber Gastro',   adresse:'Marktplatz 3',   eta_min:5,    km:1.5,  betrag:34.00, zahlungsart:'bar',    prio:'express', notiz:'2. Etage, Klingel links', telefon:'+49 172 3456789' },
    { id:'st4', sequence:4, status:'ausstehend', kunde:'Koch Familie',   adresse:'Lindenallee 8',  eta_min:14,   km:2.1,  betrag:22.00, zahlungsart:'online', prio:'hoch',    notiz:'Bitte klingeln' },
    { id:'st5', sequence:5, status:'ausstehend', kunde:'Bauer Thomas',   adresse:'Rathausstr. 21', eta_min:22,   km:1.8,  betrag:41.00, zahlungsart:'karte',  prio:'normal' },
    { id:'st6', sequence:6, status:'ausstehend', kunde:'Fischer Hotel',  adresse:'Bahnhofstr. 44', eta_min:30,   km:2.4,  betrag:55.00, zahlungsart:'bar',    prio:'normal',  telefon:'+49 151 7654321' },
  ],
};

const PRIO_BADGE = {
  express: 'bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
  hoch:    'bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
  normal:  '',
};

const ZAHLUNG_ICON = {
  bar:    <Banknote className="w-3 h-3" />,
  karte:  <CreditCard className="w-3 h-3" />,
  online: <Wifi className="w-3 h-3" />,
};

const STATUS_DOT = {
  fertig:    'bg-emerald-500',
  unterwegs: 'bg-blue-500 animate-pulse',
  ausstehend:'bg-slate-600',
  problem:   'bg-red-500 animate-pulse',
};

function mapsUrl(adresse: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`;
}

function wazeUrl(adresse: string) {
  return `https://waze.com/ul?q=${encodeURIComponent(adresse)}`;
}

interface Props { driverId?: string | null; tourId?: string | null }

export function FahrerPhase5140TourStopsNavigationHubV4({ driverId, tourId }: Props) {
  const [tour, setTour] = useState<TourData>(MOCK);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [navChoice, setNavChoice] = useState<'google' | 'waze'>('google');

  useEffect(() => {
    if (!driverId && !tourId) { setTour(MOCK); return; }
    let active = true;
    async function load() {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const sb = createClient();
        const query = sb.from('delivery_batches').select('id,fahrer_id,status,tour_stops:delivery_batch_stops(*)').eq('status','unterwegs');
        if (driverId) query.eq('fahrer_id', driverId);
        if (tourId)   query.eq('id', tourId);
        const { data } = await query.limit(1).maybeSingle();
        if (active && !data) setTour(MOCK);
      } catch { if (active) setTour(MOCK); }
    }
    load();
    const iv = setInterval(load, 15_000);
    return () => { active = false; clearInterval(iv); };
  }, [driverId, tourId]);

  const aktivStop = tour.stopps.find(s => s.status === 'unterwegs');
  const ausstehend = tour.stopps.filter(s => s.status === 'ausstehend');
  const fertig = tour.stopps.filter(s => s.status === 'fertig');
  const total = tour.stopps.length;
  const progress = Math.round((fertig.length / Math.max(1, total)) * 100);

  const navUrl = (adresse: string) => navChoice === 'waze' ? wazeUrl(adresse) : mapsUrl(adresse);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 text-slate-100 overflow-hidden max-w-sm mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700 bg-slate-800/60">
        <Route className="w-5 h-5 text-blue-400" />
        <span className="font-semibold text-sm">Tour-Stops V4</span>
        <div className="ml-auto flex gap-1">
          {(['google','waze'] as const).map(n => (
            <button key={n} onClick={() => setNavChoice(n)}
              className={cn('text-[10px] px-1.5 py-0.5 rounded transition-colors',
                navChoice === n ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400')}>
              {n === 'google' ? 'Maps' : 'Waze'}
            </button>
          ))}
        </div>
      </div>

      {/* 4-KPI Grid */}
      <div className="grid grid-cols-4 divide-x divide-slate-700 border-b border-slate-700">
        {[
          { label:'Eingenommen', value:`€${tour.eingenommen.toFixed(0)}`, color:'text-emerald-400' },
          { label:'Trinkgeld',   value:`€${tour.trinkgeld.toFixed(0)}`,   color:'text-amber-400' },
          { label:'Restzeit',    value:`${tour.restzeit_min}m`,           color:'text-blue-400' },
          { label:'Offen',       value:tour.offen_count,                  color:'text-slate-100' },
        ].map(k => (
          <div key={k.label} className="flex flex-col items-center py-2 px-1">
            <span className={cn('text-base font-bold tabular-nums', k.color)}>{k.value}</span>
            <span className="text-[10px] text-slate-500 mt-0.5 text-center leading-tight">{k.label}</span>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="px-4 py-2 border-b border-slate-700/50">
        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
          <span>{fertig.length}/{total} Stopps erledigt</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-700">
          <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width:`${progress}%` }} />
        </div>
      </div>

      {/* Aktiver Stopp Hero */}
      {aktivStop && (
        <div className="mx-3 my-3 rounded-xl border border-blue-500/40 bg-blue-500/10 p-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                <span className="text-xs text-blue-300 font-medium">Jetzt unterwegs</span>
                {aktivStop.prio !== 'normal' && <span className={PRIO_BADGE[aktivStop.prio]}>{aktivStop.prio}</span>}
              </div>
              <p className="text-sm font-semibold">{aktivStop.kunde}</p>
              <p className="text-xs text-slate-400 flex items-center gap-0.5 mt-0.5">
                <MapPin className="w-3 h-3 shrink-0" />{aktivStop.adresse}
              </p>
            </div>
            {aktivStop.betrag != null && (
              <div className="flex items-center gap-1 text-xs text-slate-300 shrink-0">
                {ZAHLUNG_ICON[aktivStop.zahlungsart]}
                <span className="font-mono">€{aktivStop.betrag.toFixed(2)}</span>
              </div>
            )}
          </div>

          {aktivStop.notiz && (
            <div className="mb-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-2 py-1 text-xs text-amber-300 flex items-start gap-1.5">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              {aktivStop.notiz}
            </div>
          )}

          <div className="flex gap-2">
            <a href={navUrl(aktivStop.adresse)} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors">
              <Navigation2 className="w-4 h-4" />Navigieren
            </a>
            {aktivStop.telefon && (
              <a href={`tel:${aktivStop.telefon}`}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs font-medium transition-colors">
                <Phone className="w-4 h-4" />
              </a>
            )}
          </div>

          {aktivStop.eta_min != null && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
              <Clock className="w-3 h-3" />
              <span>ETA ca. <strong className="text-blue-300">{aktivStop.eta_min} min</strong></span>
              {aktivStop.km != null && <><MapPin className="w-3 h-3 ml-1" /><span>{aktivStop.km} km</span></>}
            </div>
          )}
        </div>
      )}

      {/* Ausstehende Stopps */}
      {ausstehend.length > 0 && (
        <div className="px-3 pb-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Nächste Stopps</p>
          <div className="flex flex-col gap-1.5">
            {ausstehend.map(stop => {
              const isOpen = expanded === stop.id;
              return (
                <div key={stop.id} className="rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden">
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-left"
                    onClick={() => setExpanded(isOpen ? null : stop.id)}>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />
                    <span className="text-xs font-medium flex-1 truncate">{stop.kunde}</span>
                    {stop.prio !== 'normal' && <span className={PRIO_BADGE[stop.prio]}>{stop.prio}</span>}
                    {stop.eta_min != null && (
                      <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />{stop.eta_min}m
                      </span>
                    )}
                    {isOpen ? <ChevronUp className="w-3 h-3 text-slate-500 shrink-0" /> : <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />}
                  </button>

                  {isOpen && (
                    <div className="px-3 pb-2 border-t border-slate-700/50">
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-1.5">
                        <MapPin className="w-3 h-3 shrink-0" />{stop.adresse}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        {stop.km != null && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{stop.km}km</span>}
                        {stop.betrag != null && (
                          <span className="flex items-center gap-0.5 text-emerald-400">
                            {ZAHLUNG_ICON[stop.zahlungsart]}€{stop.betrag.toFixed(2)}
                          </span>
                        )}
                      </div>
                      {stop.notiz && (
                        <p className="mt-1 text-[10px] text-amber-300 flex items-start gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />{stop.notiz}
                        </p>
                      )}
                      <div className="flex gap-2 mt-2">
                        <a href={navUrl(stop.adresse)} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2 py-1 rounded bg-blue-700/60 text-blue-200 text-[10px] hover:bg-blue-700 transition-colors">
                          <Navigation2 className="w-3 h-3" />Navi
                        </a>
                        {stop.telefon && (
                          <a href={`tel:${stop.telefon}`}
                            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 text-slate-300 text-[10px] hover:bg-slate-600 transition-colors">
                            <Phone className="w-3 h-3" />Anruf
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fertige Stopps */}
      {fertig.length > 0 && (
        <div className="px-3 pb-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Erledigt</p>
          <div className="flex flex-wrap gap-1.5">
            {fertig.map(s => (
              <span key={s.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400">
                <CheckCircle2 className="w-2.5 h-2.5" />{s.kunde.split(' ')[0]}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
