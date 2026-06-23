'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Timer, ChefHat, Bike, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  orderId: string;
  estimatedMin?: number | null;
}

type Phase = 'zubereitung' | 'unterwegs' | 'geliefert';

interface PhaseInfo {
  phase: Phase;
  since: string | null;
  estimatedMin: number | null;
}

const PHASE_CONFIG: Record<Phase, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  zubereitung: { label: 'Wird zubereitet', icon: ChefHat,       color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200' },
  unterwegs:   { label: 'Unterwegs zu dir', icon: Bike,          color: 'text-matcha-700', bg: 'bg-matcha-50 border-matcha-200' },
  geliefert:   { label: 'Zugestellt!',      icon: CheckCircle2,  color: 'text-matcha-700', bg: 'bg-matcha-50 border-matcha-300' },
};

function statusToPhase(status: string): Phase {
  if (['geliefert', 'abgeholt_extern', 'abgeholt'].includes(status)) return 'geliefert';
  if (['unterwegs', 'on_route', 'fertig'].includes(status)) return 'unterwegs';
  return 'zubereitung';
}

function formatElapsed(ms: number): string {
  const min = Math.floor(ms / 60_000);
  const sec = Math.floor((ms % 60_000) / 1000);
  if (min === 0) return `${sec}s`;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export function BestPhaseTimer({ orderId, estimatedMin }: Props) {
  const supabase = createClient();
  const [info, setInfo] = useState<PhaseInfo>({ phase: 'zubereitung', since: null, estimatedMin: estimatedMin ?? null });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!orderId) return;

    async function load() {
      const { data } = await supabase
        .from('customer_orders')
        .select('status,bestellt_am,fertig_am,geschaetzte_zubereitung_min')
        .eq('id', orderId)
        .single();
      if (!data) return;
      const phase = statusToPhase(data.status);
      const since =
        phase === 'unterwegs' ? data.fertig_am :
        phase === 'geliefert' ? data.fertig_am :
        data.bestellt_am;
      setInfo({ phase, since, estimatedMin: data.geschaetzte_zubereitung_min ?? estimatedMin ?? null });
    }

    load();

    const channel = supabase
      .channel(`phase-timer-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'customer_orders', filter: `id=eq.${orderId}` },
        () => load(),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orderId]);

  const cfg = PHASE_CONFIG[info.phase];
  const Icon = cfg.icon;

  const elapsedMs = info.since ? now - new Date(info.since).getTime() : 0;
  const elapsedMin = elapsedMs / 60_000;

  const progressPct = info.estimatedMin && info.phase === 'zubereitung'
    ? Math.min(100, Math.round((elapsedMin / info.estimatedMin) * 100))
    : info.phase === 'geliefert' ? 100 : null;

  const isOverdue = info.estimatedMin && info.phase === 'zubereitung' && elapsedMin > info.estimatedMin;

  return (
    <div className={cn('rounded-2xl border p-4', cfg.bg)}>
      <div className="flex items-center gap-3 mb-3">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-full', info.phase === 'geliefert' ? 'bg-matcha-500 text-white' : 'bg-white border-2 border-inherit')}>
          <Icon className={cn('h-4 w-4', info.phase === 'geliefert' ? 'text-white' : cfg.color)} />
        </div>
        <div>
          <div className={cn('text-sm font-bold', cfg.color)}>{cfg.label}</div>
          {info.since && (
            <div className="text-[10px] text-muted-foreground">
              seit {new Date(info.since).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
            </div>
          )}
        </div>
        <div className="ml-auto text-right">
          <div className={cn('text-xl font-black tabular-nums font-mono', isOverdue ? 'text-red-600' : cfg.color)}>
            {formatElapsed(Math.max(0, elapsedMs))}
          </div>
          <div className="text-[9px] text-muted-foreground">vergangen</div>
        </div>
      </div>

      {progressPct !== null && (
        <div className="space-y-1">
          <div className="h-2 rounded-full bg-white/60 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-1000',
                isOverdue ? 'bg-red-400' : 'bg-matcha-500',
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {info.estimatedMin && info.phase === 'zubereitung' && (
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Timer className="h-2.5 w-2.5" />
                {isOverdue ? 'Überfällig' : `~${Math.max(0, Math.ceil(info.estimatedMin - elapsedMin))} Min verbleibend`}
              </span>
              <span>{progressPct}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
