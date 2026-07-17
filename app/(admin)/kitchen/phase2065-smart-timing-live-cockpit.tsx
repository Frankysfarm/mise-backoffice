'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { AlertTriangle, ChefHat, CheckCircle2, Clock, Timer, Zap } from 'lucide-react';

/* ── Typen ──────────────────────────────────────────────────────────────── */
interface OrderRow {
  id: string;
  nummer: string;
  kunde: string;
  items: string;
  statusStufe: number;       // 0=eingegangen,1=in_bearbeitung,2=fertig
  kochStartAt: Date | null;
  readyTarget: Date | null;
  prepMin: number;
  zone: string | null;
}

type FarbZone = 'gruen' | 'gelb' | 'rot' | 'grau';

interface TimingRow extends OrderRow {
  elapsedSec: number;
  restSec: number | null;
  farbZone: FarbZone;
  pct: number;        // 0..100
}

/* ── Farb-Mapping ───────────────────────────────────────────────────────── */
const FARBE: Record<FarbZone, { bg: string; ring: string; text: string; label: string }> = {
  gruen: { bg: 'bg-green-50',  ring: 'stroke-green-500',  text: 'text-green-700',  label: 'Im Plan'    },
  gelb:  { bg: 'bg-amber-50',  ring: 'stroke-amber-400',  text: 'text-amber-700',  label: 'Knapp'      },
  rot:   { bg: 'bg-red-50',    ring: 'stroke-red-500',    text: 'text-red-700',    label: 'Verspätet'  },
  grau:  { bg: 'bg-muted/30',  ring: 'stroke-muted-foreground', text: 'text-muted-foreground', label: 'Wartend' },
};

/* ── SVG-Countdown-Ring ─────────────────────────────────────────────────── */
function CountdownRing({ pct, farbZone, restSec }: { pct: number; farbZone: FarbZone; restSec: number | null }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(1, pct / 100)));

  const minStr = restSec === null ? '--' : restSec <= 0
    ? '0'
    : Math.ceil(restSec / 60).toString();

  return (
    <svg width={56} height={56} viewBox="0 0 56 56" className="shrink-0">
      {/* Track */}
      <circle cx={28} cy={28} r={r} fill="none" strokeWidth={4} className="stroke-muted/40" />
      {/* Progress */}
      <circle
        cx={28} cy={28} r={r} fill="none" strokeWidth={4}
        className={cn('transition-all duration-1000', FARBE[farbZone].ring)}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 28 28)"
      />
      {/* Label */}
      <text x={28} y={32} textAnchor="middle" fontSize={13} fontWeight={800} className={FARBE[farbZone].text}
        style={{ fontVariantNumeric: 'tabular-nums' }}>
        {minStr}
      </text>
    </svg>
  );
}

/* ── Haupt-Komponente ───────────────────────────────────────────────────── */
export function KitchenPhase2065SmartTimingLiveCockpit({
  locationId,
}: {
  locationId?: string | null;
}) {
  const [rows, setRows] = useState<TimingRow[]>([]);
  const [tick, setTick] = useState(0);
  const supaRef = useRef(createClient());

  /* Tick jede Sekunde */
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  /* Live-Daten laden */
  useEffect(() => {
    if (!locationId) return;
    const supa = supaRef.current;

    async function load() {
      const now = new Date();
      const cutoff = new Date(now.getTime() - 3 * 60 * 60 * 1000);

      const { data: orders } = await supa
        .from('orders')
        .select('id,order_number,customer_name,items,status,type,location_id')
        .eq('location_id', locationId)
        .in('status', ['eingegangen', 'in_bearbeitung', 'fertig'])
        .gte('created_at', cutoff.toISOString())
        .order('created_at', { ascending: true })
        .limit(30);

      if (!orders || orders.length === 0) return;

      const orderIds = orders.map((o: { id: string }) => o.id);
      const { data: timings } = await supa
        .from('kitchen_timings')
        .select('order_id,cook_start_at,ready_target,prep_min,status')
        .in('order_id', orderIds);

      const timingMap = new Map<string, { cook_start_at: string | null; ready_target: string | null; prep_min: number | null; status: string }>(
        (timings ?? []).map((t: { order_id: string; cook_start_at: string | null; ready_target: string | null; prep_min: number | null; status: string }) => [t.order_id, t]),
      );

      const mapped: TimingRow[] = orders
        .filter((o: { status: string }) => o.status !== 'fertig')
        .map((o: { id: string; order_number: string; customer_name: string; items: { name: string; menge?: number; qty?: number }[] | null; status: string; type: string }) => {
          const t = timingMap.get(o.id);
          const cookStart = t?.cook_start_at ? new Date(t.cook_start_at) : null;
          const target    = t?.ready_target  ? new Date(t.ready_target)  : null;
          const prepMin   = t?.prep_min ?? 20;
          const statusStufe = o.status === 'fertig' ? 2 : o.status === 'in_bearbeitung' ? 1 : 0;

          const elapsedSec = cookStart ? Math.floor((now.getTime() - cookStart.getTime()) / 1000) : 0;
          const restSec    = target ? Math.floor((target.getTime() - now.getTime()) / 1000) : null;
          const totalSec   = prepMin * 60;

          let pct = cookStart ? Math.min(100, Math.floor((elapsedSec / totalSec) * 100)) : 0;
          let farbZone: FarbZone = 'grau';

          if (cookStart) {
            if (restSec === null || restSec > totalSec * 0.3) farbZone = 'gruen';
            else if (restSec > 0)                             farbZone = 'gelb';
            else                                              farbZone = 'rot';
          }

          const items = Array.isArray(o.items)
            ? o.items.map((i: { name: string; menge?: number; qty?: number }) => `${i.menge ?? i.qty ?? 1}× ${i.name}`).join(', ')
            : '';

          return {
            id: o.id,
            nummer: o.order_number ?? o.id.slice(0, 6).toUpperCase(),
            kunde: o.customer_name ?? 'Gast',
            items,
            statusStufe,
            kochStartAt: cookStart,
            readyTarget: target,
            prepMin,
            zone: null,
            elapsedSec,
            restSec,
            farbZone,
            pct,
          };
        })
        .sort((a: TimingRow, b: TimingRow) => {
          const order: FarbZone[] = ['rot', 'gelb', 'gruen', 'grau'];
          return order.indexOf(a.farbZone) - order.indexOf(b.farbZone);
        });

      setRows(mapped);
    }

    load();
    const ch = supa
      .channel(`kitchen-timing-cockpit-${locationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `location_id=eq.${locationId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kitchen_timings' }, load)
      .subscribe();

    return () => { supa.removeChannel(ch); };
  }, [locationId]);

  /* Tick-Update: Elapsed / Rest neu berechnen ohne DB-Request */
  useEffect(() => {
    const now = new Date();
    setRows(prev => prev.map(r => {
      if (!r.kochStartAt) return r;
      const elapsedSec = Math.floor((now.getTime() - r.kochStartAt.getTime()) / 1000);
      const restSec    = r.readyTarget ? Math.floor((r.readyTarget.getTime() - now.getTime()) / 1000) : null;
      const totalSec   = r.prepMin * 60;
      const pct        = Math.min(100, Math.floor((elapsedSec / totalSec) * 100));
      let farbZone: FarbZone = 'grau';
      if (restSec === null || restSec > totalSec * 0.3) farbZone = 'gruen';
      else if (restSec > 0) farbZone = 'gelb';
      else farbZone = 'rot';
      return { ...r, elapsedSec, restSec, pct, farbZone };
    }).sort((a: TimingRow, b: TimingRow) => {
      const order: FarbZone[] = ['rot', 'gelb', 'gruen', 'grau'];
      return order.indexOf(a.farbZone) - order.indexOf(b.farbZone);
    }));
  }, [tick]);

  if (!locationId) return null;

  const counts = {
    rot:   rows.filter(r => r.farbZone === 'rot').length,
    gelb:  rows.filter(r => r.farbZone === 'gelb').length,
    gruen: rows.filter(r => r.farbZone === 'gruen').length,
    grau:  rows.filter(r => r.farbZone === 'grau').length,
  };

  return (
    <div className="rounded-2xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-matcha-50 border-b">
        <ChefHat className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider text-matcha-800">
          Smart Timing · Echtzeit-Farbkodierung
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {counts.rot  > 0 && <span className="rounded-full bg-red-500    text-white text-[10px] font-black px-2 py-0.5">{counts.rot} !</span>}
          {counts.gelb > 0 && <span className="rounded-full bg-amber-400  text-white text-[10px] font-black px-2 py-0.5">{counts.gelb} ~</span>}
          <span className="rounded-full bg-green-500 text-white text-[10px] font-black px-2 py-0.5">{counts.gruen} ✓</span>
          {rows.length === 0 && <span className="text-xs text-muted-foreground">Keine aktiven Bestellungen</span>}
        </div>
      </div>

      {/* Ampel-Zusammenfassung */}
      {rows.length > 0 && (
        <div className="grid grid-cols-3 divide-x text-center py-2 bg-white border-b">
          {[
            { zone: 'rot'  as FarbZone, icon: AlertTriangle, label: 'Verspätet' },
            { zone: 'gelb' as FarbZone, icon: Timer,         label: 'Knapp'     },
            { zone: 'gruen'as FarbZone, icon: CheckCircle2,  label: 'Im Plan'   },
          ].map(({ zone, icon: Icon, label }) => (
            <div key={zone} className={cn('py-1', counts[zone] > 0 ? FARBE[zone].text : 'text-muted-foreground/40')}>
              <Icon className="h-3.5 w-3.5 mx-auto mb-0.5" />
              <div className="text-lg font-black tabular-nums leading-none">{counts[zone]}</div>
              <div className="text-[9px] uppercase tracking-wide">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Bestellkarten */}
      <div className="divide-y max-h-[420px] overflow-y-auto">
        {rows.map(row => {
          const fb = FARBE[row.farbZone];
          const restMin = row.restSec === null ? null : row.restSec <= 0 ? 0 : Math.ceil(row.restSec / 60);
          return (
            <div key={row.id} className={cn('flex items-center gap-3 px-4 py-3', fb.bg)}>
              {/* Countdown-Ring */}
              <CountdownRing pct={row.pct} farbZone={row.farbZone} restSec={row.restSec} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black tabular-nums">#{row.nummer}</span>
                  <span className="text-xs text-muted-foreground truncate max-w-[120px]">{row.kunde}</span>
                  <span className={cn('text-[9px] rounded-full px-1.5 py-0.5 font-bold border', fb.text, 'bg-white/60 border-current/20')}>
                    {fb.label}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground truncate mt-0.5">{row.items}</div>
                {/* Progress bar */}
                <div className="mt-1.5 h-1 rounded-full bg-black/10 overflow-hidden w-full">
                  <div
                    className={cn('h-full rounded-full transition-all duration-1000',
                      row.farbZone === 'rot'   ? 'bg-red-400'    :
                      row.farbZone === 'gelb'  ? 'bg-amber-400'  :
                      row.farbZone === 'gruen' ? 'bg-green-500'  : 'bg-muted-foreground/30'
                    )}
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
              </div>

              {/* Restzeit */}
              <div className="shrink-0 text-right">
                {restMin !== null ? (
                  <>
                    <div className={cn('font-mono text-sm font-black tabular-nums', fb.text)}>
                      {restMin <= 0 ? '⚠' : `${restMin}m`}
                    </div>
                    <div className="text-[8px] text-muted-foreground">verbleibend</div>
                  </>
                ) : (
                  <>
                    <div className="font-mono text-sm font-black tabular-nums text-matcha-600">
                      {Math.floor(row.elapsedSec / 60)}m
                    </div>
                    <div className="text-[8px] text-muted-foreground">vergangen</div>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {rows.length === 0 && locationId && (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
            <Zap className="h-8 w-8 opacity-20" />
            <p className="text-sm">Keine aktiven Bestellungen</p>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="px-4 py-2 border-t bg-muted/20 flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Aktualisiert jede Sekunde · Rot = sofort handeln</span>
        </div>
      )}
    </div>
  );
}
