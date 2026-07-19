'use client';

/**
 * Phase 2395 — Live-ETA Customer Dashboard
 * Zeigt dem Kunden den aktuellen Lieferstatus mit Echtzeit-ETA,
 * Fahrer-Status, Fortschrittsbalken und visuellen Zustandsphasen.
 * Polling alle 20 Sekunden.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, CheckCircle2, ChefHat, Bike, MapPin, Package, Loader2 } from 'lucide-react';

type Phase = 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

interface LiveStatus {
  status: Phase;
  etaMin: number | null;
  driverName: string | null;
  progressPct: number;
  lastUpdate: string | null;
}

interface Props {
  orderId: string;
  orderNumber?: string;
}

const PHASES: { key: Phase; label: string; icon: React.ReactNode }[] = [
  { key: 'bestätigt', label: 'Bestätigt', icon: <CheckCircle2 className="h-4 w-4" /> },
  { key: 'in_zubereitung', label: 'Zubereitung', icon: <ChefHat className="h-4 w-4" /> },
  { key: 'fertig', label: 'Bereit', icon: <Package className="h-4 w-4" /> },
  { key: 'unterwegs', label: 'Unterwegs', icon: <Bike className="h-4 w-4" /> },
  { key: 'geliefert', label: 'Geliefert', icon: <MapPin className="h-4 w-4" /> },
];

const PHASE_ORDER: Phase[] = ['bestätigt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert'];

function phaseIndex(p: Phase): number {
  return PHASE_ORDER.indexOf(p);
}

function etaCountdown(etaMin: number | null): string {
  if (etaMin == null) return '–';
  if (etaMin <= 0) return 'Gleich';
  if (etaMin < 60) return `${etaMin} Min`;
  const h = Math.floor(etaMin / 60);
  const m = etaMin % 60;
  return `${h}h ${m}min`;
}

export function Phase2395LiveEtaCustomerDashboard({ orderId, orderNumber }: Props) {
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  async function load() {
    try {
      const r = await fetch(`/api/delivery/orders/${orderId}/tracking`);
      if (!r.ok) return;
      const d = await r.json();
      // Map tracking API fields: status, driver_name, geo.eta_min_remaining, stops_before
      const totalStops = (d.stops_before ?? 0) + 1;
      const doneFraction = totalStops > 0 ? Math.max(0, 1 - (d.stops_before ?? 0) / totalStops) : 0;
      setStatus({
        status: d.status ?? 'bestätigt',
        etaMin: d.geo?.eta_min_remaining ?? null,
        driverName: d.driver_name ?? null,
        progressPct: Math.round(doneFraction * 100),
        lastUpdate: d.eta_label ?? null,
      });
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    const poll = setInterval(load, 20_000);
    const countdownTick = setInterval(() => setTick(t => t + 1), 30_000);
    return () => { clearInterval(poll); clearInterval(countdownTick); };
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-matcha-500" />
      </div>
    );
  }

  if (!status) return null;

  const currentIdx = phaseIndex(status.status);
  const isDelivered = status.status === 'geliefert';

  return (
    <div className="rounded-2xl border border-matcha-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-matcha-600 to-matcha-500 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold opacity-80 uppercase tracking-wider">
              {orderNumber ? `Bestellung #${orderNumber}` : 'Deine Lieferung'}
            </div>
            <div className="text-2xl font-black mt-0.5">
              {isDelivered ? '🎉 Geliefert!' : etaCountdown(status.etaMin)}
            </div>
            {!isDelivered && status.etaMin != null && (
              <div className="text-xs opacity-75 mt-0.5">geschätzte Lieferzeit</div>
            )}
          </div>
          <div className="text-4xl">
            {isDelivered ? '✅' : status.status === 'unterwegs' ? '🛵' : status.status === 'in_zubereitung' ? '👨‍🍳' : '📦'}
          </div>
        </div>
      </div>

      {/* Fortschrittsbalken */}
      <div className="h-1.5 bg-gray-100">
        <div
          className="h-full bg-matcha-500 transition-all duration-1000"
          style={{ width: `${Math.min(100, status.progressPct > 0 ? status.progressPct : (currentIdx / (PHASE_ORDER.length - 1)) * 100)}%` }}
        />
      </div>

      {/* Phase-Schritte */}
      <div className="px-4 py-4">
        <div className="flex justify-between relative">
          {/* Verbindungslinie */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200 z-0" />
          <div
            className="absolute top-4 left-4 h-0.5 bg-matcha-500 z-0 transition-all duration-700"
            style={{ width: `${(currentIdx / (PHASE_ORDER.length - 1)) * (100 - 8)}%` }}
          />

          {PHASES.map((phase, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            const upcoming = i > currentIdx;
            return (
              <div key={phase.key} className="flex flex-col items-center gap-1 z-10 relative">
                <div className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-500',
                  done && 'bg-matcha-500 border-matcha-500 text-white',
                  active && 'bg-white border-matcha-500 text-matcha-600 shadow-md shadow-matcha-200',
                  upcoming && 'bg-white border-gray-200 text-gray-300',
                )}>
                  {done ? <CheckCircle2 className="h-4 w-4" /> : phase.icon}
                </div>
                <span className={cn(
                  'text-[10px] font-semibold text-center max-w-[50px] leading-tight',
                  done && 'text-matcha-600',
                  active && 'text-matcha-700 font-bold',
                  upcoming && 'text-gray-300',
                )}>
                  {phase.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fahrer-Info (wenn unterwegs) */}
      {status.status === 'unterwegs' && status.driverName && (
        <div className="mx-4 mb-4 flex items-center gap-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold text-sm shrink-0">
            {status.driverName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-xs text-blue-500 font-semibold uppercase tracking-wide">Dein Fahrer</div>
            <div className="text-sm font-bold text-blue-800">{status.driverName}</div>
          </div>
          <div className="ml-auto">
            <Bike className="h-5 w-5 text-blue-400 animate-pulse" />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 pb-3 flex items-center justify-between text-[10px] text-gray-400">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>Live-Tracking aktiv</span>
        </div>
        {status.lastUpdate && (
          <span>Aktualisiert: {new Date(status.lastUpdate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
        )}
      </div>
    </div>
  );
}
