'use client';

import { useEffect, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Activity, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { BestelleingangTaktResponse } from '@/app/api/delivery/admin/bestelleingang-takt/route';

// Phase 1487 — Bestelleingang-Takt-Panel (Kitchen)
// Visualisierung der Phase1481-API: 15-Min-Slot-Balken + Peak-Indikator + Prognose.
// Collapsible, 10-Min-Polling. Nach Phase1482.

interface Props {
  locationId: string | null;
}

const POLL_MS = 10 * 60_000;

function buildMock(): BestelleingangTaktResponse {
  const now = new Date();
  const slots = [];
  const vals = [2, 3, 1, 4, 6, 8, 5, 7, 9, 4, 6, 3, 5, 7, 8, 6];
  for (let i = 15; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 15 * 60_000);
    d.setSeconds(0, 0);
    d.setMinutes(Math.floor(d.getMinutes() / 15) * 15);
    slots.push({
      slot_start: d.toISOString(),
      slot_label: d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      anzahl: vals[15 - i] ?? 3,
      ist_peak: false,
    });
  }
  const max = Math.max(...slots.map((s) => s.anzahl));
  const peak = slots.find((s) => s.anzahl === max) ?? null;
  if (peak) peak.ist_peak = true;
  const gesamt = slots.reduce((s, sl) => s + sl.anzahl, 0);
  return {
    slots,
    peak_slot: peak,
    prognose_naechster_slot: 7,
    gesamt_4h: gesamt,
    durchschnitt_pro_slot: parseFloat((gesamt / slots.length).toFixed(1)),
    location_id: 'mock',
    generiert_am: new Date().toISOString(),
  };
}

export function KitchenPhase1487BestelleingangTaktPanel({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<BestelleingangTaktResponse>(buildMock);

  useEffect(() => {
    if (!locationId) return;

    async function load() {
      try {
        const res = await fetch(`/api/delivery/admin/bestelleingang-takt?location_id=${locationId}`, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json?.slots?.length) setData(json as BestelleingangTaktResponse);
        }
      } catch {}
    }

    load();
    const iv = setInterval(load, POLL_MS);
    return () => clearInterval(iv);
  }, [locationId]);

  const maxAnzahl = useMemo(() => Math.max(...data.slots.map((s) => s.anzahl), 1), [data.slots]);
  const last8 = data.slots.slice(-8);

  return (
    <Card className="overflow-hidden border border-teal-200 dark:border-teal-800">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-teal-50 dark:bg-teal-900/20 border-b border-teal-200 dark:border-teal-800 text-left"
      >
        <Activity className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-200 flex-1">
          Bestelleingang-Takt
        </span>
        <span className="text-[10px] font-semibold text-teal-500 dark:text-teal-400">
          {data.gesamt_4h} in 4h · Ø {data.durchschnitt_pro_slot}/Slot
        </span>
        <span className="ml-2 text-[10px] text-teal-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 py-3 space-y-3">
          {/* Bar chart — last 8 slots */}
          <div className="flex items-end gap-1 h-16">
            {last8.map((slot) => {
              const heightPct = Math.round((slot.anzahl / maxAnzahl) * 100);
              return (
                <div key={slot.slot_start} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                  <div
                    className={cn(
                      'w-full rounded-t-sm transition-all',
                      slot.ist_peak
                        ? 'bg-teal-500 dark:bg-teal-400'
                        : 'bg-teal-200 dark:bg-teal-700',
                    )}
                    style={{ height: `${Math.max(heightPct, 4)}%` }}
                  />
                  <span className="text-[8px] text-muted-foreground tabular-nums truncate w-full text-center">
                    {slot.slot_label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Peak + Prognose */}
          <div className="flex items-center gap-3 text-[11px]">
            {data.peak_slot && (
              <div className="flex items-center gap-1">
                <span className="text-teal-600 dark:text-teal-400 font-bold">Peak:</span>
                <span className="text-foreground font-semibold">{data.peak_slot.slot_label}</span>
                <span className="text-muted-foreground">({data.peak_slot.anzahl} Bestellungen)</span>
              </div>
            )}
            <div className="ml-auto flex items-center gap-1 text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-teal-400" />
              <span>Prognose: <strong className="text-foreground">{data.prognose_naechster_slot}</strong> Bestellungen</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
