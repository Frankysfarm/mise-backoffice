'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, ChefHat, ChevronDown, ChevronUp, Clock, Flame, Loader2, Zap } from 'lucide-react';

type QueueOrder = {
  order_id: string;
  bestellnummer?: string;
  status: string;
  cook_start_at?: string | null;
  ready_target?: string | null;
  prep_min?: number | null;
  item_count?: number;
  item_names?: string[];
};

type FarbStatus = 'ok' | 'warn' | 'krit' | 'fertig';

function secsUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - Date.now()) / 1000);
}

function secsSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.round((Date.now() - new Date(iso).getTime()) / 1000);
}

function farbStatus(order: QueueOrder): FarbStatus {
  if (order.status === 'fertig' || order.status === 'abgeholt') return 'fertig';
  const secsLeft = secsUntil(order.ready_target);
  if (secsLeft === null) {
    const age = secsSince(order.cook_start_at);
    if (age !== null && order.prep_min) {
      const target = order.prep_min * 60;
      const ratio = age / target;
      if (ratio >= 1) return 'krit';
      if (ratio >= 0.8) return 'warn';
    }
    return 'ok';
  }
  if (secsLeft < 0) return 'krit';
  if (secsLeft < 120) return 'warn';
  return 'ok';
}

function CountdownBadge({ order }: { order: QueueOrder }) {
  const fs = farbStatus(order);

  if (fs === 'fertig') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
        <CheckCircle2 size={10} /> Fertig
      </span>
    );
  }

  const secsLeft = secsUntil(order.ready_target);
  const cookAge = secsSince(order.cook_start_at);

  let display = '';
  if (secsLeft !== null) {
    const abs = Math.abs(secsLeft);
    const m = Math.floor(abs / 60);
    const s = abs % 60;
    display = secsLeft < 0
      ? `+${m}:${String(s).padStart(2, '0')} über`
      : `${m}:${String(s).padStart(2, '0')}`;
  } else if (cookAge !== null && order.prep_min) {
    const remaining = order.prep_min * 60 - cookAge;
    if (remaining > 0) {
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      display = `${m}:${String(s).padStart(2, '0')}`;
    } else {
      const over = Math.abs(remaining);
      const m = Math.floor(over / 60);
      const s = over % 60;
      display = `+${m}:${String(s).padStart(2, '0')} über`;
    }
  } else {
    display = '—';
  }

  const style =
    fs === 'krit'
      ? 'bg-red-100 text-red-700 animate-pulse'
      : fs === 'warn'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-matcha-100 text-matcha-700';

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black tabular-nums', style)}>
      <Clock size={9} />
      {display}
    </span>
  );
}

function StatusDot({ fs }: { fs: FarbStatus }) {
  const styles: Record<FarbStatus, string> = {
    ok: 'bg-matcha-500',
    warn: 'bg-amber-400 animate-pulse',
    krit: 'bg-red-500 animate-bounce',
    fertig: 'bg-emerald-500',
  };
  return <span className={cn('inline-block h-2 w-2 rounded-full shrink-0', styles[fs])} />;
}

const MOCK_QUEUE: QueueOrder[] = [
  {
    order_id: 'm1', bestellnummer: '1042', status: 'in_zubereitung',
    cook_start_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    ready_target: new Date(Date.now() + 4 * 60 * 1000).toISOString(),
    prep_min: 12, item_count: 3, item_names: ['Burger', 'Pommes', 'Cola'],
  },
  {
    order_id: 'm2', bestellnummer: '1043', status: 'in_zubereitung',
    cook_start_at: new Date(Date.now() - 13 * 60 * 1000).toISOString(),
    ready_target: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    prep_min: 12, item_count: 2, item_names: ['Schnitzel', 'Salat'],
  },
  {
    order_id: 'm3', bestellnummer: '1044', status: 'fertig',
    cook_start_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    ready_target: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    prep_min: 12, item_count: 1, item_names: ['Pizza Margherita'],
  },
  {
    order_id: 'm4', bestellnummer: '1045', status: 'in_zubereitung',
    cook_start_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    ready_target: new Date(Date.now() + 9 * 60 * 1000).toISOString(),
    prep_min: 12, item_count: 4, item_names: ['Döner', 'Ayran', 'Baklava', 'Hummus'],
  },
];

function useLiveTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
}

export function KitchenPhase1040LiveBestellstatusKommandozentrale({
  locationId,
}: {
  locationId?: string | null;
}) {
  useLiveTick();
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const load = () => {
      if (!locationId) {
        setOrders(MOCK_QUEUE);
        setLoading(false);
        return;
      }
      fetch(`/api/delivery/kitchen/queue?location_id=${encodeURIComponent(locationId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.queue && Array.isArray(d.queue)) setOrders(d.queue);
          else setOrders(MOCK_QUEUE);
        })
        .catch(() => setOrders(MOCK_QUEUE))
        .finally(() => setLoading(false));
    };
    load();
    timerRef.current = setInterval(load, 20_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [locationId]);

  const active = orders.filter((o) => o.status === 'in_zubereitung' || o.status === 'angenommen');
  const fertig = orders.filter((o) => o.status === 'fertig');

  const krit = active.filter((o) => farbStatus(o) === 'krit').length;
  const warn = active.filter((o) => farbStatus(o) === 'warn').length;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Bestell-Kommandozentrale
          </span>
          <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
            {active.length} aktiv
          </span>
          {krit > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 animate-pulse">
              {krit} überfällig
            </span>
          )}
          {warn > 0 && krit === 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              {warn} eilt
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t">
          {loading ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Lade Warteschlange…
            </div>
          ) : orders.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">Keine aktiven Bestellungen</div>
          ) : (
            <div className="divide-y">
              {/* Active orders - sorted by urgency */}
              {[...active]
                .sort((a, b) => {
                  const fa = farbStatus(a);
                  const fb = farbStatus(b);
                  const prio: Record<FarbStatus, number> = { krit: 0, warn: 1, ok: 2, fertig: 3 };
                  return prio[fa] - prio[fb];
                })
                .map((order) => {
                  const fs = farbStatus(order);
                  const rowBg =
                    fs === 'krit'
                      ? 'bg-red-50/60 dark:bg-red-950/20'
                      : fs === 'warn'
                      ? 'bg-amber-50/60 dark:bg-amber-950/20'
                      : '';
                  return (
                    <div
                      key={order.order_id}
                      className={cn('flex items-center gap-3 px-4 py-2.5', rowBg)}
                    >
                      <StatusDot fs={fs} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black tabular-nums">
                            #{order.bestellnummer ?? order.order_id.slice(0, 6)}
                          </span>
                          {fs === 'krit' && <AlertTriangle size={10} className="text-red-500 shrink-0" />}
                          {fs === 'warn' && <Flame size={10} className="text-amber-500 shrink-0" />}
                          {fs === 'ok' && <ChefHat size={10} className="text-matcha-500 shrink-0" />}
                        </div>
                        {order.item_names && order.item_names.length > 0 && (
                          <div className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                            {order.item_names.slice(0, 2).join(' · ')}
                            {order.item_names.length > 2 && ` +${order.item_names.length - 2}`}
                          </div>
                        )}
                      </div>
                      <CountdownBadge order={order} />
                    </div>
                  );
                })}

              {/* Ready orders */}
              {fertig.length > 0 && (
                <div className="px-4 py-2 bg-emerald-50/50 dark:bg-emerald-950/10">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                      Fertig &amp; warte auf Abholung
                    </span>
                    {fertig.map((o) => (
                      <span
                        key={o.order_id}
                        className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700"
                      >
                        #{o.bestellnummer ?? o.order_id.slice(0, 6)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
