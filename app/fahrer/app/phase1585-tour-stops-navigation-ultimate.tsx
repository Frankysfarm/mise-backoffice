'use client';

import React, { useState, useMemo } from 'react';

interface TourStop {
  id: string;
  sequence?: number;
  kunde_name?: string | null;
  adresse?: string | null;
  strasse?: string | null;
  hausnummer?: string | null;
  ort?: string | null;
  eta_min?: number | null;
  status?: string;
  geliefert_am?: string | null;
  notiz?: string | null;
}

interface Props {
  stops?: TourStop[];
  currentStopId?: string | null;
  onNavStart?: (stop: TourStop) => void;
  onMarkDelivered?: (stopId: string) => void;
}

const MOCK_STOPS: TourStop[] = [
  { id: 's1', sequence: 1, kunde_name: 'Max Müller', strasse: 'Hauptstr.', hausnummer: '12', ort: 'München', eta_min: 3, geliefert_am: new Date(Date.now() - 5 * 60_000).toISOString() },
  { id: 's2', sequence: 2, kunde_name: 'Anna Schmidt', strasse: 'Bahnhofstr.', hausnummer: '7', ort: 'München', eta_min: 2, status: 'aktiv' },
  { id: 's3', sequence: 3, kunde_name: 'Lars Weber', strasse: 'Marienplatz', hausnummer: '3', ort: 'München', eta_min: 8 },
  { id: 's4', sequence: 4, kunde_name: 'Jana Klein', strasse: 'Leopoldstr.', hausnummer: '44', ort: 'München', eta_min: 14 },
];

export function FahrerPhase1585TourStopsNavigationUltimate({
  stops: propStops,
  currentStopId,
  onNavStart,
  onMarkDelivered,
}: Props) {
  const [open, setOpen] = useState(true);
  const [delivered, setDelivered] = useState<Set<string>>(new Set());

  const stops = propStops && propStops.length > 0 ? propStops : MOCK_STOPS;

  const sorted = useMemo(
    () => [...stops].sort((a, b) => (a.sequence ?? 99) - (b.sequence ?? 99)),
    [stops],
  );

  const done = sorted.filter((s) => s.geliefert_am || delivered.has(s.id)).length;
  const pct = sorted.length > 0 ? Math.round((done / sorted.length) * 100) : 0;

  const current = sorted.find(
    (s) => s.id === currentStopId || (s.status === 'aktiv' && !s.geliefert_am && !delivered.has(s.id)),
  ) ?? sorted.find((s) => !s.geliefert_am && !delivered.has(s.id));

  if (!open) return null;

  function fullAddr(s: TourStop) {
    if (s.adresse) return s.adresse;
    return [s.strasse, s.hausnummer, s.ort].filter(Boolean).join(' ');
  }

  function handleDeliver(stopId: string) {
    setDelivered((prev) => new Set([...prev, stopId]));
    onMarkDelivered?.(stopId);
  }

  return (
    <div className="rounded-2xl border border-matcha-200 bg-white overflow-hidden mb-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-matcha-600 text-white">
        <span className="text-sm font-bold uppercase tracking-wider flex-1">Tour-Navigation</span>
        <span className="text-xs font-bold bg-white/20 rounded-full px-2 py-0.5">
          {done}/{sorted.length} Stops
        </span>
        <button onClick={() => setOpen(false)} className="text-lg leading-none text-white/60 hover:text-white">×</button>
      </div>

      {/* Progress */}
      <div className="px-4 py-2 bg-matcha-50 border-b border-matcha-200">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase text-matcha-600">Fortschritt</span>
          <span className="text-[10px] font-black text-matcha-700 tabular-nums">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-matcha-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-matcha-500 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Current Stop Highlight */}
      {current && (
        <div className="px-4 py-3 bg-matcha-50/60 border-b border-matcha-100">
          <div className="text-[10px] font-bold uppercase text-matcha-500 mb-1">Aktueller Stop</div>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-matcha-600 text-white font-black text-sm">
              {current.sequence ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-foreground truncate">{current.kunde_name ?? 'Kunde'}</div>
              <div className="text-xs text-muted-foreground truncate">{fullAddr(current)}</div>
              {current.eta_min && (
                <div className="text-[11px] text-matcha-600 font-bold mt-0.5">~{current.eta_min} Min</div>
              )}
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                onClick={() => onNavStart?.(current)}
                className="rounded-lg bg-matcha-600 text-white text-[10px] font-bold px-2.5 py-1.5 hover:bg-matcha-700 active:scale-95 transition"
              >
                Navigieren
              </button>
              <button
                onClick={() => handleDeliver(current.id)}
                className="rounded-lg bg-white border border-matcha-300 text-matcha-700 text-[10px] font-bold px-2.5 py-1.5 hover:bg-matcha-50 active:scale-95 transition"
              >
                Geliefert ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stop List */}
      <div className="divide-y divide-border/60">
        {sorted.map((s) => {
          const isDone = !!s.geliefert_am || delivered.has(s.id);
          const isCurrent = s.id === current?.id;
          return (
            <div
              key={s.id}
              className={`flex items-center gap-3 px-4 py-2.5 ${
                isCurrent ? 'bg-matcha-50' : isDone ? 'opacity-50' : ''
              }`}
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                  isDone
                    ? 'bg-emerald-100 text-emerald-600'
                    : isCurrent
                    ? 'bg-matcha-600 text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isDone ? '✓' : (s.sequence ?? '?')}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-bold truncate ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                  {s.kunde_name ?? 'Kunde'}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">{fullAddr(s)}</div>
              </div>
              {s.eta_min && !isDone && (
                <div className={`text-[10px] font-bold tabular-nums shrink-0 ${isCurrent ? 'text-matcha-600' : 'text-muted-foreground'}`}>
                  ~{s.eta_min}m
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
