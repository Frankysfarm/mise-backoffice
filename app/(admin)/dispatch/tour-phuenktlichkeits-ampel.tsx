'use client';

import { useEffect, useState, useMemo } from 'react';
import { CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type BatchStop = { geliefert_am: string | null };
type Batch = {
  id: string;
  status: string;
  startzeit?: string | null;
  total_eta_min?: number | null;
  stops: BatchStop[];
  fahrer_id?: string | null;
  zone?: string | null;
};
type Driver = { employee_id: string; employee?: { vorname: string; nachname: string } | null };

interface Props { batches: Batch[]; drivers: Driver[] }

const ACTIVE = new Set(['unterwegs', 'on_route', 'gestartet', 'en_route', 'assigned', 'active']);

type Health = 'on-time' | 'tight' | 'late';

const STYLE: Record<Health, { bg: string; text: string; border: string; label: string; icon: React.ReactNode }> = {
  'on-time': { bg: 'bg-matcha-50', text: 'text-matcha-700', border: 'border-matcha-200', label: 'Pünktlich',  icon: <CheckCircle2 className="h-4 w-4" /> },
  'tight':   { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  label: 'Knapp',      icon: <Clock className="h-4 w-4" /> },
  'late':    { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    label: 'Verspätet',  icon: <AlertTriangle className="h-4 w-4 animate-pulse" /> },
};

function computeHealth(b: Batch, nowMs: number): Health {
  if (!b.startzeit || !b.total_eta_min) return 'on-time';
  const elapsedMin = (nowMs - new Date(b.startzeit).getTime()) / 60_000;
  const total = b.stops.length;
  const done  = b.stops.filter(s => s.geliefert_am).length;
  const usedFraction = elapsedMin / b.total_eta_min;
  const doneFraction = total > 0 ? done / total : 0;
  const delta = usedFraction - doneFraction;
  if (delta > 0.3) return 'late';
  if (delta > 0.1) return 'tight';
  return 'on-time';
}

export function DispatchTourPuenktlichkeitsAmpel({ batches, drivers }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(iv);
  }, []);

  const rows = useMemo(() => {
    return batches
      .filter(b => ACTIVE.has(b.status))
      .map(b => {
        const driver = drivers.find(d => d.employee_id === (b.fahrer_id ?? ''));
        const name = driver?.employee
          ? `${driver.employee.vorname} ${driver.employee.nachname[0]}.`
          : 'Fahrer';
        const health = computeHealth(b, now);
        const total = b.stops.length;
        const done  = b.stops.filter(s => s.geliefert_am).length;
        return { id: b.id, name, health, done, total, zone: b.zone };
      })
      .sort((a, b) => {
        const order: Health[] = ['late', 'tight', 'on-time'];
        return order.indexOf(a.health) - order.indexOf(b.health);
      });
  }, [batches, drivers, now]);

  if (rows.length === 0) return null;

  const counts: Record<Health, number> = { 'on-time': 0, tight: 0, late: 0 };
  rows.forEach(r => counts[r.health]++);

  return (
    <div className="rounded-xl border border-stone-100 bg-white overflow-hidden">
      <div className="flex items-center gap-2 border-b border-stone-100 px-4 py-2.5">
        <CheckCircle2 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold text-stone-700">Tour-Pünktlichkeits-Ampel</span>
        <div className="ml-auto flex items-center gap-2 text-[10px] font-bold">
          {counts.late > 0    && <span className="rounded-full bg-red-100    px-2 py-0.5 text-red-700">{counts.late} verspätet</span>}
          {counts.tight > 0   && <span className="rounded-full bg-amber-100  px-2 py-0.5 text-amber-700">{counts.tight} knapp</span>}
          {counts['on-time'] > 0 && <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-matcha-700">{counts['on-time']} pünktlich</span>}
        </div>
      </div>

      <div className="divide-y divide-stone-50">
        {rows.map(r => {
          const s = STYLE[r.health];
          return (
            <div key={r.id} className={cn('flex items-center gap-3 px-4 py-2.5', s.bg)}>
              <div className={cn('shrink-0', s.text)}>{s.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-800 truncate">{r.name}</span>
                  {r.zone && (
                    <span className="text-[9px] rounded-full bg-white/70 border border-stone-200 px-1.5 py-0.5 font-bold text-stone-500">
                      Zone {r.zone}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <div className="flex-1 h-1.5 max-w-[80px] rounded-full bg-black/10 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500',
                        r.health === 'late' ? 'bg-red-400' : r.health === 'tight' ? 'bg-amber-400' : 'bg-matcha-500')}
                      style={{ width: `${r.total > 0 ? Math.round((r.done / r.total) * 100) : 0}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-semibold text-stone-500 tabular-nums">{r.done}/{r.total} Stopps</span>
                </div>
              </div>
              <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black', s.bg, s.text, 'border', s.border)}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
