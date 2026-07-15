'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Users, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Batch {
  id: string;
  status?: string | null;
  fahrer_id?: string | null;
}

interface Driver {
  employee_id?: string | null;
  status?: string | null;
  employee?: { vorname?: string | null; nachname?: string | null } | null;
}

interface DriverLoad {
  id: string;
  name: string;
  activeTours: number;
  capacity: number;
  loadPct: number;
  status: 'available' | 'busy' | 'overloaded' | 'offline';
}

interface Props {
  batches: Batch[];
  drivers: Driver[];
}

const ACTIVE_STATUSES = new Set(['unterwegs', 'on_route', 'gestartet', 'aktiv', 'pickup']);
const ONLINE_STATUSES = new Set(['online', 'verfügbar', 'available', 'bereit', 'idle']);

export function DispatchPhase1715FahrerAuslastungsMonitor({ batches, drivers }: Props) {
  const [open, setOpen] = useState(true);

  const rows: DriverLoad[] = useMemo(() => {
    return drivers.map((d) => {
      const id = d.employee_id ?? '';
      const name = d.employee
        ? `${d.employee.vorname ?? '?'} ${(d.employee.nachname ?? '?')[0] ?? '?'}.`
        : 'Fahrer';
      const activeTours = batches.filter(
        (b) => (b.fahrer_id ?? '') === id && ACTIVE_STATUSES.has(b.status ?? ''),
      ).length;
      const isOnline = ONLINE_STATUSES.has(d.status ?? '') || activeTours > 0;
      const capacity = 2;
      const loadPct = isOnline ? Math.min(100, Math.round((activeTours / capacity) * 100)) : 0;
      let status: DriverLoad['status'] = 'offline';
      if (isOnline) {
        if (activeTours === 0) status = 'available';
        else if (loadPct < 80) status = 'busy';
        else status = 'overloaded';
      }
      return { id, name, activeTours, capacity, loadPct, status };
    });
  }, [batches, drivers]);

  const onlineRows = rows.filter((r) => r.status !== 'offline');
  const overloaded = onlineRows.filter((r) => r.status === 'overloaded').length;
  const available = onlineRows.filter((r) => r.status === 'available').length;

  if (onlineRows.length === 0) return null;

  const STATUS_CFG = {
    available:  { label: 'Frei',       dot: 'bg-matcha-500', text: 'text-matcha-700',  bar: 'bg-matcha-400' },
    busy:       { label: 'Im Einsatz', dot: 'bg-amber-400',  text: 'text-amber-700',   bar: 'bg-amber-400'  },
    overloaded: { label: 'Überlastet', dot: 'bg-red-500',    text: 'text-red-700',     bar: 'bg-red-500'    },
    offline:    { label: 'Offline',    dot: 'bg-muted',      text: 'text-muted-foreground', bar: 'bg-muted' },
  };

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Users className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider">Fahrer-Auslastung</span>
          {overloaded > 0 && (
            <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-black animate-pulse flex items-center gap-1">
              <AlertTriangle className="h-2.5 w-2.5" /> {overloaded} überlastet
            </span>
          )}
          {available > 0 && (
            <span className="rounded-full bg-matcha-100 text-matcha-700 px-2 py-0.5 text-[10px] font-bold flex items-center gap-1">
              <CheckCircle2 className="h-2.5 w-2.5" /> {available} frei
            </span>
          )}
          <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-bold ml-auto">
            {onlineRows.length} online
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 ml-2" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />}
      </button>

      {open && (
        <div className="border-t divide-y">
          {onlineRows.map((r) => {
            const cfg = STATUS_CFG[r.status];
            return (
              <div key={r.id} className="px-4 py-2.5 flex items-center gap-3">
                <div className={cn('h-2.5 w-2.5 rounded-full shrink-0', cfg.dot)} />
                <span className="text-xs font-semibold text-foreground w-24 truncate shrink-0">{r.name}</span>
                {/* Load bar */}
                <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', cfg.bar)}
                    style={{ width: `${r.loadPct}%` }}
                  />
                </div>
                <span className={cn('text-[10px] font-bold tabular-nums w-20 text-right shrink-0', cfg.text)}>
                  {r.activeTours}/{r.capacity} Touren
                </span>
                <span className={cn('text-[9px] rounded-full px-1.5 py-0.5 font-bold bg-muted', cfg.text)}>
                  {cfg.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
