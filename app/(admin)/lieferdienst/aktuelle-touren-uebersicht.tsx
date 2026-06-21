'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Truck, Loader2 } from 'lucide-react';

interface Stop {
  geliefert_am: string | null;
}

interface BatchRow {
  id: string;
  status: string;
  zone: string | null;
  startzeit?: string | null;
  total_eta_min: number | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: Stop[];
}

interface Props {
  locationId: string | null;
}

const ACTIVE = ['assigned', 'on_route', 'en_route', 'unterwegs', 'active'];

export function LieferdienstAktuelleTouren({ locationId }: Props) {
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    const load = () => {
      fetch(`/api/delivery/admin/batches?location_id=${encodeURIComponent(locationId)}&status=active`)
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          setBatches((d.batches ?? d.data ?? []) as BatchRow[]);
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    };

    load();
    const iv = setInterval(load, 2 * 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (!locationId) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-white p-5 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Lade aktive Touren…
      </div>
    );
  }

  const active = batches.filter((b) => ACTIVE.includes(b.status));
  if (active.length === 0) return null;

  const rows = active.map((b) => {
    const name = b.fahrer ? `${b.fahrer.vorname} ${b.fahrer.nachname.charAt(0)}.` : 'Fahrer';
    const done = b.stops.filter((s) => s.geliefert_am).length;
    const total = b.stops.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    let remainMin: number | null = null;
    let health: 'on-time' | 'tight' | 'late' = 'on-time';
    if (b.startzeit && b.total_eta_min) {
      const startMs = new Date(b.startzeit).getTime();
      const elapsedMin = Math.floor((now - startMs) / 60_000);
      remainMin = Math.max(0, b.total_eta_min - elapsedMin);
      const timePct = (elapsedMin / b.total_eta_min) * 100;
      const gap = timePct - pct;
      health = gap > 20 ? 'late' : gap > 8 ? 'tight' : 'on-time';
    }

    return { b, name, done, total, pct, remainMin, health };
  });

  const healthStyle = {
    'on-time': { bar: 'bg-matcha-500', badge: 'bg-matcha-100 text-matcha-700', label: 'Im Plan' },
    tight:     { bar: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700',   label: 'Knapp'   },
    late:      { bar: 'bg-red-400',    badge: 'bg-red-100 text-red-700',       label: 'Verspätet' },
  };

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-3 border-b border-stone-100 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-700">
          <Truck className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-bold">Aktive Touren</div>
          <div className="text-xs text-stone-400">Live Fortschritt · ETA · Status</div>
        </div>
        <span className="ml-auto rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-600">
          {active.length} Tour{active.length !== 1 ? 'en' : ''}
        </span>
      </div>

      <div className="divide-y divide-stone-100">
        {rows.sort((a, b) => {
          const order = ['late', 'tight', 'on-time'];
          return order.indexOf(a.health) - order.indexOf(b.health);
        }).map((r) => {
          const hs = healthStyle[r.health];
          return (
            <div key={r.b.id} className="flex items-center gap-3 px-5 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold truncate">{r.name}</span>
                  {r.b.zone && (
                    <span className="text-[9px] rounded-full bg-stone-100 border px-1.5 py-0.5 font-bold shrink-0">
                      Zone {r.b.zone}
                    </span>
                  )}
                  <span className={cn('ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold', hs.badge)}>
                    {hs.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', hs.bar)}
                      style={{ width: `${r.pct}%` }}
                    />
                  </div>
                  <span className="text-[9px] tabular-nums text-muted-foreground shrink-0">
                    {r.done}/{r.total}
                  </span>
                </div>
              </div>
              {r.remainMin !== null && (
                <div className="shrink-0 text-right">
                  <div className={cn('font-mono text-sm font-black tabular-nums',
                    r.health === 'late' ? 'text-red-600' : r.health === 'tight' ? 'text-amber-600' : 'text-matcha-600',
                  )}>
                    ~{r.remainMin}m
                  </div>
                  <div className="text-[8px] text-muted-foreground">verbleibend</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
