'use client';

/**
 * Phase 503 — Live-Tracking-Commander
 *
 * Umfassende Live-Tracking-Ansicht für Kunden nach der Bestellung:
 * - Animierte Phasen-Timeline (Bestätigt → Zubereitung → Unterwegs → Geliefert)
 * - ETA-Countdown mit Konfidenz-Indikator
 * - Fahrer-Name + ETA-Restzeit wenn unterwegs
 * - Auto-Refresh alle 30 Sekunden
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, ChefHat, Clock, MapPin, Package, Truck, Loader2 } from 'lucide-react';

type Phase = 'confirmed' | 'preparing' | 'ready' | 'on_route' | 'delivered';

const ORDER_STATUS_TO_PHASE: Record<string, Phase> = {
  neu:             'confirmed',
  bestätigt:       'confirmed',
  in_zubereitung:  'preparing',
  fertig:          'ready',
  unterwegs:       'on_route',
  geliefert:       'delivered',
  abgeschlossen:   'delivered',
};

const PHASES: { key: Phase; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: 'confirmed', label: 'Bestätigt',    icon: <CheckCircle2 className="h-5 w-5" />, desc: 'Deine Bestellung wurde angenommen.' },
  { key: 'preparing', label: 'Zubereitung',  icon: <ChefHat className="h-5 w-5" />,     desc: 'Die Küche bereitet deine Bestellung vor.' },
  { key: 'ready',     label: 'Fertig',       icon: <Package className="h-5 w-5" />,      desc: 'Fertig — Fahrer holt gleich ab.' },
  { key: 'on_route',  label: 'Unterwegs',    icon: <Truck className="h-5 w-5" />,        desc: 'Deine Lieferung ist auf dem Weg!' },
  { key: 'delivered', label: 'Geliefert',    icon: <MapPin className="h-5 w-5" />,       desc: 'Guten Appetit! 🎉' },
];

const PHASE_ORDER: Phase[] = ['confirmed', 'preparing', 'ready', 'on_route', 'delivered'];

interface EtaData {
  eta_min: number;
  driver_name?: string;
  driver_eta_min?: number;
  phase: Phase;
  confidence?: 'high' | 'medium' | 'low';
}

interface Props {
  orderId: string;
  bestellnummer: string;
  locationId: string;
}

function useCountdown(targetMs: number | null) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!targetMs) return;
    const iv = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, [targetMs]);
  if (!targetMs) return null;
  return Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
}

function fmtCountdown(secs: number): string {
  if (secs <= 0) return 'Gleich da';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m > 0) return `${m} Min ${s} Sek`;
  return `${s} Sek`;
}

export function Phase503LiveTrackingCommander({ orderId, bestellnummer, locationId }: Props) {
  const [data, setData] = useState<EtaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const etaTargetMs = data ? Date.now() + data.eta_min * 60_000 : null;
  const countdown = useCountdown(etaTargetMs);

  useEffect(() => {
    let active = true;

    const fetch = async () => {
      try {
        const res = await window.fetch(
          `/api/delivery/eta/${orderId}?location_id=${locationId}`,
          { cache: 'no-store' },
        );
        if (!res.ok) throw new Error('fetch failed');
        const json = await res.json() as Partial<EtaData>;
        if (active) {
          setData({
            eta_min: json.eta_min ?? 30,
            driver_name: json.driver_name,
            driver_eta_min: json.driver_eta_min,
            phase: json.phase ?? 'preparing',
            confidence: json.confidence ?? 'medium',
          });
          setLastUpdate(Date.now());
        }
      } catch {
        // keep existing data
      } finally {
        if (active) setLoading(false);
      }
    };

    fetch();
    const iv = setInterval(fetch, 30_000);
    return () => { active = false; clearInterval(iv); if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, locationId]);

  const currentPhaseIndex = data ? PHASE_ORDER.indexOf(data.phase) : 0;

  const CONF_LABEL: Record<string, string> = {
    high: 'Sehr genau', medium: 'Schätzung', low: 'Ungefähr',
  };
  const CONF_COLOR: Record<string, string> = {
    high: 'text-matcha-600', medium: 'text-amber-600', low: 'text-gray-400',
  };

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-matcha-600 px-5 py-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest opacity-80">Live-Tracking</div>
            <div className="text-lg font-black mt-0.5">#{bestellnummer}</div>
          </div>
          {loading && <Loader2 className="h-5 w-5 animate-spin opacity-60" />}
        </div>

        {/* ETA Countdown */}
        {countdown != null && data?.phase !== 'delivered' && (
          <div className="mt-3 rounded-xl bg-white/10 border border-white/20 px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase opacity-70">Lieferzeit</div>
              <div className="text-3xl font-black tabular-nums mt-0.5">{fmtCountdown(countdown)}</div>
            </div>
            {data.confidence && (
              <span className={cn('text-[11px] font-bold rounded-full bg-white/10 px-2 py-0.5', CONF_COLOR[data.confidence])}>
                {CONF_LABEL[data.confidence]}
              </span>
            )}
          </div>
        )}

        {data?.phase === 'delivered' && (
          <div className="mt-3 rounded-xl bg-white/20 border border-white/30 px-4 py-3 text-center">
            <div className="text-2xl">🎉</div>
            <div className="font-black mt-1">Geliefert!</div>
          </div>
        )}
      </div>

      {/* Phasen-Timeline */}
      <div className="px-5 py-4">
        <div className="relative">
          {/* Verbindungslinie */}
          <div className="absolute left-5 top-5 bottom-5 w-px bg-border" />

          <div className="space-y-4">
            {PHASES.map((phase, i) => {
              const done    = i < currentPhaseIndex;
              const active  = i === currentPhaseIndex;
              const pending = i > currentPhaseIndex;

              return (
                <div key={phase.key} className="relative flex items-start gap-4 pl-1">
                  {/* Dot */}
                  <div className={cn(
                    'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                    done    && 'bg-matcha-500 border-matcha-500 text-white',
                    active  && 'bg-white border-matcha-500 text-matcha-600 shadow-md shadow-matcha-200',
                    pending && 'bg-muted border-border text-muted-foreground',
                  )}>
                    {done ? <CheckCircle2 className="h-5 w-5" /> : phase.icon}
                    {active && (
                      <span className="absolute -inset-1 animate-ping rounded-full bg-matcha-400/30" />
                    )}
                  </div>

                  {/* Text */}
                  <div className={cn('flex-1 pt-1.5 transition-opacity', pending && 'opacity-40')}>
                    <div className={cn('text-sm font-bold', active && 'text-matcha-700')}>
                      {phase.label}
                    </div>
                    {active && (
                      <div className="text-xs text-muted-foreground mt-0.5">{phase.desc}</div>
                    )}
                    {active && data?.driver_name && phase.key === 'on_route' && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Truck className="h-3 w-3" />
                        <span>{data.driver_name}</span>
                        {data.driver_eta_min != null && (
                          <span className="ml-1 font-bold text-matcha-600">
                            · {data.driver_eta_min} Min
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Zeitstempel */}
                  {done && (
                    <span className="shrink-0 pt-2 text-[10px] text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-matcha-500" />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t px-5 py-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Letzte Aktualisierung: {lastUpdate ? new Date(lastUpdate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</span>
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-1.5 rounded-full bg-matcha-400 animate-pulse" />
          <span>Live</span>
        </div>
      </div>
    </div>
  );
}
