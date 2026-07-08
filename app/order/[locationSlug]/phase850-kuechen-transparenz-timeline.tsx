'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, ChefHat, Clock, Loader2, Package, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

type Stage = 'warteschlange' | 'zubereitung' | 'bereit' | 'unterwegs' | 'geliefert';

interface KitchenTimeline {
  order_id: string;
  stage: Stage;
  stages: Array<{
    key: Stage;
    label: string;
    done: boolean;
    active: boolean;
    ts: string | null;
  }>;
  eta_min: number | null;
  generatedAt: string;
}

interface Props {
  orderId: string | null;
  locationId: string | null;
}

const STAGE_ICONS: Record<Stage, React.ComponentType<{ className?: string }>> = {
  warteschlange: Clock,
  zubereitung: ChefHat,
  bereit: Package,
  unterwegs: Truck,
  geliefert: CheckCircle2,
};

function mapOrderStatus(status: string): Stage {
  if (status === 'delivered') return 'geliefert';
  if (status === 'out_for_delivery' || status === 'picked_up') return 'unterwegs';
  if (status === 'ready') return 'bereit';
  if (status === 'preparing') return 'zubereitung';
  return 'warteschlange';
}

function buildStages(currentStage: Stage, tsByStage: Partial<Record<Stage, string>>): KitchenTimeline['stages'] {
  const ORDER: Stage[] = ['warteschlange', 'zubereitung', 'bereit', 'unterwegs', 'geliefert'];
  const LABELS: Record<Stage, string> = {
    warteschlange: 'Warteschlange',
    zubereitung: 'Zubereitung',
    bereit: 'Abholbereit',
    unterwegs: 'Unterwegs',
    geliefert: 'Geliefert',
  };
  const currentIdx = ORDER.indexOf(currentStage);
  return ORDER.map((key, i) => ({
    key,
    label: LABELS[key],
    done: i < currentIdx,
    active: i === currentIdx,
    ts: tsByStage[key] ?? null,
  }));
}

export function Phase850KuechenTransparenzTimeline({ orderId, locationId }: Props) {
  const [data, setData] = useState<KitchenTimeline | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!orderId || !locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/order/kuechen-timeline?order_id=${orderId}&location_id=${locationId}`, { cache: 'no-store' });
      setData(res.ok ? await res.json() : null);
    } catch {
      // keine Anzeige bei Fehler
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!orderId) return;
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [orderId, locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!orderId) return null;
  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Bestellstatus wird geladen…
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="rounded-2xl border bg-white px-5 py-4 space-y-4">
      <div className="flex items-center gap-2">
        <ChefHat className="h-4 w-4 text-matcha-600" />
        <span className="text-sm font-bold text-stone-800">Deine Bestellung</span>
        {data.eta_min != null && data.stages.find(s => s.key === 'geliefert')?.done === false && (
          <span className="ml-auto rounded-full bg-matcha-100 px-2.5 py-0.5 text-[11px] font-bold text-matcha-700">
            ~{data.eta_min} Min
          </span>
        )}
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Verbindungslinie */}
        <div className="absolute left-4 top-5 bottom-5 w-0.5 bg-stone-100" aria-hidden />

        <div className="space-y-4">
          {data.stages.map(stage => {
            const Icon = STAGE_ICONS[stage.key];
            return (
              <div key={stage.key} className="relative flex items-start gap-4">
                <div className={cn(
                  'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-500',
                  stage.done && 'border-matcha-500 bg-matcha-500 text-white',
                  stage.active && 'border-matcha-500 bg-white text-matcha-600 shadow-md shadow-matcha-200 animate-pulse',
                  !stage.done && !stage.active && 'border-stone-200 bg-stone-50 text-stone-300',
                )}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 pt-0.5">
                  <div className={cn(
                    'text-sm font-bold leading-none',
                    stage.done && 'text-matcha-700',
                    stage.active && 'text-stone-900',
                    !stage.done && !stage.active && 'text-stone-400',
                  )}>
                    {stage.label}
                  </div>
                  {stage.ts && (
                    <div className="mt-0.5 text-[10px] text-stone-400">
                      {new Date(stage.ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                  {stage.active && !stage.ts && (
                    <div className="mt-0.5 text-[10px] text-matcha-600 font-medium animate-pulse">Jetzt aktiv…</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
