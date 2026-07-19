'use client';

/**
 * Phase 2480 — Tour-Stopp Navigator Ultimate
 * Vollständige Stop-Liste mit Next-Stop-Fokus, ETA-Countdown,
 * Navigations-Buttons (Google Maps / Waze / Apple Maps), Stop-Bestätigung.
 */

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  MapPin, Navigation2, CheckCircle2, Clock, ChevronRight,
  Phone, MessageSquare, AlertCircle, Package,
} from 'lucide-react';

export interface TourStop {
  id: string;
  nr: number;
  status: 'pending' | 'arrived' | 'done' | 'skipped';
  adresse: string;
  plz?: string;
  ort?: string;
  kunde_name: string;
  telefon?: string | null;
  eta_min: number | null;
  notiz?: string | null;
  betrag?: number;
  lat?: number | null;
  lng?: number | null;
}

function statusIcon(s: TourStop['status']) {
  if (s === 'done') return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (s === 'arrived') return <Package className="h-4 w-4 text-amber-500 animate-pulse" />;
  if (s === 'skipped') return <AlertCircle className="h-4 w-4 text-stone-400" />;
  return <MapPin className="h-4 w-4 text-matcha-500" />;
}

function NavButtons({ lat, lng, adresse }: { lat?: number | null; lng?: number | null; adresse: string }) {
  const query = lat && lng ? `${lat},${lng}` : encodeURIComponent(adresse);
  return (
    <div className="flex gap-1.5 mt-2">
      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${query}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 active:bg-blue-100"
      >
        <Navigation2 className="h-3 w-3" /> Google
      </a>
      <a
        href={`https://waze.com/ul?ll=${lat ?? 0},${lng ?? 0}&navigate=yes`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold py-1.5 rounded-lg bg-cyan-50 text-cyan-700 border border-cyan-200 active:bg-cyan-100"
      >
        <Navigation2 className="h-3 w-3" /> Waze
      </a>
      <a
        href={`maps://maps.apple.com/?daddr=${query}`}
        className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold py-1.5 rounded-lg bg-stone-50 text-stone-700 border border-stone-200 active:bg-stone-100"
      >
        <Navigation2 className="h-3 w-3" /> Apple
      </a>
    </div>
  );
}

function StopCard({
  stop,
  isNext,
  onConfirm,
}: {
  stop: TourStop;
  isNext: boolean;
  onConfirm: (id: string, status: 'arrived' | 'done') => void;
}) {
  const [expanded, setExpanded] = useState(isNext);

  return (
    <div
      className={cn(
        'rounded-xl border transition-all overflow-hidden',
        stop.status === 'done' ? 'opacity-50 bg-stone-50 border-stone-200' :
        stop.status === 'skipped' ? 'opacity-40 bg-stone-50 border-stone-200' :
        isNext ? 'border-matcha-400 bg-matcha-50 shadow-md' : 'bg-card border-border',
      )}
    >
      {/* Row */}
      <button
        className="w-full flex items-center gap-3 p-3 text-left"
        onClick={() => setExpanded(v => !v)}
      >
        <div className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-black text-xs',
          stop.status === 'done' ? 'bg-emerald-100 text-emerald-600' :
          isNext ? 'bg-matcha-600 text-white' : 'bg-muted text-muted-foreground'
        )}>
          {stop.status === 'done' ? <CheckCircle2 className="h-4 w-4" /> : stop.nr}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('text-sm font-bold truncate', stop.status === 'done' ? 'line-through' : '')}>
              {stop.kunde_name}
            </span>
            {isNext && (
              <span className="text-[9px] font-black bg-matcha-600 text-white px-1.5 py-0.5 rounded-full">JETZT</span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">{stop.adresse}</div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-0.5">
          {stop.eta_min !== null && stop.status === 'pending' && (
            <span className={cn(
              'font-mono text-xs font-black tabular-nums',
              stop.eta_min <= 3 ? 'text-red-500' : stop.eta_min <= 8 ? 'text-amber-500' : 'text-matcha-600'
            )}>
              ~{stop.eta_min}m
            </span>
          )}
          {statusIcon(stop.status)}
          <ChevronRight className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
        </div>
      </button>

      {/* Expanded */}
      {expanded && stop.status !== 'done' && stop.status !== 'skipped' && (
        <div className="border-t px-3 pb-3 space-y-2">
          {stop.notiz && (
            <div className="text-[11px] bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 text-amber-700">
              💬 {stop.notiz}
            </div>
          )}
          {stop.betrag !== undefined && (
            <div className="text-[11px] font-bold text-stone-700">
              Betrag: {stop.betrag.toFixed(2).replace('.', ',')} €
            </div>
          )}
          {stop.telefon && (
            <div className="flex gap-2">
              <a href={`tel:${stop.telefon}`}
                className="flex items-center gap-1 text-[10px] font-bold py-1.5 px-3 rounded-lg bg-stone-100 text-stone-700 border border-stone-200">
                <Phone className="h-3 w-3" /> Anrufen
              </a>
              <a href={`sms:${stop.telefon}`}
                className="flex items-center gap-1 text-[10px] font-bold py-1.5 px-3 rounded-lg bg-stone-100 text-stone-700 border border-stone-200">
                <MessageSquare className="h-3 w-3" /> SMS
              </a>
            </div>
          )}
          <NavButtons lat={stop.lat} lng={stop.lng} adresse={`${stop.adresse} ${stop.plz ?? ''} ${stop.ort ?? ''}`} />
          {/* Action Buttons */}
          <div className="flex gap-2 pt-1">
            {stop.status === 'pending' && (
              <button
                onClick={() => onConfirm(stop.id, 'arrived')}
                className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-amber-500 text-white font-bold text-xs active:bg-amber-600"
              >
                <Package className="h-3.5 w-3.5" /> Angekommen
              </button>
            )}
            <button
              onClick={() => onConfirm(stop.id, 'done')}
              className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-matcha-600 text-white font-bold text-xs active:bg-matcha-700"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Zugestellt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface Props {
  stops: TourStop[];
  onStopUpdate?: (id: string, status: 'arrived' | 'done') => void;
}

export function FahrerPhase2480TourStoppNavUltimate({ stops, onStopUpdate }: Props) {
  const [localStops, setLocalStops] = useState<TourStop[]>(stops);

  useEffect(() => { setLocalStops(stops); }, [stops]);

  const handleConfirm = (id: string, status: 'arrived' | 'done') => {
    setLocalStops(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    onStopUpdate?.(id, status);
  };

  const nextStop = localStops.find(s => s.status === 'pending');
  const doneCount = localStops.filter(s => s.status === 'done').length;
  const totalCount = localStops.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Progress Header */}
      <div className="rounded-xl border bg-card p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-matcha-600" />
            <span className="text-xs font-bold uppercase tracking-wider">Tour-Stopps</span>
          </div>
          <span className="text-xs font-bold text-matcha-700">{doneCount}/{totalCount} erledigt</span>
        </div>
        <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-matcha-500 transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {nextStop?.eta_min && (
          <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            Nächster Stopp in ~{nextStop.eta_min} Min: {nextStop.adresse}
          </div>
        )}
      </div>

      {/* Stop Cards */}
      <div className="space-y-2">
        {localStops.map(stop => (
          <StopCard
            key={stop.id}
            stop={stop}
            isNext={stop.id === nextStop?.id}
            onConfirm={handleConfirm}
          />
        ))}
      </div>
    </div>
  );
}
