'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, UtensilsCrossed } from 'lucide-react';

interface Order {
  id: string;
  status: string;
  items?: Array<{ name?: string; product_name?: string; quantity?: number }>;
  created_at: string;
}

interface Props {
  orders: Order[];
}

interface GerichtStat {
  name: string;
  bestellungen: number;
  stornos: number;
  stornoPct: number;
}

function buildStats(orders: Order[]): GerichtStat[] {
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);

  const map = new Map<string, { bestellungen: number; stornos: number }>();

  for (const o of orders) {
    if (new Date(o.created_at) < heute) continue;
    const items = Array.isArray(o.items) ? o.items : [];
    for (const item of items) {
      const name = (item.name ?? item.product_name ?? 'Unbekannt').trim();
      if (!map.has(name)) map.set(name, { bestellungen: 0, stornos: 0 });
      const s = map.get(name)!;
      s.bestellungen += item.quantity ?? 1;
      if (o.status === 'cancelled') s.stornos += item.quantity ?? 1;
    }
  }

  const stats: GerichtStat[] = [];
  for (const [name, s] of map.entries()) {
    if (s.bestellungen < 3) continue;
    stats.push({
      name,
      bestellungen: s.bestellungen,
      stornos: s.stornos,
      stornoPct: s.stornos / s.bestellungen,
    });
  }

  return stats.sort((a, b) => b.stornoPct - a.stornoPct);
}

function AmpelDot({ pct }: { pct: number }) {
  const cls =
    pct >= 0.25
      ? 'bg-red-500'
      : pct >= 0.12
      ? 'bg-amber-500'
      : 'bg-emerald-500';
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${cls} shrink-0`} />;
}

export function KitchenPhase655ResteAlarm({ orders }: Props) {
  const [stats, setStats] = useState<GerichtStat[]>([]);
  const [open, setOpen] = useState(true);

  const refresh = useCallback(() => {
    setStats(buildStats(orders));
  }, [orders]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  const alarme = stats.filter((s) => s.stornoPct >= 0.12);

  if (stats.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm font-semibold">Reste-Alarm</span>
          {alarme.length > 0 && (
            <span className="rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-400">
              {alarme.length} Gericht{alarme.length !== 1 ? 'e' : ''} auffällig
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {alarme.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Gerichte mit erhöhter Storno-Rate — möglicher Qualitätshinweis. Bitte Zubereitung prüfen.
              </p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="pb-1 text-left font-medium">Gericht</th>
                  <th className="pb-1 text-right font-medium">Bestellt</th>
                  <th className="pb-1 text-right font-medium">Storniert</th>
                  <th className="pb-1 text-right font-medium">Rate</th>
                </tr>
              </thead>
              <tbody>
                {stats.slice(0, 8).map((s) => (
                  <tr key={s.name} className="border-b border-border/40 last:border-0">
                    <td className="py-1.5 pr-2 flex items-center gap-1.5">
                      <AmpelDot pct={s.stornoPct} />
                      <span className="truncate max-w-[140px]" title={s.name}>{s.name}</span>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{s.bestellungen}</td>
                    <td className="py-1.5 text-right tabular-nums text-red-600 dark:text-red-400">{s.stornos}</td>
                    <td className={`py-1.5 text-right tabular-nums font-semibold ${
                      s.stornoPct >= 0.25 ? 'text-red-600 dark:text-red-400' :
                      s.stornoPct >= 0.12 ? 'text-amber-600 dark:text-amber-400' :
                      'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {(s.stornoPct * 100).toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
