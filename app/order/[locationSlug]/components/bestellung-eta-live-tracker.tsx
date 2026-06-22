'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Bike, CheckCircle2, ChefHat, Clock, Loader2, MapPin, Package,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type TrackingStatus =
  | 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

type TrackingData = {
  status: TrackingStatus;
  bestellt_am: string | null;
  eta_earliest: string | null;
  eta_latest: string | null;
  driver_name: string | null;
  bestellnummer: string;
};

interface Props {
  orderId: string;
  bestellnummer: string;
  initialStatus?: TrackingStatus;
  typ?: 'lieferung' | 'abholung' | string;
}

const STEPS: { key: TrackingStatus; label: string; icon: React.ElementType; deliveryOnly?: boolean }[] = [
  { key: 'bestätigt',      label: 'Bestätigt',       icon: CheckCircle2 },
  { key: 'in_zubereitung', label: 'Wird zubereitet', icon: ChefHat },
  { key: 'fertig',         label: 'Bereit',           icon: Package },
  { key: 'unterwegs',      label: 'Unterwegs',        icon: Bike, deliveryOnly: true },
  { key: 'geliefert',      label: 'Angekommen!',      icon: CheckCircle2 },
];

const STATUS_ORDER: TrackingStatus[] = [
  'neu', 'bestätigt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert',
];

function stepIdx(status: TrackingStatus): number {
  return STATUS_ORDER.indexOf(status);
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function fmtCountdown(iso: string): string {
  const secs = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
  if (secs <= 0) return 'gleich';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m > 0) return `${m}:${String(s).padStart(2, '0')} Min`;
  return `${s} Sek`;
}

export function BestellungEtaLiveTracker({ orderId, bestellnummer, initialStatus, typ = 'lieferung' }: Props) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);
  const supabase = createClient();

  async function load() {
    try {
      const res = await fetch(
        `/api/delivery/orders/${encodeURIComponent(orderId)}/tracking`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const d = await res.json();
        setData({
          status: d.status ?? initialStatus ?? 'bestätigt',
          bestellt_am: d.bestellt_am ?? null,
          eta_earliest: d.eta_earliest ?? null,
          eta_latest: d.eta_latest ?? null,
          driver_name: d.driver_name ?? null,
          bestellnummer: d.bestellnummer ?? bestellnummer,
        });
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    load();
    const tick = setInterval(() => setTick(n => n + 1), 1000);
    const ch = supabase
      .channel(`eta-tracker-${orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'customer_orders',
        filter: `id=eq.${orderId}`,
      }, () => load())
      .subscribe();
    return () => {
      clearInterval(tick);
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border bg-card p-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Lade Bestellstatus…</span>
      </div>
    );
  }

  const status = data?.status ?? initialStatus ?? 'bestätigt';
  const isPickup = typ === 'abholung';
  const isDelivered = status === 'geliefert';
  const isUnderway = status === 'unterwegs';

  const visibleSteps = isPickup
    ? STEPS.filter(s => !s.deliveryOnly)
    : STEPS;
  const currentIdx = stepIdx(status);

  const etaLabel = (() => {
    if (isDelivered) return 'Erfolgreich geliefert 🎉';
    if (data?.eta_earliest && data?.eta_latest) {
      const now = Date.now();
      const earliest = new Date(data.eta_earliest).getTime();
      if (earliest > now) {
        return `In ${fmtCountdown(data.eta_earliest)} · ${fmtTime(data.eta_earliest)}–${fmtTime(data.eta_latest)} Uhr`;
      }
      return `${fmtTime(data.eta_earliest)}–${fmtTime(data.eta_latest)} Uhr`;
    }
    if (data?.eta_earliest) {
      const now = Date.now();
      const t = new Date(data.eta_earliest).getTime();
      if (t > now) return `In ${fmtCountdown(data.eta_earliest)}`;
    }
    return null;
  })();

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* ETA banner */}
      {etaLabel && (
        <div className={cn(
          'px-4 py-3 text-center font-bold text-sm border-b border-border',
          isDelivered
            ? 'bg-matcha-600 text-white'
            : isUnderway
            ? 'bg-blue-600 text-white'
            : 'bg-matcha-50 text-matcha-700',
        )}>
          <Clock className="inline h-4 w-4 mr-1.5 mb-0.5" />
          {etaLabel}
        </div>
      )}

      <div className="px-4 py-5">
        {/* Step indicator */}
        <div className="relative flex justify-between">
          {/* Track line */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-muted">
            <div
              className="h-full bg-matcha-500 transition-all duration-1000"
              style={{
                width: `${Math.min(100, (currentIdx / (visibleSteps.length - 1)) * 100)}%`,
              }}
            />
          </div>

          {visibleSteps.map((step, idx) => {
            const stepStatusIdx = stepIdx(step.key);
            const done    = currentIdx > stepStatusIdx;
            const active  = currentIdx === stepStatusIdx;
            const Icon    = step.icon;

            return (
              <div key={step.key} className="relative flex flex-col items-center gap-2 z-10">
                <div className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-500',
                  done    ? 'bg-matcha-500 border-matcha-500 text-white' :
                  active  ? 'bg-white border-matcha-500 text-matcha-600 shadow-md' + (isUnderway ? ' animate-bounce' : '') :
                            'bg-background border-muted text-muted-foreground',
                )}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className={cn(
                  'text-[10px] font-bold text-center max-w-[52px] leading-tight',
                  done   ? 'text-matcha-600' :
                  active ? 'text-foreground' :
                           'text-muted-foreground',
                )}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Driver info */}
        {isUnderway && data?.driver_name && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5">
            <Bike className="h-4 w-4 text-blue-600 shrink-0" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                Dein Fahrer ist unterwegs
              </div>
              <div className="text-sm font-bold text-foreground">{data.driver_name}</div>
            </div>
          </div>
        )}

        {/* Order number */}
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span>Bestellung #{bestellnummer}</span>
        </div>
      </div>
    </div>
  );
}
