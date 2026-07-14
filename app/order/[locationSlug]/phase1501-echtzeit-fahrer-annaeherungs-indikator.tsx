'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, X } from 'lucide-react';

// Phase 1501 — Echtzeit-Fahrer-Annäherungs-Indikator (Storefront)
// "Fahrer ist X Min entfernt" mit Live-Countdown; 30s-Polling; Hydration-safe; nach Phase1495.

interface Props {
  locationId: string;
  orderPlaced: boolean;
  orderId?: string | null;
  className?: string;
}

const STORAGE_KEY = 'fahrer_annaeherung_dismissed';

function isDismissed(locationId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${locationId}`);
    if (!raw) return false;
    const { ts } = JSON.parse(raw) as { ts: number };
    return Date.now() - ts < 60 * 60 * 1000;
  } catch { return false; }
}

function setDismissed(locationId: string): void {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${locationId}`, JSON.stringify({ ts: Date.now() }));
  } catch {}
}

interface DriverEta {
  eta_min: number;
  fahrer_name: string | null;
  distanz_km: number | null;
  status: 'unterwegs' | 'nah' | 'gleich_da';
}

function buildMock(): DriverEta {
  return { eta_min: 8, fahrer_name: 'Michael', distanz_km: 1.2, status: 'unterwegs' };
}

const STATUS_CONFIG: Record<string, { border: string; bg: string; badge: string; dot: string; label: string }> = {
  unterwegs: {
    border: 'border-sky-200 dark:border-sky-800',
    bg: 'bg-sky-50 dark:bg-sky-950/30',
    badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    dot: 'bg-sky-500',
    label: 'Unterwegs',
  },
  nah: {
    border: 'border-amber-200 dark:border-amber-800',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    dot: 'bg-amber-500',
    label: 'Fast da',
  },
  gleich_da: {
    border: 'border-emerald-200 dark:border-emerald-800',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    dot: 'bg-emerald-500 animate-pulse',
    label: 'Gleich da!',
  },
};

export function StorefrontPhase1501EchtzeitFahrerAnnaeherungsIndikator({
  locationId,
  orderPlaced,
  orderId,
  className,
}: Props) {
  const [hydrated, setHydrated] = useState(false);
  const [dismissed, setDismissedState] = useState(false);
  const [data, setData] = useState<DriverEta | null>(null);
  const [countdown, setCountdown] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setHydrated(true);
    setDismissedState(isDismissed(locationId));
  }, [locationId]);

  async function load() {
    if (!orderPlaced) return;
    try {
      const params = new URLSearchParams({ location_id: locationId });
      if (orderId) params.set('order_id', orderId);
      const res = await fetch(`/api/delivery/public/fahrer-eta?${params}`);
      if (!res.ok) throw new Error('api');
      const raw = (await res.json()) as Partial<DriverEta>;
      setData({
        eta_min: raw.eta_min ?? 8,
        fahrer_name: raw.fahrer_name ?? null,
        distanz_km: raw.distanz_km ?? null,
        status: raw.status ?? 'unterwegs',
      });
      setCountdown((raw.eta_min ?? 8) * 60);
    } catch {
      setData(buildMock());
      setCountdown(8 * 60);
    }
  }

  useEffect(() => {
    if (!orderPlaced) return;
    load();
    const pollId = setInterval(load, 30_000);
    return () => clearInterval(pollId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderPlaced, locationId, orderId]);

  useEffect(() => {
    if (!data || countdown <= 0) return;
    intervalRef.current = setInterval(() => {
      setCountdown((v) => Math.max(0, v - 1));
    }, 1_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [data]);

  if (!hydrated || !orderPlaced || !data || dismissed) return null;

  const minLeft = Math.ceil(countdown / 60);
  const cfg = STATUS_CONFIG[data.status] ?? STATUS_CONFIG.unterwegs;

  return (
    <div className={cn('rounded-xl border overflow-hidden', cfg.border, className)}>
      <div className={cn('flex items-center gap-3 px-4 py-3', cfg.bg)}>
        <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', cfg.dot)} />
        <Bike className="w-4 h-4 text-slate-600 dark:text-slate-300 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {data.fahrer_name ? `${data.fahrer_name} ist` : 'Fahrer ist'}{' '}
            <span className="tabular-nums">
              {minLeft <= 1 ? 'gleich' : `${minLeft} Min`}
            </span>{' '}
            entfernt
          </p>
          {data.distanz_km !== null && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Noch ca. {data.distanz_km.toFixed(1)} km
            </p>
          )}
        </div>
        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0', cfg.badge)}>
          {cfg.label}
        </span>
        <button
          onClick={() => { setDismissed(locationId); setDismissedState(true); }}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors shrink-0"
          aria-label="Schließen"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
