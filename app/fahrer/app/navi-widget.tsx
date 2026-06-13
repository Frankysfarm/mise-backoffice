'use client';

/**
 * NaviWidget — Phase 83
 *
 * Turn-by-Turn Navigations-Widget für die Fahrer-App.
 * Zeigt aktuellen Abbiegehinweis, verbleibende Distanz und ETA.
 * Lädt Schritte vom Server und aktualisiert per GPS-Poll alle 10s.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ArrowUp, ArrowUpLeft, ArrowUpRight, ArrowLeft, ArrowRight,
  ArrowDown, ArrowDownLeft, ArrowDownRight, RefreshCw,
  Navigation, ChevronRight, ChevronDown, Loader2, MapPin, List,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Typen ──────────────────────────────────────────────────────────────────────

interface NavStep {
  index: number;
  instruction: string;
  distance_m: number;
  duration_s: number;
  maneuver: string | null;
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
}

interface NavData {
  current_step: NavStep | null;
  next_step: NavStep | null;
  steps_remaining: number;
  distance_remaining_m: number;
  duration_remaining_s: number;
  segment?: { steps: NavStep[]; total_dist_m: number; total_dur_s: number };
  deep_links: {
    google: string;
    apple: string;
    waze: string;
  };
  error?: string;
}

interface NaviWidgetProps {
  batchId: string;
  stopIndex: number;
  toLat: number;
  toLng: number;
  vehicle: 'car' | 'bike';
  driverLat: number | null;
  driverLng: number | null;
}

// ── Manöver → Icon ─────────────────────────────────────────────────────────────

function ManeuverIcon({ maneuver, size = 28 }: { maneuver: string | null; size?: number }) {
  const cls = `shrink-0 text-matcha-900`;
  if (!maneuver || maneuver === 'straight') return <ArrowUp size={size} className={cls} />;

  const map: Record<string, React.ReactNode> = {
    'turn-slight-left':  <ArrowUpLeft size={size} className={cls} />,
    'turn-left':         <ArrowLeft size={size} className={cls} />,
    'turn-sharp-left':   <ArrowDownLeft size={size} className={cls} />,
    'turn-slight-right': <ArrowUpRight size={size} className={cls} />,
    'turn-right':        <ArrowRight size={size} className={cls} />,
    'turn-sharp-right':  <ArrowDownRight size={size} className={cls} />,
    'uturn-left':        <ArrowDown size={size} className={cls} />,
    'uturn-right':       <ArrowDown size={size} className={cls} />,
    'roundabout-left':   <RefreshCw size={size} className={cn(cls, 'scale-x-[-1]')} />,
    'roundabout-right':  <RefreshCw size={size} className={cls} />,
    'merge':             <ArrowUp size={size} className={cls} />,
    'fork-left':         <ArrowUpLeft size={size} className={cls} />,
    'fork-right':        <ArrowUpRight size={size} className={cls} />,
    'ramp-left':         <ArrowUpLeft size={size} className={cls} />,
    'ramp-right':        <ArrowUpRight size={size} className={cls} />,
    'ferry':             <ArrowUp size={size} className={cls} />,
  };

  return <>{map[maneuver] ?? <ArrowUp size={size} className={cls} />}</>;
}

// ── Distanz-Formatierung ───────────────────────────────────────────────────────

function fmtDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function fmtDuration(s: number): string {
  const min = Math.ceil(s / 60);
  if (min < 60) return `${min} Min`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return rem > 0 ? `${h} h ${rem} Min` : `${h} h`;
}

// ── Hauptkomponente ────────────────────────────────────────────────────────────

export function NaviWidget({
  batchId,
  stopIndex,
  toLat,
  toLng,
  vehicle,
  driverLat,
  driverLng,
}: NaviWidgetProps) {
  const [data, setData] = useState<NavData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAllSteps, setShowAllSteps] = useState(false);
  const lastFetchRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

  const fetchNav = useCallback(async (force = false) => {
    if (driverLat == null || driverLng == null) return;
    const now = Date.now();
    if (!force && now - lastFetchRef.current < 8000) return;
    lastFetchRef.current = now;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    try {
      const params = new URLSearchParams({
        batch_id: batchId,
        stop_index: String(stopIndex),
        driver_lat: String(driverLat),
        driver_lng: String(driverLng),
        to_lat: String(toLat),
        to_lng: String(toLng),
        vehicle,
      });
      const res = await fetch(`/api/delivery/driver/navigation?${params}`, {
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as NavData;
      setData(json);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        // Behalte letzten State, aber kein Crash
      }
    } finally {
      setLoading(false);
    }
  }, [batchId, stopIndex, driverLat, driverLng, toLat, toLng, vehicle]);

  // Initial laden + bei GPS-Update
  useEffect(() => {
    fetchNav(true);
  }, [fetchNav, stopIndex]);

  // Alle 12s neu laden
  useEffect(() => {
    const iv = setInterval(() => fetchNav(), 12_000);
    return () => clearInterval(iv);
  }, [fetchNav]);

  // Cleanup
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  if (!data && !loading) return null;

  const { current_step, next_step, distance_remaining_m, duration_remaining_s, deep_links } = data ?? {};

  const primaryMapUrl = isIos
    ? (deep_links?.apple || deep_links?.google || '')
    : (deep_links?.google || '');

  return (
    <div className="mx-4 mb-3 rounded-2xl overflow-hidden border border-accent/40 bg-accent/5">
      {/* Header: Collapse-Toggle */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2 bg-accent/20 active:bg-accent/30 transition"
        onClick={() => setIsExpanded((v) => !v)}
      >
        <Navigation size={13} className="text-accent shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-widest text-accent flex-1 text-left">
          Navigation
        </span>
        {loading && <Loader2 size={11} className="text-accent/60 animate-spin" />}
        {distance_remaining_m != null && distance_remaining_m > 0 && (
          <span className="text-[10px] font-bold text-accent/80 tabular-nums">
            {fmtDistance(distance_remaining_m)}
          </span>
        )}
        {duration_remaining_s != null && duration_remaining_s > 0 && (
          <span className="text-[10px] text-matcha-300 tabular-nums ml-1">
            · {fmtDuration(duration_remaining_s)}
          </span>
        )}
        <ChevronRight
          size={13}
          className={cn('text-matcha-400 transition-transform', isExpanded && 'rotate-90')}
        />
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 pt-2 space-y-2">
          {/* Aktueller Schritt */}
          {current_step ? (
            <div className="flex items-center gap-3 rounded-xl bg-accent/20 border border-accent/30 px-3 py-2.5">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                <ManeuverIcon maneuver={current_step.maneuver} size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-matcha-50 leading-snug line-clamp-2">
                  {current_step.instruction}
                </p>
                <p className="text-[11px] text-matcha-300 mt-0.5 tabular-nums">
                  In {fmtDistance(current_step.distance_m)}
                </p>
              </div>
            </div>
          ) : (loading && !data) ? (
            <div className="flex items-center gap-2 rounded-xl bg-matcha-800/50 px-3 py-2.5">
              <Loader2 size={16} className="text-accent/60 animate-spin" />
              <span className="text-xs text-matcha-300">Route wird geladen…</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl bg-matcha-800/50 px-3 py-2.5">
              <MapPin size={14} className="text-accent/60" />
              <span className="text-xs text-matcha-300">
                {data?.error ?? 'Fahren Sie zum Ziel'}
              </span>
            </div>
          )}

          {/* Nächster Schritt (Vorschau) */}
          {next_step && (
            <div className="flex items-center gap-2.5 rounded-lg bg-matcha-800/40 border border-matcha-700/40 px-2.5 py-1.5">
              <div className="shrink-0 w-6 h-6 rounded-lg bg-matcha-700 flex items-center justify-center">
                <ManeuverIcon maneuver={next_step.maneuver} size={13} />
              </div>
              <p className="text-[11px] text-matcha-300 flex-1 min-w-0 truncate">
                Danach: {next_step.instruction}
              </p>
              <span className="text-[10px] text-matcha-400 tabular-nums shrink-0">
                {fmtDistance(next_step.distance_m)}
              </span>
            </div>
          )}

          {/* Alle Schritte — aufklappbare Schritt-für-Schritt-Liste */}
          {data?.segment?.steps && data.segment.steps.length > 2 && (
            <div>
              <button
                type="button"
                onClick={() => setShowAllSteps((v) => !v)}
                className="flex items-center gap-1.5 w-full text-left text-[10px] font-bold text-matcha-400 hover:text-matcha-200 transition py-1"
              >
                <List size={10} />
                {showAllSteps ? 'Schritte ausblenden' : `Alle ${data.segment.steps.length} Schritte`}
                <ChevronDown size={10} className={cn('ml-auto transition-transform', showAllSteps && 'rotate-180')} />
              </button>
              {showAllSteps && (
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {data.segment.steps.map((step, i) => {
                    const isCurrent = step.index === data.current_step?.index;
                    return (
                      <div
                        key={i}
                        className={cn(
                          'flex items-center gap-2 rounded-lg px-2 py-1.5 text-[10px]',
                          isCurrent
                            ? 'bg-accent/20 border border-accent/40 text-matcha-100'
                            : 'bg-matcha-800/30 text-matcha-400',
                        )}
                      >
                        <div className={cn(
                          'shrink-0 w-5 h-5 rounded-md flex items-center justify-center',
                          isCurrent ? 'bg-accent' : 'bg-matcha-700',
                        )}>
                          <ManeuverIcon maneuver={step.maneuver} size={10} />
                        </div>
                        <span className="flex-1 min-w-0 truncate">{step.instruction}</span>
                        <span className="shrink-0 tabular-nums">{fmtDistance(step.distance_m)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Navi-App Launch Buttons */}
          <div className="flex gap-2 pt-0.5">
            {primaryMapUrl && (
              <a
                href={primaryMapUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-accent text-matcha-900 font-bold text-[12px] active:scale-[0.98] transition"
              >
                <Navigation size={13} />
                {isIos ? 'Apple Maps' : 'Google Maps'}
              </a>
            )}
            {deep_links?.waze && (
              <a
                href={deep_links.waze}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1 h-9 px-3 rounded-xl bg-[#33ccff]/15 border border-[#33ccff]/40 text-[#33ccff] font-bold text-[12px] active:scale-[0.98] transition"
              >
                Waze
              </a>
            )}
            {!isIos && deep_links?.google && (
              <a
                href={deep_links.google}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1 h-9 px-3 rounded-xl bg-matcha-700/60 border border-matcha-600/40 text-matcha-100 font-bold text-[12px] active:scale-[0.98] transition"
              >
                G Maps
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
