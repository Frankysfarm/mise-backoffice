'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Clock, ChefHat, Bike, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

interface Props {
  orderId: string;
  isDelivery?: boolean;
}

type OrderStatus =
  | 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig'
  | 'in_zustellung' | 'geliefert' | 'abgeholt';

interface Phase {
  key: OrderStatus[];
  label: string;
  icon: React.FC<{ className?: string }>;
  deliveryOnly?: boolean;
}

const PHASES: Phase[] = [
  { key: ['bestätigt', 'neu'], label: 'Bestätigt', icon: CheckCircle2 },
  { key: ['in_zubereitung'], label: 'Zubereitung', icon: ChefHat },
  { key: ['fertig'], label: 'Fertig', icon: Package },
  { key: ['in_zustellung'], label: 'Unterwegs', icon: Bike, deliveryOnly: true },
  { key: ['geliefert', 'abgeholt'], label: 'Geliefert', icon: CheckCircle2, deliveryOnly: false },
];

const STATUS_ORDER: OrderStatus[] = [
  'neu', 'bestätigt', 'in_zubereitung', 'fertig', 'in_zustellung', 'geliefert', 'abgeholt',
];

function statusIndex(s: string): number {
  return STATUS_ORDER.indexOf(s as OrderStatus);
}

function fmtTime(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function LiveStatusTimeline({ orderId, isDelivery = true }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [timestamps, setTimestamps] = useState<Partial<Record<string, string>>>({});

  useEffect(() => {
    if (!orderId) return;
    const supabase = createClient();
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from('orders')
        .select('status, bestellt_am, fertig_am, updated_at')
        .eq('id', orderId)
        .single();
      if (cancelled || !data) return;
      setStatus(data.status);
      setTimestamps({
        bestätigt: data.bestellt_am,
        fertig: data.fertig_am,
        geliefert: data.status === 'geliefert' ? (data.updated_at ?? null) : null,
        abgeholt: data.status === 'abgeholt' ? (data.updated_at ?? null) : null,
      });
    };

    load();

    const channel = supabase
      .channel(`live-status-timeline-${orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`,
      }, payload => {
        if (cancelled) return;
        const row = payload.new as Record<string, unknown>;
        setStatus(row.status as string);
        setTimestamps(prev => ({
          ...prev,
          fertig: (row.fertig_am as string) ?? prev.fertig,
          geliefert: row.status === 'geliefert' ? (row.updated_at as string) ?? null : prev.geliefert,
          abgeholt: row.status === 'abgeholt' ? (row.updated_at as string) ?? null : prev.abgeholt,
        }));
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  if (!status) return null;

  const currentIdx = statusIndex(status);
  const phases = PHASES.filter(p => isDelivery || !p.deliveryOnly);

  return (
    <div className="w-full rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-3.5 w-3.5 text-matcha-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-matcha-300">Bestell-Status</span>
      </div>

      <ol className="relative flex flex-col gap-0">
        {phases.map((phase, i) => {
          const phaseIdx = Math.max(...phase.key.map(statusIndex));
          const isDone = currentIdx > phaseIdx;
          const isActive = phase.key.includes(status as OrderStatus) ||
            (currentIdx >= phaseIdx && currentIdx <= phaseIdx + 1 && !isDone);
          const isPending = !isDone && !isActive;
          const Icon = phase.icon;
          const ts = phase.key.reduce<string | null>((acc, k) => acc ?? timestamps[k] ?? null, null);
          const isLast = i === phases.length - 1;

          return (
            <li key={phase.label} className="flex items-start gap-3 pb-4 relative">
              {!isLast && (
                <div className={cn(
                  'absolute left-[9px] top-5 w-0.5 h-full',
                  isDone ? 'bg-matcha-500' : 'bg-white/10',
                )} />
              )}
              <div className={cn(
                'relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-2',
                isDone ? 'bg-matcha-500 ring-matcha-300' :
                isActive ? 'bg-white/20 ring-white/60 animate-pulse' :
                'bg-white/5 ring-white/10',
              )}>
                {isDone ? (
                  <CheckCircle2 className="h-3 w-3 text-white" />
                ) : isActive ? (
                  <Icon className="h-3 w-3 text-white" />
                ) : (
                  <Circle className="h-3 w-3 text-white/30" />
                )}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn(
                    'text-xs font-bold',
                    isDone ? 'text-matcha-300' :
                    isActive ? 'text-white' :
                    'text-white/30',
                  )}>
                    {phase.label}
                  </span>
                  {ts && fmtTime(ts) && (
                    <span className="text-[10px] font-mono text-white/50 shrink-0">{fmtTime(ts)}</span>
                  )}
                  {isActive && !ts && (
                    <span className="text-[9px] font-bold text-white/60 bg-white/10 rounded-full px-2 py-0.5">Jetzt</span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
