'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Route, Navigation, Phone, Clock, MapPin, CheckCircle2, AlertTriangle, Euro, Banknote, CreditCard, Wifi, Zap, Package } from 'lucide-react';

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
  start_time: string;
  stopps: TourStop[];
  eingenommen: number;
  trinkgeld: number;
  offen_count: number;
  restzeit_min: number;
}

const MOCK: TourData = {
  tour_id: 'T-1042',
  fahrer_name: 'Marco',
  start_time: new Date(Date.now() - 45 * 60_000).toISOString(),
  eingenommen: 87.50,
  trinkgeld: 12.00,
  offen_count: 3,
  restzeit_min: 28,
  stopps: [
    { id: 'st1', sequence: 1, status: 'fertig',     kunde: 'Familie Müller',  adresse: 'Hauptstr. 12',     eta_min: null, km: 1.2, betrag: 28.50, zahlungsart: 'online', prio: 'normal',  bewertung_abgegeben: true },
    { id: 'st2', sequence: 2, status: 'fertig',     kunde: 'Schmidt Anna',    adresse: 'Kirchweg 5',       eta_min: null, km: 0.8, betrag: 19.00, zahlungsart: 'karte',  prio: 'normal',  bewertung_abgegeben: false },
    { id: 'st3', sequence: 3, status: 'unterwegs',  kunde: 'Weber Gastro',    adresse: 'Marktplatz 3',     eta_min: 4,    km: 1.5, betrag: 34.00, zahlungsart: 'bar',    prio: 'express', notiz: '2. Etage, Klingel links', telefon: '+49 172 3456789' },
    { id: 'st4', sequence: 4, status: 'ausstehend', kunde: 'Koch Familie',    adresse: 'Lindenallee 8',    eta_min: 12,   km: 2.1, betrag: 22.00, zahlungsart: 'online', prio: 'hoch',    notiz: 'Bitte klingeln' },
    { id: 'st5', sequence: 5, status: 'ausstehend', kunde: 'Bauer Thomas',    adresse: 'Rathausstr. 21',   eta_min: 20,   km: 1.8, betrag: 41.00, zahlungsart: 'karte',  prio: 'normal' },
    { id: 'st6', sequence: 6, status: 'ausstehend', kunde: 'Fischer Hotel',   adresse: 'Bahnhofstr. 44',   eta_min: 28,   km: 2.4, betrag: 55.00, zahlungsart: 'bar',    prio: 'normal',  telefon: '+49 151 7654321' },
  ],
};

const STATUS_DOT = {
  fertig:     'bg-emerald-500',
  unterwegs:  'bg-blue-500 animate-pulse',
  ausstehend: 'bg-slate-600',
  problem:    'bg-red-500 animate-pulse',
};

const STATUS_LABEL = {
  fertig:     { text: 'Geliefert', color: 'text-emerald-400' },
  unterwegs:  { text: 'Unterwegs', color: 'text-blue-400' },
  ausstehend: { text: 'Ausstehend', color: 'text-slate-400' },
  problem:    { text: 'Problem',   color: 'text-red-400' },
};

const PRIO_BADGE = {
  express: 'bg-red-500/20 text-red-300 border border-red-500/30',
  hoch:    'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  normal:  'bg-slate-700 text-slate-400',
};

const ZAHLUNG_ICON = {
  bar:    <Banknote className="w-3 h-3" />,
  karte:  <CreditCard className="w-3 h-3" />,
  online: <Wifi className="w-3 h-3" />,
};

function googleMapsUrl(adresse: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`;
}

export function FahrerPhase5137TourStopsNavigationHubV3({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<TourData | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!isOnline) { setData(MOCK); return; }
    async function load() {
      try {
        const url = `/api/delivery/fahrer/active-tour?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}`;
        const res = await fetch(url);
        if (res.ok) setData(await res.json());
        else setData(MOCK);
      } catch { setData(MOCK); }
    }
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [driverId, locationId, isOnline]);

  if (!data) return null;

  const aktivStop = data.stopps.find(s => s.status === 'unterwegs');
  const ausstehend = data.stopps.filter(s => s.status === 'ausstehend');
  const fertig = data.stopps.filter(s => s.status === 'fertig');
  const gesamt = data.stopps.length;
  const fortschritt = Math.round((fertig.length / gesamt) * 100);

  return (
    <div className="rounded-xl border border-blue-500/20 bg-slate-900/80 backdrop-blur p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Route className="w-5 h-5 text-blue-400" />
          <span className="font-semibold text-white text-sm">Tour-Stops V3</span>
          <span className="text-xs text-slate-500">{data.tour_id}</span>
        </div>
        {!isOnline && (
          <span className="text-xs text-amber-400 flex items-center gap-1">
            <Wifi className="w-3 h-3" /> Offline
          </span>
        )}
      </div>

      {/* 4-KPI Grid */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-slate-800/60 rounded-lg p-2 text-center">
          <div className="text-sm font-bold text-green-400 tabular-nums">{data.eingenommen.toFixed(0)}€</div>
          <div className="text-[10px] text-slate-500">Eingenommen</div>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-2 text-center">
          <div className="text-sm font-bold text-amber-400 tabular-nums">{data.trinkgeld.toFixed(0)}€</div>
          <div className="text-[10px] text-slate-500">Trinkgeld</div>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-2 text-center">
          <div className="text-sm font-bold text-blue-400 tabular-nums">{data.restzeit_min}min</div>
          <div className="text-[10px] text-slate-500">Restzeit</div>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-2 text-center">
          <div className="text-sm font-bold text-white tabular-nums">{data.offen_count}</div>
          <div className="text-[10px] text-slate-500">Offen</div>
        </div>
      </div>

      {/* Fortschrittsbalken */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-slate-400">
          <span>{fertig.length} von {gesamt} Stopps</span>
          <span>{fortschritt}%</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${fortschritt}%` }} />
        </div>
      </div>

      {/* Aktiver Stopp Hero */}
      {aktivStop && (
        <div className="rounded-xl bg-blue-600/20 border border-blue-500/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-semibold text-blue-300">Aktueller Stopp</span>
              <span className={cn('text-[10px] rounded-full px-1.5 py-0.5', PRIO_BADGE[aktivStop.prio])}>
                {aktivStop.prio}
              </span>
            </div>
            {aktivStop.eta_min != null && (
              <span className="text-xs text-amber-300 flex items-center gap-1">
                <Clock className="w-3 h-3" />{aktivStop.eta_min} min
              </span>
            )}
          </div>
          <div>
            <div className="font-semibold text-white">{aktivStop.kunde}</div>
            <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3" />{aktivStop.adresse}
            </div>
          </div>
          {aktivStop.notiz && (
            <div className="text-xs bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1 text-amber-300">
              📝 {aktivStop.notiz}
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-slate-400">
              {ZAHLUNG_ICON[aktivStop.zahlungsart]}
              <span className="capitalize">{aktivStop.zahlungsart}</span>
              {aktivStop.betrag != null && <span className="text-white font-bold">{aktivStop.betrag.toFixed(2)}€</span>}
            </div>
            <div className="flex gap-2 ml-auto">
              {aktivStop.telefon && (
                <a
                  href={`tel:${aktivStop.telefon}`}
                  className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 rounded-lg px-2 py-1 text-xs text-white"
                >
                  <Phone className="w-3.5 h-3.5" /> Anruf
                </a>
              )}
              <a
                href={googleMapsUrl(aktivStop.adresse)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 rounded-lg px-2 py-1 text-xs text-white"
              >
                <Navigation className="w-3.5 h-3.5" /> Navi
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Ausstehende Stopps */}
      {ausstehend.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs text-slate-400 font-medium">Ausstehend ({ausstehend.length})</div>
          {ausstehend.map(s => (
            <div key={s.id} className="rounded-lg bg-slate-800/60 border border-slate-700/50">
              <button
                className="w-full flex items-center gap-2 p-2 text-left"
                onClick={() => setExpanded(expanded === s.id ? null : s.id)}
              >
                <div className={cn('w-2 h-2 rounded-full shrink-0', STATUS_DOT[s.status])} />
                <span className="text-xs text-white flex-1">{s.sequence}. {s.kunde}</span>
                {s.prio !== 'normal' && (
                  <span className={cn('text-[10px] rounded-full px-1.5', PRIO_BADGE[s.prio])}>{s.prio}</span>
                )}
                {s.eta_min != null && (
                  <span className="text-xs text-slate-400 flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />{s.eta_min}m
                  </span>
                )}
              </button>
              {expanded === s.id && (
                <div className="px-3 pb-2 space-y-2 border-t border-slate-700">
                  <div className="text-xs text-slate-400 flex items-center gap-1 pt-2">
                    <MapPin className="w-3 h-3" />{s.adresse}
                  </div>
                  {s.notiz && (
                    <div className="text-xs text-amber-300 bg-amber-500/10 rounded px-2 py-1">📝 {s.notiz}</div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      {ZAHLUNG_ICON[s.zahlungsart]}
                      {s.betrag != null && <span className="text-white font-medium">{s.betrag.toFixed(2)}€</span>}
                    </div>
                    {s.km != null && <span className="text-xs text-slate-500">{s.km}km</span>}
                    <a
                      href={googleMapsUrl(s.adresse)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto flex items-center gap-1 bg-blue-600/80 hover:bg-blue-600 rounded px-2 py-0.5 text-xs text-white"
                    >
                      <Navigation className="w-3 h-3" /> Navi
                    </a>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Fertige Stopps kompakt */}
      {fertig.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-slate-500 font-medium">Erledigt ({fertig.length})</div>
          <div className="flex flex-wrap gap-1">
            {fertig.map(s => (
              <div key={s.id} className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-0.5 text-xs text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                <span>{s.sequence}. {s.kunde.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-[10px] text-slate-600 text-right">15-Sek-Polling · Mock-Fallback</div>
    </div>
  );
}
