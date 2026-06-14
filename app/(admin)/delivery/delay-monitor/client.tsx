'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, RefreshCw, Scan } from 'lucide-react';

interface DelayedOrder {
  id: string;
  bestellnummer: string;
  delayMinutes: number;
  firstNoticeSent: boolean;
  criticalNoticeSent: boolean;
  compensationFlagged: boolean;
  voucherCreated: boolean;
  status: string;
  etaLatest: string;
}

interface CompensationVoucher {
  id: string;
  orderId: string;
  voucherCode: string;
  discountAmount: number;
  delayMinutes: number;
  createdAt: string;
  expiresAt: string | null;
  redeemed: boolean;
}

interface DelayData {
  summary: {
    total_delayed: number;
    pending_first_notice: number;
    pending_critical: number;
    pending_voucher: number;
    max_delay_minutes: number;
  };
  delayed_orders: DelayedOrder[];
  vouchers: CompensationVoucher[];
}

function delayColor(minutes: number) {
  if (minutes >= 30) return 'text-red-700 bg-red-50 border-red-300';
  if (minutes >= 15) return 'text-amber-700 bg-amber-50 border-amber-300';
  return 'text-blue-700 bg-blue-50 border-blue-200';
}

export function DelayMonitorClient({ locationId }: { locationId: string }) {
  const [data, setData] = useState<DelayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/delivery/admin/delay-monitor?location_id=${locationId}&limit=50`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.summary) setData(d as DelayData); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  const scan = async () => {
    setScanning(true);
    await fetch('/api/delivery/admin/delay-monitor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location_id: locationId }),
    });
    setScanning(false);
    load();
  };

  return (
    <div className="space-y-6">
      {/* Aktionen */}
      <div className="flex items-center gap-2">
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Aktualisieren
        </button>
        <button
          onClick={scan}
          disabled={scanning || loading}
          className="flex items-center gap-1.5 rounded-lg border border-amber-500 bg-amber-500 text-white px-3 py-1.5 text-sm font-semibold hover:bg-amber-600 transition disabled:opacity-50"
        >
          <Scan className="h-3.5 w-3.5" />
          {scanning ? 'Scanne…' : 'Scan auslösen'}
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">Lade Verzögerungen…</div>
      )}

      {!loading && data && (
        <>
          {/* KPI-Karten */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className={cn('rounded-xl border px-4 py-3', data.summary.total_delayed > 0 ? 'bg-red-50 border-red-200' : 'bg-card')}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Verspätet</div>
              <div className={cn('font-display text-2xl font-black', data.summary.total_delayed > 0 ? 'text-red-700' : '')}>{data.summary.total_delayed}</div>
            </div>
            <div className="rounded-xl border bg-card px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Max. Verspätung</div>
              <div className="font-display text-2xl font-black">{data.summary.max_delay_minutes} Min</div>
            </div>
            <div className={cn('rounded-xl border px-4 py-3', data.summary.pending_voucher > 0 ? 'bg-amber-50 border-amber-200' : 'bg-card')}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Gutscheine ausstehend</div>
              <div className={cn('font-display text-2xl font-black', data.summary.pending_voucher > 0 ? 'text-amber-700' : '')}>{data.summary.pending_voucher}</div>
            </div>
            <div className="rounded-xl border bg-card px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Gutscheine ausgestellt</div>
              <div className="font-display text-2xl font-black">{data.vouchers.length}</div>
            </div>
          </div>

          {/* Verspätete Bestellungen */}
          {data.delayed_orders.length > 0 ? (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="font-semibold text-sm">Aktuell verspätete Bestellungen</span>
              </div>
              <div className="divide-y divide-border">
                {data.delayed_orders.map(o => (
                  <div key={o.id} className="px-4 py-3 flex items-center gap-3">
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-black border shrink-0', delayColor(o.delayMinutes))}>
                      +{Math.round(o.delayMinutes)} Min
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">#{o.bestellnummer}</div>
                      <div className="text-[11px] text-muted-foreground">
                        ETA war {new Date(o.etaLatest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr · {o.status}
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {o.firstNoticeSent && <span className="text-[10px] bg-blue-50 border border-blue-200 text-blue-700 rounded px-1.5 py-0.5 font-bold">Benachrichtigt</span>}
                      {o.voucherCreated && <span className="text-[10px] bg-matcha-50 border border-matcha-200 text-matcha-700 rounded px-1.5 py-0.5 font-bold">Gutschein</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 justify-center py-12 text-muted-foreground text-sm">
              <CheckCircle2 className="h-4 w-4 text-matcha-600" />
              Keine aktuell verspäteten Bestellungen.
            </div>
          )}

          {/* Kompensations-Gutscheine */}
          {data.vouchers.length > 0 && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b">
                <span className="font-semibold text-sm">Ausgestellte Kompensations-Gutscheine</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border">
                      <th className="text-left px-4 py-2">Code</th>
                      <th className="text-left px-4 py-2">Wert</th>
                      <th className="text-left px-4 py-2">Verspätung</th>
                      <th className="text-left px-4 py-2">Erstellt</th>
                      <th className="text-left px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.vouchers.slice(0, 20).map(v => (
                      <tr key={v.id} className="border-t border-border">
                        <td className="px-4 py-2.5 font-mono text-sm font-bold">{v.voucherCode}</td>
                        <td className="px-4 py-2.5 text-sm font-medium text-matcha-700">{euro(v.discountAmount)}</td>
                        <td className="px-4 py-2.5 text-sm tabular-nums text-muted-foreground">+{v.delayMinutes} Min</td>
                        <td className="px-4 py-2.5 text-sm tabular-nums text-muted-foreground">
                          {new Date(v.createdAt).toLocaleDateString('de-DE')}
                        </td>
                        <td className="px-4 py-2.5">
                          {v.redeemed
                            ? <span className="text-[11px] bg-matcha-50 border border-matcha-200 text-matcha-700 rounded-full px-2 py-0.5 font-bold">Eingelöst</span>
                            : <span className="text-[11px] bg-amber-50 border border-amber-200 text-amber-700 rounded-full px-2 py-0.5 font-bold">Offen</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
