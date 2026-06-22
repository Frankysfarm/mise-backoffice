'use client';

import { useEffect, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { ChefHat, Clock, PlayCircle, AlertTriangle, CheckCircle2, Zap } from 'lucide-react';

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  kunde_name: string;
  typ: string;
  items?: { name: string; menge: number }[];
}

interface BatchStop {
  order_id: string;
  angekommen_am: string | null;
  geliefert_am: string | null;
}

interface Batch {
  id: string;
  status: string;
  started_at: string | null;
  total_eta_min: number | null;
  stops?: BatchStop[];
}

interface Props {
  orders: Order[];
  batches: Batch[];
}

type KochPhase = 'jetzt-starten' | 'bald-starten' | 'warten' | 'fertig';

function getKochPhase(order: Order, expectedPickupMin: number, now: number): KochPhase {
  if (['fertig', 'unterwegs', 'geliefert'].includes(order.status)) return 'fertig';
  const prepMin = order.geschaetzte_zubereitung_min ?? 20;
  const bestelltMs = order.bestellt_am ? new Date(order.bestellt_am).getTime() : now;
  const elapsedMin = (now - bestelltMs) / 60_000;
  const latestKochstartMin = expectedPickupMin - prepMin;
  const minutesUntilKochstart = latestKochstartMin - elapsedMin;

  if (minutesUntilKochstart <= 0) return 'jetzt-starten';
  if (minutesUntilKochstart <= 5) return 'bald-starten';
  return 'warten';
}

const phaseStyle: Record<KochPhase, { card: string; badge: string; label: string; icon: typeof ChefHat }> = {
  'jetzt-starten': { card: 'bg-red-50 border-red-400 ring-2 ring-red-300 animate-pulse', badge: 'bg-red-600 text-white', label: 'JETZT STARTEN', icon: Zap },
  'bald-starten':  { card: 'bg-amber-50 border-amber-300',  badge: 'bg-amber-500 text-white',  label: 'Bald starten',  icon: AlertTriangle },
  'warten':        { card: 'bg-white border-border',          badge: 'bg-muted text-muted-foreground', label: 'Warten',    icon: Clock },
  'fertig':        { card: 'bg-matcha-50 border-matcha-200',  badge: 'bg-matcha-500 text-white', label: 'Fertig',      icon: CheckCircle2 },
};

export function KitchenKochstartSequenzBoard({ orders, batches }: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(iv);
  }, []);

  const activeBatches = useMemo(() =>
    batches.filter(b => ['on_route', 'unterwegs', 'bereit'].includes(b.status)),
    [batches],
  );

  const rows = useMemo(() => {
    return orders
      .filter(o => !['storniert', 'geliefert'].includes(o.status))
      .map(order => {
        const prepMin = order.geschaetzte_zubereitung_min ?? 20;
        // Find if this order is in an active batch
        const orderBatch = activeBatches.find(b =>
          b.stops?.some(s => s.order_id === order.id && !s.geliefert_am),
        );
        const pickupEtaMin = orderBatch?.total_eta_min != null
          ? Math.max(0, orderBatch.total_eta_min - (orderBatch.started_at
              ? (now - new Date(orderBatch.started_at).getTime()) / 60_000
              : 0))
          : 30;

        const phase = getKochPhase(order, pickupEtaMin, now);
        const bestelltMs = order.bestellt_am ? new Date(order.bestellt_am).getTime() : now;
        const elapsedMin = Math.floor((now - bestelltMs) / 60_000);
        const idealKochstartIn = Math.max(0, Math.round(pickupEtaMin - prepMin));

        return { order, phase, pickupEtaMin, idealKochstartIn, elapsedMin, prepMin };
      })
      .sort((a, b) => {
        const phaseOrder: KochPhase[] = ['jetzt-starten', 'bald-starten', 'warten', 'fertig'];
        return phaseOrder.indexOf(a.phase) - phaseOrder.indexOf(b.phase);
      });
  }, [orders, activeBatches, now]);

  const urgent = rows.filter(r => r.phase === 'jetzt-starten').length;
  const soon   = rows.filter(r => r.phase === 'bald-starten').length;
  const active = rows.filter(r => r.phase !== 'fertig');

  if (active.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <div className={cn(
        'flex items-center gap-2 px-4 py-2.5 border-b',
        urgent > 0 ? 'bg-red-50' : soon > 0 ? 'bg-amber-50' : 'bg-white',
      )}>
        <ChefHat className={cn('h-4 w-4 shrink-0', urgent > 0 ? 'text-red-600' : 'text-matcha-600')} />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">Kochstart-Sequenz</span>
        <div className="flex items-center gap-1.5 text-[10px]">
          {urgent > 0 && (
            <span className="flex items-center gap-0.5 rounded-full bg-red-600 text-white px-2 py-0.5 font-bold">
              <Zap className="h-2.5 w-2.5" />{urgent} jetzt
            </span>
          )}
          {soon > 0 && (
            <span className="flex items-center gap-0.5 rounded-full bg-amber-500 text-white px-2 py-0.5 font-bold">
              <AlertTriangle className="h-2.5 w-2.5" />{soon} bald
            </span>
          )}
          <span className="text-muted-foreground">{active.length} aktiv</span>
        </div>
      </div>

      <div className="divide-y">
        {active.slice(0, 10).map(({ order, phase, idealKochstartIn, elapsedMin, prepMin, pickupEtaMin }) => {
          const style = phaseStyle[phase];
          const Icon = style.icon;
          return (
            <div key={order.id} className={cn('px-4 py-3 flex items-center gap-3 border-l-4 transition-all', style.card)}>
              <div className={cn('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black min-w-[80px] text-center flex items-center justify-center gap-1', style.badge)}>
                <Icon className="h-2.5 w-2.5" />
                {style.label}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold">#{order.bestellnummer}</span>
                  <span className="text-[11px] text-muted-foreground truncate">{order.kunde_name}</span>
                  <span className={cn(
                    'text-[9px] rounded px-1.5 py-0.5 font-bold',
                    order.typ === 'lieferung' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700',
                  )}>
                    {order.typ === 'lieferung' ? 'Lieferung' : 'Abholung'}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>Prep: {prepMin} Min</span>
                  <span>Läuft: {elapsedMin} Min</span>
                  {phase !== 'fertig' && (
                    <span className={cn(
                      'font-bold',
                      phase === 'jetzt-starten' ? 'text-red-600' : phase === 'bald-starten' ? 'text-amber-600' : '',
                    )}>
                      {phase === 'jetzt-starten'
                        ? 'Überfällig!'
                        : `Kochstart in ${idealKochstartIn} Min`}
                    </span>
                  )}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="font-mono text-sm font-black tabular-nums">
                  {Math.round(pickupEtaMin)}<span className="text-[9px] font-normal ml-0.5">m</span>
                </div>
                <div className="text-[8px] text-muted-foreground">Abholung</div>
              </div>
            </div>
          );
        })}
        {active.length > 10 && (
          <div className="px-4 py-2 text-[10px] text-muted-foreground text-center bg-muted/20">
            +{active.length - 10} weitere Bestellungen
          </div>
        )}
      </div>
    </Card>
  );
}
