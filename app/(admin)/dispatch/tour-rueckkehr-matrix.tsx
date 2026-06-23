'use client';

import { useEffect, useState } from 'react';
import { Bike, Clock, ChevronDown, ChevronUp, RotateCcw, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type BatchItem = {
  id: string;
  driver_id: string;
  fahrer_id?: string;
  status: string;
  started_at: string | null;
  total_eta_min: number | null;
  fahrer?: { vorname: string; nachname: string } | null;
  zone?: string | null;
};

type DriverItem = {
  id: string;
  employee_id?: string;
  employee?: { vorname: string; nachname: string; telefon?: string | null } | null;
};

type StopItem = {
  id: string;
  batch_id: string;
  order_id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
};

type ForecastRow = {
  batchId: string;
  driverName: string;
  returnMs: number | null;
  returnLabel: string;
  remainMin: number | null;
  remainingStops: number;
  totalStops: number;
  urgency: 'soon' | 'mid' | 'far' | 'unknown';
};

const ACTIVE_STATUSES = new Set([
  'pickup', 'unterwegs', 'assigned', 'at_restaurant', 'on_route', 'pending_acceptance',
]);

export function DispatchTourRueckkehrMatrix({
  batches,
  drivers,
  stops,
}: {
  batches: BatchItem[];
  drivers: DriverItem[];
  stops: StopItem[];
}) {
  const [open, setOpen] = useState(true);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();

  const rows: ForecastRow[] = batches
    .filter((b) => ACTIVE_STATUSES.has(b.status))
    .map((b): ForecastRow => {
      const driverId = b.fahrer_id ?? b.driver_id;
      let driverName = 'Unbekannt';
      if (b.fahrer) {
        driverName = `${b.fahrer.vorname} ${b.fahrer.nachname[0]}.`;
      } else {
        const d = drivers.find((dr) => dr.id === driverId || dr.employee_id === driverId);
        if (d?.employee) {
          driverName = `${d.employee.vorname} ${d.employee.nachname[0]}.`;
        }
      }

      const batchStops = stops.filter((s) => s.batch_id === b.id);
      const remainingStops = batchStops.filter((s) => !s.geliefert_am).length;
      const totalStops = batchStops.length;

      let returnMs: number | null = null;
      let returnLabel = '—';
      let remainMin: number | null = null;
      let urgency: ForecastRow['urgency'] = 'unknown';

      if (b.started_at && b.total_eta_min != null) {
        returnMs = new Date(b.started_at).getTime() + b.total_eta_min * 60_000;
        remainMin = Math.max(0, Math.round((returnMs - now) / 60_000));
        returnLabel = new Date(returnMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

        if (remainMin <= 5) urgency = 'soon';
        else if (remainMin <= 15) urgency = 'mid';
        else urgency = 'far';
      }

      return { batchId: b.id, driverName, returnMs, returnLabel, remainMin, remainingStops, totalStops, urgency };
    })
    .sort((a, b) => {
      if (a.remainMin === null && b.remainMin === null) return 0;
      if (a.remainMin === null) return 1;
      if (b.remainMin === null) return -1;
      return a.remainMin - b.remainMin;
    });

  if (rows.length === 0) return null;

  const urgencyStyle: Record<ForecastRow['urgency'], { badge: string; text: string; label: string }> = {
    soon:    { badge: 'bg-matcha-500 text-white',       text: 'text-matcha-700',  label: 'Bald zurück' },
    mid:     { badge: 'bg-amber-400 text-amber-900',    text: 'text-amber-700',   label: 'Unterwegs' },
    far:     { badge: 'bg-muted text-muted-foreground', text: 'text-foreground',  label: 'Noch unterwegs' },
    unknown: { badge: 'bg-muted text-muted-foreground', text: 'text-muted-foreground', label: 'Keine ETA' },
  };

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition border-b"
      >
        <RotateCcw className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Fahrer-Rückkehr-Matrix
        </span>
        <Badge variant="secondary" className="ml-auto text-[10px]">
          {rows.length} aktiv
        </Badge>
        <span className="shrink-0 ml-1">
          {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </span>
      </button>

      {open && (
        <div className="divide-y">
          {rows.map((row) => {
            const s = urgencyStyle[row.urgency];
            return (
              <div key={row.batchId} className="flex items-center gap-3 px-4 py-2.5">
                <Bike className="h-4 w-4 text-matcha-500 shrink-0" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold truncate">{row.driverName}</span>
                    {row.totalStops > 0 && (
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {row.totalStops - row.remainingStops}/{row.totalStops} Stopps
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-matcha-500 rounded-full transition-all"
                        style={{
                          width: row.totalStops > 0
                            ? `${Math.round(((row.totalStops - row.remainingStops) / row.totalStops) * 100)}%`
                            : '0%',
                        }}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">
                      {row.remainingStops} übrig
                    </span>
                  </div>
                </div>

                <div className="shrink-0 text-right space-y-0.5">
                  {row.returnMs !== null ? (
                    <>
                      <div className="font-mono text-sm font-black tabular-nums text-foreground">
                        {row.returnLabel}
                      </div>
                      {row.remainMin !== null && (
                        <div className={cn('text-[10px] font-bold tabular-nums', s.text)}>
                          {row.remainMin === 0 ? 'Jetzt' : `noch ${row.remainMin} Min`}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>

                <div className={cn('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black min-w-[72px] text-center', s.badge)}>
                  {s.label}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
