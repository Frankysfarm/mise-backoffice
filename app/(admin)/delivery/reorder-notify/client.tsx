'use client';

import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Bell, RefreshCw, RotateCcw, Package, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReorderNotifyDashboard } from '@/lib/delivery/smart-reorder-notify';

interface Props {
  locationId: string;
  initial: ReorderNotifyDashboard;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export function ReorderNotifyClient({ locationId, initial }: Props) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [resetting, setResetting] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/reorder-notify?location_id=${locationId}`);
      const json = await res.json();
      if (json.ok) setData(json as ReorderNotifyDashboard);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  const scanNow = useCallback(async () => {
    setScanning(true);
    setLastResult(null);
    try {
      const res = await fetch('/api/delivery/admin/reorder-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan_now', location_id: locationId }),
      });
      const json = await res.json();
      if (json.ok) {
        setLastResult(`${json.pushed} Push(es) gesendet, ${json.deduped} dedupliziert`);
        await reload();
      }
    } finally {
      setScanning(false);
    }
  }, [locationId, reload]);

  const resetDedup = useCallback(async (itemName: string) => {
    setResetting(itemName);
    try {
      await fetch('/api/delivery/admin/reorder-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_dedup', location_id: locationId, item_name: itemName }),
      });
      await reload();
    } finally {
      setResetting(null);
    }
  }, [locationId, reload]);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={scanNow} disabled={scanning}>
          <Bell size={14} className="mr-1" />
          {scanning ? 'Scannt…' : 'Jetzt scannen'}
        </Button>
        <Button size="sm" variant="outline" onClick={reload} disabled={loading}>
          <RefreshCw size={14} className={cn('mr-1', loading && 'animate-spin')} />
          Aktualisieren
        </Button>
        {lastResult && (
          <span className="text-sm text-emerald-600 ml-2">{lastResult}</span>
        )}
        {data.lastScanAt && (
          <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
            <Clock size={12} /> Letzter Push: {fmtDate(data.lastScanAt)}
          </span>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: <AlertTriangle size={16} />, label: 'Kritisch', value: data.totalOpenCritical, color: 'text-red-600', bg: 'bg-red-50' },
          { icon: <AlertTriangle size={16} />, label: 'Warnung', value: data.totalOpenWarning, color: 'text-amber-600', bg: 'bg-amber-50' },
          { icon: <Bell size={16} />, label: 'Pushes gesendet', value: data.recentPushes.length, color: 'text-blue-600', bg: 'bg-blue-50' },
          { icon: <Package size={16} />, label: 'Alerts gesamt', value: data.openAlerts.length, color: 'text-slate-600', bg: 'bg-slate-50' },
        ].map((kpi, i) => (
          <Card key={i} className={cn('p-3', kpi.bg)}>
            <div className={cn('mb-1', kpi.color)}>{kpi.icon}</div>
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className="text-2xl font-bold">{kpi.value}</p>
          </Card>
        ))}
      </div>

      {/* Offene Alerts */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-500" />
          Offene Alerts
        </h3>
        {data.openAlerts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Keine offenen Alerts — alle Bestände im grünen Bereich.
          </p>
        ) : (
          <div className="space-y-2">
            {data.openAlerts.map((alert) => (
              <div
                key={`${alert.itemName}-${alert.alertLevel}`}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border',
                  alert.alertLevel === 'critical'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-amber-50 border-amber-200',
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-medium',
                        alert.alertLevel === 'critical'
                          ? 'bg-red-500 text-white'
                          : 'bg-amber-500 text-white',
                      )}
                    >
                      {alert.alertLevel === 'critical' ? 'KRITISCH' : 'WARNUNG'}
                    </span>
                    <span className="font-medium text-sm">{alert.itemName}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Bestand: {alert.currentStock} · Reorder-Punkt: {alert.reorderPoint} ·{' '}
                    Ø {alert.avgDailyDemand.toFixed(1)}/Tag
                    {alert.daysUntilDepletion != null && ` · ~${alert.daysUntilDepletion}d bis leer`}
                  </p>
                  {alert.pushedAt && (
                    <p className="text-xs text-blue-600 mt-0.5">
                      Push gesendet: {fmtDate(alert.pushedAt)}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => resetDedup(alert.itemName)}
                  disabled={resetting === alert.itemName}
                  title="Push-Dedup zurücksetzen (nächster Scan sendet erneut)"
                >
                  <RotateCcw size={12} className="mr-1" />
                  {resetting === alert.itemName ? '…' : 'Erneut pushen'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Push-Log */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Bell size={16} className="text-blue-500" />
          Push-Verlauf (letzte 20)
        </h3>
        {data.recentPushes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Noch keine Pushes gesendet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left pb-2 pr-3">Artikel</th>
                  <th className="text-left pb-2 pr-3">Stufe</th>
                  <th className="text-left pb-2">Gesendet</th>
                </tr>
              </thead>
              <tbody>
                {data.recentPushes.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 pr-3 font-medium">{p.itemName}</td>
                    <td className="py-2 pr-3">
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full',
                        p.alertLevel === 'critical'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700',
                      )}>
                        {p.alertLevel === 'critical' ? 'Kritisch' : 'Warnung'}
                      </span>
                    </td>
                    <td className="py-2 text-muted-foreground text-xs">{fmtDate(p.pushedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
