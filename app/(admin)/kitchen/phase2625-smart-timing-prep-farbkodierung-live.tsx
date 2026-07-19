'use client';

/**
 * Phase 2625 — Smart-Timing Prep-Farbkodierung Live (Küche)
 *
 * Echtzeit-Prep-Ampel: je aktiver Bestellung farbkodierter Countdown
 * (grün >3min, gelb 0–3min, rot überfällig), On-Time-Rate-Ring,
 * SLA-Balken und Batch-Alert.
 * 1-Sek-Tick lokal + 25-Sek-Polling.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, ChefHat, Clock, Timer } from 'lucide-react';

interface OrderRow {
  id: string;
  bestellnummer: string | null;
  kunde_name: string | null;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  ready_target: string | null;
}

type Ampel = 'gruen' | 'gelb' | 'rot' | 'fertig';

const MOCK: OrderRow[] = [
  { id: '1', bestellnummer: '#1041', kunde_name: 'Marie S.',   status: 'in_zubereitung', bestellt_am: new Date(Date.now() - 8 * 60000).toISOString(),  geschaetzte_zubereitung_min: 12, ready_target: new Date(Date.now() + 4 * 60000).toISOString() },
  { id: '2', bestellnummer: '#1042', kunde_name: 'Thomas K.',  status: 'bestätigt',      bestellt_am: new Date(Date.now() - 2 * 60000).toISOString(),  geschaetzte_zubereitung_min: 10, ready_target: new Date(Date.now() + 8 * 60000).toISOString() },
  { id: '3', bestellnummer: '#1043', kunde_name: 'Leila B.',   status: 'in_zubereitung', bestellt_am: new Date(Date.now() - 14 * 60000).toISOString(), geschaetzte_zubereitung_min: 12, ready_target: new Date(Date.now() - 2 * 60000).toISOString() },
  { id: '4', bestellnummer: '#1044', kunde_name: 'Jan M.',     status: 'in_zubereitung', bestellt_am: new Date(Date.now() - 5 * 60000).toISOString(),  geschaetzte_zubereitung_min: 8,  ready_target: new Date(Date.now() + 1.5 * 60000).toISOString() },
  { id: '5', bestellnummer: '#1045', kunde_name: 'Ana P.',     status: 'fertig',         bestellt_am: new Date(Date.now() - 18 * 60000).toISOString(), geschaetzte_zubereitung_min: 14, ready_target: new Date(Date.now() - 4 * 60000).toISOString() },
];

function ampel(secsLeft: number | null, status: string): Ampel {
  if (['fertig', 'unterwegs', 'geliefert'].includes(status)) return 'fertig';
  if (secsLeft === null) return 'gruen';
  if (secsLeft > 180) return 'gruen';
  if (secsLeft >= 0) return 'gelb';
  return 'rot';
}

const STYLE: Record<Ampel, { card: string; badge: string; label: string }> = {
  gruen:  { card: 'bg-matcha-50 dark:bg-matcha-950/30 border-matcha-200 dark:border-matcha-800', badge: 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300', label: 'Im Plan' },
  gelb:   { card: 'bg-amber-50  dark:bg-amber-950/30  border-amber-200  dark:border-amber-800',  badge: 'bg-amber-100  text-amber-700  dark:bg-amber-900/40  dark:text-amber-300',  label: 'Dringend' },
  rot:    { card: 'bg-red-50    dark:bg-red-950/30    border-red-200    dark:border-red-800',    badge: 'bg-red-100    text-red-700    dark:bg-red-900/40    dark:text-red-300',    label: 'Überfällig' },
  fertig: { card: 'bg-stone-50  dark:bg-stone-900/20  border-stone-200  dark:border-stone-700',  badge: 'bg-stone-100  text-stone-500  dark:bg-stone-800/40  dark:text-stone-400',  label: 'Fertig' },
};

function fmtCountdown(secs: number | null, a: Ampel): string {
  if (a === 'fertig') return '✓';
  if (secs === null) return '—';
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${secs < 0 ? '-' : ''}${m}:${String(s).padStart(2, '0')}`;
}

function OnTimeRing({ onTime, total, size = 52 }: { onTime: number; total: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? onTime / total : 0;
  const color = pct >= 0.9 ? '#6a9e5f' : pct >= 0.7 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={6} className="text-border" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={6} strokeLinecap="round"
          strokeDasharray={`${circ * pct} ${circ}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-black leading-none" style={{ color }}>
          {total > 0 ? Math.round(pct * 100) : '—'}%
        </span>
      </div>
    </div>
  );
}

interface Props {
  locationId?: string | null;
}

export function KitchenPhase2625SmartTimingPrepFarbkodierungLive({ locationId }: Props) {
  const supabase = createClient();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const load = useCallback(async () => {
    const q = supabase
      .from('customer_orders')
      .select('id, bestellnummer, kunde_name, status, bestellt_am, geschaetzte_zubereitung_min, ready_target')
      .in('status', ['neu', 'bestätigt', 'in_zubereitung', 'fertig']);
    if (locationId) q.eq('location_id', locationId);
    const { data } = await q.order('bestellt_am', { ascending: true }).limit(12);
    if (data && data.length > 0) setOrders(data as OrderRow[]);
    else setOrders(MOCK);
    setLoading(false);
  }, [locationId]); // eslint-disable-line

  useEffect(() => { load(); pollRef.current = setInterval(load, 25_000); return () => clearInterval(pollRef.current); }, [load]);
  useEffect(() => { const t = setInterval(() => setTick(n => n + 1), 1000); return () => clearInterval(t); }, []);

  const active = orders.filter(o => !['geliefert', 'storniert'].includes(o.status));
  const fertigAnz = orders.filter(o => o.status === 'fertig').length;
  const onTimeAnz = active.filter(o => {
    const s = o.ready_target ? Math.round((new Date(o.ready_target).getTime() - Date.now()) / 1000) : null;
    return s === null || s >= 0;
  }).length + fertigAnz;
  const rotAnz = active.filter(o => {
    const s = o.ready_target ? Math.round((new Date(o.ready_target).getTime() - Date.now()) / 1000) : null;
    return s !== null && s < 0 && o.status !== 'fertig';
  }).length;

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-center h-28">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-primary shrink-0" />
          <h3 className="text-sm font-semibold text-foreground">Prep-Timing Live</h3>
        </div>
        <div className="flex items-center gap-2">
          {rotAnz > 0 && (
            <span className="flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {rotAnz} überfällig
            </span>
          )}
          <OnTimeRing onTime={onTimeAnz} total={orders.length} />
        </div>
      </div>

      {/* SLA-Balken */}
      {orders.length > 0 && (
        <div>
          <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
            <span>On-Time-Rate</span>
            <span className="font-semibold">{orders.length > 0 ? Math.round((onTimeAnz / orders.length) * 100) : 0}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700',
                onTimeAnz / orders.length >= 0.9 ? 'bg-matcha-500' :
                onTimeAnz / orders.length >= 0.7 ? 'bg-amber-400' : 'bg-red-500'
              )}
              style={{ width: `${orders.length > 0 ? Math.round((onTimeAnz / orders.length) * 100) : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Order-Kacheln */}
      <div className="space-y-1.5">
        {active.slice(0, 6).map(o => {
          const secsLeft = o.ready_target ? Math.round((new Date(o.ready_target).getTime() - Date.now()) / 1000) : null;
          const a = ampel(secsLeft, o.status);
          const st = STYLE[a];
          const countdown = fmtCountdown(secsLeft, a);
          const totalSec = o.geschaetzte_zubereitung_min ? o.geschaetzte_zubereitung_min * 60 : null;
          const elapsedSec = o.bestellt_am ? Math.round((Date.now() - new Date(o.bestellt_am).getTime()) / 1000) : 0;
          const pct = totalSec ? Math.min(100, Math.round((elapsedSec / totalSec) * 100)) : 0;

          return (
            <div key={o.id} className={cn('rounded-lg border px-3 py-2 flex items-center gap-3', st.card)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-foreground truncate">{o.bestellnummer ?? o.id.slice(0, 6)}</span>
                  {o.kunde_name && <span className="text-[11px] text-muted-foreground truncate">{o.kunde_name}</span>}
                </div>
                <div className="mt-1 h-1 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-current transition-all duration-500"
                    style={{ width: `${pct}%`, color: a === 'gruen' ? '#6a9e5f' : a === 'gelb' ? '#f59e0b' : '#ef4444' }}
                  />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className={cn('text-sm font-black tabular-nums', a === 'rot' && 'animate-pulse')}>{countdown}</div>
                <div className={cn('text-[10px] rounded px-1', st.badge)}>{st.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {active.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-matcha-500" />
          Keine aktiven Bestellungen
        </div>
      )}

      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Clock className="h-3 w-3" />
        Echtzeit · 25-Sek-Update
      </div>
    </div>
  );
}
