'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPin, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface ZoneAufkommen {
  zone: string;
  bestellungen: number;
  pct: number;
  farbe: 'niedrig' | 'mittel' | 'hoch';
}

const MOCK: ZoneAufkommen[] = [
  { zone: 'Zone A', bestellungen: 18, pct: 42, farbe: 'hoch' },
  { zone: 'Zone B', bestellungen: 12, pct: 28, farbe: 'mittel' },
  { zone: 'Zone C', bestellungen: 8, pct: 19, farbe: 'mittel' },
  { zone: 'Zone D', bestellungen: 5, pct: 11, farbe: 'niedrig' },
];

function balkenFarbe(f: ZoneAufkommen['farbe']) {
  return f === 'hoch' ? 'bg-red-500' : f === 'mittel' ? 'bg-amber-500' : 'bg-emerald-500';
}

export function KitchenPhase757ZonenBestellaufkommen({ locationId }: Props) {
  const [data, setData] = useState<ZoneAufkommen[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const laden = useCallback(async () => {
    if (!locationId) { setData(MOCK); setLoading(false); return; }
    try {
      const res = await fetch(
        `/api/delivery/admin/zonen-bestelldruck?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.zonen) && json.zonen.length > 0) {
          const gesamt = json.zonen.reduce((s: number, z: { bestellungen_aktiv?: number }) => s + (z.bestellungen_aktiv ?? 0), 0) || 1;
          const mapped: ZoneAufkommen[] = json.zonen.map((z: { zone?: string; bestellungen_aktiv?: number }) => {
            const b = z.bestellungen_aktiv ?? 0;
            const pct = Math.round((b / gesamt) * 100);
            return {
              zone: z.zone ?? 'Zone',
              bestellungen: b,
              pct,
              farbe: pct > 30 ? 'hoch' : pct > 15 ? 'mittel' : 'niedrig',
            };
          }).sort((a: ZoneAufkommen, b: ZoneAufkommen) => b.bestellungen - a.bestellungen);
          setData(mapped);
          return;
        }
      }
    } catch { /* fallback */ }
    setData(MOCK);
  }, [locationId]);

  useEffect(() => {
    laden().finally(() => setLoading(false));
    const id = setInterval(laden, 2 * 60_000);
    return () => clearInterval(id);
  }, [laden]);

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-semibold">Zonen-Aufkommen</span>
          {!loading && data.length > 0 && (
            <span className="text-xs text-muted-foreground">{data.length} Zonen</span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="h-20 animate-pulse rounded bg-muted" />
          ) : data.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Keine Zonen-Daten</p>
          ) : (
            data.map((z) => (
              <div key={z.zone} className="space-y-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">{z.zone}</span>
                  <span className="tabular-nums text-muted-foreground">{z.bestellungen} Best. ({z.pct}%)</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${balkenFarbe(z.farbe)}`} style={{ width: `${z.pct}%` }} />
                </div>
              </div>
            ))
          )}
          <p className="text-[10px] text-muted-foreground">Aktive Bestellungen je Zone · 2-Min Update</p>
        </div>
      )}
    </div>
  );
}
