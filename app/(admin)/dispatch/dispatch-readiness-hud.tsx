'use client';

/**
 * DispatchReadinessHUD — Kompakte Ampel-Übersicht für Dispatch-Entscheidungen
 *
 * Aggregiert: fertige Bestellungen + freie Fahrer + aktive Tours in einer
 * visuellen Traffic-Light-Anzeige. Ermöglicht sofortige Situations-Einschätzung.
 *
 * Status-Logik:
 * - 🟢 GUT: Fahrer frei ≥ fertige Bestellungen (oder nichts zu tun)
 * - 🟡 ACHTUNG: Fertige Bestellungen > freie Fahrer (Engpass, aber noch Fahrer verfügbar)
 * - 🔴 KRITISCH: Fertige Bestellungen vorhanden aber KEIN freier Fahrer
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Bike, CheckCircle2, Package, Route, Truck, Zap } from 'lucide-react';
import { euro } from '@/lib/utils';

type OrderItem = {
  id: string;
  status: string;
  typ: string;
  fertig_am: string | null;
  gesamtbetrag: number;
  delivery_zone: string | null;
};

type DriverItem = {
  employee_id: string;
  ist_online: boolean;
  aktueller_batch_id: string | null;
  employee: { vorname: string; nachname: string } | null;
};

type BatchItem = {
  id: string;
  status: string;
  fahrer_id: string | null;
  total_eta_min: number | null;
  startzeit?: string | null;
  stops: { geliefert_am: string | null }[];
};

interface Props {
  orders: OrderItem[];
  drivers: DriverItem[];
  batches: BatchItem[];
}

type HudStatus = 'idle' | 'ok' | 'warn' | 'critical';

function calcStatus(readyCount: number, freeCount: number, onlineCount: number): HudStatus {
  if (readyCount === 0 && onlineCount === 0) return 'idle';
  if (readyCount === 0) return 'ok';
  if (freeCount > 0) return readyCount <= freeCount ? 'ok' : 'warn';
  return 'critical';
}

function waitMin(fertigAm: string | null): number {
  if (!fertigAm) return 0;
  return Math.floor((Date.now() - new Date(fertigAm).getTime()) / 60_000);
}

const STATUS_CONFIG: Record<HudStatus, {
  dot: string; ring: string; bg: string; border: string; label: string; labelColor: string;
}> = {
  idle:     { dot: 'bg-slate-400',   ring: '',                  bg: 'bg-slate-50',   border: 'border-slate-200', label: 'Bereit',   labelColor: 'text-slate-600'  },
  ok:       { dot: 'bg-matcha-500',  ring: '',                  bg: 'bg-matcha-50',  border: 'border-matcha-200', label: 'Gut',     labelColor: 'text-matcha-700' },
  warn:     { dot: 'bg-amber-500',   ring: 'animate-pulse',     bg: 'bg-amber-50',   border: 'border-amber-300',  label: 'Engpass', labelColor: 'text-amber-800'  },
  critical: { dot: 'bg-red-500',     ring: 'animate-ping',      bg: 'bg-red-50',     border: 'border-red-300',    label: 'Kritisch', labelColor: 'text-red-800'   },
};

export function DispatchReadinessHUD({ orders, drivers, batches }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 20_000);
    return () => clearInterval(iv);
  }, []);

  const readyOrders = orders.filter((o) => o.status === 'fertig' && o.typ === 'lieferung');
  const onlineDrivers = drivers.filter((d) => d.ist_online);
  const freeDrivers = onlineDrivers.filter((d) => !d.aktueller_batch_id);
  const activeBatches = batches.filter((b) =>
    b.status === 'unterwegs' || b.status === 'on_route' || b.status === 'assigned' || b.status === 'aktiv',
  );

  const status = calcStatus(readyOrders.length, freeDrivers.length, onlineDrivers.length);
  const cfg = STATUS_CONFIG[status];

  // Longest-waiting order
  const longestWait = readyOrders.reduce<number>((max, o) => {
    const w = waitMin(o.fertig_am);
    return w > max ? w : max;
  }, 0);

  // Active tour progress
  const tourProgress = activeBatches.map((b) => {
    const total = b.stops.length;
    const done = b.stops.filter((s) => s.geliefert_am).length;
    const etaMin =
      b.startzeit && b.total_eta_min != null
        ? Math.max(0, Math.round((new Date(b.startzeit).getTime() + b.total_eta_min * 60_000 - Date.now()) / 60_000))
        : null;
    return { id: b.id, total, done, etaMin };
  });

  const totalRevenuePending = readyOrders.reduce((s, o) => s + o.gesamtbetrag, 0);

  return (
    <div className={cn('rounded-xl border overflow-hidden', cfg.bg, cfg.border)}>
      {/* Ampel-Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Ampel-Dot */}
        <span className="relative flex h-4 w-4 shrink-0">
          {(status === 'critical' || status === 'warn') && (
            <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-75', cfg.dot, cfg.ring)} />
          )}
          <span className={cn('relative inline-flex h-4 w-4 rounded-full', cfg.dot)} />
        </span>

        <div className="flex-1 min-w-0">
          <div className={cn('text-xs font-black uppercase tracking-wider', cfg.labelColor)}>
            Dispatch-Status: {cfg.label}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              {readyOrders.length} fertig
              {totalRevenuePending > 0 && ` · ${euro(totalRevenuePending)}`}
            </span>
            <span className="flex items-center gap-1">
              <Bike className="h-3 w-3" />
              {freeDrivers.length}/{onlineDrivers.length} frei
            </span>
            <span className="flex items-center gap-1">
              <Truck className="h-3 w-3" />
              {activeBatches.length} aktiv
            </span>
          </div>
        </div>

        {/* Handlungs-Empfehlung */}
        {status === 'critical' && (
          <div className="shrink-0 flex items-center gap-1.5 rounded-full bg-red-500 text-white px-3 py-1 text-[10px] font-black animate-pulse">
            <AlertTriangle className="h-3 w-3" />
            Fahrer rufen!
          </div>
        )}
        {status === 'warn' && (
          <div className="shrink-0 flex items-center gap-1.5 rounded-full bg-amber-500 text-white px-3 py-1 text-[10px] font-black">
            <Zap className="h-3 w-3" />
            {readyOrders.length - freeDrivers.length} warten
          </div>
        )}
        {status === 'ok' && readyOrders.length > 0 && (
          <div className="shrink-0 flex items-center gap-1.5 rounded-full bg-matcha-500 text-white px-3 py-1 text-[10px] font-black">
            <CheckCircle2 className="h-3 w-3" />
            Einsatzbereit
          </div>
        )}
      </div>

      {/* Detail-Grid */}
      {(readyOrders.length > 0 || activeBatches.length > 0) && (
        <div className="border-t border-current/10 px-4 py-2.5 grid grid-cols-2 gap-4">
          {/* Wartezeiten */}
          {readyOrders.length > 0 && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Längstes Warten
              </div>
              <div className={cn(
                'text-lg font-black tabular-nums',
                longestWait >= 12 ? 'text-red-600' : longestWait >= 6 ? 'text-amber-600' : 'text-matcha-700',
              )}>
                {longestWait} Min
              </div>
              <div className="text-[10px] text-muted-foreground">
                {readyOrders.length} {readyOrders.length === 1 ? 'Bestellung' : 'Bestellungen'} wartend
              </div>
            </div>
          )}

          {/* Tour-Fortschritt */}
          {tourProgress.length > 0 && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Tour-Fortschritt
              </div>
              <div className="space-y-1">
                {tourProgress.slice(0, 3).map((t) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <Route className="h-3 w-3 text-muted-foreground shrink-0" />
                    <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-matcha-500 transition-all"
                        style={{ width: `${t.total > 0 ? (t.done / t.total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold tabular-nums text-muted-foreground">
                      {t.done}/{t.total}
                    </span>
                    {t.etaMin !== null && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        ~{t.etaMin}m
                      </span>
                    )}
                  </div>
                ))}
                {tourProgress.length > 3 && (
                  <div className="text-[9px] text-muted-foreground">+{tourProgress.length - 3} weitere Touren</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
