'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Navigation, CheckCircle2, Clock, Phone, CreditCard, Banknote, AlertCircle, ChevronDown, ChevronUp, Package } from 'lucide-react';

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
  lat?: number | null;
  lng?: number | null;
}

interface Props {
  fahrerTourId?: string | null;
  isOnline?: boolean;
}

const STATUS_CONFIG = {
  ausstehend: { icon: Clock, color: 'text-slate-400', dot: 'bg-slate-600', label: 'Ausstehend' },
  unterwegs: { icon: Navigation, color: 'text-blue-400', dot: 'bg-blue-400 animate-pulse', label: 'Unterwegs' },
  angekommen: { icon: MapPin, color: 'text-amber-400', dot: 'bg-amber-400', label: 'Angekommen' },
  abgeschlossen: { icon: CheckCircle2, color: 'text-emerald-400', dot: 'bg-emerald-400', label: 'Erledigt' },
  problem: { icon: AlertCircle, color: 'text-red-400', dot: 'bg-red-400', label: 'Problem' },
};

const MOCK_STOPPS: TourStopp[] = [
  { id: 's1', stop_nr: 1, adresse: 'Hauptstraße 12, Aachen', kunde_name: 'M. Müller', kunde_telefon: '+49151000001', eta_min: 5, status: 'unterwegs', zahlungsart: 'karte', betrag: 24.50, bestellnummer: '#4201' },
  { id: 's2', stop_nr: 2, adresse: 'Pontstraße 35, Aachen', kunde_name: 'L. Schmidt', kunde_telefon: '+49151000002', eta_min: 14, status: 'ausstehend', zahlungsart: 'bar', betrag: 18.00, notiz: 'Klingel defekt – anrufen', bestellnummer: '#4202' },
  { id: 's3', stop_nr: 3, adresse: 'Großkölnstraße 8, Aachen', kunde_name: 'K. Weber', kunde_telefon: null, eta_min: 22, status: 'ausstehend', zahlungsart: 'karte', betrag: 31.20, bestellnummer: '#4203' },
];

function openNav(stopp: TourStopp) {
  const addr = encodeURIComponent(stopp.adresse);
  if (stopp.lat && stopp.lng) {
    window.open(`https://maps.google.com/maps?daddr=${stopp.lat},${stopp.lng}&dirflg=d`, '_blank');
  } else {
    window.open(`https://maps.google.com/maps?daddr=${addr}&dirflg=d`, '_blank');
  }
}

export function FahrerPhase5076TourNaviV18({ fahrerTourId, isOnline = true }: Props) {
  const [stopps, setStopps] = useState<TourStopp[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!fahrerTourId) {
      setStopps(MOCK_STOPPS);
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const res = await fetch(`/api/delivery/tours/${fahrerTourId}/stops`);
        if (res.ok) {
          const data = await res.json();
          setStopps(data.stops ?? MOCK_STOPPS);
        } else {
          setStopps(MOCK_STOPPS);
        }
      } catch {
        setStopps(MOCK_STOPPS);
      } finally {
        setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [fahrerTourId]);

  const aktiveStopps = stopps.filter(s => s.status !== 'abgeschlossen');
  const erledigte = stopps.filter(s => s.status === 'abgeschlossen').length;
  const naechster = aktiveStopps[0] ?? null;

  const toggle = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  if (!isOnline) {
    return (
      <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 text-center">
        <p className="text-slate-400 text-sm">Offline — Navi nicht verfügbar</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-500/20">
            <Navigation className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Tour-Navi V18</p>
            <p className="text-xs text-slate-400">{erledigte}/{stopps.length} Stopps erledigt</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-white">{aktiveStopps.length}</p>
          <p className="text-xs text-slate-500">verbleibend</p>
        </div>
      </div>

      {/* Fortschrittsbalken */}
      {stopps.length > 0 && (
        <div className="h-1.5 w-full bg-slate-700/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${(erledigte / stopps.length) * 100}%` }}
          />
        </div>
      )}

      {/* Nächster Stopp Banner */}
      {naechster && (
        <div className="rounded-lg bg-blue-500/15 border border-blue-500/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-300 uppercase tracking-wide">Nächster Stopp</span>
            {naechster.eta_min != null && (
              <span className="text-sm font-bold text-white">{naechster.eta_min}min</span>
            )}
          </div>
          <p className="text-sm font-semibold text-white">{naechster.adresse}</p>
          {naechster.kunde_name && (
            <p className="text-xs text-slate-300">{naechster.kunde_name} · {naechster.bestellnummer}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => openNav(naechster)}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-blue-500 hover:bg-blue-400 text-white rounded-lg py-2 transition-colors"
            >
              <Navigation className="h-3.5 w-3.5" />
              Navigation starten
            </button>
            {naechster.kunde_telefon && (
              <a
                href={`tel:${naechster.kunde_telefon}`}
                className="flex items-center justify-center gap-1.5 text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white rounded-lg px-3 py-2 transition-colors"
              >
                <Phone className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          {naechster.notiz && (
            <p className="text-xs text-amber-400 bg-amber-500/10 rounded px-2 py-1">{naechster.notiz}</p>
          )}
        </div>
      )}

      {/* Alle Stopps */}
      <div className="space-y-1.5">
        {loading ? (
          <div className="text-center py-3 text-slate-500 text-sm">Lade Stopps…</div>
        ) : (
          stopps.map(stopp => {
            const cfg = STATUS_CONFIG[stopp.status];
            const StopIcon = cfg.icon;
            const isExpanded = expandedId === stopp.id;
            const isDone = stopp.status === 'abgeschlossen';

            return (
              <div
                key={stopp.id}
                className={cn('rounded-lg border p-2.5', isDone ? 'bg-slate-800/20 border-white/5 opacity-60' : 'bg-slate-800/40 border-white/8')}
              >
                <button
                  onClick={() => toggle(stopp.id)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2 h-2 rounded-full flex-shrink-0', cfg.dot)} />
                    <span className="text-xs font-bold text-slate-400">#{stopp.stop_nr}</span>
                    <span className="text-xs text-white font-medium truncate max-w-[160px]">{stopp.adresse}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {stopp.eta_min != null && !isDone && (
                      <span className="text-xs text-slate-400">{stopp.eta_min}min</span>
                    )}
                    {stopp.zahlungsart === 'bar' ? (
                      <Banknote className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <CreditCard className="h-3.5 w-3.5 text-blue-400" />
                    )}
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-slate-500" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-500" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-2 pt-2 border-t border-white/5 space-y-1.5">
                    {stopp.kunde_name && <p className="text-xs text-slate-300">Kunde: <span className="text-white">{stopp.kunde_name}</span></p>}
                    {stopp.bestellnummer && <p className="text-xs text-slate-300">Bestellung: <span className="text-white">{stopp.bestellnummer}</span></p>}
                    {stopp.betrag != null && (
                      <p className="text-xs text-slate-300">Betrag: <span className="text-white font-semibold">{stopp.betrag.toFixed(2)} €</span> · {stopp.zahlungsart === 'bar' ? 'Bar' : 'Karte'}</p>
                    )}
                    {stopp.notiz && <p className="text-xs text-amber-400">{stopp.notiz}</p>}
                    <div className="flex gap-2 mt-1.5">
                      {!isDone && (
                        <button
                          onClick={() => openNav(stopp)}
                          className="flex items-center gap-1 text-xs bg-blue-500/20 text-blue-400 rounded px-2 py-1"
                        >
                          <Navigation className="h-3 w-3" />Navigieren
                        </button>
                      )}
                      {stopp.kunde_telefon && (
                        <a href={`tel:${stopp.kunde_telefon}`} className="flex items-center gap-1 text-xs bg-slate-700/50 text-slate-300 rounded px-2 py-1">
                          <Phone className="h-3 w-3" />Anrufen
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
