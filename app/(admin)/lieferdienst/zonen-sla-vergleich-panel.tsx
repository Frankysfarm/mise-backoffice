'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ZoneSlaEntry {
  zone: string;
  totalOrders: number;
  deliveredOrders: number;
  onTimeOrders: number;
  lateOrders: number;
  slaPct: number;
  avgDeliveryMin: number | null;
  status: 'gut' | 'mittel' | 'kritisch';
}

interface Props {
  locationId: string | null;
}

const STATUS_CONFIG: Record<ZoneSlaEntry['status'], { label: string; bar: string; badge: string; text: string; bg: string }> = {
  gut:      { label: 'Gut',      bar: 'bg-matcha-500', badge: 'bg-matcha-100 text-matcha-700 border-matcha-200', text: 'text-matcha-700', bg: 'bg-matcha-50/50' },
  mittel:   { label: 'Mittel',   bar: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700 border-amber-200',   text: 'text-amber-700',   bg: 'bg-amber-50/50'  },
  kritisch: { label: 'Kritisch', bar: 'bg-red-500',    badge: 'bg-red-100 text-red-700 border-red-200',         text: 'text-red-700',     bg: 'bg-red-50/50'    },
};

export function LieferdienstZonenSlaVergleichPanel({ locationId }: Props) {
  const [zones, setZones] = useState<ZoneSlaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [days, setDays] = useState(7);

  const load = (d = days) => {
    if (!locationId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/zonen-sla-vergleich?location_id=${encodeURIComponent(locationId)}&days=${d}`)
      .then((r) => r.json())
      .then((data) => setZones(data.zones ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(() => load(), 120_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, days]);

  if (!loading && zones.length === 0) return null;

  const kritisch = zones.filter((z) => z.status === 'kritisch').length;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        className={cn(
          'w-full flex items-center gap-2 px-4 py-2.5 border-b transition-colors',
          kritisch > 0 ? 'bg-red-50 hover:bg-red-100' : 'bg-muted/30 hover:bg-muted/50',
        )}
        onClick={() => setOpen((p) => !p)}
      >
        <MapPin className={cn('h-4 w-4 shrink-0', kritisch > 0 ? 'text-red-500' : 'text-matcha-600')} />
        <span className={cn('text-xs font-bold uppercase tracking-wider flex-1 text-left', kritisch > 0 ? 'text-red-800' : '')}>
          Zonen-SLA-Vergleich · {days} Tage
        </span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        {kritisch > 0 && (
          <span className="text-[10px] font-black text-red-600 bg-red-100 rounded px-1.5 py-0.5 border border-red-200">
            {kritisch} kritisch
          </span>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          {/* Period selector */}
          <div className="flex gap-1.5">
            {[3, 7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={cn(
                  'text-[10px] font-bold rounded px-2 py-1 border transition-colors',
                  days === d
                    ? 'bg-matcha-600 text-white border-matcha-600'
                    : 'bg-white text-muted-foreground border-border hover:border-matcha-300',
                )}
              >
                {d}T
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => <div key={i} className="h-14 rounded bg-muted/40 animate-pulse" />)}
            </div>
          ) : (
            <div className="divide-y rounded-lg border overflow-hidden">
              {zones.map((z) => {
                const cfg = STATUS_CONFIG[z.status];
                return (
                  <div key={z.zone} className={cn('px-3 py-3', cfg.bg)}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-black flex-1">Zone {z.zone}</span>
                      <span className={cn('text-[9px] font-bold border rounded px-1.5 py-0.5', cfg.badge)}>
                        {cfg.label}
                      </span>
                      <span className={cn('text-sm font-black tabular-nums', cfg.text)}>
                        {z.slaPct}%
                      </span>
                    </div>

                    {/* SLA bar */}
                    <div className="h-1.5 rounded-full bg-black/10 overflow-hidden mb-1.5">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', cfg.bar)}
                        style={{ width: `${z.slaPct}%` }}
                      />
                    </div>

                    <div className="flex gap-3 text-[9px] text-muted-foreground flex-wrap">
                      <span>{z.totalOrders} Bestellungen</span>
                      <span className="text-matcha-600 font-bold">{z.onTimeOrders} pünktlich</span>
                      {z.lateOrders > 0 && <span className="text-red-600 font-bold">{z.lateOrders} zu spät</span>}
                      {z.avgDeliveryMin !== null && <span>Ø {z.avgDeliveryMin} Min</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
