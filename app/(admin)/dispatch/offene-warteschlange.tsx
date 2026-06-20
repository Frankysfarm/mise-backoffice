'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, MapPin, Package, Loader2, RefreshCw, Euro } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { euro } from '@/lib/utils';

type QueueItem = {
  order_id: string;
  bestellnummer: string;
  score: number;
  waited_min: number;
  zone: string | null;
  gesamtbetrag: number;
  kunde_adresse: string | null;
  prioritaet: 'hoch' | 'mittel' | 'niedrig';
};

type QueueHealth = {
  pendingCount: number;
  avgWaitMin: number;
  maxWaitMin: number;
};

function urgencyColor(waited_min: number): { bg: string; border: string; text: string; badge: string } {
  if (waited_min >= 15) return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-500 text-white' };
  if (waited_min >= 5)  return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-400 text-white' };
  return { bg: 'bg-matcha-50', border: 'border-matcha-200', text: 'text-matcha-700', badge: 'bg-matcha-500 text-white' };
}

type Props = { locationId: string };

export function DispatchOffeneWarteschlange({ locationId }: Props) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [health, setHealth] = useState<QueueHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = () => {
    if (!locationId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/dispatch-queue?location_id=${encodeURIComponent(locationId)}`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.queue)) {
          const mapped: QueueItem[] = (d.queue as any[]).map(q => ({
            order_id: q.order_id ?? q.id ?? '',
            bestellnummer: q.bestellnummer ?? q.order_id ?? '—',
            score: q.score ?? q.priority_score ?? 0,
            waited_min: Math.round((q.waited_min ?? q.wait_min ?? q.waitMin ?? 0)),
            zone: q.zone ?? q.delivery_zone ?? null,
            gesamtbetrag: q.gesamtbetrag ?? q.amount ?? 0,
            kunde_adresse: q.kunde_adresse ?? q.address ?? null,
            prioritaet: (q.prioritaet as QueueItem['prioritaet']) ?? 'niedrig',
          }));
          setItems(mapped.slice(0, 10));
        }
        if (d.health) {
          setHealth({
            pendingCount: d.health.pendingCount ?? d.health.pending_count ?? 0,
            avgWaitMin: Math.round(d.health.avgWaitMin ?? d.health.avg_wait_min ?? 0),
            maxWaitMin: Math.round(d.health.maxWaitMin ?? d.health.max_wait_min ?? 0),
          });
        }
        setLastRefresh(new Date());
      })
      .catch(() => {
        // Mock-Daten als Fallback – TODO: remove when API stable
        const now = Date.now();
        setItems([
          { order_id: 'mock-1', bestellnummer: '#4421', score: 95, waited_min: 18, zone: 'A', gesamtbetrag: 32.5, kunde_adresse: 'Hauptstr. 12', prioritaet: 'hoch' },
          { order_id: 'mock-2', bestellnummer: '#4422', score: 78, waited_min: 9, zone: 'B', gesamtbetrag: 19.9, kunde_adresse: 'Bahnhofstr. 7', prioritaet: 'mittel' },
          { order_id: 'mock-3', bestellnummer: '#4423', score: 55, waited_min: 3, zone: 'A', gesamtbetrag: 27.0, kunde_adresse: 'Marktplatz 3', prioritaet: 'niedrig' },
        ]);
        setHealth({ pendingCount: 3, avgWaitMin: 10, maxWaitMin: 18 });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!loading && items.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <Package className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Offene Warteschlange</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        <div className="ml-auto flex items-center gap-2">
          {health && (
            <Badge variant="secondary" className="text-[10px]">
              {health.pendingCount} offen · ø {health.avgWaitMin} Min
            </Badge>
          )}
          {health && health.maxWaitMin >= 15 && (
            <Badge className="bg-red-500 text-white text-[10px] animate-pulse">
              max {health.maxWaitMin} Min
            </Badge>
          )}
          <button onClick={load} className="text-muted-foreground hover:text-foreground transition">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="divide-y">
        {items.map((item, i) => {
          const col = urgencyColor(item.waited_min);
          return (
            <div key={item.order_id} className={cn('flex items-center gap-3 px-4 py-2.5 transition-colors hover:brightness-95', col.bg)}>
              {/* Rank */}
              <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black', col.badge)}>
                {i + 1}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold">{item.bestellnummer}</span>
                  {item.zone && (
                    <span className="rounded-full bg-white/60 border border-current/20 px-1.5 py-0.5 text-[9px] font-bold">
                      Zone {item.zone}
                    </span>
                  )}
                </div>
                {item.kunde_adresse && (
                  <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground truncate">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{item.kunde_adresse}</span>
                  </div>
                )}
              </div>

              {/* Wait time + amount */}
              <div className="shrink-0 text-right">
                <div className={cn('flex items-center gap-1 font-bold text-sm tabular-nums', col.text)}>
                  <Clock className="h-3.5 w-3.5" />
                  {item.waited_min} Min
                </div>
                <div className="text-[10px] text-muted-foreground tabular-nums">
                  {euro(item.gesamtbetrag)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 border-t bg-muted/20">
        <span className="text-[10px] text-muted-foreground">
          Aktualisiert {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · alle 30 Sek
        </span>
      </div>
    </Card>
  );
}
