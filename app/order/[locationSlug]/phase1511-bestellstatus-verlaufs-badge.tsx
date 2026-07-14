'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { PackageCheck, Clock, Truck, ChefHat, CheckCircle2 } from 'lucide-react';

// Phase 1511 — Bestellstatus-Verlaufs-Badge (Storefront)
// Kompakter Inline-Badge der letzten Bestellung mit Status-Icon + Zeit;
// localStorage-basiert; Hydration-safe; nach Phase1506.

interface Props {
  locationId: string;
  className?: string;
}

interface LastOrderInfo {
  orderId: string;
  status: string;
  createdAt: string;
  total?: number;
  items?: number;
}

const LS_KEY_PREFIX = 'mise_last_order_';

type StatusKey = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'on_the_way' | 'delivered' | 'cancelled';

const STATUS_CONFIG: Record<StatusKey, { label: string; icon: React.ReactNode; badge: string; border: string }> = {
  pending: {
    label: 'Bestellt',
    icon: <Clock className="w-3 h-3" />,
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
  },
  confirmed: {
    label: 'Bestätigt',
    icon: <PackageCheck className="w-3 h-3" />,
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
  },
  preparing: {
    label: 'In Zubereitung',
    icon: <ChefHat className="w-3 h-3" />,
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-800',
  },
  ready: {
    label: 'Abholbereit',
    icon: <PackageCheck className="w-3 h-3" />,
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  on_the_way: {
    label: 'Unterwegs',
    icon: <Truck className="w-3 h-3" />,
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
  },
  delivered: {
    label: 'Geliefert',
    icon: <CheckCircle2 className="w-3 h-3" />,
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  cancelled: {
    label: 'Storniert',
    icon: <Clock className="w-3 h-3" />,
    badge: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-700',
  },
};

const FALLBACK_CONFIG = STATUS_CONFIG['pending'];

function getStatusCfg(status: string) {
  return STATUS_CONFIG[status as StatusKey] ?? FALLBACK_CONFIG;
}

function fmtRelTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std`;
  return `vor ${Math.floor(h / 24)} Tagen`;
}

export function StorefrontPhase1511BestellstatusVerlaufsBadge({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [order, setOrder] = useState<LastOrderInfo | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(`${LS_KEY_PREFIX}${locationId}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as LastOrderInfo;
      // Show only recent orders (last 4 hours)
      const ageH = (Date.now() - new Date(parsed.createdAt).getTime()) / 3_600_000;
      if (ageH > 4) return;
      // Hide delivered/cancelled orders older than 30 min
      if ((parsed.status === 'delivered' || parsed.status === 'cancelled') && ageH * 60 > 30) return;
      setOrder(parsed);
    } catch {
      // ignore
    }
  }, [locationId]);

  if (!mounted || !order) return null;

  const cfg = getStatusCfg(order.status);

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium',
        cfg.border,
        cfg.badge,
        className,
      )}
    >
      <span className="shrink-0">{cfg.icon}</span>
      <span className="font-semibold">{cfg.label}</span>
      <span className="opacity-70">·</span>
      <span className="opacity-70">{fmtRelTime(order.createdAt)}</span>
      {order.total !== undefined && (
        <>
          <span className="opacity-70">·</span>
          <span className="opacity-70">
            {order.total.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
          </span>
        </>
      )}
    </div>
  );
}

/**
 * Call this after a successful order to persist order info to localStorage.
 */
export function persistLastOrder(locationId: string, info: LastOrderInfo): void {
  try {
    localStorage.setItem(`${LS_KEY_PREFIX}${locationId}`, JSON.stringify(info));
  } catch {
    // ignore
  }
}
