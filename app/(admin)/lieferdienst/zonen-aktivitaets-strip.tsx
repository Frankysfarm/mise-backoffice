'use client';

/**
 * ZonenAktivitaetsStrip — Phase 249
 *
 * Kompakter Echtzeit-Streifen für die Hauptbestellansicht des Lieferdienstes.
 * Zeigt je Lieferzone: Anzahl offener Bestellungen + Ampelstatus (rot/gelb/grün).
 * Hilft Schichtleitern sofort zu erkennen, welche Zonen überlastet sind.
 * Unterscheidet sich von zone-ampel.tsx durch Bestellanzahl + horizontal-kompaktes Layout.
 */

import { useEffect, useState } from 'react';
import { MapPin, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

interface ZoneStat {
  zone: string;
  openOrders: number;
  underwegs: number;
}

function getAmpelColor(openOrders: number): 'green' | 'amber' | 'red' {
  if (openOrders <= 2) return 'green';
  if (openOrders <= 5) return 'amber';
  return 'red';
}

const AMPEL_CLASSES = {
  green: 'bg-green-500',
  amber: 'bg-amber-400',
  red:   'bg-red-500 animate-pulse',
};

const AMPEL_TEXT = {
  green: 'text-green-700 bg-green-100',
  amber: 'text-amber-700 bg-amber-100',
  red:   'text-red-700 bg-red-100',
};

export function ZonenAktivitaetsStrip() {
  const [zones, setZones] = useState<ZoneStat[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  async function refresh() {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('customer_orders')
        .select('delivery_zone, status')
        .in('status', ['bestätigt', 'in_zubereitung', 'fertig', 'unterwegs'])
        .eq('typ', 'lieferung')
        .not('delivery_zone', 'is', null);

      if (!data) return;

      const map = new Map<string, ZoneStat>();
      for (const row of data) {
        const zone = (row.delivery_zone as string) || 'Sonstige';
        if (!map.has(zone)) map.set(zone, { zone, openOrders: 0, underwegs: 0 });
        const s = map.get(zone)!;
        s.openOrders++;
        if (row.status === 'unterwegs') s.underwegs++;
      }

      const sorted = Array.from(map.values())
        .sort((a, b) => b.openOrders - a.openOrders)
        .slice(0, 8);

      setZones(sorted);
      setLastRefresh(new Date());
    } catch {
      // silent fail
    }
  }

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 60_000);
    return () => clearInterval(iv);
  }, []);

  if (zones.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 px-0.5">
        <MapPin size={11} className="text-muted-foreground" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex-1">
          Zonen-Status
        </span>
        {lastRefresh && (
          <button
            onClick={refresh}
            className="flex items-center gap-0.5 text-[9px] text-muted-foreground hover:text-foreground transition"
          >
            <RefreshCw size={8} />
            {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {zones.map((z) => {
          const color = getAmpelColor(z.openOrders);
          return (
            <div
              key={z.zone}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold',
                AMPEL_TEXT[color],
              )}
            >
              <div className={cn('h-2 w-2 rounded-full shrink-0', AMPEL_CLASSES[color])} />
              <span className="truncate max-w-[80px]">{z.zone}</span>
              <span className="font-black tabular-nums">{z.openOrders}</span>
              {z.underwegs > 0 && (
                <span className="font-normal opacity-70">· {z.underwegs} uw.</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
