'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Clock, MapPin, Navigation, Phone } from 'lucide-react';

interface Stop {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  angekommen_am: string | null;
  order_id: string;
  adresse: string | null;
  kunde_name: string | null;
  kunde_telefon: string | null;
  eta_min: number | null;
}

function fmtSec(totalSec: number) {
  const m = Math.floor(Math.abs(totalSec) / 60);
  const s = Math.abs(totalSec) % 60;
  return (totalSec < 0 ? '-' : '') + `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function FahrerPhase2878NaechsterStoppGpsNavigationsKommando({
  stops,
  batchId,
  isOnline = true,
}: {
  stops: Stop[];
  batchId?: string;
  isOnline?: boolean;
}) {
  const [tick, setTick] = useState(0);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  if (!isOnline) return null;

  const pendingStops = stops
    .filter(s => !s.geliefert_am)
    .sort((a, b) => a.reihenfolge - b.reihenfolge);

  const current = pendingStops[0] ?? null;
  const upcoming = pendingStops.slice(1, 4);
  const doneCount = stops.filter(s => !!s.geliefert_am).length;
  const totalCount = stops.length;

  const etaSec = current?.eta_min != null ? current.eta_min * 60 - tick : null;

  if (!current) {
    return (
      <div className="rounded-2xl border border-matcha-200 bg-matcha-50 px-4 py-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-matcha-600 mb-2" />
        <div className="text-sm font-black text-matcha-700">Tour abgeschlossen!</div>
        <div className="text-xs text-matcha-600 mt-0.5">{totalCount} Stopps erledigt</div>
      </div>
    );
  }

  const etaColor = etaSec === null
    ? 'text-stone-500'
    : etaSec > 180 ? 'text-matcha-700'
    : etaSec > 0 ? 'text-amber-700'
    : 'text-rose-700';

  const cardBorder = etaSec !== null && etaSec <= 0
    ? 'border-rose-400'
    : etaSec !== null && etaSec <= 180
    ? 'border-amber-400'
    : 'border-matcha-300';

  return (
    <div className="space-y-3">
      {/* Hero: Nächster Stopp */}
      <div className={cn('rounded-2xl border-2 bg-white overflow-hidden', cardBorder)}>
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-stone-50 to-white border-b border-stone-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-900">
                <span className="text-xs font-black text-white">{current.reihenfolge}</span>
              </div>
              <div>
                <div className="text-xs font-black text-char">Nächster Stopp</div>
                <div className="text-[10px] text-stone-400">{doneCount}/{totalCount} abgeschlossen</div>
              </div>
            </div>
            {/* ETA Countdown */}
            {etaSec !== null && (
              <div className="text-right">
                <div className={cn('text-2xl font-black tabular-nums leading-none', etaColor)}>
                  {fmtSec(etaSec)}
                </div>
                <div className="text-[9px] text-stone-400">{etaSec < 0 ? 'überfällig' : 'bis Ankunft'}</div>
              </div>
            )}
          </div>
        </div>

        {/* Adresse */}
        <div className="px-4 py-3">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-stone-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-bold text-char leading-snug">
                {current.adresse ?? 'Adresse nicht verfügbar'}
              </div>
              {current.kunde_name && (
                <div className="text-[11px] text-stone-500 mt-0.5">{current.kunde_name}</div>
              )}
            </div>
          </div>
        </div>

        {/* Fortschrittsleiste */}
        <div className="px-4 pb-2">
          <div className="h-2 w-full rounded-full bg-stone-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-matcha-500 transition-all duration-700"
              style={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-stone-400">{doneCount} fertig</span>
            <span className="text-[9px] text-stone-400">{totalCount - doneCount} ausstehend</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-4 pb-4 grid grid-cols-3 gap-2">
          {/* Navigation */}
          <a
            href={current.adresse
              ? `https://maps.google.com/?q=${encodeURIComponent(current.adresse)}`
              : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex flex-col items-center justify-center gap-1 rounded-xl py-3 text-white font-bold text-xs transition-transform active:scale-95',
              'bg-blue-600 hover:bg-blue-700',
            )}
          >
            <Navigation className="h-5 w-5" />
            <span className="text-[10px]">Google Maps</span>
          </a>

          {/* Anruf */}
          {current.kunde_telefon ? (
            <a
              href={`tel:${current.kunde_telefon}`}
              className="flex flex-col items-center justify-center gap-1 rounded-xl py-3 bg-matcha-600 text-white font-bold text-xs transition-transform active:scale-95 hover:bg-matcha-700"
            >
              <Phone className="h-5 w-5" />
              <span className="text-[10px]">Anrufen</span>
            </a>
          ) : (
            <div className="flex flex-col items-center justify-center gap-1 rounded-xl py-3 bg-stone-100 text-stone-400 text-xs">
              <Phone className="h-5 w-5" />
              <span className="text-[10px]">Kein Tel.</span>
            </div>
          )}

          {/* Bestätigen */}
          <button
            onClick={() => setConfirming(true)}
            disabled={confirming}
            className="flex flex-col items-center justify-center gap-1 rounded-xl py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-transform active:scale-95 disabled:opacity-60"
          >
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-[10px]">{confirming ? '...' : 'Bestätigen'}</span>
          </button>
        </div>

        {/* Alert: überfällig */}
        {etaSec !== null && etaSec < -120 && (
          <div className="mx-4 mb-3 flex items-center gap-1.5 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
            <span className="text-[10px] font-bold text-rose-700">ETA überschritten um {fmtSec(-etaSec)}</span>
          </div>
        )}
      </div>

      {/* Weitere Stopps */}
      {upcoming.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <div className="px-4 py-2 border-b border-stone-100 bg-stone-50">
            <span className="text-[10px] font-black uppercase tracking-wide text-stone-500">Weitere Stopps</span>
          </div>
          <div className="divide-y divide-stone-100">
            {upcoming.map(s => (
              <div key={s.id} className="px-4 py-2.5 flex items-center gap-3">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-stone-100 text-[9px] font-black text-stone-500 shrink-0">
                  {s.reihenfolge}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-char truncate">{s.adresse ?? '—'}</div>
                  {s.kunde_name && <div className="text-[9px] text-stone-400">{s.kunde_name}</div>}
                </div>
                {s.eta_min != null && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Clock className="h-3 w-3 text-stone-400" />
                    <span className="text-[10px] text-stone-500">~{s.eta_min} Min</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
