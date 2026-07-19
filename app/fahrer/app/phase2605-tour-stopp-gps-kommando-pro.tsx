'use client';

/**
 * Phase 2605 — Tour-Stopp GPS-Kommando Pro (Fahrer-App)
 *
 * Vollständiges GPS-Navigations-Cockpit für Fahrer:
 * Aktueller Stopp mit One-Tap-Navigation (Google/Apple/Waze),
 * ETA-Countdown, Kundentelefon, Stopp-Bestätigung, Preview
 * nächster Stopps, Fortschrittsring. Mobile-optimiert.
 * 1-Sek-Tick + 30-Sek-Polling.
 */

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  CheckCircle2, ChevronDown, ChevronUp, Clock, MapPin,
  Navigation, Phone, Loader2, AlertCircle,
} from 'lucide-react';

interface TourStop {
  id: string;
  reihenfolge: number | null;
  adresse: string | null;
  kunde_name: string | null;
  kunde_telefon: string | null;
  angekommen_am: string | null;
  geliefert_am: string | null;
  eta_min: number | null;
  lat: number | null;
  lng: number | null;
  notiz: string | null;
}

interface Props {
  driverId?: string;
  batchId?: string | null;
  initialStops?: TourStop[];
}

function sorted(stops: TourStop[]) {
  return [...stops].sort((a, b) => (a.reihenfolge ?? 99) - (b.reihenfolge ?? 99));
}

function openGoogle(lat: number | null, lng: number | null, adresse: string | null) {
  if (lat && lng) window.open(`https://maps.google.com/?daddr=${lat},${lng}&travelmode=driving`, '_blank');
  else if (adresse) window.open(`https://maps.google.com/?daddr=${encodeURIComponent(adresse)}&travelmode=driving`, '_blank');
}

function openApple(lat: number | null, lng: number | null, adresse: string | null) {
  if (lat && lng) window.open(`https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`, '_blank');
  else if (adresse) window.open(`https://maps.apple.com/?daddr=${encodeURIComponent(adresse)}&dirflg=d`, '_blank');
}

function openWaze(lat: number | null, lng: number | null, adresse: string | null) {
  if (lat && lng) window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_blank');
  else if (adresse) window.open(`https://waze.com/ul?q=${encodeURIComponent(adresse)}&navigate=yes`, '_blank');
}

function ProgressRing({ done, total, size = 64 }: { done: number; total: number; size?: number }) {
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? done / total : 0;
  const color = pct >= 1 ? '#6a9e5f' : pct > 0 ? '#f59e0b' : '#d6d3d1';
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={5} strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ - pct * circ}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
    </svg>
  );
}

function EtaCountdown({ etaMin, tick }: { etaMin: number | null; tick: number }) {
  if (etaMin === null) return <span className="text-muted-foreground">—</span>;
  if (etaMin <= 0) return <span className="text-matcha-600 font-black">Jetzt!</span>;
  const m = Math.floor(etaMin);
  return <span className="font-black tabular-nums text-foreground">{m} Min</span>;
}

function StopCard({
  stop,
  active,
  done,
  onConfirm,
  confirming,
}: {
  stop: TourStop;
  active: boolean;
  done: boolean;
  onConfirm: (id: string) => void;
  confirming: string | null;
}) {
  if (!active && !done) {
    return (
      <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-muted/30">
        <span className="h-2 w-2 rounded-full bg-stone-300 dark:bg-stone-600 shrink-0" />
        <span className="text-[11px] text-muted-foreground truncate">{stop.adresse ?? stop.kunde_name ?? '—'}</span>
        {stop.eta_min !== null && (
          <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{stop.eta_min} Min</span>
        )}
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-matcha-50 dark:bg-matcha-950/20 border border-matcha-200 dark:border-matcha-800">
        <CheckCircle2 className="h-4 w-4 text-matcha-500 shrink-0" />
        <span className="text-[11px] font-semibold text-matcha-700 dark:text-matcha-300 truncate">
          {stop.adresse ?? stop.kunde_name ?? '—'}
        </span>
        <span className="ml-auto text-[10px] text-matcha-500 shrink-0">✓</span>
      </div>
    );
  }

  // Active stop — full card
  return (
    <div className="rounded-xl border-2 border-matcha-400 dark:border-matcha-600 bg-matcha-50 dark:bg-matcha-950/30 p-3">
      {/* Adresse */}
      <div className="flex items-start gap-2 mb-2.5">
        <MapPin className="h-4 w-4 text-matcha-600 mt-0.5 shrink-0" />
        <div>
          {stop.kunde_name && (
            <div className="text-xs font-bold text-foreground">{stop.kunde_name}</div>
          )}
          <div className="text-xs text-muted-foreground">{stop.adresse ?? '—'}</div>
          {stop.notiz && (
            <div className="mt-1 rounded bg-amber-100 dark:bg-amber-900/30 px-2 py-1 text-[10px] text-amber-800 dark:text-amber-300 flex items-start gap-1">
              <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
              {stop.notiz}
            </div>
          )}
        </div>
        {stop.eta_min !== null && (
          <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <Clock className="h-3 w-3" />
            <EtaCountdown etaMin={stop.eta_min} tick={0} />
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="grid grid-cols-3 gap-1.5 mb-2.5">
        {[
          { label: 'Google', fn: () => openGoogle(stop.lat, stop.lng, stop.adresse), color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
          { label: 'Apple',  fn: () => openApple(stop.lat, stop.lng, stop.adresse),  color: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300' },
          { label: 'Waze',   fn: () => openWaze(stop.lat, stop.lng, stop.adresse),   color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' },
        ].map(nav => (
          <button
            key={nav.label}
            onClick={nav.fn}
            className={cn('flex items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-bold transition hover:opacity-80', nav.color)}
          >
            <Navigation className="h-3 w-3" />
            {nav.label}
          </button>
        ))}
      </div>

      {/* Actions row */}
      <div className="flex gap-2">
        {stop.kunde_telefon && (
          <a
            href={`tel:${stop.kunde_telefon}`}
            className="flex items-center gap-1 rounded-lg bg-stone-100 dark:bg-stone-800 px-3 py-2 text-[11px] font-semibold text-foreground hover:bg-stone-200 dark:hover:bg-stone-700 transition"
          >
            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            Anrufen
          </a>
        )}
        <button
          onClick={() => onConfirm(stop.id)}
          disabled={confirming === stop.id}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-matcha-500 hover:bg-matcha-600 disabled:opacity-60 text-white text-[11px] font-black py-2 transition"
        >
          {confirming === stop.id ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          Zugestellt
        </button>
      </div>
    </div>
  );
}

export function FahrerPhase2605TourStoppGpsKommandoPro({ driverId, batchId: propBatchId, initialStops }: Props) {
  const [stops, setStops] = useState<TourStop[]>(initialStops ?? []);
  const [loading, setLoading] = useState(!initialStops);
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const supabase = createClient();

  const load = useCallback(async () => {
    if (!driverId && !propBatchId) { setLoading(false); return; }

    let batchId = propBatchId;
    if (!batchId && driverId) {
      const { data: status } = await supabase
        .from('driver_status')
        .select('aktueller_batch_id')
        .eq('employee_id', driverId)
        .maybeSingle();
      batchId = status?.aktueller_batch_id ?? null;
    }
    if (!batchId) { setLoading(false); return; }

    const { data } = await supabase
      .from('delivery_batch_stops')
      .select('id, reihenfolge, angekommen_am, geliefert_am, order:customer_orders(kunde_name, kunde_adresse, kunde_telefon, kunde_lat, kunde_lng, notiz)')
      .eq('batch_id', batchId)
      .order('reihenfolge', { ascending: true });

    if (data) {
      setStops(data.map((s: any) => ({
        id: s.id,
        reihenfolge: s.reihenfolge,
        adresse: s.order?.kunde_adresse ?? null,
        kunde_name: s.order?.kunde_name ?? null,
        kunde_telefon: s.order?.kunde_telefon ?? null,
        angekommen_am: s.angekommen_am ?? null,
        geliefert_am: s.geliefert_am ?? null,
        eta_min: null,
        lat: s.order?.kunde_lat ?? null,
        lng: s.order?.kunde_lng ?? null,
        notiz: s.order?.notiz ?? null,
      })));
    }
    setLoading(false);
  }, [driverId, propBatchId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const api = setInterval(load, 30_000);
    const t = setInterval(() => setTick(n => n + 1), 1_000);
    return () => { clearInterval(api); clearInterval(t); };
  }, [load]);

  const handleConfirm = useCallback(async (stopId: string) => {
    setConfirming(stopId);
    await supabase
      .from('delivery_batch_stops')
      .update({ geliefert_am: new Date().toISOString() })
      .eq('id', stopId);
    await load();
    setConfirming(null);
  }, [load]);

  const sortedStops = sorted(stops);
  const doneCount = sortedStops.filter(s => !!s.geliefert_am).length;
  const activeStop = sortedStops.find(s => !s.geliefert_am) ?? null;
  const nextStops = activeStop
    ? sortedStops.filter(s => s.id !== activeStop.id && !s.geliefert_am).slice(0, 3)
    : [];

  if (loading) {
    return (
      <div className="rounded-2xl border bg-card p-4 animate-pulse">
        <div className="h-5 w-48 bg-muted rounded mb-3" />
        <div className="h-32 bg-muted rounded-xl" />
      </div>
    );
  }

  if (stops.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <ProgressRing done={doneCount} total={sortedStops.length} size={40} />
            <div className="absolute inset-0 flex items-center justify-center rotate-90">
              <span className="text-[9px] font-black text-foreground tabular-nums">
                {doneCount}/{sortedStops.length}
              </span>
            </div>
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-foreground">GPS-Kommando Pro</div>
            <div className="text-[10px] text-muted-foreground">
              {activeStop ? `Nächster: ${activeStop.adresse ?? activeStop.kunde_name ?? '—'}` : 'Tour abgeschlossen'}
            </div>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {/* Active stop */}
          {activeStop && (
            <StopCard
              stop={activeStop}
              active={true}
              done={false}
              onConfirm={handleConfirm}
              confirming={confirming}
            />
          )}

          {/* Next stops preview */}
          {nextStops.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-semibold text-muted-foreground px-1">Nächste Stopps</div>
              {nextStops.map(s => (
                <StopCard key={s.id} stop={s} active={false} done={false} onConfirm={handleConfirm} confirming={confirming} />
              ))}
            </div>
          )}

          {/* Show all / done stops */}
          {doneCount > 0 && (
            <button
              onClick={() => setShowAll(x => !x)}
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition"
            >
              {showAll ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showAll ? 'Weniger anzeigen' : `${doneCount} erledigte Stopps anzeigen`}
            </button>
          )}

          {showAll && sortedStops.filter(s => !!s.geliefert_am).map(s => (
            <StopCard key={s.id} stop={s} active={false} done={true} onConfirm={handleConfirm} confirming={confirming} />
          ))}
        </div>
      )}
    </div>
  );
}
