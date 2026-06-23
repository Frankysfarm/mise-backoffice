'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { WifiOff, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const QUEUE_KEY = 'mise_offline_queue';

interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  body: string | null;
  headers: Record<string, string>;
  queuedAt: string;
}

function getQueue(): QueuedRequest[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveQueue(q: QueuedRequest[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function addToOfflineQueue(url: string, method: string, body: unknown, headers?: Record<string, string>) {
  const q = getQueue();
  q.push({
    id: crypto.randomUUID(),
    url,
    method,
    body: body ? JSON.stringify(body) : null,
    headers: headers ?? { 'Content-Type': 'application/json' },
    queuedAt: new Date().toISOString(),
  });
  saveQueue(q);
}

export function FahrerOfflineSyncBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: number; fail: number } | null>(null);
  const syncResultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshQueueCount = useCallback(() => {
    setQueueCount(getQueue().length);
  }, []);

  const replayQueue = useCallback(async () => {
    const q = getQueue();
    if (q.length === 0) return;
    setSyncing(true);
    setSyncResult(null);

    let ok = 0;
    let fail = 0;
    const remaining: QueuedRequest[] = [];

    for (const item of q) {
      try {
        const res = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body,
        });
        if (res.ok) {
          ok++;
        } else {
          fail++;
          remaining.push(item);
        }
      } catch {
        fail++;
        remaining.push(item);
      }
    }

    saveQueue(remaining);
    setQueueCount(remaining.length);
    setSyncing(false);
    setSyncResult({ ok, fail });

    if (syncResultTimer.current) clearTimeout(syncResultTimer.current);
    syncResultTimer.current = setTimeout(() => setSyncResult(null), 5_000);
  }, []);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      // Auto-replay when back online
      setTimeout(() => replayQueue(), 500);
    };
    const onOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);
    refreshQueueCount();

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // Refresh queue count every 10s
    const iv = setInterval(refreshQueueCount, 10_000);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      clearInterval(iv);
      if (syncResultTimer.current) clearTimeout(syncResultTimer.current);
    };
  }, [replayQueue, refreshQueueCount]);

  // Nothing to show when online and no queue
  if (isOnline && queueCount === 0 && !syncResult) return null;

  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-3 flex items-center gap-3 transition-all duration-300',
        !isOnline
          ? 'bg-orange-900/80 border-orange-700/50 text-orange-100'
          : syncResult
            ? syncResult.fail === 0
              ? 'bg-matcha-900/80 border-matcha-700/50 text-matcha-100'
              : 'bg-red-900/80 border-red-700/50 text-red-100'
            : 'bg-amber-900/80 border-amber-700/50 text-amber-100',
      )}
    >
      {!isOnline && (
        <>
          <WifiOff className="h-5 w-5 shrink-0 text-orange-300" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold">Kein Internet</div>
            <div className="text-xs opacity-80">
              {queueCount > 0
                ? `${queueCount} Aktion${queueCount !== 1 ? 'en' : ''} gespeichert — werden beim Reconnect gesendet`
                : 'Aktionen werden zwischengespeichert'}
            </div>
          </div>
        </>
      )}

      {isOnline && queueCount > 0 && !syncResult && (
        <>
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold">{queueCount} ausstehende Aktionen</div>
            <div className="text-xs opacity-80">Offline gespeichert — jetzt synchronisieren?</div>
          </div>
          <button
            onClick={() => replayQueue()}
            disabled={syncing}
            className="shrink-0 flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-400 disabled:opacity-60 transition"
          >
            {syncing
              ? <RefreshCw className="h-3 w-3 animate-spin" />
              : <RefreshCw className="h-3 w-3" />
            }
            {syncing ? 'Sync…' : 'Jetzt sync'}
          </button>
        </>
      )}

      {isOnline && syncResult && (
        <>
          {syncResult.fail === 0
            ? <CheckCircle2 className="h-5 w-5 shrink-0 text-matcha-300" />
            : <AlertTriangle className="h-5 w-5 shrink-0 text-red-300" />
          }
          <div className="text-sm font-bold">
            {syncResult.fail === 0
              ? `${syncResult.ok} Aktionen erfolgreich synchronisiert ✓`
              : `${syncResult.ok} OK · ${syncResult.fail} fehlgeschlagen`
            }
          </div>
        </>
      )}
    </div>
  );
}
