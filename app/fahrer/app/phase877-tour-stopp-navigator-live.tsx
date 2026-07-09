'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Navigation, MapPin, Clock, CheckCircle2, ChevronRight } from 'lucide-react';

export interface TourStoppLive {
  id: string;
  address: string;
  customer_name?: string | null;
  sequence: number;
  status: 'pending' | 'arrived' | 'delivered';
  eta_min?: number | null;
  distance_km?: number | null;
  lat?: number | null;
  lng?: number | null;
}

interface Props {
  stops: TourStoppLive[];
  currentStopId?: string | null;
  onNavigate?: (stop: TourStoppLive) => void;
  onMarkDelivered?: (stopId: string) => void;
}

function openNavigation(lat: number | null | undefined, lng: number | null | undefined, address: string) {
  if (lat && lng) {
    window.open(`https://maps.google.com/?daddr=${lat},${lng}`, '_blank');
  } else {
    window.open(`https://maps.google.com/?daddr=${encodeURIComponent(address)}`, '_blank');
  }
}

export function FahrerPhase877TourStoppNavigatorLive({ stops, currentStopId, onNavigate, onMarkDelivered }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = [...stops].sort((a, b) => a.sequence - b.sequence);
  const pending = sorted.filter(s => s.status === 'pending');
  const delivered = sorted.filter(s => s.status === 'delivered');
  const nextStop = pending[0] ?? null;

  useEffect(() => {
    if (nextStop) setExpandedId(nextStop.id);
  }, [nextStop?.id]);

  if (stops.length === 0) return null;

  return (
    <div className="rounded-2xl overflow-hidden border border-white/20 bg-gradient-to-b from-slate-800 to-slate-900 shadow-xl">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2 border-b border-white/10">
        <Navigation className="h-4 w-4 text-blue-400" />
        <span className="text-sm font-bold text-white">Tour-Stopp Navigator</span>
        <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-blue-300">
          {delivered.length}/{stops.length} erledigt
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-white/10">
        <div
          className="h-full bg-blue-500 transition-all duration-500"
          style={{ width: `${stops.length > 0 ? (delivered.length / stops.length) * 100 : 0}%` }}
        />
      </div>

      {/* Next stop highlight */}
      {nextStop && (
        <div
          className={cn(
            'px-4 py-3 cursor-pointer transition-colors',
            expandedId === nextStop.id ? 'bg-blue-600/30' : 'hover:bg-white/5',
          )}
          onClick={() => setExpandedId(v => v === nextStop.id ? null : nextStop.id)}
        >
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-black">
              {nextStop.sequence}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white truncate">
                  {nextStop.customer_name ?? 'Nächster Stopp'}
                </span>
                <span className="shrink-0 rounded bg-blue-500/30 px-1.5 py-0.5 text-[9px] font-bold text-blue-300">
                  NÄCHSTER
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <MapPin className="h-3 w-3 text-blue-400 shrink-0" />
                <span className="text-[11px] text-blue-200 truncate">{nextStop.address}</span>
              </div>
              <div className="flex items-center gap-3 mt-1">
                {nextStop.eta_min != null && (
                  <div className="flex items-center gap-1 text-[10px] text-blue-300">
                    <Clock className="h-3 w-3" />
                    ~{nextStop.eta_min} Min
                  </div>
                )}
                {nextStop.distance_km != null && (
                  <span className="text-[10px] text-blue-300">
                    {nextStop.distance_km.toFixed(1)} km
                  </span>
                )}
              </div>
            </div>
            <ChevronRight className={cn('h-4 w-4 text-blue-400 shrink-0 transition-transform', expandedId === nextStop.id && 'rotate-90')} />
          </div>

          {expandedId === nextStop.id && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={e => { e.stopPropagation(); openNavigation(nextStop.lat, nextStop.lng, nextStop.address); onNavigate?.(nextStop); }}
                className="flex-1 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Navigation className="h-3.5 w-3.5" /> Navigieren
              </button>
              {onMarkDelivered && (
                <button
                  onClick={e => { e.stopPropagation(); onMarkDelivered(nextStop.id); }}
                  className="flex-1 py-2 rounded-xl bg-matcha-600 hover:bg-matcha-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Zugestellt
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Remaining stops list */}
      {pending.slice(1).length > 0 && (
        <div className="divide-y divide-white/5 border-t border-white/10">
          {pending.slice(1).map(stop => (
            <div
              key={stop.id}
              className="px-4 py-2.5 flex items-center gap-3 hover:bg-white/5 cursor-pointer transition-colors"
              onClick={() => setExpandedId(v => v === stop.id ? null : stop.id)}
            >
              <div className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full border border-white/30 text-[9px] font-black text-slate-300">
                {stop.sequence}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-slate-200 truncate">
                  {stop.customer_name ?? stop.address}
                </div>
                {stop.customer_name && (
                  <div className="text-[9px] text-slate-400 truncate">{stop.address}</div>
                )}
              </div>
              {stop.eta_min != null && (
                <span className="text-[10px] text-slate-400 shrink-0">~{stop.eta_min} Min</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delivered stops */}
      {delivered.length > 0 && (
        <div className="px-4 py-2 border-t border-white/10 bg-white/5">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <CheckCircle2 className="h-3 w-3 text-matcha-400" />
            {delivered.length} Stopp{delivered.length !== 1 ? 's' : ''} zugestellt
          </div>
        </div>
      )}
    </div>
  );
}
