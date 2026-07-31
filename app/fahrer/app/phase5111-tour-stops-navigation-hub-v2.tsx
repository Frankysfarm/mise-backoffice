'use client';

import React, { useEffect, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import {
  MapPin, Navigation, CheckCircle2, Clock, Phone, CreditCard, Banknote,
  AlertCircle, ChevronDown, ChevronUp, Package, Zap, Target, Route, TrendingUp,
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
  ausstehend:    { icon: Clock,         color: 'text-slate-400',   dot: 'bg-slate-600',                label: 'Ausstehend' },
  unterwegs:     { icon: Navigation,    color: 'text-blue-400',    dot: 'bg-blue-400 animate-pulse',   label: 'Unterwegs'  },
  angekommen:    { icon: MapPin,        color: 'text-amber-400',   dot: 'bg-amber-400',                label: 'Angekommen' },
  abgeschlossen: { icon: CheckCircle2,  color: 'text-emerald-400', dot: 'bg-emerald-400',              label: 'Erledigt'   },
  problem:       { icon: AlertCircle,   color: 'text-red-400',     dot: 'bg-red-400',                  label: 'Problem'    },
};

const PRIO_STYLE = {
  express: 'bg-red-500/20 text-red-300 border-red-500/30',
  hoch:    'bg-amber-500/20 text-amber-300 border-amber-500/30',
  normal:  'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

const MOCK_STOPPS: TourStopp[] = [
  { id: 's1', stop_nr: 1, adresse: 'Hauptstraße 12, Aachen',      kunde_name: 'M. Müller', kunde_telefon: '+49151000001', eta_min: 4,  status: 'unterwegs',    zahlungsart: 'karte', betrag: 24.50, bestellnummer: '#4201', prioritaet: 'express', distanz_km: 1.2 },
  { id: 's2', stop_nr: 2, adresse: 'Pontstraße 35, Aachen',       kunde_name: 'L. Schmidt', kunde_telefon: '+49151000002', eta_min: 13, status: 'ausstehend',   zahlungsart: 'bar',   betrag: 18.00, notiz: 'Klingel defekt – anrufen', bestellnummer: '#4202', prioritaet: 'hoch', distanz_km: 2.4 },
  { id: 's3', stop_nr: 3, adresse: 'Großkölnstraße 8, Aachen',   kunde_name: 'K. Weber',                                   eta_min: 21, status: 'ausstehend',   zahlungsart: 'karte', betrag: 31.20, bestellnummer: '#4203', prioritaet: 'normal', distanz_km: 3.1 },
  { id: 's4', stop_nr: 0, adresse: 'Alemannenstraße 2, Aachen',  kunde_name: 'A. Bauer',                                              status: 'abgeschlossen', betrag: 16.80,          bestellnummer: '#4200', prioritaet: null },
];

function openNav(stopp: TourStopp) {
  const addr = encodeURIComponent(stopp.adresse);
  if (stopp.lat && stopp.lng) {
    window.open(`https://maps.google.com/maps?daddr=${stopp.lat},${stopp.lng}&dirflg=d`, '_blank');
  } else {
    window.open(`https://maps.google.com/maps?daddr=${addr}&dirflg=d`, '_blank');
  }
}

export function FahrerPhase5111TourStopsNavigationHubV2({ fahrerTourId, isOnline }: Props) {
  const [stopps, setStopps] = useState<TourStopp[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!fahrerTourId) { setStopps(MOCK_STOPPS); setLoading(false); return; }
    async function load() {
      try {
        const res = await fetch(`/api/delivery/fahrer/tour-stops?tour_id=${fahrerTourId}`);
        if (res.ok) {
          const data = await res.json();
          setStopps(data.stopps ?? data ?? MOCK_STOPPS);
        } else { setStopps(MOCK_STOPPS); }
      } catch { setStopps(MOCK_STOPPS); }
      finally { setLoading(false); }
    }
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [fahrerTourId]);

  const pending = stopps.filter(s => !['abgeschlossen'].includes(s.status));
  const done    = stopps.filter(s => s.status === 'abgeschlossen');
  const next    = pending.find(s => s.status === 'unterwegs') ?? pending[0] ?? null;
  const pct     = stopps.length ? Math.round((done.length / stopps.length) * 100) : 0;
  const totalBetrag = done.reduce((s, o) => s + (o.betrag ?? 0), 0);
  const remainingEta = pending.reduce((s, o) => s + (o.eta_min ?? 0), 0);

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center justify-center h-28">
        <span className="text-slate-400 text-sm animate-pulse">Lade Tour-Stopps…</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">Tour-Stops Navigation V2</span>
          {isOnline === false && (
            <span className="text-[10px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded">Offline</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span>{done.length}/{stopps.length} Stopps</span>
          <span className={cn('font-bold', pct >= 80 ? 'text-emerald-400' : 'text-amber-400')}>{pct}%</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', pct >= 80 ? 'bg-emerald-400' : 'bg-blue-400')}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Tour summary strip */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="rounded-lg bg-white/5 p-2 text-center">
          <TrendingUp className="h-3 w-3 text-emerald-400 mx-auto mb-0.5" />
          <div className="text-sm font-bold text-emerald-400">{euro(totalBetrag)}</div>
          <div className="text-[10px] text-slate-500">Eingenommen</div>
        </div>
        <div className="rounded-lg bg-white/5 p-2 text-center">
          <Clock className="h-3 w-3 text-amber-400 mx-auto mb-0.5" />
          <div className="text-sm font-bold text-amber-400">{remainingEta} Min</div>
          <div className="text-[10px] text-slate-500">Restzeit ca.</div>
        </div>
        <div className="rounded-lg bg-white/5 p-2 text-center">
          <Target className="h-3 w-3 text-blue-400 mx-auto mb-0.5" />
          <div className="text-sm font-bold text-blue-400">{pending.length}</div>
          <div className="text-[10px] text-slate-500">Noch offen</div>
        </div>
      </div>

      {/* Next Stop Banner */}
      {next && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Navigation className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
              <span className="text-xs font-semibold text-blue-300">Nächster Stopp</span>
              {next.prioritaet && next.prioritaet !== 'normal' && (
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium', PRIO_STYLE[next.prioritaet])}>
                  {next.prioritaet === 'express' ? '⚡ Express' : '▲ Hoch'}
                </span>
              )}
            </div>
            {next.eta_min != null && (
              <span className="text-sm font-bold text-blue-400">{next.eta_min} Min</span>
            )}
          </div>
          <div className="text-sm text-white font-medium">{next.adresse}</div>
          {next.notiz && (
            <div className="text-xs text-amber-300 bg-amber-500/10 px-2 py-1 rounded">⚠ {next.notiz}</div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => openNav(next)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-medium hover:bg-blue-500/30 transition-colors"
            >
              <Navigation className="h-3.5 w-3.5" />
              Navigation starten
            </button>
            {next.kunde_telefon && (
              <a
                href={`tel:${next.kunde_telefon}`}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-xs font-medium hover:bg-white/10 transition-colors"
              >
                <Phone className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* All stops list */}
      <div className="space-y-1">
        {[...stopps].sort((a, b) => a.stop_nr - b.stop_nr).map(s => {
          const cfg = STATUS_CONFIG[s.status];
          const Icon = cfg.icon;
          const isExp = expanded === s.id;
          const isDone = s.status === 'abgeschlossen';

          return (
            <div
              key={s.id}
              className={cn(
                'rounded-lg border p-2.5 transition-colors cursor-pointer',
                isDone ? 'border-white/5 bg-white/3 opacity-60' : 'border-white/10 bg-white/5 hover:bg-white/8'
              )}
              onClick={() => setExpanded(isExp ? null : s.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn('w-2 h-2 rounded-full flex-shrink-0', cfg.dot)} />
                  <span className="text-xs font-medium text-white truncate max-w-[160px]">{s.adresse}</span>
                  {s.bestellnummer && (
                    <span className="text-[10px] text-slate-500">{s.bestellnummer}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {s.zahlungsart === 'bar' && <Banknote className="h-3 w-3 text-amber-400" />}
                  {s.zahlungsart === 'karte' && <CreditCard className="h-3 w-3 text-blue-400" />}
                  {s.betrag != null && <span className="text-xs text-slate-300">{euro(s.betrag)}</span>}
                  {isExp ? <ChevronUp className="h-3 w-3 text-slate-400" /> : <ChevronDown className="h-3 w-3 text-slate-400" />}
                </div>
              </div>

              {isExp && (
                <div className="mt-2 pt-2 border-t border-white/10 space-y-1.5">
                  {s.kunde_name && (
                    <div className="text-xs text-slate-400">{s.kunde_name}</div>
                  )}
                  {s.distanz_km != null && (
                    <div className="text-xs text-slate-400">{s.distanz_km} km entfernt</div>
                  )}
                  {s.eta_min != null && (
                    <div className="text-xs text-slate-400">ETA: {s.eta_min} Min</div>
                  )}
                  {s.notiz && (
                    <div className="text-xs text-amber-300 bg-amber-500/10 px-2 py-1 rounded">⚠ {s.notiz}</div>
                  )}
                  {!isDone && (
                    <button
                      onClick={e => { e.stopPropagation(); openNav(s); }}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-medium hover:bg-blue-500/30 transition-colors"
                    >
                      <Navigation className="h-3.5 w-3.5" />
                      Navigieren
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-[10px] text-slate-600 text-right">15-Sek-Polling · Mock-Fallback</div>
    </div>
  );
}
