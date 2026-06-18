'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Flame, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PrepItem {
  orderId: string;
  bestellnummer: string;
  itemName: string;
  menge: number;
  station: string;
  startedAt: string | null;
  targetMin: number;
}

type Urgency = 'done' | 'on-time' | 'tight' | 'overdue';

function calcUrgency(item: PrepItem): { urgency: Urgency; elapsedMin: number; remainMin: number } {
  if (!item.startedAt) return { urgency: 'on-time', elapsedMin: 0, remainMin: item.targetMin };
  const elapsed = Math.floor((Date.now() - new Date(item.startedAt).getTime()) / 60000);
  const remain = item.targetMin - elapsed;
  let urgency: Urgency = 'on-time';
  if (remain <= 0) urgency = 'overdue';
  else if (remain <= 2) urgency = 'tight';
  else urgency = 'on-time';
  return { urgency, elapsedMin: elapsed, remainMin: Math.max(0, remain) };
}

const URGENCY_META: Record<Urgency, { bg: string; border: string; badge: string; label: string }> = {
  done:    { bg: 'bg-matcha-50',  border: 'border-matcha-200', badge: 'bg-matcha-500 text-white',   label: 'Fertig' },
  'on-time':{ bg: 'bg-white',     border: 'border-border',     badge: 'bg-muted text-foreground',    label: 'Läuft' },
  tight:   { bg: 'bg-amber-50',   border: 'border-amber-200',  badge: 'bg-amber-500 text-white',     label: 'Knapp' },
  overdue: { bg: 'bg-red-50',     border: 'border-red-200',    badge: 'bg-red-600 text-white',       label: 'Überfällig' },
};

const MOCK_ITEMS: PrepItem[] = [
  { orderId: 'o1', bestellnummer: '1042', itemName: 'Matcha Latte', menge: 2, station: 'Getränke', startedAt: new Date(Date.now() - 4 * 60000).toISOString(), targetMin: 5 },
  { orderId: 'o2', bestellnummer: '1043', itemName: 'Avocado Bowl', menge: 1, station: 'Bowl', startedAt: new Date(Date.now() - 8 * 60000).toISOString(), targetMin: 7 },
  { orderId: 'o3', bestellnummer: '1044', itemName: 'Acai Bowl', menge: 3, station: 'Bowl', startedAt: new Date(Date.now() - 2 * 60000).toISOString(), targetMin: 7 },
  { orderId: 'o4', bestellnummer: '1045', itemName: 'Green Smoothie', menge: 2, station: 'Getränke', startedAt: null, targetMin: 4 },
  { orderId: 'o5', bestellnummer: '1046', itemName: 'Protein Box', menge: 1, station: 'Snack', startedAt: new Date(Date.now() - 6 * 60000).toISOString(), targetMin: 5 },
];

export function PrepQueueMonitor({ items = MOCK_ITEMS, useMock = true }: { items?: PrepItem[]; useMock?: boolean }) {
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 15000);
    return () => clearInterval(id);
  }, []);

  const processed = items.map(item => ({ item, ...calcUrgency(item) })).sort((a, b) => {
    const order: Urgency[] = ['overdue', 'tight', 'on-time', 'done'];
    return order.indexOf(a.urgency) - order.indexOf(b.urgency);
  });

  const overdueCount = processed.filter(x => x.urgency === 'overdue').length;
  const tightCount = processed.filter(x => x.urgency === 'tight').length;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider">Zubereitungs-Monitor</span>
          <div className="flex gap-1 ml-1">
            {overdueCount > 0 && (
              <span className="rounded-full bg-red-600 text-white px-1.5 py-0.5 text-[9px] font-black">
                {overdueCount}× Überfällig
              </span>
            )}
            {tightCount > 0 && (
              <span className="rounded-full bg-amber-500 text-white px-1.5 py-0.5 text-[9px] font-black">
                {tightCount}× Knapp
              </span>
            )}
            {overdueCount === 0 && tightCount === 0 && (
              <span className="rounded-full bg-matcha-100 text-matcha-700 px-1.5 py-0.5 text-[9px] font-bold">
                Alles läuft
              </span>
            )}
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t">
          {processed.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Keine aktiven Zubereitungen.
            </div>
          )}

          <div className="divide-y">
            {processed.map(({ item, urgency, elapsedMin, remainMin }) => {
              const m = URGENCY_META[urgency];
              return (
                <div key={`${item.orderId}-${item.itemName}`} className={cn('flex items-center gap-3 px-4 py-2.5', m.bg)}>
                  {/* Station-Tag */}
                  <div className="shrink-0">
                    <span className="rounded-full bg-muted text-foreground text-[9px] font-bold px-2 py-0.5">
                      {item.station}
                    </span>
                  </div>

                  {/* Item-Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold truncate">{item.menge}× {item.itemName}</span>
                      <span className="text-[9px] text-muted-foreground">#{item.bestellnummer}</span>
                    </div>

                    {/* Timer-Balken */}
                    {item.startedAt && (
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-1000',
                              urgency === 'overdue' ? 'bg-red-500 w-full' :
                              urgency === 'tight'   ? 'bg-amber-400' :
                                                      'bg-matcha-400',
                            )}
                            style={{ width: urgency === 'overdue' ? '100%' : `${Math.min(100, (elapsedMin / item.targetMin) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-bold tabular-nums shrink-0 text-muted-foreground">
                          {urgency === 'overdue' ? `+${elapsedMin - item.targetMin}m` : `${remainMin}m`}
                        </span>
                      </div>
                    )}
                    {!item.startedAt && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">Noch nicht gestartet · Ziel {item.targetMin} Min</div>
                    )}
                  </div>

                  {/* Status-Badge */}
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black', m.badge)}>
                    {m.label}
                  </span>
                </div>
              );
            })}
          </div>

          {useMock && (
            <div className="px-4 py-1.5 bg-muted/20 border-t">
              <span className="text-[10px] text-muted-foreground">⚠ Demo-Daten — Echtdaten über Kitchen-Queue-API</span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
