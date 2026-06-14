'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { List, RefreshCw } from 'lucide-react';

type DeliveryEventType =
  | 'order_received' | 'order_dispatched' | 'order_bundled' | 'order_held' | 'order_geocoded'
  | 'batch_created' | 'batch_assigned' | 'batch_optimized' | 'batch_picked_up' | 'batch_completed' | 'batch_cancelled'
  | 'stop_delivered' | 'driver_online' | 'driver_offline' | 'eta_updated' | 'zone_classified'
  | 'kitchen_ready' | 'kitchen_cooking' | 'delay_first_notice' | 'delay_critical_notice'
  | 'delay_compensation_created' | 'order_scheduled' | 'order_released_for_dispatch'
  | 'tour_stop_inserted' | 'tour_stop_removed' | 'tour_reoptimized';

interface DeliveryEventRow {
  id: string;
  event_type: DeliveryEventType;
  order_id: string | null;
  batch_id: string | null;
  driver_id: string | null;
  occurred_at: string;
  payload: Record<string, unknown>;
}

interface EventsData {
  events: DeliveryEventRow[];
  total: number;
}

const EVENT_CATEGORIES: { label: string; types: DeliveryEventType[] }[] = [
  { label: 'Bestellungen', types: ['order_received', 'order_dispatched', 'order_bundled', 'order_held', 'order_geocoded', 'order_scheduled', 'order_released_for_dispatch'] },
  { label: 'Touren', types: ['batch_created', 'batch_assigned', 'batch_optimized', 'batch_picked_up', 'batch_completed', 'batch_cancelled', 'stop_delivered', 'tour_stop_inserted', 'tour_stop_removed', 'tour_reoptimized'] },
  { label: 'Fahrer', types: ['driver_online', 'driver_offline'] },
  { label: 'ETA & Delay', types: ['eta_updated', 'delay_first_notice', 'delay_critical_notice', 'delay_compensation_created'] },
  { label: 'Küche', types: ['kitchen_ready', 'kitchen_cooking', 'zone_classified'] },
];

const EVENT_LABELS: Partial<Record<DeliveryEventType, string>> = {
  order_received: 'Bestellung eingegangen',
  order_dispatched: 'Dispatched',
  order_bundled: 'Gebündelt',
  order_held: 'Zurückgehalten',
  order_geocoded: 'Geocodiert',
  batch_created: 'Tour erstellt',
  batch_assigned: 'Tour zugewiesen',
  batch_optimized: 'Tour optimiert',
  batch_picked_up: 'Abgeholt',
  batch_completed: 'Tour abgeschlossen',
  batch_cancelled: 'Tour abgebrochen',
  stop_delivered: 'Geliefert',
  driver_online: 'Fahrer online',
  driver_offline: 'Fahrer offline',
  eta_updated: 'ETA aktualisiert',
  zone_classified: 'Zone klassifiziert',
  kitchen_ready: 'Küche fertig',
  kitchen_cooking: 'Küche kocht',
  delay_first_notice: 'Verspätungs-Nachricht',
  delay_critical_notice: 'Kritische Verspätung',
  delay_compensation_created: 'Gutschein erstellt',
  order_scheduled: 'Vorbestellung angelegt',
  order_released_for_dispatch: 'Für Dispatch freigegeben',
  tour_stop_inserted: 'Stop eingefügt',
  tour_stop_removed: 'Stop entfernt',
  tour_reoptimized: 'Tour neu optimiert',
};

function eventColor(type: DeliveryEventType) {
  if (type.startsWith('batch_cancelled') || type.startsWith('delay_')) return 'bg-red-100 text-red-700';
  if (type.startsWith('driver_')) return 'bg-blue-100 text-blue-700';
  if (type.startsWith('batch_') || type.startsWith('tour_') || type === 'stop_delivered') return 'bg-matcha-100 text-matcha-700';
  if (type.startsWith('kitchen_')) return 'bg-amber-100 text-amber-700';
  return 'bg-muted text-muted-foreground';
}

export function EventsClient({ locationId }: { locationId: string }) {
  const [filterType, setFilterType] = useState<DeliveryEventType | ''>('');
  const [data, setData] = useState<EventsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const url = `/api/delivery/admin/events?location_id=${locationId}&limit=100${filterType ? `&event_type=${filterType}` : ''}`;
    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.events) setData(d as EventsData); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId, filterType]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex items-start gap-2 flex-wrap">
        <button
          onClick={() => setFilterType('')}
          className={cn('rounded-lg border px-3 py-1.5 text-sm font-semibold transition shrink-0', !filterType ? 'bg-matcha-700 text-white border-matcha-700' : 'bg-card border-border text-muted-foreground hover:bg-muted')}
        >
          Alle
        </button>
        {EVENT_CATEGORIES.map(cat => (
          <div key={cat.label} className="flex items-center gap-1 flex-wrap">
            {cat.types.map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={cn('rounded-md border px-2 py-1 text-[11px] font-semibold transition', filterType === t ? 'bg-matcha-700 text-white border-matcha-700' : 'bg-card border-border text-muted-foreground hover:bg-muted')}
              >
                {EVENT_LABELS[t] ?? t}
              </button>
            ))}
          </div>
        ))}
        <button onClick={load} disabled={loading} className="ml-auto flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-sm bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50 shrink-0">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      {loading && <div className="flex items-center justify-center py-16 text-muted-foreground">Lade Ereignisse…</div>}

      {!loading && data && data.events.length === 0 && (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Keine Ereignisse.</div>
      )}

      {!loading && data && data.events.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <List className="h-4 w-4 text-matcha-700" />
            <span className="font-semibold text-sm">{data.total} Ereignisse</span>
          </div>
          <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
            {data.events.map(ev => (
              <div key={ev.id} className="px-4 py-2.5 flex items-start gap-3">
                <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-bold shrink-0 mt-0.5', eventColor(ev.event_type))}>
                  {EVENT_LABELS[ev.event_type] ?? ev.event_type}
                </span>
                <div className="flex-1 min-w-0 text-[11px] text-muted-foreground">
                  {ev.order_id && <span className="mr-2">Bestellung: {ev.order_id.slice(0, 8)}</span>}
                  {ev.batch_id && <span className="mr-2">Tour: {ev.batch_id.slice(0, 8)}</span>}
                  {ev.driver_id && <span>Fahrer: {ev.driver_id.slice(0, 8)}</span>}
                </div>
                <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                  {new Date(ev.occurred_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
