'use client';

import { useEffect, useState } from 'react';
import { MapPin, Clock, CheckCircle2, Bike, ChefHat, Package, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

type TrackingStatus = 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

type TrackingData = {
  bestellnummer: string;
  status: TrackingStatus;
  bestellt_am: string | null;
  fertig_am: string | null;
  geschaetzte_lieferung_min: number | null;
  driver_name: string | null;
  eta_min: number | null;
};

const STATUS_STEPS: { key: TrackingStatus; label: string; icon: React.ElementType }[] = [
  { key: 'bestätigt',      label: 'Bestätigt',       icon: CheckCircle2 },
  { key: 'in_zubereitung', label: 'In Zubereitung',  icon: ChefHat },
  { key: 'fertig',         label: 'Bereit',           icon: Package },
  { key: 'unterwegs',     label: 'Unterwegs',         icon: Bike },
  { key: 'geliefert',     label: 'Geliefert!',        icon: CheckCircle2 },
];

const STATUS_ORDER: TrackingStatus[] = ['neu', 'bestätigt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert'];

function getStepIndex(status: TrackingStatus) {
  const i = STATUS_ORDER.indexOf(status);
  return i < 0 ? 0 : i;
}

export function LiveTrackingCard({ bestellnummer }: { bestellnummer: string }) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/delivery/tracking/${encodeURIComponent(bestellnummer)}`, { cache: 'no-store' })
        .catch(() => null);
      if (res?.ok) {
        const d = await res.json();
        setData({
          bestellnummer: d.bestellnummer ?? bestellnummer,
          status: d.status ?? 'neu',
          bestellt_am: d.bestellt_am ?? null,
          fertig_am: d.fertig_am ?? null,
          geschaetzte_lieferung_min: d.geschaetzte_lieferung_min ?? null,
          driver_name: d.driver_name ?? null,
          eta_min: d.eta_min ?? null,
        });
      }
      setLoading(false);
    }
    load();

    // Realtime updates
    const ch = supabase
      .channel(`tracking-${bestellnummer}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'customer_orders' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bestellnummer]);

  // ETA countdown
  useEffect(() => {
    if (!data?.bestellt_am || !data?.geschaetzte_lieferung_min) { setCountdown(null); return; }
    if (data.status === 'geliefert') { setCountdown(0); return; }
    const targetMs = new Date(data.bestellt_am).getTime() + data.geschaetzte_lieferung_min * 60_000;
    const tick = () => {
      const secs = Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
      setCountdown(secs);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [data]);

  if (loading) {
    return (
      <div className="rounded-2xl border bg-white p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Bestellstatus wird geladen…
      </div>
    );
  }

  if (!data) return null;

  const stepIdx = getStepIndex(data.status);
  const activeStepIndex = Math.max(0, stepIdx - 1); // Map to 0-4 steps (excluding 'neu')

  const countdownMin = countdown != null ? Math.floor(countdown / 60) : null;
  const countdownSec = countdown != null ? countdown % 60 : null;
  const isDelivered = data.status === 'geliefert';
  const isOnTheWay = data.status === 'unterwegs';

  return (
    <div className={cn(
      'rounded-2xl border-2 p-4 space-y-3 transition-all',
      isDelivered ? 'border-matcha-400 bg-matcha-50' :
      isOnTheWay ? 'border-blue-400 bg-blue-50' :
      'border-gray-200 bg-white',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground font-medium">Bestellung #{data.bestellnummer}</div>
          <div className={cn(
            'text-sm font-bold',
            isDelivered ? 'text-matcha-700' : isOnTheWay ? 'text-blue-700' : 'text-foreground',
          )}>
            {isDelivered ? '🎉 Zugestellt!' :
             isOnTheWay ? '🛵 Fahrer ist unterwegs' :
             data.status === 'in_zubereitung' ? '👨‍🍳 Wird zubereitet' :
             data.status === 'fertig' ? '📦 Bereit zur Abholung' :
             '✅ Bestätigt'}
          </div>
        </div>
        {/* Countdown */}
        {countdownMin != null && countdownSec != null && !isDelivered && (
          <div className="flex flex-col items-center justify-center rounded-xl bg-white border-2 border-current px-3 py-2 min-w-[56px]"
            style={{ borderColor: isOnTheWay ? '#3b82f6' : '#84cc16' }}>
            <div className={cn(
              'font-mono text-xl font-black tabular-nums leading-none',
              isOnTheWay ? 'text-blue-700' : 'text-matcha-700',
            )}>
              {String(countdownMin).padStart(2, '0')}:{String(countdownSec).padStart(2, '0')}
            </div>
            <div className="text-[8px] text-muted-foreground mt-0.5">verbleibend</div>
          </div>
        )}
      </div>

      {/* Status Steps */}
      <div className="relative">
        {/* Progress line */}
        <div className="absolute top-3 left-3 right-3 h-0.5 bg-muted">
          <div
            className="h-full bg-matcha-500 transition-all duration-700"
            style={{ width: `${Math.min(100, (activeStepIndex / (STATUS_STEPS.length - 1)) * 100)}%` }}
          />
        </div>

        <div className="relative grid grid-cols-5 gap-0">
          {STATUS_STEPS.map((step, i) => {
            const done = i < activeStepIndex;
            const active = i === activeStepIndex;
            const Icon = step.icon;
            return (
              <div key={step.key} className="flex flex-col items-center gap-1">
                <div className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center border-2 transition-all duration-300 z-10 bg-white',
                  done ? 'bg-matcha-500 border-matcha-500 text-white' :
                  active ? 'border-matcha-500 bg-white text-matcha-600 scale-110' :
                  'border-gray-200 text-gray-300',
                )}>
                  {done ? <CheckCircle2 className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                </div>
                <div className={cn(
                  'text-[8px] text-center leading-tight',
                  done ? 'text-matcha-600 font-bold' :
                  active ? 'text-matcha-700 font-black' :
                  'text-gray-400',
                )}>
                  {step.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Driver info when on the way */}
      {isOnTheWay && data.driver_name && (
        <div className="flex items-center gap-2 rounded-xl bg-blue-100 border border-blue-200 px-3 py-2">
          <Bike className="h-4 w-4 text-blue-600 shrink-0" />
          <div>
            <div className="text-xs font-bold text-blue-800">{data.driver_name} ist unterwegs</div>
            {data.eta_min != null && (
              <div className="text-[10px] text-blue-600">Ankunft in ca. {data.eta_min} Minuten</div>
            )}
          </div>
        </div>
      )}

      {/* ETA info */}
      {!isDelivered && data.geschaetzte_lieferung_min && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          Geschätzte Lieferzeit: {data.geschaetzte_lieferung_min} Minuten
        </div>
      )}
    </div>
  );
}
