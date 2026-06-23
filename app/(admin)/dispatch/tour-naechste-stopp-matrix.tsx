'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MapPin, Clock, Bike, ChevronDown, ChevronUp, Navigation2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface StoppRow {
  batchId: string;
  driverName: string;
  reihenfolge: number;
  totalStops: number;
  completedStops: number;
  naechsterStop: {
    orderId: string;
    bestellnummer: string;
    kundeName: string;
    adresse: string | null;
    plz: string | null;
    etaMin: number | null;
  } | null;
  tourEtaMin: number | null;
  health: 'on-time' | 'tight' | 'late' | 'unknown';
}

function computeHealth(tourEtaMin: number | null, completedPct: number): StoppRow['health'] {
  if (tourEtaMin == null) return 'unknown';
  if (tourEtaMin > 45 && completedPct < 0.5) return 'late';
  if (tourEtaMin > 30 && completedPct < 0.3) return 'tight';
  if (tourEtaMin <= 30 || completedPct >= 0.7) return 'on-time';
  return 'unknown';
}

const HEALTH_STYLE = {
  'on-time': { bg: 'bg-matcha-50', badge: 'bg-matcha-500 text-white', label: 'Pünktlich' },
  tight:     { bg: 'bg-amber-50',  badge: 'bg-amber-400 text-white',  label: 'Knapp'    },
  late:      { bg: 'bg-red-50',    badge: 'bg-red-500 text-white',    label: 'Verspätet'},
  unknown:   { bg: 'bg-muted/20',  badge: 'bg-muted text-muted-foreground', label: 'Unbekannt' },
};

export function DispatchTourNaechsteStoppMatrix({
  locationId,
}: {
  locationId: string | null;
}) {
  const [rows, setRows] = useState<StoppRow[]>([]);
  const [open, setOpen] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  async function load() {
    if (!locationId) return;
    const sb = createClient();

    // Active batches
    const { data: batches } = await sb
      .from('delivery_batches')
      .select('id, fahrer_id, status, total_eta_min, started_at')
      .eq('location_id', locationId)
      .in('status', ['aktiv', 'unterwegs', 'pickup'])
      .order('started_at', { ascending: true })
      .limit(15);

    if (!batches?.length) { setRows([]); return; }

    const batchIds = batches.map((b: { id: string }) => b.id);

    // Load stops
    const { data: stops } = await sb
      .from('delivery_batch_stops')
      .select('id, batch_id, order_id, reihenfolge, angekommen_am, geliefert_am')
      .in('batch_id', batchIds)
      .order('reihenfolge', { ascending: true });

    // Load orders for stops
    const orderIds = [...new Set((stops ?? []).map((s: { order_id: string }) => s.order_id))];
    const { data: orders } = orderIds.length > 0
      ? await sb
          .from('customer_orders')
          .select('id, bestellnummer, kunde_name, kunde_adresse, kunde_plz, geschaetzte_lieferung_min')
          .in('id', orderIds)
      : { data: [] };

    const orderMap = new Map<string, {
      bestellnummer: string; kunde_name: string; kunde_adresse: string | null;
      kunde_plz: string | null; geschaetzte_lieferung_min: number | null;
    }>();
    for (const o of (orders ?? []) as {
      id: string; bestellnummer: string | null; kunde_name: string;
      kunde_adresse: string | null; kunde_plz: string | null; geschaetzte_lieferung_min: number | null;
    }[]) {
      orderMap.set(o.id, {
        bestellnummer: o.bestellnummer ?? '—',
        kunde_name: o.kunde_name,
        kunde_adresse: o.kunde_adresse,
        kunde_plz: o.kunde_plz,
        geschaetzte_lieferung_min: o.geschaetzte_lieferung_min,
      });
    }

    // Load driver names
    const fahrerIds = [...new Set(batches.map((b: { fahrer_id: string }) => b.fahrer_id).filter(Boolean))];
    const { data: employees } = fahrerIds.length > 0
      ? await sb
          .from('employees')
          .select('id, vorname, nachname')
          .in('id', fahrerIds)
      : { data: [] };

    const driverMap = new Map<string, string>();
    for (const e of (employees ?? []) as { id: string; vorname: string; nachname: string }[]) {
      driverMap.set(e.id, `${e.vorname} ${e.nachname.charAt(0)}.`);
    }

    const stoppRows: StoppRow[] = batches.map((b: {
      id: string; fahrer_id: string; status: string; total_eta_min: number | null; started_at: string | null;
    }) => {
      const batchStops = (stops ?? []).filter((s: { batch_id: string }) => s.batch_id === b.id);
      const completed = batchStops.filter((s: { geliefert_am: string | null }) => s.geliefert_am != null);
      const nextStop = batchStops.find((s: {
        reihenfolge: number; geliefert_am: string | null;
      }) => s.geliefert_am == null);

      const completedPct = batchStops.length > 0 ? completed.length / batchStops.length : 0;
      const tourEtaMin = b.total_eta_min;

      return {
        batchId: b.id,
        driverName: driverMap.get(b.fahrer_id) ?? 'Fahrer',
        reihenfolge: nextStop?.reihenfolge ?? batchStops.length,
        totalStops: batchStops.length,
        completedStops: completed.length,
        naechsterStop: nextStop
          ? {
              orderId: nextStop.order_id,
              bestellnummer: orderMap.get(nextStop.order_id)?.bestellnummer ?? '—',
              kundeName: orderMap.get(nextStop.order_id)?.kunde_name ?? '—',
              adresse: orderMap.get(nextStop.order_id)?.kunde_adresse ?? null,
              plz: orderMap.get(nextStop.order_id)?.kunde_plz ?? null,
              etaMin: orderMap.get(nextStop.order_id)?.geschaetzte_lieferung_min ?? null,
            }
          : null,
        tourEtaMin,
        health: computeHealth(tourEtaMin, completedPct),
      };
    });

    const healthOrder: StoppRow['health'][] = ['late', 'tight', 'on-time', 'unknown'];
    stoppRows.sort((a, b) => healthOrder.indexOf(a.health) - healthOrder.indexOf(b.health));
    setRows(stoppRows);
    setLastUpdate(new Date());
  }

  useEffect(() => {
    void load();
    const iv = setInterval(() => void load(), 20_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (rows.length === 0) return null;

  const lateCount = rows.filter(r => r.health === 'late').length;
  const tightCount = rows.filter(r => r.health === 'tight').length;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition"
      >
        <Navigation2 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Nächster Stopp · Matrix</span>
        {lateCount > 0 && (
          <span className="ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white">
            {lateCount}
          </span>
        )}
        {tightCount > 0 && (
          <span className="ml-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-400 px-1.5 text-[10px] font-black text-white">
            {tightCount}
          </span>
        )}
        <Badge variant="secondary" className="ml-auto text-[10px]">
          {rows.length} Tour{rows.length !== 1 ? 'en' : ''}
        </Badge>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-1 shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-1 shrink-0" />}
      </button>

      {open && (
        <div className="divide-y">
          {rows.map(row => {
            const s = HEALTH_STYLE[row.health];
            return (
              <div key={row.batchId} className={cn('px-4 py-3', s.bg)}>
                <div className="flex items-start gap-3">
                  {/* Driver + health */}
                  <div className="shrink-0">
                    <div className={cn('rounded-full px-2 py-0.5 text-[9px] font-black', s.badge)}>
                      {s.label}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1 text-xs font-bold">
                        <Bike className="h-3 w-3 text-muted-foreground" />
                        {row.driverName}
                      </span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {row.completedStops}/{row.totalStops} Stops
                      </span>
                      {row.tourEtaMin != null && (
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          ~{row.tourEtaMin} Min
                        </span>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="mt-1.5 h-1 w-full rounded-full bg-black/10 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-700',
                          row.health === 'on-time' ? 'bg-matcha-500' :
                          row.health === 'tight' ? 'bg-amber-400' : 'bg-red-400',
                        )}
                        style={{ width: `${row.totalStops > 0 ? Math.round((row.completedStops / row.totalStops) * 100) : 0}%` }}
                      />
                    </div>

                    {/* Nächster Stop */}
                    {row.naechsterStop && (
                      <div className="mt-2 flex items-start gap-2 rounded-lg bg-white/60 border px-2.5 py-1.5">
                        <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-bold truncate">
                            #{row.naechsterStop.bestellnummer} · {row.naechsterStop.kundeName}
                          </div>
                          {(row.naechsterStop.adresse || row.naechsterStop.plz) && (
                            <div className="text-[10px] text-muted-foreground truncate">
                              {[row.naechsterStop.plz, row.naechsterStop.adresse].filter(Boolean).join(' ')}
                            </div>
                          )}
                        </div>
                        {row.naechsterStop.etaMin != null && (
                          <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-bold text-muted-foreground tabular-nums">
                            <Clock className="h-2.5 w-2.5" />
                            {row.naechsterStop.etaMin}m
                          </span>
                        )}
                      </div>
                    )}

                    {!row.naechsterStop && (
                      <div className="mt-1.5 text-[11px] text-matcha-600 font-bold">
                        Alle Stops abgeschlossen ✓
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
