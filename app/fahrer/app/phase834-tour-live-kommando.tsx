'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Navigation, Clock, CheckCircle2, Circle, ChevronRight, Zap, Timer } from 'lucide-react';

interface TourStop {
  id: string;
  stopp_nr: number;
  adresse: string;
  kunde_name?: string | null;
  lat?: number | null;
  lng?: number | null;
  geliefert_am?: string | null;
  geschaetzte_ankunft?: string | null;
  soll_ankunft?: string | null;
}

interface Props {
  stops: TourStop[];
  driverLat?: number | null;
  driverLng?: number | null;
}

function secsUntil(target: string | null | undefined): number | null {
  if (!target) return null;
  const diff = Math.round((new Date(target).getTime() - Date.now()) / 1000);
  return diff;
}

function fmtDuration(secs: number): string {
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = secs < 0 ? '-' : '';
  return m > 0 ? `${sign}${m} min` : `${sign}${s} s`;
}

function urgencyClass(secs: number | null): string {
  if (secs === null) return 'border-stone-200 bg-stone-50';
  if (secs < -60) return 'border-red-400 bg-red-50 animate-pulse';
  if (secs < 120) return 'border-orange-400 bg-orange-50';
  if (secs < 300) return 'border-amber-300 bg-amber-50';
  return 'border-matcha-300 bg-matcha-50';
}

function urgencyBadge(secs: number | null) {
  if (secs === null) return null;
  if (secs < -60) return { text: 'Überfällig', cls: 'bg-red-100 text-red-700' };
  if (secs < 0) return { text: 'Jetzt', cls: 'bg-orange-100 text-orange-700' };
  if (secs < 120) return { text: 'In Kürze', cls: 'bg-amber-100 text-amber-700' };
  if (secs < 300) return { text: `${fmtDuration(secs)}`, cls: 'bg-yellow-100 text-yellow-700' };
  return { text: fmtDuration(secs), cls: 'bg-matcha-100 text-matcha-700' };
}

function openNavigation(lat: number, lng: number, adresse: string) {
  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad/i.test(ua);
  const url = isIos
    ? `maps://maps.apple.com/?daddr=${lat},${lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodeURIComponent(adresse)}`;
  window.open(url, '_blank');
}

export function FahrerPhase834TourLiveKommando({ stops, driverLat, driverLng }: Props) {
  const [now, setNow] = useState(Date.now());
  const [expanded, setExpanded] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    timerRef.current = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(timerRef.current);
  }, []);

  const pending = stops.filter((s) => !s.geliefert_am);
  const done = stops.filter((s) => !!s.geliefert_am);
  const nextStop = pending[0] ?? null;

  const nextEta = secsUntil(nextStop?.geschaetzte_ankunft ?? nextStop?.soll_ankunft);

  if (stops.length === 0) return null;

  const progressPct = stops.length > 0 ? Math.round((done.length / stops.length) * 100) : 0;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 bg-stone-50 border-b border-stone-100 hover:bg-stone-100 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-matcha-500 text-white shrink-0">
          <Navigation className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-bold text-stone-800">Tour-Kommando Live</div>
          <div className="text-[11px] text-stone-500">
            {done.length}/{stops.length} Stopps · {progressPct}%
          </div>
        </div>
        {/* Progress bar */}
        <div className="w-20 h-2 rounded-full bg-stone-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-matcha-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </button>

      {expanded && (
        <div className="p-3 space-y-2">
          {/* Next stop hero */}
          {nextStop && (
            <div className={cn('rounded-xl border-2 p-3 transition-colors', urgencyClass(nextEta))}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white border-2 border-stone-300 text-[11px] font-black text-stone-700 mt-0.5">
                    {nextStop.stopp_nr}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-0.5">
                      Nächster Stopp
                    </div>
                    <div className="text-sm font-bold text-stone-800 leading-snug truncate">
                      {nextStop.kunde_name ?? `Stopp ${nextStop.stopp_nr}`}
                    </div>
                    <div className="text-[11px] text-stone-500 truncate">{nextStop.adresse}</div>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1.5">
                  {urgencyBadge(nextEta) && (
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', urgencyBadge(nextEta)!.cls)}>
                      {urgencyBadge(nextEta)!.text}
                    </span>
                  )}
                  {nextStop.lat && nextStop.lng && (
                    <button
                      onClick={() => openNavigation(nextStop.lat!, nextStop.lng!, nextStop.adresse)}
                      className="flex items-center gap-1 rounded-lg bg-matcha-500 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-matcha-600 active:scale-95 transition-all"
                    >
                      <Navigation className="h-3 w-3" />
                      Navi
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* All stops list */}
          <div className="space-y-1">
            {stops.map((stop, idx) => {
              const eta = secsUntil(stop.geschaetzte_ankunft ?? stop.soll_ankunft);
              const isDone = !!stop.geliefert_am;
              const isNext = !isDone && idx === done.length;
              return (
                <div
                  key={stop.id}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl px-3 py-2 border transition-colors',
                    isDone ? 'border-transparent bg-stone-50 opacity-50' : isNext ? 'border-matcha-300 bg-matcha-50' : 'border-stone-100 bg-white',
                  )}
                >
                  <div className="shrink-0">
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-matcha-500" />
                    ) : (
                      <Circle className={cn('h-4 w-4', isNext ? 'text-matcha-600' : 'text-stone-300')} />
                    )}
                  </div>
                  <span className={cn('text-[10px] font-black rounded-full h-4 w-4 flex items-center justify-center shrink-0', isDone ? 'bg-stone-200 text-stone-500' : isNext ? 'bg-matcha-500 text-white' : 'bg-stone-100 text-stone-600')}>
                    {stop.stopp_nr}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-stone-800 truncate">
                      {stop.kunde_name ?? stop.adresse}
                    </div>
                    {!isDone && stop.adresse !== (stop.kunde_name ?? '') && (
                      <div className="text-[10px] text-stone-400 truncate">{stop.adresse}</div>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    {!isDone && eta !== null && (
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', eta < 0 ? 'text-red-600 bg-red-50' : eta < 300 ? 'text-amber-600 bg-amber-50' : 'text-matcha-600 bg-matcha-50')}>
                        {fmtDuration(eta)}
                      </span>
                    )}
                    {isDone && (
                      <span className="text-[10px] text-stone-400">
                        {new Date(stop.geliefert_am!).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {!isDone && stop.lat && stop.lng && (
                      <button
                        onClick={() => openNavigation(stop.lat!, stop.lng!, stop.adresse)}
                        className="p-1 rounded-lg bg-stone-100 hover:bg-matcha-100 text-stone-500 hover:text-matcha-700 transition-colors"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {pending.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-3 text-matcha-600">
              <Zap className="h-4 w-4" />
              <span className="text-sm font-bold">Alle Stopps erledigt!</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
