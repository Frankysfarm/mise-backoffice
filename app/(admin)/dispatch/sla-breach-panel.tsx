'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, RefreshCw, Siren } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SlaBreachRecord {
  id: string;
  orderId: string;
  driverId: string | null;
  bestellnummer: string | null;
  severity: 'warning' | 'critical';
  delayMin: number;
  etaLatestAt: string | null;
  createdAt: string;
}

interface Dashboard {
  activeBreaches: SlaBreachRecord[];
  totalActive: number;
  criticalCount: number;
  warningCount: number;
  oldestBreachMinutes: number | null;
}

interface Props {
  locationId: string | null;
}

export function SlaBreachDetectorPanel({ locationId }: Props) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [resolving, setResolving] = useState<Set<string>>(new Set());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch('/api/delivery/admin/sla-breaches?action=list');
      if (res.ok) {
        setData(await res.json() as Dashboard);
        setLastUpdated(new Date());
      }
    } catch {
      // silent
    }
  }, [locationId]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, [load]);

  async function handleResolve(breachId: string) {
    setResolving((prev) => new Set([...prev, breachId]));
    try {
      await fetch('/api/delivery/admin/sla-breaches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', breach_id: breachId }),
      });
      await load();
    } finally {
      setResolving((prev) => {
        const next = new Set(prev);
        next.delete(breachId);
        return next;
      });
    }
  }

  if (!locationId || !data || data.totalActive === 0) return null;

  const hasCritical = data.criticalCount > 0;

  return (
    <Card className={cn(
      'overflow-hidden border-2',
      hasCritical ? 'border-red-400 bg-red-50/60' : 'border-amber-300 bg-amber-50/60',
    )}>
      {/* Header */}
      <div className={cn(
        'flex items-center gap-2 px-4 py-2.5 border-b',
        hasCritical ? 'bg-red-100/70 border-red-200' : 'bg-amber-100/70 border-amber-200',
      )}>
        <Siren className={cn('h-4 w-4 shrink-0 animate-pulse', hasCritical ? 'text-red-600' : 'text-amber-600')} />
        <span className="text-xs font-black uppercase tracking-wider text-foreground">
          SLA-Verletzungen · Aktiv
        </span>
        <div className="flex items-center gap-1.5 ml-auto">
          {data.criticalCount > 0 && (
            <Badge className="bg-red-500 text-white text-[10px] font-black">
              {data.criticalCount} kritisch
            </Badge>
          )}
          {data.warningCount > 0 && (
            <Badge className="bg-amber-500 text-white text-[10px] font-black">
              {data.warningCount} Warnung
            </Badge>
          )}
          <button
            onClick={() => void load()}
            className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Aktualisieren"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Summary strip */}
      {data.oldestBreachMinutes !== null && (
        <div className={cn(
          'px-4 py-1.5 text-xs font-bold flex items-center gap-1.5',
          hasCritical ? 'text-red-700' : 'text-amber-700',
        )}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {data.totalActive} Bestellung{data.totalActive !== 1 ? 'en' : ''} überschreiten SLA
          — längste Verspätung: <span className="font-black tabular-nums">{data.oldestBreachMinutes} Min</span>
        </div>
      )}

      {/* Breach rows */}
      <div className="divide-y divide-border/60 max-h-64 overflow-y-auto">
        {data.activeBreaches.map((breach) => (
          <div
            key={breach.id}
            className={cn(
              'flex items-center gap-3 px-4 py-2.5',
              breach.severity === 'critical' ? 'bg-red-50/50' : 'bg-amber-50/40',
            )}
          >
            {/* Severity badge */}
            <div className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black min-w-[58px] text-center',
              breach.severity === 'critical'
                ? 'bg-red-500 text-white'
                : 'bg-amber-400 text-white',
            )}>
              {breach.severity === 'critical' ? 'KRITISCH' : 'Warnung'}
            </div>

            {/* Order info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold">
                  #{breach.bestellnummer ?? breach.orderId.slice(0, 8)}
                </span>
                {breach.etaLatestAt && (
                  <span className="text-[10px] text-muted-foreground">
                    ETA war {new Date(breach.etaLatestAt).toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <div className={cn(
                'text-[11px] font-black tabular-nums',
                breach.severity === 'critical' ? 'text-red-600' : 'text-amber-600',
              )}>
                +{breach.delayMin} Min verspätet
              </div>
            </div>

            {/* Resolve button */}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[10px] shrink-0"
              disabled={resolving.has(breach.id)}
              onClick={() => void handleResolve(breach.id)}
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              Lösen
            </Button>
          </div>
        ))}
      </div>

      {/* Footer */}
      {lastUpdated && (
        <div className="px-4 py-1 text-[10px] text-muted-foreground border-t">
          Zuletzt aktualisiert {lastUpdated.toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      )}
    </Card>
  );
}
