'use client';

/**
 * Phase 2450 — Smart-Timing Countdown Pro
 * Farbkodierter Sekunden-Countdown je Bestellung (grün/gelb/rot/grau).
 * On-Time-Quote + Warnung + Batch-Fortschrittsbalken. 20-Sek-Update.
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Clock, Flame, CheckCircle2, AlertTriangle, ChefHat } from 'lucide-react';

interface OrderTiming {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  fertig_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  items_count: number;
}

function getColor(secLeft: number | null, isLate: boolean) {
  if (isLate) return { bg: 'bg-red-50 border-red-200', ring: 'text-red-600', badge: 'bg-red-500', label: 'SPÄT' };
  if (secLeft === null) return { bg: 'bg-stone-50 border-stone-200', ring: 'text-stone-400', badge: 'bg-stone-400', label: '—' };
  if (secLeft > 300) return { bg: 'bg-emerald-50 border-emerald-200', ring: 'text-emerald-600', badge: 'bg-emerald-500', label: 'OK' };
  if (secLeft > 90) return { bg: 'bg-amber-50 border-amber-200', ring: 'text-amber-600', badge: 'bg-amber-500', label: 'BALD' };
  return { bg: 'bg-red-50 border-red-200', ring: 'text-red-600', badge: 'bg-red-500', label: 'JETZT' };
}

function formatSec(sec: number) {
  const m = Math.floor(Math.abs(sec) / 60);
  const s = Math.abs(sec) % 60;
  const sign = sec < 0 ? '-' : '';
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

function CountdownTile({ order, now }: { order: OrderTiming; now: number }) {
  const targetSec = order.bestellt_am && order.geschaetzte_zubereitung_min
    ? Math.round((new Date(order.bestellt_am).getTime() + order.geschaetzte_zubereitung_min * 60_000 - now) / 1000)
    : null;
  const isLate = targetSec !== null && targetSec < 0;
  const color = getColor(targetSec, isLate);
  const progressPct = order.bestellt_am && order.geschaetzte_zubereitung_min
    ? Math.min(100, Math.max(0, ((now - new Date(order.bestellt_am).getTime()) / (order.geschaetzte_zubereitung_min * 60_000)) * 100))
    : 0;

  return (
    <div className={cn('rounded-xl border p-3 flex flex-col gap-1.5', color.bg)}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-stone-500 truncate">#{order.bestellnummer}</span>
        <span className={cn('text-[9px] font-black px-1.5 py-0.5 rounded-full text-white', color.badge)}>
          {color.label}
        </span>
      </div>
      <div className={cn('font-mono text-2xl font-black tabular-nums text-center', color.ring)}>
        {targetSec !== null ? formatSec(targetSec) : '—'}
      </div>
      <div className="h-1 rounded-full bg-black/10 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', isLate ? 'bg-red-400' : progressPct > 80 ? 'bg-amber-400' : 'bg-emerald-400')}
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <div className="text-[9px] text-stone-400 text-center tabular-nums">
        {order.items_count} Pos. · {order.geschaetzte_zubereitung_min ?? '?'} Min geplant
      </div>
    </div>
  );
}

export function KitchenPhase2450SmartTimingCountdownPro({ locationId }: { locationId?: string }) {
  const [orders, setOrders] = useState<OrderTiming[]>([]);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = createClient();
    const load = async () => {
      let q = sb
        .from('bestellungen')
        .select('id, bestellnummer, status, bestellt_am, fertig_am, geschaetzte_zubereitung_min, items:bestellungs_positionen(count)')
        .in('status', ['neu', 'angenommen', 'in_zubereitung'])
        .order('bestellt_am', { ascending: true })
        .limit(12);
      if (locationId) q = q.eq('location_id', locationId);
      const { data } = await q;
      if (data) {
        setOrders(data.map((o: any) => ({
          ...o,
          items_count: o.items?.[0]?.count ?? 0,
        })));
      }
      setLoading(false);
    };
    load();
    const iv = setInterval(load, 20_000);
    const tick = setInterval(() => setNow(Date.now()), 1_000);
    return () => { clearInterval(iv); clearInterval(tick); };
  }, [locationId]);

  const late = orders.filter(o => {
    if (!o.bestellt_am || !o.geschaetzte_zubereitung_min) return false;
    return new Date(o.bestellt_am).getTime() + o.geschaetzte_zubereitung_min * 60_000 < now;
  });
  const onTimePct = orders.length > 0 ? Math.round(((orders.length - late.length) / orders.length) * 100) : 100;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-card">
        <div className="flex items-center gap-2">
          <ChefHat className="h-4 w-4 text-matcha-600" />
          <span className="text-xs font-bold uppercase tracking-wider">Smart-Timing Countdown</span>
        </div>
        <div className="flex items-center gap-3">
          {late.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
              <AlertTriangle className="h-3 w-3" />
              {late.length} spät
            </span>
          )}
          <span className={cn(
            'text-[10px] font-black px-2 py-0.5 rounded-full',
            onTimePct >= 90 ? 'bg-emerald-100 text-emerald-700' : onTimePct >= 75 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
          )}>
            {onTimePct}% on-time
          </span>
          <span className="text-[10px] text-muted-foreground">{orders.length} aktiv</span>
        </div>
      </div>

      {/* Grid */}
      <div className="p-3">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
            <Clock className="h-4 w-4 animate-pulse" /> Lade…
          </div>
        ) : orders.length === 0 ? (
          <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-matcha-500" /> Keine aktiven Bestellungen
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {orders.map(o => <CountdownTile key={o.id} order={o} now={now} />)}
          </div>
        )}

        {/* Summary Bar */}
        {orders.length > 0 && (
          <div className="mt-3 flex gap-3 justify-center flex-wrap text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" /> OK (&gt;5 Min)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400" /> Bald (&lt;5 Min)
            </span>
            <span className="flex items-center gap-1">
              <Flame className="h-2.5 w-2.5 text-red-500" /> Spät / Jetzt fällig
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
