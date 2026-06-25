'use client';

/**
 * Phase 501 — Kapazitäts-Matrix
 *
 * Übersichtliche Matrix aller aktiven Fahrer mit:
 * - Status: Frei / Auf Tour (X Stops) / Rückkehr in Y Min
 * - Farbkodierung nach Kapazität
 * - Klick-to-sort nach verfügbarer Kapazität
 * - 30s Auto-Refresh
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, CheckCircle2, Clock, MapPin, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  locationId: string | null;
}

interface DriverRow {
  id: string;
  name: string;
  status: 'frei' | 'unterwegs' | 'rueckkehr';
  activeStops: number;
  remainMin: number | null;
  zone: string | null;
  vehicle: string | null;
}

const STATUS_LABEL: Record<DriverRow['status'], string> = {
  frei:      'Frei',
  unterwegs: 'Unterwegs',
  rueckkehr: 'Rückkehr',
};

const STATUS_STYLE: Record<DriverRow['status'], { bg: string; dot: string; text: string }> = {
  frei:      { bg: 'bg-matcha-50 border-matcha-200',  dot: 'bg-matcha-500',  text: 'text-matcha-700' },
  unterwegs: { bg: 'bg-amber-50 border-amber-200',    dot: 'bg-amber-500',   text: 'text-amber-700' },
  rueckkehr: { bg: 'bg-blue-50 border-blue-200',      dot: 'bg-blue-500',    text: 'text-blue-700' },
};

export function DispatchPhase501KapazitaetsMatrix({ locationId }: Props) {
  const [rows, setRows]     = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]     = useState(true);
  const supabase = createClient();

  async function load() {
    if (!locationId) return;
    setLoading(true);
    try {
      const { data: drivers } = await supabase
        .from('delivery_drivers')
        .select(`
          id, vorname, nachname,
          driver_status:delivery_driver_status(ist_online, fahrzeug, aktueller_batch_id, last_update)
        `)
        .eq('location_id', locationId)
        .eq('delivery_driver_status.ist_online', true);

      if (!drivers) { setLoading(false); return; }

      const onlineDrivers = drivers.filter(
        (d: any) => d.driver_status?.[0]?.ist_online,
      );

      const batchIds = onlineDrivers
        .map((d: any) => d.driver_status?.[0]?.aktueller_batch_id)
        .filter(Boolean);

      let stopCounts: Record<string, number> = {};
      let batchEtas: Record<string, number | null> = {};

      if (batchIds.length > 0) {
        const { data: stops } = await supabase
          .from('delivery_batch_stops')
          .select('batch_id, geliefert_am')
          .in('batch_id', batchIds);

        const { data: batches } = await supabase
          .from('delivery_batches')
          .select('id, total_eta_min, started_at')
          .in('id', batchIds);

        if (stops) {
          for (const s of stops) {
            if (!s.geliefert_am) {
              stopCounts[s.batch_id] = (stopCounts[s.batch_id] ?? 0) + 1;
            }
          }
        }
        if (batches) {
          for (const b of batches) {
            if (b.total_eta_min && b.started_at) {
              const elapsedMin = Math.floor((Date.now() - new Date(b.started_at).getTime()) / 60_000);
              batchEtas[b.id] = Math.max(0, b.total_eta_min - elapsedMin);
            } else {
              batchEtas[b.id] = null;
            }
          }
        }
      }

      const newRows: DriverRow[] = onlineDrivers.map((d: any) => {
        const ds = d.driver_status?.[0];
        const batchId = ds?.aktueller_batch_id;
        const remainStops = batchId ? (stopCounts[batchId] ?? 0) : 0;
        const remainMin   = batchId ? (batchEtas[batchId] ?? null) : null;

        let status: DriverRow['status'] = 'frei';
        if (batchId && remainStops > 0) status = 'unterwegs';
        else if (batchId && remainStops === 0) status = 'rueckkehr';

        return {
          id:          d.id,
          name:        `${d.vorname} ${d.nachname}`,
          status,
          activeStops: remainStops,
          remainMin,
          zone:        null,
          vehicle:     ds?.fahrzeug ?? null,
        };
      });

      newRows.sort((a, b) => {
        const order = { frei: 0, rueckkehr: 1, unterwegs: 2 };
        return order[a.status] - order[b.status];
      });

      setRows(newRows);
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const freeCount      = rows.filter((r) => r.status === 'frei').length;
  const onTourCount    = rows.filter((r) => r.status === 'unterwegs').length;
  const returningCount = rows.filter((r) => r.status === 'rueckkehr').length;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-muted/40 transition text-left"
      >
        <Bike className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="font-display text-sm font-bold uppercase tracking-wider flex-1">
          Fahrer-Kapazität
        </span>
        <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-black text-matcha-700">
          {freeCount} frei
        </span>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">
          {onTourCount} Tour
        </span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        <span className="text-[10px] text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t">
          {rows.length === 0 && !loading && (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Keine Fahrer online.
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3">
            {rows.map((row) => {
              const s = STATUS_STYLE[row.status];
              return (
                <div key={row.id} className={cn('rounded-lg border flex items-center gap-2.5 px-3 py-2', s.bg)}>
                  <span className={cn('h-2 w-2 rounded-full shrink-0', s.dot)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold truncate">{row.name}</div>
                    <div className={cn('text-[10px] font-semibold', s.text)}>
                      {STATUS_LABEL[row.status]}
                      {row.status === 'unterwegs' && row.activeStops > 0 && (
                        <> · {row.activeStops} Stop{row.activeStops !== 1 ? 's' : ''}</>
                      )}
                      {row.remainMin !== null && (
                        <> · ~{row.remainMin} Min</>
                      )}
                    </div>
                  </div>
                  {row.vehicle && (
                    <span className="text-sm shrink-0">
                      {row.vehicle === 'bike' ? '🚲' : row.vehicle === 'ebike' ? '🛵' : row.vehicle === 'auto' ? '🚗' : '🛴'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {rows.length > 0 && (
            <div className="px-4 pb-3 flex items-center gap-3 text-[10px] text-muted-foreground">
              <span>{rows.length} Fahrer online</span>
              <span>·</span>
              <span>{freeCount} frei · {returningCount} rückkehrend · {onTourCount} auf Tour</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
