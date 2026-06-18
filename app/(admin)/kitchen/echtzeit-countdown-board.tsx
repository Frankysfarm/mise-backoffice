'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface OrderItem {
  name: string;
  menge: number;
}

interface CountdownOrder {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  kunde_name: string;
  items: OrderItem[];
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function getColorClass(elapsedMin: number): string {
  if (elapsedMin < 10) return 'border-green-300 bg-green-50';
  if (elapsedMin < 20) return 'border-amber-300 bg-amber-50';
  return 'border-red-400 bg-red-50 animate-pulse';
}

function getTimerColor(elapsedMin: number): string {
  if (elapsedMin < 10) return 'text-green-700';
  if (elapsedMin < 20) return 'text-amber-700';
  return 'text-red-700';
}

export function KitchenEchtzeitCountdownBoard({ orders }: { orders: CountdownOrder[] }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const active = orders.filter(o => o.status === 'in_zubereitung' || o.status === 'bestätigt' || o.status === 'fertig');

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Clock className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Echtzeit-Countdown</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{active.length} Bestellungen</span>
      </div>

      {active.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          Keine aktiven Bestellungen
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
          {active.map(order => {
            const elapsedMs = order.bestellt_am ? Date.now() - new Date(order.bestellt_am).getTime() : 0;
            const elapsedMin = Math.floor(elapsedMs / 60000);
            const isFertig = order.status === 'fertig';

            return (
              <div
                key={order.id}
                className={cn(
                  'rounded-lg border-2 p-3 flex flex-col gap-1.5 transition-colors',
                  isFertig ? 'border-matcha-300 bg-matcha-50' : getColorClass(elapsedMin),
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">#{order.bestellnummer}</span>
                  {isFertig ? (
                    <Badge className="text-[9px] bg-matcha-500 text-white border-0 px-1.5">Fertig</Badge>
                  ) : (
                    <span className={cn('text-sm font-black tabular-nums', getTimerColor(elapsedMin))}>
                      {formatElapsed(elapsedMs)}
                    </span>
                  )}
                </div>

                <div className="text-[11px] font-medium text-foreground truncate">{order.kunde_name}</div>

                <div className="text-[10px] text-muted-foreground">
                  {order.items.length} Position{order.items.length !== 1 ? 'en' : ''}
                  {order.items.slice(0, 2).map((it, i) => (
                    <span key={i} className="ml-1">· {it.menge}× {it.name}</span>
                  ))}
                  {order.items.length > 2 && <span className="ml-1">+{order.items.length - 2} weitere</span>}
                </div>

                {order.geschaetzte_zubereitung_min && !isFertig && (
                  <div className="mt-1 h-1 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-1000',
                        elapsedMin < 10 ? 'bg-green-500' : elapsedMin < 20 ? 'bg-amber-400' : 'bg-red-500',
                      )}
                      style={{ width: `${Math.min(100, (elapsedMin / order.geschaetzte_zubereitung_min) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
