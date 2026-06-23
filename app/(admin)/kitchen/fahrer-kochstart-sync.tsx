'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Bike, ChefHat, Clock, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface SyncRow {
  orderId: string;
  bestellnummer: string;
  kundeName: string;
  prepMin: number;
  driverName: string | null;
  driverEtaMin: number | null; // minutes until driver arrives at kitchen
  recommendedStartIn: number; // 0 = now, >0 = wait N min
  urgency: 'jetzt' | 'bald' | 'warten' | 'kein-fahrer';
}

function getUrgency(prepMin: number, driverEtaMin: number | null): SyncRow['urgency'] {
  if (driverEtaMin == null) return 'kein-fahrer';
  const delta = driverEtaMin - prepMin;
  if (delta <= 0) return 'jetzt';
  if (delta <= 5) return 'bald';
  return 'warten';
}

function getStartIn(prepMin: number, driverEtaMin: number | null): number {
  if (driverEtaMin == null) return 0;
  const wait = driverEtaMin - prepMin;
  return Math.max(0, wait);
}

const URGENCY_STYLE = {
  jetzt:       { bg: 'bg-red-50 border-red-200',    dot: 'bg-red-500',    text: 'Jetzt kochen!',  badge: 'bg-red-500 text-white' },
  bald:        { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400',  text: 'Bald starten',   badge: 'bg-amber-400 text-white' },
  warten:      { bg: 'bg-matcha-50 border-matcha-200', dot: 'bg-matcha-500', text: 'Warten',        badge: 'bg-matcha-100 text-matcha-800' },
  'kein-fahrer':{ bg: 'bg-muted/30 border-border',  dot: 'bg-gray-400',   text: 'Kein Fahrer',    badge: 'bg-muted text-muted-foreground' },
};

export function KitchenFahrerKochStartSync({
  locationId,
}: {
  locationId: string | null;
}) {
  const [rows, setRows] = useState<SyncRow[]>([]);
  const [open, setOpen] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  async function load() {
    if (!locationId) return;
    const sb = createClient();

    // Load active orders in_zubereitung + bestätigt
    const { data: orders } = await sb
      .from('customer_orders')
      .select('id, bestellnummer, kunde_name, geschaetzte_zubereitung_min, status')
      .eq('location_id', locationId)
      .in('status', ['bestätigt', 'neu'])
      .order('bestellt_am', { ascending: true })
      .limit(20);

    if (!orders?.length) { setRows([]); return; }

    // Load kitchen timings
    const orderIds = orders.map((o: { id: string }) => o.id);
    const { data: timings } = await sb
      .from('kitchen_order_timings')
      .select('order_id, prep_min')
      .in('order_id', orderIds);

    const prepMinMap = new Map<string, number>();
    if (timings) {
      for (const t of timings as { order_id: string; prep_min: number | null }[]) {
        if (t.prep_min != null) prepMinMap.set(t.order_id, t.prep_min);
      }
    }

    // Load active driver batches for ETA
    const { data: drivers } = await sb
      .from('driver_statuses')
      .select('employee_id, aktueller_batch_id, last_lat, last_lng, last_update')
      .eq('ist_online', true)
      .not('aktueller_batch_id', 'is', null);

    // Fetch ETA data from API
    let etaData: Record<string, { driverName: string; etaMin: number }> = {};
    try {
      const res = await fetch(`/api/delivery/admin/overview?location_id=${locationId}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        const pending = (json.pendingOrders ?? []) as {
          id: string; driverName?: string | null; etaMin?: number | null;
        }[];
        for (const p of pending) {
          if (p.id && p.etaMin != null) {
            etaData[p.id] = { driverName: p.driverName ?? null, etaMin: p.etaMin };
          }
        }
      }
    } catch {}

    const syncRows: SyncRow[] = orders.map((o: {
      id: string; bestellnummer: string | null; kunde_name: string; geschaetzte_zubereitung_min: number | null;
    }) => {
      const prepMin = prepMinMap.get(o.id) ?? o.geschaetzte_zubereitung_min ?? 15;
      const eta = etaData[o.id];
      const driverEtaMin = eta?.etaMin ?? null;
      return {
        orderId: o.id,
        bestellnummer: o.bestellnummer ?? '—',
        kundeName: o.kunde_name ?? 'Unbekannt',
        prepMin,
        driverName: eta?.driverName ?? null,
        driverEtaMin,
        recommendedStartIn: getStartIn(prepMin, driverEtaMin),
        urgency: getUrgency(prepMin, driverEtaMin),
      };
    });

    // Sort: jetzt → bald → warten → kein-fahrer
    const order: SyncRow['urgency'][] = ['jetzt', 'bald', 'warten', 'kein-fahrer'];
    syncRows.sort((a, b) => order.indexOf(a.urgency) - order.indexOf(b.urgency));

    setRows(syncRows);
    setLastUpdate(new Date());
  }

  useEffect(() => {
    void load();
    const iv = setInterval(() => void load(), 25_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (rows.length === 0) return null;

  const jetzt = rows.filter(r => r.urgency === 'jetzt').length;
  const bald = rows.filter(r => r.urgency === 'bald').length;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition"
      >
        <ChefHat className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Fahrer–Koch-Sync</span>
        {jetzt > 0 && (
          <span className="ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white">
            {jetzt}
          </span>
        )}
        {bald > 0 && (
          <span className="ml-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-400 px-1.5 text-[10px] font-black text-white">
            {bald}
          </span>
        )}
        {lastUpdate && (
          <span className="ml-auto text-[9px] text-muted-foreground tabular-nums">
            {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-1 shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-1 shrink-0" />}
      </button>

      {open && (
        <div className="divide-y">
          {rows.map(row => {
            const s = URGENCY_STYLE[row.urgency];
            return (
              <div key={row.orderId} className={cn('flex items-center gap-3 px-4 py-3', s.bg, 'border-l-4', s.bg.split(' ')[1])}>
                {/* Dot */}
                <div className={cn('h-2.5 w-2.5 shrink-0 rounded-full', s.dot)} />

                {/* Order info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold">#{row.bestellnummer}</span>
                    <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">{row.kundeName}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <ChefHat className="h-3 w-3" />
                      {row.prepMin} Min Prep
                    </span>
                    {row.driverName && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Bike className="h-3 w-3" />
                        {row.driverName}
                        {row.driverEtaMin != null && ` · ~${row.driverEtaMin} Min`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Urgency */}
                <div className="shrink-0 text-right">
                  <div className={cn('rounded-full px-2 py-0.5 text-[10px] font-black', s.badge)}>
                    {s.text}
                  </div>
                  {row.urgency === 'warten' && row.recommendedStartIn > 0 && (
                    <div className="mt-0.5 text-[9px] text-muted-foreground tabular-nums">
                      Start in {row.recommendedStartIn} Min
                    </div>
                  )}
                  {row.urgency === 'jetzt' && (
                    <div className="mt-0.5 flex items-center justify-end gap-0.5 text-[9px] text-red-600 font-bold">
                      <Zap className="h-2.5 w-2.5" />
                      Jetzt!
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
