'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  Activity, CheckCircle2, Clock, Package, TrendingUp,
  AlertTriangle, Zap, Wifi,
} from 'lucide-react';

type PulsEvent = {
  id: string;
  bestellnummer: string;
  kundeName: string;
  status: string;
  ts: Date;
  betrag: number;
  zone: string | null;
};

type LiveStats = {
  activeOrders: number;
  deliveredToday: number;
  avgDeliveryMin: number;
  onTimePct: number;
  pendingOrders: number;
};

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  geliefert:      { bg: 'bg-matcha-50',  text: 'text-matcha-800',  dot: 'bg-matcha-500', label: '✓ Geliefert' },
  unterwegs:      { bg: 'bg-blue-50',    text: 'text-blue-800',    dot: 'bg-blue-500 animate-pulse', label: '→ Unterwegs' },
  fertig:         { bg: 'bg-amber-50',   text: 'text-amber-800',   dot: 'bg-amber-400', label: '📦 Fertig' },
  in_zubereitung: { bg: 'bg-orange-50',  text: 'text-orange-800',  dot: 'bg-orange-400', label: '👨‍🍳 Kochen' },
  bestätigt:      { bg: 'bg-indigo-50',  text: 'text-indigo-800',  dot: 'bg-indigo-400', label: '✓ Bestätigt' },
  storniert:      { bg: 'bg-red-50',     text: 'text-red-800',     dot: 'bg-red-400', label: '✗ Storniert' },
  default:        { bg: 'bg-muted/30',   text: 'text-foreground',  dot: 'bg-muted-foreground', label: '·' },
};

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function fmtRelative(d: Date): string {
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return 'Jetzt';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `vor ${diffMin} Min`;
  return fmtTime(d);
}

export function SchichtPulsLive({ locationId }: { locationId: string | null }) {
  const [events, setEvents] = useState<PulsEvent[]>([]);
  const [stats, setStats] = useState<LiveStats>({
    activeOrders: 0, deliveredToday: 0, avgDeliveryMin: 0, onTimePct: 0, pendingOrders: 0,
  });
  const [, setTick] = useState(0);
  const [pulse, setPulse] = useState(false);

  const loadStats = useCallback(async () => {
    if (!locationId) return;
    try {
      const supabase = createClient();
      const today = new Date(); today.setHours(0, 0, 0, 0);

      const [{ count: active }, { count: delivered }, { count: pending }] = await Promise.all([
        supabase
          .from('customer_orders')
          .select('id', { count: 'exact', head: true })
          .in('status', ['bestätigt', 'in_zubereitung', 'fertig', 'unterwegs'])
          .eq('location_id', locationId),
        supabase
          .from('customer_orders')
          .select('id', { count: 'exact', head: true })
          .in('status', ['geliefert', 'abgeholt', 'abgeschlossen'])
          .gte('bestellt_am', today.toISOString())
          .eq('location_id', locationId),
        supabase
          .from('customer_orders')
          .select('id', { count: 'exact', head: true })
          .in('status', ['fertig'])
          .eq('location_id', locationId),
      ]);

      setStats((prev) => ({
        ...prev,
        activeOrders: active ?? 0,
        deliveredToday: delivered ?? 0,
        pendingOrders: pending ?? 0,
      }));
    } catch {}
  }, [locationId]);

  const loadEvents = useCallback(async () => {
    if (!locationId) return;
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('customer_orders')
        .select('id, bestellnummer, kunde_name, status, bestellt_am, fertig_am, gesamtbetrag, delivery_zone')
        .eq('location_id', locationId)
        .order('fertig_am', { ascending: false, nullsFirst: false })
        .limit(8);

      if (data) {
        const mapped: PulsEvent[] = (data as any[]).map((row) => ({
          id: row.id,
          bestellnummer: row.bestellnummer ?? '–',
          kundeName: row.kunde_name ?? '–',
          status: row.status ?? 'default',
          ts: new Date(row.fertig_am ?? row.bestellt_am ?? Date.now()),
          betrag: row.gesamtbetrag ?? 0,
          zone: row.delivery_zone ?? null,
        }));
        setEvents(mapped);
      }
    } catch {}
  }, [locationId]);

  useEffect(() => {
    loadStats();
    loadEvents();

    const iv = setInterval(() => {
      loadStats();
      loadEvents();
    }, 30_000);

    // Tick für relative Zeit
    const tickIv = setInterval(() => setTick((n) => n + 1), 15_000);

    const supabase = createClient();
    const ch = supabase
      .channel('schicht-puls-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders' }, () => {
        setPulse(true);
        setTimeout(() => setPulse(false), 2000);
        loadStats();
        loadEvents();
      })
      .subscribe();

    return () => {
      clearInterval(iv);
      clearInterval(tickIv);
      supabase.removeChannel(ch);
    };
  }, [loadStats, loadEvents]);

  const healthSignal = (() => {
    if (stats.onTimePct === 0 && stats.deliveredToday === 0) return 'neutral';
    if (stats.pendingOrders > 5) return 'warn';
    if (stats.onTimePct < 75) return 'warn';
    return 'ok';
  })();

  return (
    <div className="rounded-xl border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-card">
        <Activity className={cn('h-4 w-4 shrink-0 transition-colors', pulse ? 'text-matcha-500' : 'text-muted-foreground')} />
        <span className="font-display text-sm font-bold uppercase tracking-wider">
          Schicht-Puls
        </span>
        <span className={cn(
          'flex items-center gap-1 ml-1 rounded-full px-2 py-0.5 text-[9px] font-black transition-all',
          pulse ? 'bg-matcha-100 text-matcha-700' : 'bg-muted/30 text-muted-foreground',
        )}>
          <Wifi className="h-2.5 w-2.5" />
          Live
        </span>
        <div className="ml-auto flex items-center gap-1">
          <div className={cn(
            'h-2 w-2 rounded-full',
            healthSignal === 'ok' ? 'bg-matcha-500' :
            healthSignal === 'warn' ? 'bg-amber-400 animate-pulse' :
            'bg-muted-foreground/30',
          )} />
          <span className={cn(
            'text-[9px] font-bold',
            healthSignal === 'ok' ? 'text-matcha-700' :
            healthSignal === 'warn' ? 'text-amber-600' :
            'text-muted-foreground',
          )}>
            {healthSignal === 'ok' ? 'Schicht OK' : healthSignal === 'warn' ? 'Achtung' : 'Bereit'}
          </span>
        </div>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-3 divide-x border-b bg-muted/10">
        <div className="px-3 py-2.5 text-center">
          <div className="font-mono text-lg font-black tabular-nums text-foreground">
            {stats.activeOrders}
          </div>
          <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">
            Aktiv
          </div>
        </div>
        <div className="px-3 py-2.5 text-center">
          <div className="font-mono text-lg font-black tabular-nums text-matcha-700">
            {stats.deliveredToday}
          </div>
          <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">
            Geliefert
          </div>
        </div>
        <div className="px-3 py-2.5 text-center">
          <div className={cn(
            'font-mono text-lg font-black tabular-nums',
            stats.pendingOrders > 3 ? 'text-amber-600' : 'text-foreground',
          )}>
            {stats.pendingOrders}
          </div>
          <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">
            Warten
          </div>
        </div>
      </div>

      {/* Event Feed */}
      {events.length > 0 ? (
        <div className="divide-y max-h-[320px] overflow-y-auto">
          {events.map((ev) => {
            const s = STATUS_STYLE[ev.status] ?? STATUS_STYLE['default'];
            return (
              <div key={ev.id} className={cn('flex items-center gap-3 px-4 py-2.5', s.bg)}>
                <div className={cn('h-2 w-2 rounded-full shrink-0', s.dot)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black text-foreground">
                      #{ev.bestellnummer.slice(-4)}
                    </span>
                    <span className={cn('text-[9px] font-bold rounded-full px-1.5 py-0.5', s.bg, s.text, 'border border-current/20')}>
                      {s.label}
                    </span>
                    {ev.zone && (
                      <span className="text-[9px] text-muted-foreground font-bold">
                        Zone {ev.zone}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">{ev.kundeName}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[10px] font-bold text-foreground tabular-nums">
                    {ev.betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-[9px] text-muted-foreground tabular-nums">
                    {fmtRelative(ev.ts)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
          <Package className="h-6 w-6 opacity-30" />
          <span className="text-sm">Noch keine Bestellungen heute</span>
        </div>
      )}
    </div>
  );
}
