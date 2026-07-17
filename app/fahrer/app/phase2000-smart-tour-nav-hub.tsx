'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  MapPin, Navigation, CheckCircle2, Clock, Phone, ChevronRight, Package,
  AlertTriangle, Star, Timer,
} from 'lucide-react';

/**
 * Phase 2000 — Smart Tour Nav Hub (Fahrer App)
 *
 * Erweiterter Tour-Navigations-Hub mit:
 * - Aktueller Stop als große Hero-Karte mit direktem Navigations-Button
 * - ETA-Countdown zum aktuellen Stop
 * - Nächste Stops als kompakte Liste
 * - Schnell-Aktionen: Abgeliefert / Kunden anrufen
 * - Tour-Score-Anzeige
 */

export type SmartTourStop = {
  id: string;
  sequence: number;
  status: 'pending' | 'active' | 'completed';
  address: string;
  customerName?: string | null;
  customerPhone?: string | null;
  etaMin?: number | null;
  notes?: string | null;
  lat?: number | null;
  lng?: number | null;
  orderId?: string;
  orderTotal?: number;
  paymentMethod?: 'bar' | 'karte' | null;
};

interface Props {
  stops: SmartTourStop[];
  tourScore?: number | null;
  onStopComplete?: (stopId: string) => void;
  onNavigate?: (stop: SmartTourStop) => void;
  onCall?: (phone: string) => void;
}

function EtaBadge({ etaMin }: { etaMin: number }) {
  const isLate = etaMin < 0;
  const isUrgent = etaMin >= 0 && etaMin <= 3;

  return (
    <div className={cn(
      'flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm font-black tabular-nums',
      isLate
        ? 'bg-rose-500/20 text-rose-300'
        : isUrgent
          ? 'bg-amber-500/20 text-amber-300 animate-pulse'
          : 'bg-matcha-800/50 text-matcha-300',
    )}>
      <Clock className="h-3.5 w-3.5" />
      {isLate ? `${Math.abs(etaMin)} Min überfällig` : `${etaMin} Min`}
    </div>
  );
}

function navigateToStop(stop: SmartTourStop) {
  if (stop.lat && stop.lng) {
    window.open(`https://maps.google.com/?q=${stop.lat},${stop.lng}&navigate=yes`, '_blank');
  } else {
    window.open(`https://maps.google.com/?q=${encodeURIComponent(stop.address)}&navigate=yes`, '_blank');
  }
}

export function FahrerPhase2000SmartTourNavHub({ stops, tourScore, onStopComplete, onNavigate, onCall }: Props) {
  const [completingId, setCompletingId] = useState<string | null>(null);

  const activeStop = stops.find(s => s.status === 'active');
  const pendingStops = stops.filter(s => s.status === 'pending').sort((a, b) => a.sequence - b.sequence);
  const completedCount = stops.filter(s => s.status === 'completed').length;
  const totalCount = stops.length;

  async function handleComplete(stop: SmartTourStop) {
    if (completingId) return;
    setCompletingId(stop.id);
    try {
      await new Promise(r => setTimeout(r, 500));
      onStopComplete?.(stop.id);
    } finally {
      setCompletingId(null);
    }
  }

  function handleNavigate(stop: SmartTourStop) {
    if (onNavigate) { onNavigate(stop); return; }
    navigateToStop(stop);
  }

  if (stops.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-matcha-400 mb-3" />
        <div className="font-display font-bold text-white">Tour abgeschlossen</div>
        <p className="text-sm text-matcha-200 mt-1">Alle Stops erledigt.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Tour header: progress + score */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {stops.map(s => (
              <div key={s.id} className={cn(
                'h-1.5 rounded-full transition-all',
                s.status === 'completed' ? 'w-4 bg-matcha-400' : s.status === 'active' ? 'w-3 bg-accent animate-pulse' : 'w-2 bg-white/20',
              )} />
            ))}
          </div>
          <span className="text-xs text-matcha-200">
            {completedCount}/{totalCount} Stops
          </span>
        </div>
        {tourScore !== null && tourScore !== undefined && (
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 text-accent fill-accent" />
            <span className={cn(
              'font-mono font-black text-sm',
              tourScore >= 75 ? 'text-emerald-400' : tourScore >= 50 ? 'text-amber-400' : 'text-rose-400',
            )}>
              {tourScore}
            </span>
          </div>
        )}
      </div>

      {/* Current active stop */}
      {activeStop && (
        <div className="rounded-2xl border border-matcha-600/40 bg-matcha-900/60 overflow-hidden">
          {/* Current badge */}
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-accent">
              Aktueller Stop
            </span>
            {activeStop.etaMin !== null && activeStop.etaMin !== undefined && (
              <EtaBadge etaMin={activeStop.etaMin} />
            )}
          </div>

          {/* Address */}
          <div className="px-4 py-2">
            <div className="flex items-start gap-2">
              <MapPin className="h-5 w-5 text-accent shrink-0 mt-0.5" />
              <div>
                <div className="font-display font-bold text-white text-base leading-snug">
                  {activeStop.address}
                </div>
                {activeStop.customerName && (
                  <div className="text-sm text-matcha-200 mt-0.5">{activeStop.customerName}</div>
                )}
              </div>
            </div>

            {/* Order details */}
            {(activeStop.orderTotal || activeStop.paymentMethod || activeStop.notes) && (
              <div className="mt-3 rounded-xl bg-white/5 border border-white/10 p-3 space-y-1.5">
                {activeStop.orderTotal && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-matcha-300">Betrag</span>
                    <span className="font-bold text-white">
                      {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(activeStop.orderTotal)}
                    </span>
                  </div>
                )}
                {activeStop.paymentMethod && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-matcha-300">Zahlung</span>
                    <span className={cn(
                      'font-bold',
                      activeStop.paymentMethod === 'bar' ? 'text-amber-400' : 'text-matcha-300',
                    )}>
                      {activeStop.paymentMethod === 'bar' ? '💵 Bar' : '💳 Karte'}
                    </span>
                  </div>
                )}
                {activeStop.notes && (
                  <div className="flex items-start gap-1.5 text-sm">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                    <span className="text-amber-300">{activeStop.notes}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 px-4 pb-4 pt-1">
            <button
              onClick={() => handleNavigate(activeStop)}
              className="flex items-center justify-center gap-2 rounded-xl bg-accent text-matcha-900 py-3 font-display font-bold text-sm"
            >
              <Navigation className="h-4 w-4" />
              Navigation
            </button>

            <button
              onClick={() => handleComplete(activeStop)}
              disabled={!!completingId}
              className="flex items-center justify-center gap-2 rounded-xl bg-matcha-600 text-white py-3 font-display font-bold text-sm disabled:opacity-50"
            >
              {completingId === activeStop.id ? (
                <Timer className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Abgeliefert
            </button>

            {activeStop.customerPhone && (
              <button
                onClick={() => onCall ? onCall(activeStop.customerPhone!) : window.open(`tel:${activeStop.customerPhone}`)}
                className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-white/10 text-matcha-200 py-2.5 font-bold text-sm"
              >
                <Phone className="h-4 w-4" />
                {activeStop.customerPhone}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Pending stops list */}
      {pendingStops.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="px-4 py-2 border-b border-white/10">
            <span className="text-[10px] font-black uppercase tracking-widest text-matcha-400">
              Nächste Stops ({pendingStops.length})
            </span>
          </div>
          <div className="divide-y divide-white/5">
            {pendingStops.map((stop, i) => (
              <div key={stop.id} className="flex items-center gap-3 px-4 py-3">
                <div className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-matcha-300 shrink-0">
                  {completedCount + (activeStop ? 1 : 0) + i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{stop.address}</div>
                  {stop.customerName && (
                    <div className="text-xs text-matcha-400">{stop.customerName}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {stop.etaMin !== null && stop.etaMin !== undefined && (
                    <span className="text-xs text-matcha-300 tabular-nums">{stop.etaMin}m</span>
                  )}
                  <button
                    onClick={() => handleNavigate(stop)}
                    className="p-1.5 rounded-lg bg-white/10 text-matcha-300"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All done */}
      {!activeStop && pendingStops.length === 0 && completedCount > 0 && (
        <div className="rounded-2xl border border-matcha-600/30 bg-matcha-900/40 p-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-matcha-400 mb-2" />
          <div className="font-display font-bold text-white">Tour abgeschlossen!</div>
          <div className="text-sm text-matcha-200 mt-1">
            {completedCount} Stops · {tourScore !== null && tourScore !== undefined ? `Score: ${tourScore}` : ''}
          </div>
        </div>
      )}
    </div>
  );
}
