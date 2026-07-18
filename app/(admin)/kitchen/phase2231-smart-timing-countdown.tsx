'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, AlertTriangle, CheckCircle2, Timer } from 'lucide-react';

type BatchUrgency = 'on_track' | 'due_soon' | 'overdue';

interface BatchCountdown {
  batchId: string;
  zone: string | null;
  ordersCount: number;
  estimatedPrepMin: number;
  elapsedMin: number;
  remainingMin: number;
  urgency: BatchUrgency;
  status: string;
  driverName: string | null;
}

interface Summary {
  activeBatches: number;
  overdueCount: number;
  dueSoonCount: number;
  avgRemainingMin: number | null;
}

interface ApiData {
  batches: BatchCountdown[];
  summary: Summary;
}

function urgencyColor(urgency: BatchUrgency) {
  if (urgency === 'overdue') return 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30';
  if (urgency === 'due_soon') return 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30';
  return 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30';
}

function urgencyDot(urgency: BatchUrgency) {
  if (urgency === 'overdue') return 'bg-red-500 animate-pulse';
  if (urgency === 'due_soon') return 'bg-yellow-500';
  return 'bg-green-500';
}

function urgencyText(urgency: BatchUrgency) {
  if (urgency === 'overdue') return 'text-red-700 dark:text-red-300';
  if (urgency === 'due_soon') return 'text-yellow-700 dark:text-yellow-300';
  return 'text-green-700 dark:text-green-300';
}

function CountdownRing({ remaining, total }: { remaining: number; total: number }) {
  const pct = Math.max(0, Math.min(100, total > 0 ? (remaining / total) * 100 : 0));
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = remaining <= 0 ? '#ef4444' : remaining <= 5 ? '#f59e0b' : '#22c55e';

  return (
    <svg width="44" height="44" className="shrink-0">
      <circle cx="22" cy="22" r={r} fill="none" stroke="currentColor" strokeWidth="3"
        className="text-gray-200 dark:text-gray-700" />
      <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 22 22)" />
      <text x="22" y="22" textAnchor="middle" dominantBaseline="central"
        fontSize="10" fontWeight="bold" fill={color}>
        {remaining <= 0 ? '!' : `${Math.round(remaining)}`}
      </text>
    </svg>
  );
}

export function KitchenPhase2231SmartTimingCountdown({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/kitchen-batch-countdown?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 60_000);
    const ticker = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => { clearInterval(poll); clearInterval(ticker); };
  }, [load]);

  const sorted = useMemo(() => {
    if (!data?.batches) return [];
    return [...data.batches].sort((a, b) => a.remainingMin - b.remainingMin);
  }, [data, tick]);

  if (!locationId || !data) return null;
  if (sorted.length === 0) return null;

  const { summary } = data;
  const hasAlert = summary.overdueCount > 0 || summary.dueSoonCount > 0;

  return (
    <div className={`rounded-xl border p-4 mb-3 ${hasAlert ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20' : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20'}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Timer className={`w-4 h-4 ${hasAlert ? 'text-red-500' : 'text-blue-500'}`} />
          <span className={`font-semibold ${hasAlert ? 'text-red-900 dark:text-red-200' : 'text-blue-900 dark:text-blue-200'}`}>
            Smart-Timing Countdown
          </span>
          {summary.overdueCount > 0 && (
            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {summary.overdueCount} überfällig
            </span>
          )}
          {summary.dueSoonCount > 0 && summary.overdueCount === 0 && (
            <span className="text-xs bg-yellow-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
              <Clock className="w-3 h-3" /> {summary.dueSoonCount} bald fertig
            </span>
          )}
        </div>
        {open
          ? <ChevronUp className={`w-4 h-4 ${hasAlert ? 'text-red-500' : 'text-blue-500'}`} />
          : <ChevronDown className={`w-4 h-4 ${hasAlert ? 'text-red-500' : 'text-blue-500'}`} />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="rounded-lg bg-white dark:bg-gray-800 px-3 py-2 text-center">
              <div className="text-lg font-bold text-gray-800 dark:text-white">{summary.activeBatches}</div>
              <div className="text-[10px] text-gray-500">Aktiv</div>
            </div>
            <div className="rounded-lg bg-yellow-100 dark:bg-yellow-900/30 px-3 py-2 text-center">
              <div className="text-lg font-bold text-yellow-700 dark:text-yellow-300">{summary.dueSoonCount}</div>
              <div className="text-[10px] text-yellow-600 dark:text-yellow-400">Bald fertig</div>
            </div>
            <div className="rounded-lg bg-red-100 dark:bg-red-900/30 px-3 py-2 text-center">
              <div className="text-lg font-bold text-red-600 dark:text-red-400">{summary.overdueCount}</div>
              <div className="text-[10px] text-red-500">Überfällig</div>
            </div>
          </div>

          <div className="space-y-2">
            {sorted.map((batch) => (
              <div key={batch.batchId} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${urgencyColor(batch.urgency)}`}>
                <CountdownRing remaining={batch.remainingMin} total={batch.estimatedPrepMin} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${urgencyDot(batch.urgency)}`} />
                    <span className={`text-sm font-semibold ${urgencyText(batch.urgency)}`}>
                      {batch.zone ? `Zone ${batch.zone}` : 'Kein Zone'} · {batch.ordersCount} Bestellung{batch.ordersCount !== 1 ? 'en' : ''}
                    </span>
                  </div>
                  {batch.driverName && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      🚴 {batch.driverName}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-xs font-bold ${urgencyText(batch.urgency)}`}>
                    {batch.remainingMin <= 0 ? 'ÜBERFÄLLIG' : `${Math.round(batch.remainingMin)} Min`}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {batch.elapsedMin > 0 ? `${Math.round(batch.elapsedMin)} Min. gelaufen` : 'Gestartet'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {summary.avgRemainingMin !== null && (
            <p className="text-xs text-center text-gray-500 dark:text-gray-400 pt-1">
              Ø Verbleibend: {Math.round(summary.avgRemainingMin)} Min · Grün &gt;5 · Gelb 1–5 · Rot &lt;1 Min
            </p>
          )}
        </div>
      )}
    </div>
  );
}
