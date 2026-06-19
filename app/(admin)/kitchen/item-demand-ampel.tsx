'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Loader2, Package, ShoppingCart, XCircle } from 'lucide-react';

interface DemandAlert {
  id: string;
  itemName: string;
  alertLevel: 'warning' | 'critical';
  currentStock: number;
  reorderPoint: number;
  daysUntilDepletion: number | null;
  suggestedOrderQty: number | null;
  status: string;
  unit?: string;
  supplierName?: string | null;
}

interface Dashboard {
  totalTrackedItems: number;
  itemsOk: number;
  itemsWarning: number;
  itemsCritical: number;
  openAlerts: DemandAlert[];
  lastCheckedAt: string | null;
}

interface Props {
  locationId?: string;
  className?: string;
}

export function KitchenItemDemandAmpel({ locationId, className }: Props) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const load = () => {
    if (!locationId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/item-demand?action=dashboard&location_id=${locationId}`)
      .then((r) => r.json())
      .then((j) => { if (j.ok) setData(j.dashboard); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const triggerCheck = () => {
    if (!locationId || checking) return;
    setChecking(true);
    fetch(`/api/delivery/admin/item-demand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check', location_id: locationId }),
    })
      .then(() => { setLastCheck(new Date()); load(); })
      .catch(() => {})
      .finally(() => setChecking(false));
  };

  if (!locationId) return null;

  const totalAlerts = (data?.itemsCritical ?? 0) + (data?.itemsWarning ?? 0);

  return (
    <div className={cn('rounded-2xl border bg-white overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b bg-stone-50/60">
        <Package className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground flex-1">
          Artikel-Lagerampel
        </span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        <button
          onClick={triggerCheck}
          disabled={checking}
          className="text-[10px] font-bold text-matcha-700 hover:text-matcha-900 disabled:opacity-50 transition"
        >
          {checking ? 'Prüfe…' : 'Jetzt prüfen'}
        </button>
      </div>

      {/* KPI-Zeile */}
      {data && (
        <div className="grid grid-cols-3 divide-x border-b">
          <div className="px-3 py-2 text-center">
            <div className="text-base font-black text-matcha-700 tabular-nums">{data.itemsOk}</div>
            <div className="text-[9px] text-muted-foreground font-semibold uppercase mt-0.5">OK</div>
          </div>
          <div className="px-3 py-2 text-center">
            <div className={cn('text-base font-black tabular-nums', data.itemsWarning > 0 ? 'text-amber-600' : 'text-muted-foreground')}>
              {data.itemsWarning}
            </div>
            <div className="text-[9px] text-muted-foreground font-semibold uppercase mt-0.5">Warnung</div>
          </div>
          <div className="px-3 py-2 text-center">
            <div className={cn('text-base font-black tabular-nums', data.itemsCritical > 0 ? 'text-red-600' : 'text-muted-foreground')}>
              {data.itemsCritical}
            </div>
            <div className="text-[9px] text-muted-foreground font-semibold uppercase mt-0.5">Kritisch</div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {loading && !data && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Lade Lagerstand…
        </div>
      )}

      {data && totalAlerts === 0 && (
        <div className="flex items-center gap-2 px-4 py-4 text-sm text-matcha-700">
          <CheckCircle2 className="h-4 w-4 text-matcha-500" />
          Alle Lager im grünen Bereich
        </div>
      )}

      {data && data.openAlerts.length > 0 && (
        <div className="divide-y max-h-64 overflow-y-auto">
          {data.openAlerts.map((alert) => (
            <div key={alert.id} className={cn(
              'flex items-center gap-3 px-4 py-2.5',
              alert.alertLevel === 'critical' ? 'bg-red-50' : 'bg-amber-50',
            )}>
              {alert.alertLevel === 'critical'
                ? <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                : <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold truncate">{alert.itemName}</div>
                <div className="text-[10px] text-muted-foreground">
                  {alert.currentStock} {alert.unit ?? 'Stk'} lagernd
                  {alert.daysUntilDepletion !== null && (
                    <span className={cn(
                      'ml-1 font-bold',
                      alert.daysUntilDepletion <= 1 ? 'text-red-600' : 'text-amber-600',
                    )}>
                      · ~{alert.daysUntilDepletion}d bis leer
                    </span>
                  )}
                </div>
              </div>
              {alert.suggestedOrderQty !== null && (
                <div className="shrink-0 text-right">
                  <div className="text-[10px] font-black text-matcha-700 flex items-center gap-1">
                    <ShoppingCart className="h-3 w-3" />
                    {alert.suggestedOrderQty} {alert.unit ?? 'Stk'}
                  </div>
                  <div className="text-[9px] text-muted-foreground">bestellen</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      {data?.lastCheckedAt && (
        <div className="px-4 py-2 border-t text-[10px] text-muted-foreground">
          Zuletzt geprüft: {new Date(data.lastCheckedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          {lastCheck && ` · Manuell: ${lastCheck.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`}
        </div>
      )}
    </div>
  );
}
