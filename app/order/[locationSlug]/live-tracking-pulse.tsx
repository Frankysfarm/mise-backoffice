'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Bike, MapPin, CheckCircle2, ChefHat, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

type Phase = 'preparing' | 'ready' | 'picked_up' | 'delivering' | 'delivered';

const PHASES: { key: Phase; label: string; icon: React.ElementType }[] = [
  { key: 'preparing', label: 'Zubereitung', icon: ChefHat },
  { key: 'ready', label: 'Bereit', icon: Package },
  { key: 'picked_up', label: 'Abgeholt', icon: Bike },
  { key: 'delivering', label: 'Unterwegs', icon: MapPin },
  { key: 'delivered', label: 'Geliefert', icon: CheckCircle2 },
];

function statusToPhase(status: string): Phase {
  if (['geliefert', 'abgeholt_extern'].includes(status)) return 'delivered';
  if (['unterwegs', 'on_route'].includes(status)) return 'delivering';
  if (['abgeholt', 'picked_up'].includes(status)) return 'picked_up';
  if (['fertig'].includes(status)) return 'ready';
  return 'preparing';
}

interface Props {
  orderId: string;
  locationId: string;
}

export function LiveTrackingPulse({ orderId, locationId }: Props) {
  const supabase = createClient();
  const [phase, setPhase] = useState<Phase>('preparing');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 2_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!orderId) return;

    const channel = supabase
      .channel(`live-pulse-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'customer_orders', filter: `id=eq.${orderId}` },
        (payload: { new: Record<string, unknown> }) => {
          const st = (payload.new as { status?: string })?.status;
          if (st) setPhase(statusToPhase(st));
        },
      )
      .subscribe();

    async function initial() {
      const { data } = await supabase
        .from('customer_orders')
        .select('status')
        .eq('id', orderId)
        .single();
      if (data?.status) setPhase(statusToPhase(data.status));
    }
    initial();

    return () => { supabase.removeChannel(channel); };
  }, [orderId]);

  const currentIdx = PHASES.findIndex((p) => p.key === phase);

  return (
    <div className="rounded-2xl border border-matcha-200 bg-gradient-to-b from-matcha-50 to-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-matcha-200">
        <div className="relative flex h-2 w-2 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-matcha-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-matcha-600" />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-matcha-800">Live-Tracking</span>
      </div>

      <div className="px-4 py-4">
        {/* Step indicators */}
        <div className="relative flex items-center justify-between">
          {/* Connection line */}
          <div className="absolute left-0 right-0 top-4 h-0.5 bg-matcha-100" />
          <div
            className="absolute left-0 top-4 h-0.5 bg-matcha-500 transition-all duration-700"
            style={{ width: `${(currentIdx / (PHASES.length - 1)) * 100}%` }}
          />

          {PHASES.map((p, idx) => {
            const done = idx < currentIdx;
            const active = idx === currentIdx;
            const Icon = p.icon;
            return (
              <div key={p.key} className="relative z-10 flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-500',
                    done
                      ? 'border-matcha-500 bg-matcha-500 text-white'
                      : active
                      ? 'border-matcha-500 bg-white text-matcha-600 shadow-md shadow-matcha-200'
                      : 'border-matcha-200 bg-white text-matcha-300',
                  )}
                >
                  {active ? (
                    <span
                      className={cn(
                        'relative inline-flex',
                        tick % 2 === 0 ? 'opacity-100' : 'opacity-70',
                        'transition-opacity duration-300',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={cn(
                    'text-[9px] font-bold text-center max-w-[52px] leading-tight',
                    done ? 'text-matcha-600' : active ? 'text-matcha-700' : 'text-matcha-300',
                  )}
                >
                  {p.label}
                </span>
              </div>
            );
          })}
        </div>

        {phase === 'delivered' && (
          <div className="mt-4 rounded-xl bg-matcha-600 px-4 py-2.5 text-center">
            <span className="text-sm font-bold text-white">Bestellung erfolgreich geliefert!</span>
          </div>
        )}
      </div>
    </div>
  );
}
