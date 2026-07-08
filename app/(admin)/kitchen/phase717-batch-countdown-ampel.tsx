'use client';

import { useEffect, useMemo, useState } from 'react';

interface Order {
  id?: string;
  status?: string | null;
  created_at?: string | null;
  promised_at?: string | null;
}

interface Props {
  orders: Order[];
  deadlineMinuten?: number;
}

interface BatchRow {
  id: string;
  verblMs: number;
  status: 'ok' | 'warn' | 'kritisch';
  label: string;
}

function ampelClass(s: BatchRow['status']) {
  switch (s) {
    case 'ok': return 'bg-emerald-500';
    case 'warn': return 'bg-amber-500';
    case 'kritisch': return 'bg-red-500 animate-pulse';
  }
}

function formatVerbl(ms: number): string {
  if (ms <= 0) return '0:00';
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function KitchenPhase717BatchCountdownAmpel({ orders, deadlineMinuten = 25 }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(id);
  }, []);

  const batches = useMemo<BatchRow[]>(() => {
    const aktiv = orders.filter(
      (o) => o.status && ['confirmed', 'preparing'].includes(o.status) && (o.created_at || o.promised_at),
    );

    return aktiv
      .slice(0, 10)
      .map((o) => {
        const deadlineMs = o.promised_at
          ? new Date(o.promised_at).getTime()
          : new Date(o.created_at!).getTime() + deadlineMinuten * 60_000;
        const verblMs = deadlineMs - now;
        const verblMin = verblMs / 60_000;
        const status: BatchRow['status'] =
          verblMin <= 3 ? 'kritisch' : verblMin <= 8 ? 'warn' : 'ok';
        return {
          id: o.id ?? Math.random().toString(),
          verblMs,
          status,
          label: formatVerbl(verblMs),
        };
      })
      .sort((a, b) => a.verblMs - b.verblMs);
  }, [orders, now, deadlineMinuten]);

  if (batches.length === 0) return null;

  const kritischCount = batches.filter((b) => b.status === 'kritisch').length;

  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold">Batch-Countdown</span>
        {kritischCount > 0 && (
          <span className="text-[10px] font-bold text-red-600 dark:text-red-400 animate-pulse">
            {kritischCount} kritisch!
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {batches.map((b) => (
          <div
            key={b.id}
            className="flex items-center gap-1.5 rounded-lg border px-2 py-1"
          >
            <div className={`h-2 w-2 rounded-full shrink-0 ${ampelClass(b.status)}`} />
            <span className="text-[11px] font-bold tabular-nums">{b.label}</span>
          </div>
        ))}
      </div>
      <p className="text-[9px] text-muted-foreground mt-2">5s Update · Deadline {deadlineMinuten} Min ab Bestelleingang</p>
    </div>
  );
}
