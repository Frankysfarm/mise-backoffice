'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Bike, Package, CheckCircle2, Clock } from 'lucide-react';

// Phase 1571 — Lieferzeit-Echtzeit-Ticker (Storefront)
// Scrollender Text-Ticker nach Bestellabschluss: Zeigt aktuellen Lieferstatus
// mit passendem Icon + Statustext + dynamischer ETA. 60-Sek-Polling; Hydration-safe.
// Nur sichtbar wenn orderPlaced = true.

interface Props {
  locationId: string;
  orderPlaced: boolean;
  orderStatus?: string | null;
}

const TICKER_MESSAGES: { status: string; icon: React.ReactNode; text: string }[] = [
  { status: 'pending', icon: <Clock className="h-3.5 w-3.5 text-amber-500" />, text: 'Ihre Bestellung wird gerade angenommen…' },
  { status: 'accepted', icon: <ChefHat className="h-3.5 w-3.5 text-sky-500" />, text: 'Küche hat Ihre Bestellung angenommen — Zubereitung startet!' },
  { status: 'preparing', icon: <ChefHat className="h-3.5 w-3.5 text-orange-500" />, text: 'Ihre Bestellung wird frisch zubereitet…' },
  { status: 'ready', icon: <Package className="h-3.5 w-3.5 text-violet-500" />, text: 'Fertig! Fahrer holt Ihre Bestellung gleich ab.' },
  { status: 'dispatched', icon: <Bike className="h-3.5 w-3.5 text-matcha-600" />, text: 'Ihr Fahrer ist auf dem Weg zu Ihnen!' },
  { status: 'delivered', icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />, text: 'Geliefert! Guten Appetit!' },
];

function messageFor(status: string | null | undefined) {
  const found = TICKER_MESSAGES.find((m) => m.status === status);
  return found ?? TICKER_MESSAGES[0];
}

export function StorefrontPhase1571LieferzeitEchtzeitTicker({ locationId, orderPlaced, orderStatus }: Props) {
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<string | null>(orderStatus ?? 'pending');
  const [eta, setEta] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!orderPlaced || !locationId || !mounted) return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/delivery/order/live-status?location_id=${locationId}`);
        if (!res.ok) throw new Error('no data');
        const json = await res.json();
        if (!cancelled) {
          setStatus(json.status ?? 'pending');
          setEta(json.eta_min ?? null);
        }
      } catch {
        /* keep current status */
      }
    }

    poll();
    const id = setInterval(poll, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [locationId, orderPlaced, mounted]);

  if (!mounted || !orderPlaced || dismissed) return null;
  if (status === 'delivered') {
    // Auto-dismiss nach Lieferung nach kurzem Delay
    setTimeout(() => setDismissed(true), 8000);
  }

  const msg = messageFor(status);

  return (
    <div className="flex items-center gap-2 rounded-xl border border-matcha-200 bg-matcha-50 px-3 py-2 mb-2 overflow-hidden">
      <span className="shrink-0 animate-pulse">{msg.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-matcha-800 truncate">{msg.text}</p>
        {eta != null && (
          <p className="text-[10px] text-matcha-600 tabular-nums">Noch ca. {eta} Min bis zur Lieferung</p>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Schließen"
        className="ml-1 shrink-0 text-muted-foreground hover:text-foreground transition text-sm leading-none"
      >
        ×
      </button>
    </div>
  );
}
