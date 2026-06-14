'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, RefreshCw, RotateCcw, XCircle } from 'lucide-react';

interface RecoveryEvent {
  id: string;
  cancelled_batch_id: string;
  driver_id: string | null;
  reason: string | null;
  orders_recovered: number;
  orders_requeued: number;
  recovery_batch_ids: string[];
  started_at: string;
  completed_at: string | null;
  duration_sec: number | null;
  error: string | null;
  driver_name?: string | null;
}

interface RecoveryData {
  events: RecoveryEvent[];
  count: number;
  _note?: string;
}

export function RecoveryClient({ locationId }: { locationId: string }) {
  const [data, setData] = useState<RecoveryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [batchId, setBatchId] = useState('');
  const [triggering, setTriggering] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/delivery/admin/recovery?location_id=${locationId}&limit=20`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d as RecoveryData); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  const triggerRecovery = async () => {
    if (!batchId.trim()) return;
    setTriggering(true);
    setResult(null);
    const res = await fetch('/api/delivery/admin/recovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batch_id: batchId.trim(), reason: 'manual_admin' }),
    });
    const json = await res.json();
    if (res.ok) {
      setResult({ ok: true, msg: `${json.orders_recovered ?? 0} Bestellungen gerettet, ${json.orders_requeued ?? 0} neu eingeplant` });
      setBatchId('');
      load();
    } else {
      setResult({ ok: false, msg: json.error ?? 'Unbekannter Fehler' });
    }
    setTriggering(false);
  };

  return (
    <div className="space-y-6">
      {/* Manual recovery trigger */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <RotateCcw className="h-4 w-4 text-matcha-700" />
          <span className="font-semibold text-sm">Recovery manuell auslösen</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={batchId}
            onChange={e => setBatchId(e.target.value)}
            placeholder="Tour-ID (batch_id) eingeben…"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-matcha-500"
          />
          <button
            onClick={triggerRecovery}
            disabled={triggering || !batchId.trim()}
            className="flex items-center gap-1.5 rounded-lg border border-matcha-700 bg-matcha-700 text-white px-3 py-2 text-sm font-semibold hover:bg-matcha-800 transition disabled:opacity-50 shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {triggering ? 'Wird verarbeitet…' : 'Recovery starten'}
          </button>
        </div>
        {result && (
          <div className={cn('flex items-center gap-2 text-sm', result.ok ? 'text-matcha-700' : 'text-red-600')}>
            {result.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
            {result.msg}
          </div>
        )}
      </div>

      {/* History */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">Recovery-Verlauf</span>
        <button onClick={load} disabled={loading} className="ml-auto flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-sm bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      {loading && <div className="flex items-center justify-center py-12 text-muted-foreground">Lade Recovery-Verlauf…</div>}

      {!loading && data && data._note && (
        <div className="text-sm text-muted-foreground text-center py-4">{data._note}</div>
      )}

      {!loading && data && !data._note && data.events.length === 0 && (
        <div className="flex items-center gap-2 justify-center py-12 text-muted-foreground text-sm">
          <CheckCircle2 className="h-4 w-4" />
          Keine Recovery-Ereignisse.
        </div>
      )}

      {!loading && data && data.events.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border">
                  <th className="text-left px-4 py-2">Tour</th>
                  <th className="text-left px-4 py-2">Fahrer</th>
                  <th className="text-left px-4 py-2">Gerettet</th>
                  <th className="text-left px-4 py-2">Neu eingeplant</th>
                  <th className="text-left px-4 py-2">Dauer</th>
                  <th className="text-left px-4 py-2">Zeitpunkt</th>
                  <th className="text-left px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map(ev => (
                  <tr key={ev.id} className="border-t border-border">
                    <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground truncate max-w-[100px]">{ev.cancelled_batch_id.slice(0, 8)}</td>
                    <td className="px-4 py-2.5 text-sm">{ev.driver_name ?? ev.driver_id?.slice(0, 8) ?? '—'}</td>
                    <td className="px-4 py-2.5 text-sm font-bold text-matcha-700">{ev.orders_recovered}</td>
                    <td className="px-4 py-2.5 text-sm tabular-nums">{ev.orders_requeued}</td>
                    <td className="px-4 py-2.5 text-sm tabular-nums text-muted-foreground">
                      {ev.duration_sec !== null ? `${ev.duration_sec}s` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-sm tabular-nums text-muted-foreground">
                      {new Date(ev.started_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-2.5">
                      {ev.error
                        ? <span className="text-[11px] text-red-600 font-bold">Fehler</span>
                        : ev.completed_at
                          ? <span className="text-[11px] text-matcha-700 font-bold">✓ OK</span>
                          : <span className="text-[11px] text-amber-600 font-bold">Läuft</span>}
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
