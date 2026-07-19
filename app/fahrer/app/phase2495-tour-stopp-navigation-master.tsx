'use client';

/**
 * Phase 2495 — Tour-Stopp Navigation Master
 * Aktueller Stopp im Fokus, komplette Stop-Liste, Navigation-Buttons,
 * ETA-Countdown, Fortschrittsring, Schnell-Bestätigung. Mobile-optimiert.
 */

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  MapPin, Navigation2, CheckCircle2, Clock, Phone, Package,
  ChevronRight, AlertCircle, Map, Bike, Target, Star,
} from 'lucide-react';

export interface MasterTourStop {
  id: string;
  nr: number;
  status: 'pending' | 'arrived' | 'done' | 'skipped';
  adresse: string;
  ort?: string;
  plz?: string;
  kunde_name: string;
  telefon?: string | null;
  eta_min: number | null;
  notiz?: string | null;
  betrag?: number;
  lat?: number | null;
  lng?: number | null;
  bezahlt?: boolean;
}

interface Props {
  stops: MasterTourStop[];
  batchId: string;
  onConfirmArrival?: (stopId: string) => void;
  onConfirmDelivery?: (stopId: string) => void;
  fahrerName?: string;
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 24;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? done / total : 0;
  const offset = circ * (1 - pct);
  return (
    <svg width={58} height={58} className="shrink-0">
      <circle cx={29} cy={29} r={r} fill="none" stroke="#e5e7eb" strokeWidth={5} />
      <circle
        cx={29} cy={29} r={r} fill="none"
        stroke={pct >= 1 ? '#22c55e' : pct >= 0.5 ? '#f59e0b' : '#4d7c0f'}
        strokeWidth={5}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 29 29)"
        className="transition-all duration-700"
      />
      <text x={29} y={26} textAnchor="middle" fontSize={11} fontWeight="900" fill="#374151" fontFamily="monospace">
        {done}
      </text>
      <text x={29} y={37} textAnchor="middle" fontSize={9} fill="#9ca3af" fontFamily="sans-serif">
        /{total}
      </text>
    </svg>
  );
}

function NavButtons({ lat, lng, adresse }: { lat?: number | null; lng?: number | null; adresse: string }) {
  const coords = lat && lng ? `${lat},${lng}` : '';
  const query = coords || encodeURIComponent(adresse);
  return (
    <div className="grid grid-cols-3 gap-1.5 mt-2">
      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${query}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col items-center gap-0.5 py-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 active:bg-blue-100 transition-colors"
      >
        <Navigation2 className="h-4 w-4" />
        <span className="text-[9px] font-bold">Google</span>
      </a>
      <a
        href={lat && lng ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes` : `https://waze.com/ul?q=${encodeURIComponent(adresse)}&navigate=yes`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col items-center gap-0.5 py-2 rounded-xl bg-cyan-50 text-cyan-700 border border-cyan-200 active:bg-cyan-100 transition-colors"
      >
        <Map className="h-4 w-4" />
        <span className="text-[9px] font-bold">Waze</span>
      </a>
      <a
        href={lat && lng ? `maps://maps.apple.com/?daddr=${lat},${lng}` : `maps://maps.apple.com/?daddr=${encodeURIComponent(adresse)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col items-center gap-0.5 py-2 rounded-xl bg-stone-50 text-stone-700 border border-stone-200 active:bg-stone-100 transition-colors"
      >
        <MapPin className="h-4 w-4" />
        <span className="text-[9px] font-bold">Apple</span>
      </a>
    </div>
  );
}

function CurrentStopCard({
  stop,
  onArrival,
  onDelivery,
}: {
  stop: MasterTourStop;
  onArrival?: (id: string) => void;
  onDelivery?: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border-2 border-matcha-500 bg-matcha-50 dark:bg-matcha-950/20 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Target className="h-4 w-4 text-matcha-600" />
        <span className="text-[10px] font-black uppercase tracking-wider text-matcha-700">
          Aktueller Stopp #{stop.nr}
        </span>
        {stop.eta_min !== null && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-matcha-600">
            <Clock className="h-3 w-3" /> ~{stop.eta_min} min
          </span>
        )}
      </div>

      <div className="text-base font-black leading-tight mb-0.5">{stop.adresse}</div>
      {(stop.plz || stop.ort) && (
        <div className="text-sm text-muted-foreground mb-2">
          {stop.plz} {stop.ort}
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-bold">{stop.kunde_name}</span>
        {stop.telefon && (
          <a
            href={`tel:${stop.telefon}`}
            className="flex items-center gap-1 text-[10px] text-blue-600 font-semibold ml-auto"
          >
            <Phone className="h-3 w-3" /> Anrufen
          </a>
        )}
        {stop.betrag !== undefined && (
          <span className={cn(
            'text-[10px] font-black px-1.5 py-0.5 rounded-full ml-auto',
            stop.bezahlt ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          )}>
            {stop.bezahlt ? '✓ Bezahlt' : `€${stop.betrag?.toFixed(2)} kassieren`}
          </span>
        )}
      </div>

      {stop.notiz && (
        <div className="flex items-start gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 px-3 py-2 mb-3 text-xs text-amber-800">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          {stop.notiz}
        </div>
      )}

      <NavButtons lat={stop.lat} lng={stop.lng} adresse={stop.adresse} />

      <div className="grid grid-cols-2 gap-2 mt-3">
        {stop.status === 'pending' && onArrival && (
          <button
            onClick={() => onArrival(stop.id)}
            className="col-span-2 flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 text-white font-bold text-sm active:bg-amber-600 transition-colors"
          >
            <Package className="h-4 w-4" /> Angekommen
          </button>
        )}
        {stop.status === 'arrived' && onDelivery && (
          <button
            onClick={() => onDelivery(stop.id)}
            className="col-span-2 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 text-white font-bold text-sm active:bg-emerald-600 transition-colors"
          >
            <CheckCircle2 className="h-4 w-4" /> Zugestellt ✓
          </button>
        )}
      </div>
    </div>
  );
}

export function FahrerPhase2495TourStoppNavigationMaster({
  stops,
  batchId,
  onConfirmArrival,
  onConfirmDelivery,
  fahrerName,
}: Props) {
  const [expandedAll, setExpandedAll] = useState(false);

  const done = stops.filter(s => s.status === 'done');
  const pending = stops.filter(s => s.status !== 'done' && s.status !== 'skipped');
  const currentStop = pending[0] ?? null;
  const nextStops = pending.slice(1, 3);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ProgressRing done={done.length} total={stops.length} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-black">
            {pending.length === 0 ? 'Tour abgeschlossen!' : `Noch ${pending.length} Stopp${pending.length !== 1 ? 's' : ''}`}
          </div>
          <div className="text-xs text-muted-foreground">
            {done.length} von {stops.length} zugestellt
          </div>
          {fahrerName && (
            <div className="text-[10px] text-matcha-600 font-bold flex items-center gap-1 mt-0.5">
              <Bike className="h-3 w-3" /> {fahrerName}
            </div>
          )}
        </div>
        {pending.length === 0 && (
          <div className="flex items-center gap-1 text-emerald-600 font-black text-sm">
            <Star className="h-4 w-4" /> TOP!
          </div>
        )}
      </div>

      {/* Current stop */}
      {currentStop && (
        <CurrentStopCard
          stop={currentStop}
          onArrival={onConfirmArrival}
          onDelivery={onConfirmDelivery}
        />
      )}

      {/* Next stops preview */}
      {nextStops.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-3 py-2 border-b bg-muted/30">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Nächste Stopps
            </span>
          </div>
          {nextStops.map(s => (
            <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 border-b last:border-b-0">
              <div className="h-6 w-6 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-[10px] font-black text-stone-600 shrink-0">
                {s.nr}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold truncate">{s.adresse}</div>
                <div className="text-[10px] text-muted-foreground truncate">{s.kunde_name}</div>
              </div>
              {s.eta_min !== null && (
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">~{s.eta_min}m</span>
              )}
              <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
            </div>
          ))}
        </div>
      )}

      {/* All stops toggle */}
      {stops.length > (1 + nextStops.length) && (
        <button
          onClick={() => setExpandedAll(v => !v)}
          className="w-full text-[11px] font-bold text-muted-foreground py-2 rounded-xl border bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          {expandedAll ? 'Weniger anzeigen ▲' : `Alle ${stops.length} Stopps anzeigen ▼`}
        </button>
      )}

      {expandedAll && (
        <div className="rounded-xl border bg-card overflow-hidden">
          {stops.map(s => (
            <div key={s.id} className={cn(
              'flex items-center gap-3 px-3 py-2.5 border-b last:border-b-0',
              s.status === 'done' ? 'opacity-50' : ''
            )}>
              <div className={cn(
                'h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0',
                s.status === 'done' ? 'bg-emerald-500' :
                s.status === 'arrived' ? 'bg-amber-500' :
                s.nr === (currentStop?.nr ?? -1) ? 'bg-matcha-600' : 'bg-stone-300 text-stone-600'
              )}>
                {s.status === 'done' ? '✓' : s.nr}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold truncate">{s.adresse}</div>
                <div className="text-[10px] text-muted-foreground truncate">{s.kunde_name}</div>
              </div>
              <span className="text-[9px] font-bold shrink-0 capitalize text-muted-foreground">
                {s.status === 'done' ? '✓ geliefert' : s.status === 'arrived' ? '📦 angekommen' : s.eta_min !== null ? `~${s.eta_min}m` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
