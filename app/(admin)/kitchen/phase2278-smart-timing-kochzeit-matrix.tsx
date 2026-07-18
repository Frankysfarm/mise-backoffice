'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { ChefHat, Clock, Timer, TrendingUp, Zap, AlertTriangle } from 'lucide-react';

/* ── Typen ─────────────────────────────────────────────────────────────── */
type FarbZone = 'gruen' | 'gelb' | 'rot' | 'grau';

interface MatrixRow {
  id: string;
  nummer: string;
  items: string;
  zone: string | null;
  kochStartAt: Date | null;
  readyTarget: Date | null;
  prepMin: number;
  elapsedSec: number;
  restSec: number | null;
  farbZone: FarbZone;
  pct: number;
  status: string;
}

/* ── Farb-Konfiguration ─────────────────────────────────────────────────── */
const FARBEN: Record<FarbZone, { bg: string; border: string; badge: string; label: string; icon: string }> = {
  gruen: { bg: 'bg-green-50 dark:bg-green-950/30', border: 'border-green-200 dark:border-green-800', badge: 'bg-green-500', label: 'Im Plan', icon: '🟢' },
  gelb:  { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', badge: 'bg-amber-400', label: 'Knapp',   icon: '🟡' },
  rot:   { bg: 'bg-red-50 dark:bg-red-950/30',     border: 'border-red-200 dark:border-red-800',     badge: 'bg-red-500',   label: 'Über Zeit',icon: '🔴' },
  grau:  { bg: 'bg-muted/20',                      border: 'border-border',                          badge: 'bg-muted-foreground', label: 'Wartend',icon: '⚪' },
};

/* ── Hilfsfunktionen ────────────────────────────────────────────────────── */
function fmtSec(sec: number | null): string {
  if (sec === null) return '--';
  if (sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function calcFarbe(elapsedSec: number, prepMin: number, status: string): FarbZone {
  if (!['in_bearbeitung', 'in_zubereitung'].includes(status)) return 'grau';
  const totalSec = prepMin * 60;
  const pct = elapsedSec / Math.max(totalSec, 1);
  if (pct < 0.7) return 'gruen';
  if (pct < 1.0) return 'gelb';
  return 'rot';
}

/* ── Countdown-Balken ───────────────────────────────────────────────────── */
function CountdownBar({ pct, farbZone }: { pct: number; farbZone: FarbZone }) {
  const width = Math.max(0, Math.min(100, pct));
  const color = farbZone === 'gruen' ? 'bg-green-500' : farbZone === 'gelb' ? 'bg-amber-400' : farbZone === 'rot' ? 'bg-red-500' : 'bg-muted-foreground';
  return (
    <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-1000', color)}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

/* ── Zusammenfassung-Chips ──────────────────────────────────────────────── */
function SummaryChips({ rows }: { rows: MatrixRow[] }) {
  const counts = { gruen: 0, gelb: 0, rot: 0, grau: 0 };
  rows.forEach(r => counts[r.farbZone]++);
  return (
    <div className="flex gap-2 flex-wrap">
      {(Object.entries(counts) as [FarbZone, number][]).map(([zone, n]) => (
        n > 0 && (
          <span key={zone} className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white', FARBEN[zone].badge)}>
            {FARBEN[zone].icon} {n} {FARBEN[zone].label}
          </span>
        )
      ))}
    </div>
  );
}

/* ── Haupt-Komponente ───────────────────────────────────────────────────── */
export function KitchenPhase2278SmartTimingKochzeitMatrix({ locationId }: { locationId?: string | null }) {
  const [rows, setRows] = useState<MatrixRow[]>([]);
  const [tick, setTick] = useState(0);
  const supaRef = useRef(createClient());

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!locationId) return;
    const supa = supaRef.current;

    async function load() {
      const { data } = await supa
        .from('customer_orders')
        .select('id,bestellnummer,status,bestellt_am,fertig_am,geschaetzte_zubereitung_min,delivery_zone,items:order_items(name,menge)')
        .eq('location_id', locationId)
        .in('status', ['in_bearbeitung', 'in_zubereitung', 'eingegangen'])
        .order('bestellt_am', { ascending: true })
        .limit(20);

      if (!data) return;

      const now = Date.now();
      setRows(
        data.map((o: Record<string, unknown>) => {
          const prepMin = (o.geschaetzte_zubereitung_min as number | null) ?? 15;
          const bestelltAt = o.bestellt_am ? new Date(o.bestellt_am as string) : null;
          const kochStartAt = bestelltAt;
          const readyTarget = kochStartAt ? new Date(kochStartAt.getTime() + prepMin * 60_000) : null;
          const elapsedSec = kochStartAt ? Math.floor((now - kochStartAt.getTime()) / 1000) : 0;
          const restSec = readyTarget ? Math.max(0, Math.floor((readyTarget.getTime() - now) / 1000)) : null;
          const totalSec = prepMin * 60;
          const pct = totalSec > 0 ? Math.min(100, (elapsedSec / totalSec) * 100) : 0;
          const status = o.status as string;
          const farbZone = calcFarbe(elapsedSec, prepMin, status);
          const items = Array.isArray(o.items)
            ? (o.items as Array<{ name: string; menge: number }>).map(i => `${i.menge}× ${i.name}`).join(', ')
            : '';
          return {
            id: o.id as string,
            nummer: o.bestellnummer as string,
            items,
            zone: o.delivery_zone as string | null,
            kochStartAt,
            readyTarget,
            prepMin,
            elapsedSec,
            restSec,
            farbZone,
            pct,
            status,
          };
        }),
      );
    }

    load();
    const sub = supa
      .channel(`phase2278-${locationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders', filter: `location_id=eq.${locationId}` }, load)
      .subscribe();
    return () => { supa.removeChannel(sub); };
  }, [locationId]);

  // Update elapsed/rest/farbe every second
  useEffect(() => {
    const now = Date.now();
    setRows(prev => prev.map(r => {
      const elapsedSec = r.kochStartAt ? Math.floor((now - r.kochStartAt.getTime()) / 1000) : r.elapsedSec;
      const restSec = r.readyTarget ? Math.max(0, Math.floor((r.readyTarget.getTime() - now) / 1000)) : r.restSec;
      const totalSec = r.prepMin * 60;
      const pct = totalSec > 0 ? Math.min(100, (elapsedSec / totalSec) * 100) : 0;
      const farbZone = calcFarbe(elapsedSec, r.prepMin, r.status);
      return { ...r, elapsedSec, restSec, pct, farbZone };
    }));
  }, [tick]);

  if (!locationId) return null;

  const active = rows.filter(r => r.farbZone !== 'grau');
  const overdue = rows.filter(r => r.farbZone === 'rot').length;

  return (
    <section className="rounded-2xl border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-matcha-100 dark:bg-matcha-900/40">
            <Timer className="h-4 w-4 text-matcha-600" />
          </span>
          <div>
            <p className="text-sm font-bold leading-tight">Smart Timing Matrix</p>
            <p className="text-[10px] text-muted-foreground">Kochzeit Farbkodierung — Live</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {overdue > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
              <AlertTriangle className="h-3 w-3" /> {overdue} Überfällig
            </span>
          )}
          <span className="text-[10px] text-muted-foreground tabular-nums">{active.length} aktiv</span>
        </div>
      </div>

      {rows.length > 0 && <SummaryChips rows={rows} />}

      {/* Matrix */}
      {rows.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          <ChefHat className="mx-auto mb-2 h-6 w-6 opacity-30" />
          Keine aktiven Bestellungen
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(r => {
            const f = FARBEN[r.farbZone];
            return (
              <div key={r.id} className={cn('rounded-xl border p-3 transition-colors', f.bg, f.border)}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold tabular-nums">#{r.nummer}</span>
                      {r.zone && <span className="rounded bg-muted/60 px-1 py-0.5 text-[9px] font-medium text-muted-foreground">{r.zone}</span>}
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{r.items || '—'}</p>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white', f.badge)}>{f.label}</span>
                    <div className="mt-1 flex items-center gap-1 text-[10px] font-bold tabular-nums">
                      <Clock className="h-3 w-3 opacity-60" />
                      {r.farbZone === 'grau'
                        ? `${r.prepMin} Min`
                        : r.farbZone === 'rot'
                          ? `+${fmtSec(-r.restSec!)} über`
                          : fmtSec(r.restSec)}
                    </div>
                  </div>
                </div>
                <CountdownBar pct={r.pct} farbZone={r.farbZone} />
                <div className="mt-1 flex items-center justify-between text-[9px] text-muted-foreground">
                  <span>{fmtSec(r.elapsedSec)} vergangen</span>
                  <span>{r.prepMin} Min Ziel</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
