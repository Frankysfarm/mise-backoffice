'use client';

import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Package, ChevronDown, ChevronUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface IncomingOrder {
  id: string;
  bestellnummer: string | null;
  gesamtpreis: number | null;
  bestellt_am: string;
  status: string;
  isNew: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  neu:         'Neu',
  bestätigt:   'Bestätigt',
  in_zubereitung: 'In Zubereitung',
  fertig:      'Fertig',
  assigned:    'Zugewiesen',
};

const STATUS_STYLE: Record<string, string> = {
  neu:            'bg-blue-100 text-blue-800',
  bestätigt:      'bg-matcha-100 text-matcha-800',
  in_zubereitung: 'bg-amber-100 text-amber-800',
  fertig:         'bg-matcha-500 text-white',
  assigned:       'bg-slate-100 text-slate-700',
};

const POLL_MS = 20_000;
const MAX_ITEMS = 15;

function timeAgo(isoStr: string): string {
  const diffSec = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1_000);
  if (diffSec < 60) return `${diffSec}s`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  return `${Math.floor(diffSec / 3600)}h`;
}

export function KitchenBestellEingangsTicker({
  locationId,
}: {
  locationId: string | null;
}) {
  const [orders, setOrders] = useState<IncomingOrder[]>([]);
  const [open, setOpen] = useState(true);
  const knownIds = useRef(new Set<string>());

  async function fetchOrders() {
    if (!locationId) return;
    const sb = createClient();
    const since = new Date(Date.now() - 3 * 60 * 60 * 1_000).toISOString(); // last 3h
    const { data } = await sb
      .from('customer_orders')
      .select('id, bestellnummer, gesamtpreis, bestellt_am, status')
      .eq('location_id', locationId)
      .gte('bestellt_am', since)
      .not('status', 'in', '("storniert","cancelled","geliefert")')
      .order('bestellt_am', { ascending: false })
      .limit(MAX_ITEMS);

    if (!data) return;

    const newRows: IncomingOrder[] = data.map((o) => ({
      id: o.id as string,
      bestellnummer: o.bestellnummer as string | null,
      gesamtpreis: o.gesamtpreis != null ? Number(o.gesamtpreis) : null,
      bestellt_am: o.bestellt_am as string,
      status: o.status as string,
      isNew: !knownIds.current.has(o.id as string),
    }));

    for (const r of newRows) knownIds.current.add(r.id);
    setOrders(newRows);

    // Clear isNew flag after animation
    setTimeout(() => {
      setOrders((prev) => prev.map((r) => ({ ...r, isNew: false })));
    }, 1_200);
  }

  useEffect(() => {
    fetchOrders();
    const iv = setInterval(fetchOrders, POLL_MS);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;

  const newCount = orders.filter((o) => o.isNew).length;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b bg-gradient-to-r from-slate-50 to-blue-50 hover:from-blue-50 hover:to-indigo-50 transition-colors"
      >
        <Package className="h-4 w-4 text-blue-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Eingangs-Ticker
        </span>
        {newCount > 0 && (
          <Badge className="bg-blue-500 text-white text-[9px] px-1.5 py-0 animate-pulse ml-1">
            +{newCount} neu
          </Badge>
        )}
        <Badge variant="secondary" className="ml-auto text-[10px]">
          {orders.length}
        </Badge>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className="divide-y max-h-72 overflow-y-auto">
          {orders.length === 0 && (
            <div className="px-4 py-5 text-center text-sm text-muted-foreground">
              Keine aktiven Bestellungen
            </div>
          )}
          {orders.map((o) => (
            <div
              key={o.id}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 transition-all duration-700',
                o.isNew
                  ? 'bg-blue-50 animate-[fade-in_0.6s_ease-out]'
                  : 'bg-white hover:bg-muted/30',
              )}
            >
              {/* Order number */}
              <div className="shrink-0 font-mono text-[11px] font-bold text-foreground w-20 truncate">
                {o.bestellnummer ?? o.id.slice(0, 8)}
              </div>

              {/* Time */}
              <div className="shrink-0 text-[10px] text-muted-foreground tabular-nums w-8">
                {timeAgo(o.bestellt_am)}
              </div>

              {/* Status badge */}
              <Badge
                className={cn(
                  'shrink-0 text-[9px] px-1.5 py-0 font-bold',
                  STATUS_STYLE[o.status] ?? 'bg-muted text-muted-foreground',
                )}
              >
                {STATUS_LABEL[o.status] ?? o.status}
              </Badge>

              {/* Price */}
              <div className="ml-auto shrink-0 text-xs font-bold tabular-nums text-foreground">
                {o.gesamtpreis != null ? `${o.gesamtpreis.toFixed(2)} €` : '—'}
              </div>

              {/* New indicator */}
              {o.isNew && (
                <div className="shrink-0 w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
