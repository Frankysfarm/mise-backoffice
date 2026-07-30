'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { cn, euro } from '@/lib/utils';
import {
  MapPin, Navigation, CheckCircle2, Clock, Phone, CreditCard, Banknote,
  AlertCircle, ChevronDown, ChevronUp, Package, Zap, Target, Route,
} from 'lucide-react';

interface TourStopp {
  id: string;
  stop_nr: number;
  adresse: string;
  kunde_name?: string | null;
  kunde_telefon?: string | null;
  eta_min?: number | null;
  status: 'ausstehend' | 'unterwegs' | 'angekommen' | 'abgeschlossen' | 'problem';
  zahlungsart?: 'bar' | 'karte' | null;
  betrag?: number | null;
  notiz?: string | null;
  bestellnummer?: string | null;
  prioritaet?: 'express' | 'hoch' | 'normal' | null;
  lat?: number | null;
  lng?: number | null;
  distanz_km?: number | null;
}

interface Props {
  fahrerTourId?: string | null;
  isOnline?: boolean;
}

const STATUS_CONFIG = {
  ausstehend:   { icon: Clock,         color: 'text-slate-400',   dot: 'bg-slate-600',               label: 'Ausstehend' },
  unterwegs:    { icon: Navigation,    color: 'text-blue-400',    dot: 'bg-blue-400 animate-pulse',  label: 'Unterwegs' },
  angekommen:   { icon: MapPin,        color: 'text-amber-400',   dot: 'bg-amber-400',               label: 'Angekommen' },
  abgeschlossen:{ icon: CheckCircle2,  color: 'text-emerald-400', dot: 'bg-emerald-400',             label: 'Erledigt' },
  problem:      { icon: AlertCircle,   color: 'text-red-400',     dot: 'bg-red-400',                 label: 'Problem' },
};

const PRIO_STYLE = {
  express: 'bg-red-500/20 text-red-300 border-red-500/30',
  hoch:    'bg-amber-500/20 text-amber-300 border-amber-500/30',
  normal:  'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

const MOCK_STOPPS: TourStopp[] = [
  { id: 's1', stop_nr: 1, adresse: 'Hauptstraße 12, Aachen', kunde_name: 'M. Müller', kunde_telefon: '+49151000001', eta_min: 4, status: 'unterwegs', zahlungsart: 'karte', betrag: 24.50, bestellnummer: '#4201', prioritaet: 'express', distanz_km: 1.2 },
  { id: 's2', stop_nr: 2, adresse: 'Pontstraße 35, Aachen', kunde_name: 'L. Schmidt', kunde_telefon: '+49151000002', eta_min: 13, status: 'ausstehend', zahlungsart: 'bar', betrag: 18.00, notiz: 'Klingel defekt – anrufen', bestellnummer: '#4202', prioritaet: 'hoch', distanz_km: 2.4 },
  { id: 's3', stop_nr: 3, adresse: 'Großkölnstraße 8, Aachen', kunde_name: 'K. Weber', eta_min: 21, status: 'ausstehend', zahlungsart: 'karte', betrag: 31.20, bestellnummer: '#4203', prioritaet: 'normal', distanz_km: 3.1 },
  { id: 's4', stop_nr: 0, adresse: 'Bereits abgeschlossen', status: 'abgeschlossen', betrag: 16.80, bestellnummer: '#4200', prioritaet: null },
];

function openNav(stopp: TourStopp) {
  const addr = encodeURIComponent(stopp.adresse);
  if (stopp.lat && stopp.lng) {
    window.open(`https://maps.google.com/maps?daddr=${stopp.lat},${stopp.lng}&dirflg=d`, '_blank');
  } else {
    window.open(`https://maps.google.com/maps?daddr=${addr}&dirflg=d`, '_blank');
  }
}

export function FahrerPhase5110TourStopsNavigationHub({ fahrerTourId, isOnline = true }: Props) {
  const [stopps, setStopps] = useState<TourStopp[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!fahrerTourId) { setStopps(MOCK_STOPPS); setLoading(false); return; }
    try {
      const res = await fetch(`/api/driver-app/tour/${fahrerTourId}/stops`);
      if (res.ok) {
        const data = await res.json();
        setStopps(data.stops ?? MOCK_STOPPS);
      } else { setStopps(MOCK_STOPPS); }
    } catch { setStopps(MOCK_STOPPS); }
    finally { setLoading(false); }
  }, [fahrerTourId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [load]);

  if (!isOnline) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center text-white/40 text-xs">
        <Navigation className="h-5 w-5 mx-auto mb-1 text-slate-500" />
        Offline – keine Navigation verfügbar
      </div>
    );
  }

  const erledigt = stopps.filter(s => s.status === 'abgeschlossen').length;
  const aktive = stopps.filter(s => ['unterwegs', 'angekommen'].includes(s.status));
  const naechster = stopps.find(s => s.status === 'unterwegs') ?? stopps.find(s => s.status === 'ausstehend');
  const gesamt = stopps.filter(s => s.stop_nr > 0).length;
  const fortschritt = gesamt > 0 ? Math.round((erledigt / gesamt) * 100) : 0;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">Tour-Stops & Navigation</span>
        </div>
        <span className="text-xs text-white/40">{erledigt}/{gesamt} erledigt</span>
      </div>

      {/* Fortschrittsbalken */}
      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full bg-blue-400 transition-all" style={{ width: `${fortschritt}%` }} />
      </div>

      {/* Nächster-Stopp-Banner */}
      {naechster && (
        <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-blue-400" />
              <span className="text-xs font-semibold text-blue-300">Nächster Stopp</span>
            </div>
            {naechster.prioritaet && naechster.prioritaet !== 'normal' && (
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', PRIO_STYLE[naechster.prioritaet])}>
                {naechster.prioritaet.toUpperCase()}
              </span>
            )}
          </div>
          <div className="text-sm font-medium text-white">{naechster.adresse}</div>
          {naechster.kunde_name && <div className="text-xs text-white/60">{naechster.kunde_name}</div>}
          <div className="flex items-center gap-3 mt-2">
            {naechster.eta_min !== null && naechster.eta_min !== undefined && (
              <span className="text-xs text-blue-300 flex items-center gap-0.5"><Clock className="h-3 w-3" />{naechster.eta_min}min</span>
            )}
            {naechster.distanz_km !== null && naechster.distanz_km !== undefined && (
              <span className="text-xs text-white/40">{naechster.distanz_km}km</span>
            )}
            <button
              onClick={() => openNav(naechster)}
              className="ml-auto flex items-center gap-1 rounded-lg bg-blue-500 hover:bg-blue-400 text-white text-xs px-3 py-1.5 font-semibold transition-colors"
            >
              <Navigation className="h-3 w-3" />
              Navigation starten
            </button>
          </div>
        </div>
      )}

      {/* Stop-Liste */}
      {loading ? (
        <div className="text-center text-white/40 text-xs py-4">Lädt…</div>
      ) : (
        <div className="space-y-1.5">
          {stopps.filter(s => s.stop_nr > 0).sort((a, b) => a.stop_nr - b.stop_nr).map(s => {
            const cfg = STATUS_CONFIG[s.status];
            const Icon = cfg.icon;
            const isExpanded = expandedId === s.id;
            const isActive = s.status === 'unterwegs' || s.status === 'angekommen';

            return (
              <div key={s.id} className={cn('rounded-lg border transition-colors', isActive ? 'border-blue-500/30 bg-blue-500/5' : 'border-white/10 bg-white/5')}>
                <button
                  className="w-full flex items-center gap-2 p-2 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : s.id)}
                >
                  <div className={cn('h-2.5 w-2.5 rounded-full flex-shrink-0', cfg.dot)} />
                  <span className="text-xs text-white/40 w-4">{s.stop_nr}</span>
                  <span className="text-xs text-white flex-1 truncate">{s.adresse}</span>
                  {s.prioritaet && s.prioritaet !== 'normal' && (
                    <span className={cn('text-[9px] px-1 rounded border', PRIO_STYLE[s.prioritaet])}>{s.prioritaet}</span>
                  )}
                  {s.eta_min !== null && s.eta_min !== undefined && s.status !== 'abgeschlossen' && (
                    <span className="text-[10px] text-white/40">{s.eta_min}m</span>
                  )}
                  {isExpanded ? <ChevronUp className="h-3 w-3 text-white/30" /> : <ChevronDown className="h-3 w-3 text-white/30" />}
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2 border-t border-white/5 pt-2">
                    {s.bestellnummer && <div className="text-[10px] text-white/40">Bestellung: {s.bestellnummer}</div>}
                    {s.kunde_name && <div className="text-xs text-white">{s.kunde_name}</div>}
                    {s.notiz && (
                      <div className="text-[10px] text-amber-300 bg-amber-500/10 rounded px-2 py-1">⚠ {s.notiz}</div>
                    )}
                    <div className="flex items-center gap-3">
                      {s.betrag !== null && s.betrag !== undefined && (
                        <span className="text-xs text-white/70 flex items-center gap-0.5">
                          {s.zahlungsart === 'bar' ? <Banknote className="h-3 w-3" /> : <CreditCard className="h-3 w-3" />}
                          {euro(s.betrag)}
                        </span>
                      )}
                      {s.kunde_telefon && (
                        <a href={`tel:${s.kunde_telefon}`} className="flex items-center gap-0.5 text-[10px] text-blue-400 hover:text-blue-300">
                          <Phone className="h-3 w-3" /> Anrufen
                        </a>
                      )}
                      {s.status !== 'abgeschlossen' && (
                        <button onClick={() => openNav(s)} className="ml-auto flex items-center gap-0.5 text-[10px] text-blue-400 hover:text-blue-300">
                          <Navigation className="h-3 w-3" /> Nav
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
