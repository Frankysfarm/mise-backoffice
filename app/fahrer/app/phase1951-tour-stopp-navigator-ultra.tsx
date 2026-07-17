'use client';

import { useState } from 'react';
import { MapPin, Phone, Navigation, ChevronDown, ChevronUp, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stop {
  id: string;
  sequence: number;
  status: 'neu' | 'unterwegs' | 'geliefert';
  kunde_name: string | null;
  adresse: string | null;
  telefon?: string | null;
  lat?: number | null;
  lng?: number | null;
  notiz?: string | null;
}

interface Props {
  stops: Stop[];
  onNavigate?: (stop: Stop) => void;
  className?: string;
}

export function FahrerPhase1951TourStoppNavigatorUltra({ stops, onNavigate, className }: Props) {
  const [open, setOpen] = useState(true);

  const sorted = [...stops].sort((a, b) => a.sequence - b.sequence);
  const nextStop = sorted.find(s => s.status === 'neu' || s.status === 'unterwegs');
  const donePct = stops.length > 0
    ? Math.round((stops.filter(s => s.status === 'geliefert').length / stops.length) * 100)
    : 0;

  function buildNavUrl(stop: Stop): string {
    if (stop.lat && stop.lng) {
      return `https://maps.google.com/?q=${stop.lat},${stop.lng}`;
    }
    if (stop.adresse) {
      return `https://maps.google.com/?q=${encodeURIComponent(stop.adresse)}`;
    }
    return '#';
  }

  return (
    <div className={cn('rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-800 overflow-hidden', className)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-blue-500" />
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">Tour-Navigator</span>
          <span className="text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-bold">
            {donePct}% erledigt
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-blue-100 dark:border-blue-800 px-4 pb-4 pt-3 space-y-3">
          {/* Fortschrittsbalken */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>{stops.filter(s => s.status === 'geliefert').length} von {stops.length} Stopps</span>
              <span>{donePct}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-500"
                style={{ width: `${donePct}%` }}
              />
            </div>
          </div>

          {/* Nächster Stopp — prominente Anzeige */}
          {nextStop && (
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-700 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                <Navigation className="w-3 h-3" />
                Nächster Stopp
              </div>

              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {nextStop.kunde_name ?? 'Kunde'}
                </p>
                {nextStop.adresse && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{nextStop.adresse}</p>
                )}
                {nextStop.notiz && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 italic">📝 {nextStop.notiz}</p>
                )}
              </div>

              <div className="flex gap-2">
                <a
                  href={buildNavUrl(nextStop)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onNavigate?.(nextStop)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 text-white rounded-lg py-2 text-xs font-bold hover:bg-blue-700 transition-colors"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Navigation starten
                </a>
                {nextStop.telefon && (
                  <a
                    href={`tel:${nextStop.telefon}`}
                    className="flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Stopp-Liste */}
          <div className="space-y-1.5">
            {sorted.map(stop => (
              <div
                key={stop.id}
                className={cn(
                  'flex items-start gap-2.5 rounded-lg p-2',
                  stop.status === 'geliefert' ? 'bg-green-50 dark:bg-green-950/20' :
                  stop.id === nextStop?.id ? 'bg-blue-50 dark:bg-blue-950/20' :
                  'bg-slate-50 dark:bg-slate-700/30',
                )}
              >
                <div className="mt-0.5">
                  {stop.status === 'geliefert' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <Circle className={cn(
                      'w-4 h-4',
                      stop.id === nextStop?.id ? 'text-blue-500' : 'text-slate-300 dark:text-slate-600',
                    )} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      'text-xs font-semibold truncate',
                      stop.status === 'geliefert' ? 'text-green-700 dark:text-green-400 line-through' : 'text-slate-700 dark:text-slate-200',
                    )}>
                      {stop.sequence}. {stop.kunde_name ?? 'Kunde'}
                    </span>
                    {stop.status !== 'geliefert' && (
                      <a
                        href={buildNavUrl(stop)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 ml-2"
                      >
                        <MapPin className="w-3.5 h-3.5 text-blue-400" />
                      </a>
                    )}
                  </div>
                  {stop.adresse && (
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">{stop.adresse}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
