'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, RefreshCw } from 'lucide-react';

interface StaleOrder {
  id: string;
  bestellnummer: string;
  age_min: number;
  dispatch_attempts: number;
  escalation_status: 'first_hold' | 'retry' | 'needs_escalation' | 'escalated';
  delivery_zone: string | null;
  priority: string | null;
  created_at: string;
  last_dispatch_attempt_at: string | null;
  dispatch_escalated_at: string | null;
  kunde_adresse: string | null;
}

interface StaleData {
  count: number;
  needs_attention: boolean;
  orders: StaleOrder[];
}

const ESCALATION_LABELS: Record<string, string> = {
  first_hold: 'Wartet',
  retry: 'Wiederholung',
  needs_escalation: 'Eskalation nötig',
  escalated: 'Eskaliert',
};

function statusBadge(status: string, ageMin: number) {
  if (status === 'escalated') return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border bg-matcha-50 border-matcha-200 text-matcha-700">Eskaliert</span>;
  if (status === 'needs_escalation') return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border bg-red-50 border-red-300 text-red-700 animate-pulse">Eskalation nötig</span>;
  if (status === 'retry') return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border bg-amber-50 border-amber-200 text-amber-700">Wiederholung</span>;
  return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border bg-muted border-border text-muted-foreground">Wartet</span>;
}

export function StaleOrdersClient({ locationId }: { locationId: string }) {
  const [data, setData] = useState<StaleData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/delivery/admin/stale-orders?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d !== null) setData(d as StaleData); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [load]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Aktualisieren
        </button>
        <span className="ml-auto text-[11px] text-muted-foreground">Automatische Aktualisierung alle 30 Sek.</span>
      </div>

      {/* Attention Banner */}
      {!loading && data?.needs_attention && (
        <div className="flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-800 text-sm font-medium">
          ⚠️ Bestellungen benötigen sofortige Aufmerksamkeit – Fahrer zuweisen oder Radius erweitern!
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">Lade feststeckende Bestellungen…</div>
      )}

      {!loading && data && data.orders.length === 0 && (
        <div className="flex items-center gap-2 justify-center py-16 text-muted-foreground text-sm">
          <CheckCircle2 className="h-4 w-4 text-matcha-600" />
          Keine feststeckenden Bestellungen.
        </div>
      )}

      {!loading && data && data.orders.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <span className="font-semibold text-sm">{data.count} Bestellung{data.count !== 1 ? 'en' : ''} ohne Fahrer</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border">
                  <th className="text-left px-4 py-2">Bestellung</th>
                  <th className="text-left px-4 py-2">Wartezeit</th>
                  <th className="text-left px-4 py-2">Versuche</th>
                  <th className="text-left px-4 py-2">Zone</th>
                  <th className="text-left px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map(o => (
                  <tr key={o.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="text-sm font-bold">#{o.bestellnummer}</div>
                      {o.kunde_adresse && (
                        <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">{o.kunde_adresse}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-sm font-bold tabular-nums', o.age_min >= 30 ? 'text-red-600' : o.age_min >= 15 ? 'text-amber-600' : 'text-muted-foreground')}>
                        {Math.round(o.age_min)} Min
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums text-muted-foreground">{o.dispatch_attempts}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{o.delivery_zone ?? '—'}</td>
                    <td className="px-4 py-3">{statusBadge(o.escalation_status, o.age_min)}</td>
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
