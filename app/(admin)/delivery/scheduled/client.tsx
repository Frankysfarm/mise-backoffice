'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';
import { Calendar, CheckCircle2, Clock, RefreshCw, Zap } from 'lucide-react';

interface ScheduledOrder {
  id: string;
  bestellnummer: string;
  kunde_name: string | null;
  kunde_adresse: string | null;
  scheduled_at: string;
  schedule_status: 'scheduled' | 'released' | 'immediate';
  order_status: string;
  gesamtbetrag: number | null;
  estimated_prep_min: number | null;
  mins_until_kitchen_start: number | null;
  ready_for_dispatch: boolean;
}

interface ScheduledData {
  summary: {
    total: number;
    next_hour: number;
    next_4h: number;
    overdue: number;
  } | null;
  orders: ScheduledOrder[];
  count: number;
}

function statusBadge(order: ScheduledOrder) {
  if (order.ready_for_dispatch) {
    return <span className="rounded-full bg-matcha-100 text-matcha-800 text-[11px] font-bold px-2 py-0.5 border border-matcha-300">Bereit</span>;
  }
  if (order.schedule_status === 'released') {
    return <span className="rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold px-2 py-0.5 border border-blue-200">Freigegeben</span>;
  }
  if (order.mins_until_kitchen_start !== null && order.mins_until_kitchen_start <= 15) {
    return <span className="rounded-full bg-amber-50 text-amber-700 text-[11px] font-bold px-2 py-0.5 border border-amber-200 animate-pulse">Bald</span>;
  }
  return <span className="rounded-full bg-muted text-muted-foreground text-[11px] font-bold px-2 py-0.5 border border-border">Geplant</span>;
}

export function ScheduledClient({ locationId }: { locationId: string }) {
  const [data, setData] = useState<ScheduledData | null>(null);
  const [loading, setLoading] = useState(true);
  const [releasing, setReleasing] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/delivery/admin/scheduled?location_id=${locationId}&hours=4`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d !== null) setData(d as ScheduledData); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  const releaseOrder = async (orderId: string) => {
    setReleasing(orderId);
    await fetch('/api/delivery/admin/scheduled', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'release', order_id: orderId, location_id: locationId }),
    });
    setReleasing(null);
    load();
  };

  const releaseAll = async () => {
    setReleasing('all');
    await fetch('/api/delivery/admin/scheduled', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'release_all', location_id: locationId }),
    });
    setReleasing(null);
    load();
  };

  return (
    <div className="space-y-6">
      {/* Header-Aktionen */}
      <div className="flex items-center gap-2">
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Aktualisieren
        </button>
        {data && data.count > 0 && (
          <button
            onClick={releaseAll}
            disabled={releasing === 'all'}
            className="flex items-center gap-1.5 rounded-lg border border-matcha-700 bg-matcha-700 text-white px-3 py-1.5 text-sm font-semibold hover:bg-matcha-800 transition disabled:opacity-50"
          >
            <Zap className="h-3.5 w-3.5" />
            Alle fälligen freigeben
          </button>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">nächste 4 Stunden</span>
      </div>

      {/* Summary KPIs */}
      {data?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Gesamt</div>
            <div className="font-display text-2xl font-black">{data.summary.total}</div>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Nächste Stunde</div>
            <div className="font-display text-2xl font-black">{data.summary.next_hour}</div>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">4h-Fenster</div>
            <div className="font-display text-2xl font-black">{data.summary.next_4h}</div>
          </div>
          <div className={cn('rounded-xl border px-4 py-3', data.summary.overdue > 0 ? 'bg-red-50 border-red-200' : 'bg-card')}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Überfällig</div>
            <div className={cn('font-display text-2xl font-black', data.summary.overdue > 0 ? 'text-red-700' : '')}>{data.summary.overdue}</div>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">Lade Vorbestellungen…</div>
      )}

      {!loading && data && data.orders.length === 0 && (
        <div className="flex items-center gap-2 justify-center py-16 text-muted-foreground text-sm">
          <CheckCircle2 className="h-4 w-4" />
          Keine Vorbestellungen in den nächsten 4 Stunden.
        </div>
      )}

      {!loading && data && data.orders.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <Calendar className="h-4 w-4 text-matcha-700" />
            <span className="font-semibold text-sm">{data.count} Vorbestellung{data.count !== 1 ? 'en' : ''}</span>
          </div>
          <div className="divide-y divide-border">
            {data.orders.map(order => (
              <div key={order.id} className="px-4 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold">#{order.bestellnummer}</span>
                    {statusBadge(order)}
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5 truncate">
                    {order.kunde_name ?? 'Unbekannt'}{order.kunde_adresse ? ` · ${order.kunde_adresse}` : ''}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="flex items-center gap-1 text-sm font-medium tabular-nums justify-end">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    {new Date(order.scheduled_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                  </div>
                  {order.gesamtbetrag !== null && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">{euro(order.gesamtbetrag)}</div>
                  )}
                </div>
                {order.schedule_status === 'scheduled' && !order.ready_for_dispatch && (
                  <button
                    onClick={() => releaseOrder(order.id)}
                    disabled={releasing === order.id}
                    className="shrink-0 rounded-lg border border-matcha-300 bg-matcha-50 text-matcha-800 px-2.5 py-1 text-xs font-bold hover:bg-matcha-100 transition disabled:opacity-50"
                  >
                    {releasing === order.id ? '…' : 'Freigeben'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
