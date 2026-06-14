'use client';

/**
 * DispatchSchichtUebergabePanel — Phase 162
 *
 * Schicht-Übergabe-Zusammenfassung für den Dispatcher.
 * Zeigt was in-flight ist wenn ein Schichtwechsel ansteht:
 * - Aktive Touren mit ETA-Countdown
 * - Wartende Bestellungen ohne Fahrer
 * - Fahrer-Roster (wer online, wer geht, wer kommt)
 * - Umsatz + SLA-Score der laufenden Schicht
 */

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn, euro } from '@/lib/utils';
import {
  Bike, CheckCircle2, Clock, LogOut, Package, TrendingUp, Truck, Users, X, Zap,
} from 'lucide-react';

type Driver = {
  employee_id: string;
  ist_online: boolean;
  fahrzeug: string | null;
  online_seit: string | null;
  aktueller_batch_id: string | null;
  employee: { vorname: string; nachname: string } | null;
};

type ActiveBatch = {
  id: string;
  fahrer_id: string | null;
  status: string;
  startzeit: string | null;
  total_eta_min: number | null;
  total_distance_km: number | null;
  stops: {
    id: string;
    order_id: string;
    geliefert_am: string | null;
    order: { bestellnummer: string; kunde_name: string; eta_earliest: string | null } | null;
  }[];
};

type WaitingOrder = {
  id: string;
  bestellnummer: string;
  kunde_name: string;
  fertig_am: string | null;
  gesamtbetrag: number;
};

type ShiftKpi = {
  ordersDelivered: number;
  revenueToday: number;
  slaHits: number;
  slaTotal: number;
};

function useTick(ms = 1000) {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), ms);
    return () => clearInterval(iv);
  }, [ms]);
}

function fmtCountdown(sec: number): string {
  const m = Math.floor(Math.abs(sec) / 60);
  const s = Math.abs(sec) % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtOnlineDuration(seit: string | null): string {
  if (!seit) return '—';
  const ms = Date.now() - new Date(seit).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

interface Props {
  locationId: string | null;
  drivers: Driver[];
  activeBatches: ActiveBatch[];
  waitingOrders: WaitingOrder[];
  onClose?: () => void;
}

export function DispatchSchichtUebergabePanel({
  locationId,
  drivers,
  activeBatches,
  waitingOrders,
  onClose,
}: Props) {
  useTick(1_000);
  const [kpi, setKpi] = useState<ShiftKpi | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!locationId) return;
    const load = async () => {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const { data: orders } = await supabase
        .from('customer_orders')
        .select('id, gesamtbetrag, status, geliefert_am, eta_latest')
        .eq('location_id', locationId)
        .eq('status', 'geliefert')
        .gte('geliefert_am', todayStart.toISOString());

      const rows = (orders ?? []) as { id: string; gesamtbetrag: number; geliefert_am: string | null; eta_latest: string | null }[];
      const revenue = rows.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);
      const slaTotal = rows.filter(o => o.eta_latest).length;
      const slaHits = rows.filter(o => o.eta_latest && o.geliefert_am && new Date(o.geliefert_am) <= new Date(o.eta_latest)).length;

      setKpi({ ordersDelivered: rows.length, revenueToday: revenue, slaHits, slaTotal });
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const onlineDrivers = drivers.filter(d => d.ist_online);
  const onTourDrivers = onlineDrivers.filter(d => d.aktueller_batch_id);
  const freeDrivers = onlineDrivers.filter(d => !d.aktueller_batch_id);

  const now = Date.now();

  const tourItems = useMemo(() => activeBatches
    .filter(b => b.status === 'in_transit')
    .map(b => {
      const pendingStops = b.stops.filter(s => !s.geliefert_am);
      const etaSec = b.startzeit && b.total_eta_min
        ? Math.floor((new Date(b.startzeit).getTime() + b.total_eta_min * 60_000 - now) / 1000)
        : null;
      const driver = onlineDrivers.find(d => d.employee_id === b.fahrer_id);
      return { ...b, pendingStops, etaSec, driverName: driver ? `${driver.employee?.vorname ?? ''} ${driver.employee?.nachname ?? ''}`.trim() : 'Unbekannt' };
    })
    .sort((a, b) => (a.etaSec ?? 9999) - (b.etaSec ?? 9999)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [activeBatches, onlineDrivers, now]);

  const slaPct = kpi && kpi.slaTotal > 0 ? Math.round((kpi.slaHits / kpi.slaTotal) * 100) : null;

  return (
    <div className="rounded-xl border-2 border-saffron/40 bg-gradient-to-br from-amber-50 to-white shadow-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <LogOut className="h-5 w-5 text-saffron" />
        <span className="font-display text-sm font-bold uppercase tracking-wider text-char">
          Schicht-Übergabe Snapshot
        </span>
        <span className="ml-2 rounded-full bg-saffron/20 px-2 py-0.5 text-[10px] font-bold text-saffron">
          {new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
        </span>
        {onClose && (
          <button onClick={onClose} className="ml-auto rounded-full p-1 hover:bg-black/5">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* KPI-Grid */}
      {kpi && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <div className="rounded-lg bg-matcha-50 border border-matcha-200 p-2 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wide text-matcha-600 mb-0.5">Geliefert</div>
            <div className="font-display text-2xl font-black text-matcha-800">{kpi.ordersDelivered}</div>
          </div>
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-2 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wide text-blue-600 mb-0.5">Umsatz</div>
            <div className="font-display text-lg font-black text-blue-800">{euro(kpi.revenueToday)}</div>
          </div>
          <div className={cn('rounded-lg border p-2 text-center', slaPct != null && slaPct >= 90 ? 'bg-matcha-50 border-matcha-200' : slaPct != null && slaPct >= 75 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200')}>
            <div className={cn('text-[10px] font-bold uppercase tracking-wide mb-0.5', slaPct != null && slaPct >= 90 ? 'text-matcha-600' : slaPct != null && slaPct >= 75 ? 'text-amber-600' : 'text-red-600')}>SLA</div>
            <div className={cn('font-display text-2xl font-black', slaPct != null && slaPct >= 90 ? 'text-matcha-800' : slaPct != null && slaPct >= 75 ? 'text-amber-800' : 'text-red-800')}>
              {slaPct != null ? `${slaPct}%` : '—'}
            </div>
          </div>
          <div className="rounded-lg bg-purple-50 border border-purple-200 p-2 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wide text-purple-600 mb-0.5">Fahrer online</div>
            <div className="font-display text-2xl font-black text-purple-800">{onlineDrivers.length}</div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Aktive Touren */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Truck className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Aktive Touren ({tourItems.length})
            </span>
          </div>
          {tourItems.length === 0 && (
            <div className="rounded-lg border border-dashed p-3 text-center text-[11px] text-muted-foreground">
              Keine aktiven Touren
            </div>
          )}
          <div className="space-y-1.5">
            {tourItems.map(tour => {
              const isOverdue = tour.etaSec != null && tour.etaSec < 0;
              const isUrgent = tour.etaSec != null && tour.etaSec < 300 && tour.etaSec >= 0;
              return (
                <div
                  key={tour.id}
                  className={cn('rounded-lg border p-2', isOverdue ? 'border-red-300 bg-red-50' : isUrgent ? 'border-amber-300 bg-amber-50' : 'border-stone-200 bg-white')}
                >
                  <div className="flex items-center gap-2">
                    <Bike className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="text-[11px] font-bold flex-1 truncate">{tour.driverName}</span>
                    <span className={cn('text-[11px] font-bold tabular-nums', isOverdue ? 'text-red-600' : isUrgent ? 'text-amber-600' : 'text-muted-foreground')}>
                      {tour.etaSec != null ? (isOverdue ? `+${fmtCountdown(tour.etaSec)}` : fmtCountdown(tour.etaSec)) : '—'}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {tour.pendingStops.length} Stop{tour.pendingStops.length !== 1 ? 's' : ''} ausstehend
                    {tour.total_distance_km != null && ` · ${tour.total_distance_km.toFixed(1)} km`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Wartende Orders + Fahrer-Status */}
        <div className="space-y-3">
          {/* Wartende Bestellungen */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Package className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Warten auf Fahrer ({waitingOrders.length})
              </span>
              {waitingOrders.length > 0 && (
                <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  OFFEN
                </span>
              )}
            </div>
            {waitingOrders.length === 0 ? (
              <div className="flex items-center gap-1.5 text-[11px] text-matcha-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Alle Bestellungen zugewiesen
              </div>
            ) : (
              <div className="space-y-1">
                {waitingOrders.slice(0, 5).map(o => {
                  const waitSec = o.fertig_am ? Math.floor((now - new Date(o.fertig_am).getTime()) / 1000) : 0;
                  return (
                    <div key={o.id} className="flex items-center gap-2 rounded border border-orange-200 bg-orange-50 px-2 py-1">
                      <span className="text-[10px] font-bold text-orange-800">#{o.bestellnummer}</span>
                      <span className="text-[10px] text-orange-700 truncate flex-1">{o.kunde_name}</span>
                      <span className="text-[10px] tabular-nums text-orange-600">{Math.floor(waitSec / 60)}min warten</span>
                    </div>
                  );
                })}
                {waitingOrders.length > 5 && (
                  <div className="text-[10px] text-muted-foreground text-center">+{waitingOrders.length - 5} weitere</div>
                )}
              </div>
            )}
          </div>

          {/* Fahrer-Roster */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Fahrer-Roster
              </span>
            </div>
            <div className="space-y-1">
              {onlineDrivers.map(d => {
                const onTour = !!d.aktueller_batch_id;
                return (
                  <div key={d.employee_id} className="flex items-center gap-2 text-[11px]">
                    <span className={cn('h-2 w-2 rounded-full shrink-0', onTour ? 'bg-blue-500' : 'bg-matcha-500')} />
                    <span className="font-medium truncate flex-1">
                      {d.employee?.vorname ?? ''} {d.employee?.nachname ?? ''}
                    </span>
                    <span className="text-muted-foreground">{fmtOnlineDuration(d.online_seit)}</span>
                    <span className={cn('text-[10px] font-bold', onTour ? 'text-blue-600' : 'text-matcha-600')}>
                      {onTour ? 'Tour' : 'Frei'}
                    </span>
                  </div>
                );
              })}
              {onlineDrivers.length === 0 && (
                <div className="text-[11px] text-muted-foreground">Kein Fahrer online</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Übergabe-Checkliste */}
      <div className="mt-4 rounded-lg border border-saffron/30 bg-saffron/5 p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Zap className="h-3.5 w-3.5 text-saffron" />
          <span className="text-[11px] font-bold text-saffron">Übergabe-Checkliste</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
          {[
            { ok: tourItems.length === 0, label: 'Alle Touren abgeschlossen' },
            { ok: waitingOrders.length === 0, label: 'Keine Bestellungen wartend' },
            { ok: freeDrivers.length > 0, label: `Freier Fahrer verfügbar (${freeDrivers.length})` },
            { ok: slaPct == null || slaPct >= 80, label: `SLA-Quote ≥80% (${slaPct ?? '?'}%)` },
          ].map((item, i) => (
            <div key={i} className={cn('flex items-center gap-1.5 text-[11px]', item.ok ? 'text-matcha-700' : 'text-red-600')}>
              <span>{item.ok ? '✓' : '✗'}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
