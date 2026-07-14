'use client';

import React, { useMemo, useState } from 'react';

interface Stop {
  id: string;
  geliefert_am?: string | null;
}

interface BatchInput {
  id: string;
  status: string;
  fahrer_id?: string | null;
  zone?: string | null;
  startzeit?: string | null;
  total_eta_min?: number | null;
  stops?: Stop[];
}

interface DriverInput {
  employee_id: string;
  employee?: { vorname: string; nachname: string } | null;
}

interface Props {
  batches: BatchInput[];
  drivers: DriverInput[];
}

type Health = 'on_time' | 'tight' | 'late' | 'unknown';

const HEALTH: Record<Health, { bar: string; badge: string; badgeText: string; label: string }> = {
  on_time: { bar: 'bg-emerald-400', badge: 'bg-emerald-100 border-emerald-300 text-emerald-800', badgeText: 'bg-emerald-500 text-white', label: 'Pünktlich' },
  tight:   { bar: 'bg-amber-400',   badge: 'bg-amber-50  border-amber-300   text-amber-800',   badgeText: 'bg-amber-400 text-white',   label: 'Knapp' },
  late:    { bar: 'bg-rose-500',    badge: 'bg-rose-50   border-rose-300    text-rose-800',    badgeText: 'bg-rose-600 text-white',    label: 'Verspätet' },
  unknown: { bar: 'bg-gray-300',    badge: 'bg-gray-50   border-gray-200    text-gray-600',    badgeText: 'bg-gray-400 text-white',    label: 'Unbekannt' },
};

function score(h: Health, stopsDone: number, stopsTotal: number): number {
  const base = h === 'on_time' ? 100 : h === 'tight' ? 70 : h === 'late' ? 40 : 50;
  const progress = stopsTotal > 0 ? (stopsDone / stopsTotal) * 20 : 0;
  return Math.min(100, Math.round(base + progress - (h === 'late' ? 20 : 0)));
}

export function DispatchPhase1584TourScoreVisualisierungsCockpit({ batches, drivers }: Props) {
  const [open, setOpen] = useState(true);

  const rows = useMemo(() => {
    const now = Date.now();
    const ACTIVE = ['unterwegs', 'on_route', 'gestartet', 'dispatched'];
    return batches
      .filter((b) => ACTIVE.includes(b.status))
      .map((b) => {
        const driver = drivers.find((d) => d.employee_id === (b.fahrer_id ?? ''));
        const name = driver?.employee
          ? `${driver.employee.vorname} ${driver.employee.nachname[0]}.`
          : 'Fahrer';
        const total = b.stops?.length ?? 0;
        const done = b.stops?.filter((s) => s.geliefert_am).length ?? 0;
        const elapsed = b.startzeit ? (now - new Date(b.startzeit).getTime()) / 60_000 : 0;
        const eta = b.total_eta_min ?? null;
        const remain = eta !== null ? Math.max(0, eta - elapsed) : null;
        let health: Health = 'unknown';
        if (eta !== null) {
          const timePct = elapsed / eta;
          const donePct = total > 0 ? done / total : 0;
          if (timePct - donePct > 0.3) health = 'late';
          else if (timePct - donePct > 0.1) health = 'tight';
          else health = 'on_time';
        }
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        const sc = score(health, done, total);
        return { id: b.id, name, zone: b.zone, total, done, elapsed: Math.floor(elapsed), remain: remain !== null ? Math.floor(remain) : null, health, pct, sc };
      })
      .sort((a, b) => a.sc - b.sc);
  }, [batches, drivers]);

  if (!open || rows.length === 0) return null;

  const avgScore = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.sc, 0) / rows.length) : 0;
  const lateCount = rows.filter((r) => r.health === 'late').length;

  return (
    <div className="rounded-xl border border-matcha-200 bg-white overflow-hidden mb-4">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-matcha-50 border-b border-matcha-200">
        <span className="text-xs font-bold uppercase tracking-wider text-matcha-800">Tour-Score-Cockpit</span>
        <span className="rounded-full bg-matcha-600 text-white px-2 py-0.5 text-[10px] font-black">Ø {avgScore}</span>
        {lateCount > 0 && (
          <span className="rounded-full bg-rose-500 text-white px-2 py-0.5 text-[10px] font-black animate-pulse">
            {lateCount} verspätet
          </span>
        )}
        <button onClick={() => setOpen(false)} className="ml-auto text-base leading-none text-muted-foreground hover:text-foreground">×</button>
      </div>

      <div className="divide-y">
        {rows.map((r) => {
          const h = HEALTH[r.health];
          return (
            <div key={r.id} className={`flex items-center gap-3 px-4 py-3 ${h.badge} border-0`}>
              {/* Score ring */}
              <div className="relative shrink-0 h-10 w-10">
                <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-black/10" />
                  <circle
                    cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3"
                    strokeDasharray={`${(r.sc / 100) * 94.2} 94.2`}
                    className={r.health === 'on_time' ? 'text-emerald-500' : r.health === 'tight' ? 'text-amber-400' : 'text-rose-500'}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black">
                  {r.sc}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold truncate">{r.name}</span>
                  {r.zone && (
                    <span className="text-[9px] rounded-full bg-white/70 border px-1.5 font-bold">Zone {r.zone}</span>
                  )}
                  <span className={`text-[9px] font-black rounded-full px-1.5 py-0.5 ${h.badgeText}`}>
                    {h.label}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${h.bar}`}
                      style={{ width: `${r.pct}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-bold tabular-nums shrink-0 text-muted-foreground">
                    {r.done}/{r.total} Stops
                  </span>
                </div>
              </div>

              {/* Time */}
              <div className="shrink-0 text-right">
                <div className="font-mono text-sm font-black tabular-nums">{r.elapsed}m</div>
                {r.remain !== null && (
                  <div className={`text-[9px] font-bold tabular-nums ${r.health === 'late' ? 'text-rose-600' : r.health === 'tight' ? 'text-amber-600' : 'text-muted-foreground'}`}>
                    ~{r.remain}m verbl.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-muted/30 flex items-center gap-4 text-[10px] text-muted-foreground border-t">
        {(['on_time', 'tight', 'late'] as Health[]).map((h) => {
          const count = rows.filter((r) => r.health === h).length;
          return (
            <span key={h} className="flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${HEALTH[h].bar}`} />
              {HEALTH[h].label}: {count}
            </span>
          );
        })}
      </div>
    </div>
  );
}
