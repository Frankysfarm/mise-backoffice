'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Clock, Bike, ChefHat, Package, CheckCircle2 } from 'lucide-react';

type Phase = 'waiting' | 'cooking' | 'ready' | 'on_route' | 'delivered';

type Props = {
  orderId: string;
  initialStatus: string;
  initialEtaMin: number | null;
};

function mapStatus(status: string): Phase {
  if (['geliefert', 'abgeholt', 'abgeschlossen'].includes(status)) return 'delivered';
  if (status === 'unterwegs') return 'on_route';
  if (status === 'fertig') return 'ready';
  if (status === 'in_zubereitung') return 'cooking';
  return 'waiting';
}

const PHASES: { key: Phase; label: string; icon: React.ElementType; desc: string }[] = [
  { key: 'waiting', label: 'Bestätigt', icon: Clock, desc: 'Bestellung eingegangen' },
  { key: 'cooking', label: 'In Zubereitung', icon: ChefHat, desc: 'Küche arbeitet' },
  { key: 'ready', label: 'Bereit', icon: Package, desc: 'Wartet auf Abholung' },
  { key: 'on_route', label: 'Unterwegs', icon: Bike, desc: 'Fahrer ist auf dem Weg' },
  { key: 'delivered', label: 'Geliefert', icon: CheckCircle2, desc: 'Guten Appetit!' },
];

export function EtaLiveUpdateWidget({ orderId, initialStatus, initialEtaMin }: Props) {
  const [phase, setPhase] = useState<Phase>(() => mapStatus(initialStatus));
  const [etaMin, setEtaMin] = useState<number | null>(initialEtaMin);
  const [countdown, setCountdown] = useState<number | null>(initialEtaMin != null ? initialEtaMin * 60 : null);
  const supabase = createClient();

  // Supabase realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`eta-order-${orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'customer_orders',
        filter: `id=eq.${orderId}`,
      }, (payload: { new: Record<string, unknown> }) => {
        const row = payload.new;
        setPhase(mapStatus((row.status as string | null | undefined) ?? ''));
        const etaMin = row.geschaetzte_lieferung_min as number | null | undefined;
        if (etaMin != null) {
          setEtaMin(etaMin);
          setCountdown(etaMin * 60);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orderId, supabase]);

  // Countdown timer
  useEffect(() => {
    if (phase === 'delivered') { setCountdown(0); return; }
    if (countdown == null || countdown <= 0) return;
    const iv = setInterval(() => {
      setCountdown(prev => (prev != null && prev > 0 ? prev - 1 : prev));
    }, 1000);
    return () => clearInterval(iv);
  }, [phase, countdown]);

  const currentIdx = PHASES.findIndex(p => p.key === phase);
  const progressPct = Math.round((currentIdx / (PHASES.length - 1)) * 100);

  const mins = countdown != null ? Math.floor(countdown / 60) : null;
  const secs = countdown != null ? countdown % 60 : null;

  if (phase === 'delivered') {
    return (
      <div className="rounded-2xl border border-matcha-200 bg-matcha-50 p-5 text-center space-y-2">
        <CheckCircle2 className="h-10 w-10 text-matcha-600 mx-auto" />
        <div className="text-lg font-black text-matcha-800">Geliefert!</div>
        <div className="text-sm text-matcha-600">Guten Appetit 🍽️</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
      {/* ETA countdown */}
      {mins != null && mins > 0 && (
        <div className="text-center">
          <div className="text-4xl font-black tabular-nums text-foreground">
            {String(mins).padStart(2, '0')}:{String(secs ?? 0).padStart(2, '0')}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Geschätzte Restlieferzeit</div>
        </div>
      )}

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-matcha-500 transition-all duration-1000"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Phase steps */}
      <div className="flex items-start justify-between">
        {PHASES.map((p, idx) => {
          const Icon = p.icon;
          const isActive = idx === currentIdx;
          const isDone = idx < currentIdx;
          return (
            <div key={p.key} className="flex flex-col items-center gap-1 flex-1">
              <div className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
                isDone ? 'bg-matcha-500 text-white' : isActive ? 'bg-matcha-100 text-matcha-700 ring-2 ring-matcha-400' : 'bg-stone-100 text-stone-400',
              )}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <span className={cn('text-[9px] text-center font-semibold leading-tight', isActive ? 'text-matcha-700' : isDone ? 'text-matcha-500' : 'text-stone-400')}>
                {p.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Current phase description */}
      {currentIdx >= 0 && (
        <div className="rounded-xl bg-stone-50 px-3 py-2 text-center text-xs text-muted-foreground">
          {PHASES[currentIdx]?.desc}
        </div>
      )}
    </div>
  );
}
