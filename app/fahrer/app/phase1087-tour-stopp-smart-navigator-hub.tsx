'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  CheckCircle2, ChevronDown, ChevronUp, Clock, Loader2, MapPin,
  Navigation, Navigation2, Package, Phone, Truck,
} from 'lucide-react';

/**
 * Phase 1087 — Tour-Stopp Smart-Navigator Hub (Fahrer-App)
 *
 * Zeigt alle Tourstrops der aktuellen Tour in priorisierter Reihenfolge:
 * – Aktueller Stopp hervorgehoben mit Navigations-CTAs
 * – Countdown zur erwarteten Ankunft
 * – Schnell-Aktionen: Navi-App starten, Kunden anrufen, Lieferung abschließen
 * – Farbkodierung nach Status (ausstehend / aktiv / erledigt)
 */

export interface TourStoppEntry {
  id: string;
  order_id?: string | null;
  reihenfolge?: number | null;
  sequence?: number | null;
  angekommen_am?: string | null;
  arrived_at?: string | null;
  geliefert_am?: string | null;
  completed_at?: string | null;
  order?: {
    bestellnummer?: string | null;
    kunde_name?: string | null;
    kunde_adresse?: string | null;
    kunde_plz?: string | null;
    kunde_lat?: number | null;
    kunde_lng?: number | null;
    telefon?: string | null;
    kunde_telefon?: string | null;
    eta_earliest?: string | null;
    eta_latest?: string | null;
    zahlungsart?: string | null;
    gesamtbetrag?: number | null;
  } | null;
}

interface Props {
  stops?: TourStoppEntry[];
  batchId?: string | null;
  driverLat?: number | null;
  driverLng?: number | null;
  onComplete?: (stopId: string) => void;
}

type StopStatus = 'done' | 'active' | 'pending';

function getStopStatus(stop: TourStoppEntry): StopStatus {
  if (stop.geliefert_am ?? stop.completed_at) return 'done';
  if (stop.angekommen_am ?? stop.arrived_at) return 'active';
  return 'pending';
}

function getSeq(stop: TourStoppEntry): number {
  return stop.reihenfolge ?? stop.sequence ?? 0;
}

function etaLabel(stop: TourStoppEntry): string | null {
  const ts = stop.order?.eta_earliest ?? stop.order?.eta_latest;
  if (!ts) return null;
  const d = new Date(ts);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function mapsUrl(stop: TourStoppEntry): string {
  const { kunde_lat, kunde_lng, kunde_adresse, kunde_plz } = stop.order ?? {};
  if (kunde_lat && kunde_lng) {
    return `https://maps.google.com/?q=${kunde_lat},${kunde_lng}`;
  }
  const addr = [kunde_adresse, kunde_plz].filter(Boolean).join(', ');
  return `https://maps.google.com/?q=${encodeURIComponent(addr || 'Lieferadresse')}`;
}

/* ── Countdown hook ──────────────────────────────────────────────── */
function useCountdown(targetIso: string | null | undefined) {
  const [remainMs, setRemainMs] = useState<number | null>(null);
  useEffect(() => {
    if (!targetIso) { setRemainMs(null); return; }
    const target = new Date(targetIso).getTime();
    const update = () => setRemainMs(target - Date.now());
    update();
    const id = setInterval(update, 1_000);
    return () => clearInterval(id);
  }, [targetIso]);
  return remainMs;
}

function CountdownBadge({ targetIso }: { targetIso: string | null | undefined }) {
  const ms = useCountdown(targetIso);
  if (ms === null) return null;
  const abs  = Math.abs(ms);
  const mins = Math.floor(abs / 60_000);
  const secs = Math.floor((abs % 60_000) / 1_000);
  const over = ms < 0;
  return (
    <span className={cn(
      'text-xs font-mono font-semibold px-1.5 py-0.5 rounded',
      over ? 'bg-red-100 text-red-700' : mins < 5 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700',
    )}>
      {over ? '+' : ''}{mins}:{String(secs).padStart(2, '0')}
    </span>
  );
}

/* ── Single stop card ────────────────────────────────────────────── */
function StopCard({
  stop,
  index,
  total,
  isActive,
  onComplete,
}: {
  stop: TourStoppEntry;
  index: number;
  total: number;
  isActive: boolean;
  onComplete?: (id: string) => void;
}) {
  const status    = getStopStatus(stop);
  const isDone    = status === 'done';
  const order     = stop.order;
  const telefon   = order?.telefon ?? order?.kunde_telefon;
  const eta       = stop.order?.eta_earliest;

  return (
    <div className={cn(
      'rounded-xl border p-3.5 transition-all',
      isDone  ? 'bg-slate-50 border-slate-200 opacity-60' :
      isActive ? 'bg-emerald-50 border-emerald-400 shadow-md ring-2 ring-emerald-300 ring-offset-1' :
               'bg-white border-slate-200',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shrink-0',
            isDone  ? 'bg-slate-300 text-slate-600' :
            isActive ? 'bg-emerald-500 text-white' :
                      'bg-slate-200 text-slate-600',
          )}>
            {isDone ? <CheckCircle2 size={14} /> : index + 1}
          </div>
          <div>
            <p className="font-semibold text-sm text-slate-800">
              {order?.kunde_name ?? `Stopp ${index + 1}`}
            </p>
            {order?.kunde_adresse && (
              <p className="text-xs text-slate-500 leading-tight">{order.kunde_adresse}</p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {!isDone && <CountdownBadge targetIso={eta} />}
          {etaLabel(stop) && (
            <span className="text-xs text-slate-400">ETA {etaLabel(stop)}</span>
          )}
        </div>
      </div>

      {/* Actions (only for active or pending) */}
      {!isDone && (
        <div className="mt-3 flex gap-2 flex-wrap">
          <a
            href={mapsUrl(stop)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
              isActive
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
            )}
          >
            <Navigation2 size={12} />
            Navigation
          </a>

          {telefon && (
            <a
              href={`tel:${telefon}`}
              className="flex items-center gap-1.5 rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-200 transition-colors"
            >
              <Phone size={12} />
              Anrufen
            </a>
          )}

          {isActive && onComplete && (
            <button
              onClick={() => onComplete(stop.id)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors ml-auto"
            >
              <CheckCircle2 size={12} />
              Abschließen
            </button>
          )}
        </div>
      )}

      {isDone && stop.geliefert_am && (
        <p className="mt-2 text-xs text-slate-400">
          Geliefert {new Date(stop.geliefert_am ?? stop.completed_at ?? '').toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  );
}

export function FahrerPhase1087TourStoppSmartNavigatorHub({ stops = [], batchId, driverLat, driverLng, onComplete }: Props) {
  const [open, setOpen] = useState(true);

  const sorted = [...stops].sort((a, b) => getSeq(a) - getSeq(b));
  const doneCount   = sorted.filter((s) => getStopStatus(s) === 'done').length;
  const totalCount  = sorted.length;
  const progress    = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // First non-done stop is the active one
  const activeIdx = sorted.findIndex((s) => getStopStatus(s) !== 'done');

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 p-4 text-center text-xs text-slate-400">
        <Package size={20} className="mx-auto mb-2 text-slate-300" />
        Keine Tourstopps
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-300 shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-emerald-600 text-white text-sm font-semibold"
        onClick={() => setOpen((p) => !p)}
      >
        <div className="flex items-center gap-2">
          <Truck size={15} />
          Tour-Navigator
          <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-xs">
            {doneCount}/{totalCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs opacity-80">{progress}% fertig</span>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* Progress bar */}
      <div className="h-1.5 bg-emerald-100">
        <div
          className="h-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {open && (
        <div className="p-3 space-y-2 bg-slate-50">
          {sorted.map((stop, idx) => (
            <StopCard
              key={stop.id}
              stop={stop}
              index={idx}
              total={totalCount}
              isActive={idx === activeIdx}
              onComplete={onComplete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
