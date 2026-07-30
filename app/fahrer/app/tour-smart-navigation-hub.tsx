'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Navigation, CheckCircle2, Clock, Phone, Package, ChevronRight, Zap, AlertCircle } from 'lucide-react';

export interface SmartTourStop {
  id: string;
  stop_nr: number;
  adresse: string;
  kunde_name?: string | null;
  kunde_telefon?: string | null;
  eta_min?: number | null;
  status: 'ausstehend' | 'unterwegs' | 'angekommen' | 'abgeschlossen' | 'problem';
  prioritaet?: 'normal' | 'hoch' | 'express';
  notiz?: string | null;
  lat?: number | null;
  lng?: number | null;
  bestellnummer?: string | null;
}

interface Props {
  stops: SmartTourStop[];
  currentStopId?: string | null;
  onStartNavigation?: (stop: SmartTourStop) => void;
  onMarkDone?: (stopId: string) => void;
  onCallCustomer?: (telefon: string) => void;
}

const STATUS_CONFIG = {
  ausstehend: { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-700/40', label: 'Ausstehend' },
  unterwegs: { icon: Navigation, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Unterwegs' },
  angekommen: { icon: MapPin, color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'Angekommen' },
  abgeschlossen: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/15', label: 'Erledigt' },
  problem: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Problem' },
};

const PRIORITAET_BADGES = {
  normal: null,
  hoch: <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-medium">Hoch</span>,
  express: <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5"><Zap className="h-2.5 w-2.5" />Express</span>,
};

function openMapsNavigation(stop: SmartTourStop) {
  const addr = encodeURIComponent(stop.adresse);
  if (stop.lat && stop.lng) {
    // Google Maps mit Koordinaten
    window.open(`https://maps.google.com/maps?daddr=${stop.lat},${stop.lng}&dirflg=d`, '_blank');
  } else {
    window.open(`https://maps.google.com/maps?daddr=${addr}&dirflg=d`, '_blank');
  }
}

export function TourSmartNavigationHub({
  stops,
  currentStopId,
  onStartNavigation,
  onMarkDone,
  onCallCustomer,
}: Props) {
  const [expandedStopId, setExpandedStopId] = useState<string | null>(currentStopId ?? null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    setExpandedStopId(currentStopId ?? null);
  }, [currentStopId]);

  const activeStops = stops.filter(s => s.status !== 'abgeschlossen');
  const doneStops = stops.filter(s => s.status === 'abgeschlossen');
  const nextStop = activeStops[0] ?? null;

  const handleNav = useCallback((stop: SmartTourStop) => {
    openMapsNavigation(stop);
    onStartNavigation?.(stop);
  }, [onStartNavigation]);

  if (!stops.length) {
    return (
      <div className="rounded-xl border border-slate-700/40 bg-slate-900/60 p-6 text-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
        <p className="text-slate-300 font-medium">Tour abgeschlossen</p>
        <p className="text-slate-500 text-sm mt-1">Alle Stopps erledigt</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700/40 bg-slate-900/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/60 border-b border-slate-700/40">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-semibold text-slate-200">Tour Navigation</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            {doneStops.length}/{stops.length}
          </span>
          {activeStops.length > 0 && (
            <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-medium">
              {activeStops.length} offen
            </span>
          )}
        </div>
      </div>

      {/* Nächster Stop Banner */}
      {nextStop && nextStop.status !== 'abgeschlossen' && (
        <div className="bg-blue-600/20 border-b border-blue-500/30 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white">
                {nextStop.stop_nr}
              </div>
              <div>
                <p className="text-xs text-blue-300 font-medium">Nächster Stopp</p>
                <p className="text-sm text-white font-semibold leading-tight">{nextStop.adresse}</p>
              </div>
            </div>
            <button
              onClick={() => handleNav(nextStop)}
              className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-400 active:bg-blue-600 text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors"
            >
              <Navigation className="h-4 w-4" />
              Start
            </button>
          </div>
          {nextStop.eta_min !== null && nextStop.eta_min !== undefined && (
            <p className="text-xs text-blue-300/70 mt-1.5 ml-8">
              ETA: ca. {nextStop.eta_min} min
            </p>
          )}
        </div>
      )}

      {/* Stop-Liste */}
      <div className="divide-y divide-slate-700/30">
        {stops.map((stop, idx) => {
          const config = STATUS_CONFIG[stop.status];
          const Icon = config.icon;
          const isDone = stop.status === 'abgeschlossen';
          const isCurrent = stop.id === currentStopId || stop.id === expandedStopId;
          const isExpanded = expandedStopId === stop.id;

          return (
            <div
              key={stop.id}
              className={cn(
                'transition-all',
                isDone ? 'opacity-50' : '',
                isCurrent && !isDone ? 'bg-slate-800/30' : ''
              )}
            >
              {/* Stop-Header (immer sichtbar) */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                onClick={() => setExpandedStopId(isExpanded ? null : stop.id)}
              >
                {/* Stop-Nummer */}
                <div className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                  isDone ? 'bg-emerald-500/20 text-emerald-400' :
                  isCurrent ? 'bg-blue-500 text-white' :
                  'bg-slate-700/60 text-slate-400'
                )}>
                  {isDone ? <CheckCircle2 className="h-4 w-4" /> : stop.stop_nr}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={cn('text-sm font-medium truncate', isDone ? 'text-slate-500 line-through' : 'text-slate-200')}>
                      {stop.adresse}
                    </p>
                    {stop.prioritaet && stop.prioritaet !== 'normal' && PRIORITAET_BADGES[stop.prioritaet]}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className={cn('flex items-center gap-1 text-xs', config.color)}>
                      <Icon className="h-3 w-3" />
                      {config.label}
                    </div>
                    {stop.eta_min !== null && stop.eta_min !== undefined && !isDone && (
                      <span className="text-xs text-slate-500">· ~{stop.eta_min}min</span>
                    )}
                    {stop.bestellnummer && (
                      <span className="text-xs text-slate-600">#{stop.bestellnummer}</span>
                    )}
                  </div>
                </div>

                <ChevronRight className={cn(
                  'h-4 w-4 text-slate-600 shrink-0 transition-transform',
                  isExpanded ? 'rotate-90' : ''
                )} />
              </button>

              {/* Erweiterte Aktionen */}
              {isExpanded && !isDone && (
                <div className="px-4 pb-3 pl-14 space-y-2">
                  {stop.notiz && (
                    <p className="text-xs text-amber-300/80 bg-amber-500/10 rounded-lg px-2 py-1.5">
                      📝 {stop.notiz}
                    </p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => handleNav(stop)}
                      className="flex items-center gap-1.5 bg-blue-600/30 hover:bg-blue-600/40 text-blue-300 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors border border-blue-500/30"
                    >
                      <Navigation className="h-3.5 w-3.5" />
                      Navigation öffnen
                    </button>
                    {stop.kunde_telefon && (
                      <button
                        onClick={() => { window.location.href = `tel:${stop.kunde_telefon}`; onCallCustomer?.(stop.kunde_telefon!); }}
                        className="flex items-center gap-1.5 bg-slate-700/40 hover:bg-slate-700/60 text-slate-300 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors border border-slate-600/30"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        Anrufen
                      </button>
                    )}
                    {onMarkDone && (
                      <button
                        onClick={() => onMarkDone(stop.id)}
                        className="flex items-center gap-1.5 bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors border border-emerald-500/30"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Abschließen
                      </button>
                    )}
                  </div>
                  {stop.kunde_name && (
                    <p className="text-xs text-slate-500">
                      Empfänger: <span className="text-slate-400">{stop.kunde_name}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer: Tour-Zusammenfassung */}
      {doneStops.length > 0 && activeStops.length === 0 && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-500/10 border-t border-emerald-500/20">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span className="text-sm text-emerald-300 font-medium">Alle {stops.length} Stopps abgeschlossen!</span>
        </div>
      )}
    </div>
  );
}
