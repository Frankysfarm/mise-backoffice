'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Clock, AlertTriangle } from 'lucide-react';

interface QueueEntry {
  id: string;
  order_id: string;
  cook_start_at: string;
  ready_target: string;
  prep_min: number;
  status: string;
  overdue: boolean;
}

interface Props {
  locationId: string;
}

function getSecondsUntil(iso: string): number {
  return Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
}

function formatCountdown(seconds: number): string {
  const abs = Math.abs(seconds);
  const mm = String(Math.floor(abs / 60)).padStart(2, '0');
  const ss = String(abs % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function getColorClass(entry: QueueEntry, secondsUntilCook: number): string {
  if (entry.overdue) return 'border-red-500 bg-red-50';
  if (secondsUntilCook < 120) return 'border-red-400 bg-red-50';
  if (secondsUntilCook < 300) return 'border-amber-400 bg-amber-50';
  return 'border-emerald-400 bg-emerald-50';
}

function getTimerColor(entry: QueueEntry, secondsUntilCook: number): string {
  if (entry.overdue) return 'text-red-600';
  if (secondsUntilCook < 120) return 'text-red-500';
  if (secondsUntilCook < 300) return 'text-amber-600';
  return 'text-emerald-600';
}

export function KitchenQueueCountdownBoard({ locationId }: Props) {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/kitchen/queue?location_id=${locationId}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();
      const now = Date.now();
      const filtered = (data.queue ?? []).filter((entry: QueueEntry) => {
        const msCookStart = new Date(entry.cook_start_at).getTime() - now;
        const minUntilCook = msCookStart / 60000;
        return entry.overdue || minUntilCook <= 20;
      });
      filtered.sort((a: QueueEntry, b: QueueEntry) => {
        if (a.overdue && !b.overdue) return -1;
        if (!a.overdue && b.overdue) return 1;
        return new Date(a.cook_start_at).getTime() - new Date(b.cook_start_at).getTime();
      });
      setQueue(filtered);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  // Poll every 15 seconds
  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 15_000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  // Tick every second for countdown display
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (loading) return null;
  if (queue.length === 0) return null;

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-100 bg-stone-50">
        <Clock className="w-4 h-4 text-stone-500" />
        <h2 className="text-sm font-semibold text-stone-700">Queue-Countdown</h2>
        <span className="ml-auto text-xs text-stone-400">{queue.length} Einträge</span>
      </div>

      {/* List */}
      <ul className="divide-y divide-stone-100">
        {queue.map((entry) => {
          const secondsUntilCook = getSecondsUntil(entry.cook_start_at);
          const readyTime = new Date(entry.ready_target).toLocaleTimeString('de-DE', {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <li
              key={entry.id}
              className={cn(
                'flex items-center gap-3 px-4 py-3 border-l-4 transition-all',
                getColorClass(entry, secondsUntilCook),
              )}
            >
              {/* Status label */}
              <div className="flex-shrink-0 w-28">
                {entry.overdue ? (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 text-xs font-bold uppercase text-red-600',
                      'animate-pulse',
                    )}
                  >
                    <AlertTriangle className="w-3 h-3" />
                    ÜBERFÄLLIG
                  </span>
                ) : (
                  <span className="text-xs text-stone-500 uppercase font-medium">
                    {entry.status === 'cooking'
                      ? 'Kocht'
                      : entry.status === 'ready'
                        ? 'Fertig'
                        : 'Geplant'}
                  </span>
                )}
              </div>

              {/* Order ID */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-800 truncate">
                  #{entry.order_id.slice(0, 8)}
                </p>
                <p className="text-xs text-stone-400">{entry.prep_min} Min Zubereitung</p>
              </div>

              {/* Countdown */}
              <div className="text-right flex-shrink-0">
                <p
                  className={cn(
                    'text-xl font-mono font-bold tabular-nums',
                    getTimerColor(entry, secondsUntilCook),
                  )}
                >
                  {entry.overdue ? '-' : ''}{formatCountdown(secondsUntilCook)}
                </p>
                <p className="text-xs text-stone-400">Fertig: {readyTime}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
