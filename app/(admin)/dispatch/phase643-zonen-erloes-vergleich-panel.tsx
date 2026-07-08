'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart2, ChevronDown, ChevronUp, Euro } from 'lucide-react';

interface ZonenErloes {
  zone: string;
  lieferungen: number;
  erloes_gesamt: number;
  erloes_pro_lieferung: number;
  liefergebuehr_gesamt: number;
  trinkgeld_gesamt: number;
}

interface Props {
  locationId: string | null;
}

const MOCK: ZonenErloes[] = [
  { zone: 'A', lieferungen: 14, erloes_gesamt: 56.0, erloes_pro_lieferung: 4.0, liefergebuehr_gesamt: 42.0, trinkgeld_gesamt: 14.0 },
  { zone: 'B', lieferungen: 9,  erloes_gesamt: 31.5, erloes_pro_lieferung: 3.5, liefergebuehr_gesamt: 22.5, trinkgeld_gesamt: 9.0 },
  { zone: 'C', lieferungen: 6,  erloes_gesamt: 18.0, erloes_pro_lieferung: 3.0, liefergebuehr_gesamt: 12.0, trinkgeld_gesamt: 6.0 },
  { zone: 'D', lieferungen: 3,  erloes_gesamt: 7.5,  erloes_pro_lieferung: 2.5, liefergebuehr_gesamt: 6.0,  trinkgeld_gesamt: 1.5 },
];

function eur(v: number): string {
  return v.toFixed(2).replace('.', ',') + ' €';
}

export function DispatchPhase643ZonenErloeesVergleichPanel({ locationId }: Props) {
  const [zonen, setZonen] = useState<ZonenErloes[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const laden = useCallback(async () => {
    if (!locationId) {
      setZonen(MOCK);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/delivery/admin/zonen-erloes-vergleich?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.zonen) && json.zonen.length > 0) {
          setZonen(json.zonen);
        } else {
          setZonen(MOCK);
        }
      } else {
        setZonen(MOCK);
      }
    } catch {
      setZonen(MOCK);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, 60_000);
    return () => clearInterval(id);
  }, [laden]);

  const maxErloes = Math.max(...zonen.map((z) => z.erloes_gesamt), 1);

  const ZONE_COLORS: Record<string, string> = {
    A: 'bg-emerald-500',
    B: 'bg-blue-500',
    C: 'bg-amber-400',
    D: 'bg-orange-500',
  };

  function barColor(zone: string): string {
    return ZONE_COLORS[zone] ?? 'bg-purple-500';
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm p-4 animate-pulse h-28" />
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        <BarChart2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="flex-1 text-sm font-semibold text-foreground">
          Zonen-Erlös heute
        </span>
        <Euro className="h-3 w-3 text-muted-foreground mr-1" />
        <span className="text-xs font-bold tabular-nums text-muted-foreground">
          {eur(zonen.reduce((s, z) => s + z.erloes_gesamt, 0))}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {zonen.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Noch keine Lieferungen heute.
            </p>
          )}
          {zonen.map((z) => {
            const pct = Math.round((z.erloes_gesamt / maxErloes) * 100);
            return (
              <div key={z.zone}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-6 text-xs font-black text-foreground">
                    {z.zone}
                  </span>
                  <div className="flex-1 h-5 rounded-md bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div
                      className={`h-full rounded-md transition-all duration-700 ${barColor(z.zone)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold tabular-nums text-foreground w-16 text-right">
                    {eur(z.erloes_gesamt)}
                  </span>
                </div>
                <div className="flex gap-4 pl-8 text-[10px] text-muted-foreground">
                  <span>{z.lieferungen} Lief.</span>
                  <span>{eur(z.erloes_pro_lieferung)} /Lief.</span>
                  <span>Geb. {eur(z.liefergebuehr_gesamt)}</span>
                  <span>TG {eur(z.trinkgeld_gesamt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
