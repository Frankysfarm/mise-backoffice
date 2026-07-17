'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { AlarmClock, ChevronDown, ChevronUp, AlertTriangle, Package } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  status: string;
  scheduled_for?: string | null;
  created_at?: string;
}

interface FahrerSchichtInfo {
  driver_id: string;
  name: string;
  letzte_tour_ende: string | null;
  schicht_dauer_min: number;
  ueberstunden: boolean;
}

interface ApiData {
  fahrer: FahrerSchichtInfo[];
}

interface Props {
  orders: Order[];
  locationId?: string | null;
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

const MOCK_API: ApiData = {
  fahrer: [
    { driver_id: 'm1', name: 'Anna M.', letzte_tour_ende: new Date(Date.now() + 25 * 60_000).toISOString(), schicht_dauer_min: 460, ueberstunden: false },
    { driver_id: 'm2', name: 'Ben K.', letzte_tour_ende: new Date(Date.now() + 55 * 60_000).toISOString(), schicht_dauer_min: 510, ueberstunden: true },
  ],
};

export function KitchenPhase2081SchichtEndeWarnung({ orders, locationId }: Props) {
  const [apiData, setApiData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) { setApiData(MOCK_API); return; }
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-schicht-start?location_id=${locationId}`);
      if (!res.ok) throw new Error();
      setApiData(await res.json());
    } catch {
      setApiData(MOCK_API);
    }
  }, [locationId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => { void load(); }, 5 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  const { bald, aktiv, pendingOrders } = useMemo(() => {
    const now = Date.now();
    const WARN_MS = 30 * 60_000; // 30 min

    const fahrer = apiData?.fahrer ?? [];

    const bald = fahrer.filter(f => {
      if (!f.letzte_tour_ende) return false;
      const endeMs = new Date(f.letzte_tour_ende).getTime();
      return endeMs > now && endeMs - now <= WARN_MS;
    });

    const aktiv = fahrer.filter(f => {
      if (!f.letzte_tour_ende) return false;
      const endeMs = new Date(f.letzte_tour_ende).getTime();
      return endeMs > now && endeMs - now > WARN_MS;
    });

    const pendingOrders = orders.filter(o =>
      ['pending', 'confirmed', 'preparing', 'in_progress'].includes(o.status),
    );

    return { bald, aktiv, pendingOrders };
  }, [apiData, orders]);

  const hasAlert = bald.length > 0;

  if (!apiData) return null;

  return (
    <Card className="overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b text-left"
        onClick={() => setOpen(o => !o)}
      >
        <AlarmClock className="h-4 w-4 text-orange-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Schicht-Ende-Warnung
        </span>
        {hasAlert && (
          <Badge className="ml-2 bg-orange-500 text-white text-[10px] px-1.5 py-0.5">
            {bald.length} endet bald
          </Badge>
        )}
        <span className="ml-auto text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* KPI */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-muted/40 p-3 text-center">
              <div className="text-[9px] text-muted-foreground uppercase mb-1">Aktive Fahrer</div>
              <div className="text-xl font-black tabular-nums">{aktiv.length}</div>
            </div>
            <div className={cn('rounded-xl p-3 text-center', hasAlert ? 'bg-orange-50' : 'bg-muted/40')}>
              <div className={cn('text-[9px] uppercase mb-1', hasAlert ? 'text-orange-600' : 'text-muted-foreground')}>
                Endet &lt;30 Min
              </div>
              <div className={cn('text-xl font-black tabular-nums', hasAlert ? 'text-orange-700' : '')}>
                {bald.length}
              </div>
            </div>
            <div className={cn('rounded-xl p-3 text-center', pendingOrders.length > 0 ? 'bg-amber-50' : 'bg-muted/40')}>
              <div className={cn('text-[9px] uppercase mb-1', pendingOrders.length > 0 ? 'text-amber-600' : 'text-muted-foreground')}>
                Offene Aufträge
              </div>
              <div className={cn('text-xl font-black tabular-nums', pendingOrders.length > 0 ? 'text-amber-700' : '')}>
                {pendingOrders.length}
              </div>
            </div>
          </div>

          {/* Alert-Banner */}
          {hasAlert && pendingOrders.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
              <p className="text-xs text-orange-800">
                {bald.length} Fahrer {bald.length === 1 ? 'beendet' : 'beenden'} die Schicht in &lt;30 Min —
                noch {pendingOrders.length} offene Aufträge. Batch-Stopp empfohlen.
              </p>
            </div>
          )}

          {/* Fahrer-Liste: bald endend */}
          {bald.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase text-orange-600 tracking-wide">Schicht endet bald</p>
              {bald.map(f => (
                <div key={f.driver_id} className="flex items-center gap-2 rounded-lg bg-orange-50 border border-orange-100 px-3 py-2">
                  <Package className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                  <span className="text-xs font-bold">{f.name}</span>
                  <span className="ml-auto text-[10px] font-mono text-orange-700">
                    ≈ {formatTime(f.letzte_tour_ende)}
                  </span>
                  {f.ueberstunden && (
                    <Badge className="bg-red-500 text-white text-[9px] px-1 py-0">ÜS</Badge>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Fahrer-Liste: noch aktiv */}
          {aktiv.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wide">Noch im Einsatz</p>
              {aktiv.map(f => (
                <div key={f.driver_id} className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-100 px-3 py-2">
                  <Package className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  <span className="text-xs font-bold">{f.name}</span>
                  <span className="ml-auto text-[10px] font-mono text-green-700">
                    bis ca. {formatTime(f.letzte_tour_ende)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {bald.length === 0 && aktiv.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">Keine Fahrerdaten verfügbar</p>
          )}
        </div>
      )}
    </Card>
  );
}
