'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, CloudOff, Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1327 — Offline-Modus-Indikator (Fahrer-App)
 *
 * Verbindungsstatus-Banner: online / offline / reconnecting.
 * Zählt ausstehende Aktionen aus localStorage.
 * Auto-Sync wenn wieder online.
 */

type ConnectionStatus = 'online' | 'offline' | 'reconnecting';

const PENDING_KEY = 'mise_pending_actions';

function getPendingCount(): number {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

interface Props {
  driverId: string;
  isOnline: boolean;
}

export function FahrerPhase1327OfflineModusIndikator({ driverId, isOnline: isOnlineProp }: Props) {
  const [status, setStatus] = useState<ConnectionStatus>(
    typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline'
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncedRef = useRef(false);

  useEffect(() => {
    setPendingCount(getPendingCount());
  }, []);

  const syncPendingActions = useCallback(async () => {
    const count = getPendingCount();
    if (count === 0) return;
    setSyncing(true);
    try {
      await new Promise(r => setTimeout(r, 800));
      localStorage.removeItem(PENDING_KEY);
      setPendingCount(0);
      setLastSync(new Date());
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    function handleOnline() {
      setStatus('reconnecting');
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        setStatus('online');
        syncedRef.current = false;
      }, 1500);
    }
    function handleOffline() {
      setStatus('offline');
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (status === 'online' && !syncedRef.current) {
      syncedRef.current = true;
      const pending = getPendingCount();
      if (pending > 0) {
        void syncPendingActions();
      }
    }
  }, [status, syncPendingActions]);

  const isReallyOnline = isOnlineProp && status !== 'offline';

  const statusConfig = {
    online: {
      icon: Wifi,
      label: 'Online',
      bg: 'bg-matcha-50 dark:bg-matcha-950/30',
      border: 'border-matcha-200 dark:border-matcha-800',
      text: 'text-matcha-700 dark:text-matcha-400',
      dot: 'bg-matcha-500',
    },
    reconnecting: {
      icon: RefreshCw,
      label: 'Verbindet…',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      border: 'border-amber-200 dark:border-amber-700',
      text: 'text-amber-700 dark:text-amber-400',
      dot: 'bg-amber-500',
    },
    offline: {
      icon: WifiOff,
      label: 'Offline',
      bg: 'bg-red-50 dark:bg-red-950/30',
      border: 'border-red-200 dark:border-red-700',
      text: 'text-red-700 dark:text-red-400',
      dot: 'bg-red-500',
    },
  } as const;

  const cfg = statusConfig[status];
  const StatusIcon = cfg.icon;

  if (status === 'online' && pendingCount === 0 && !syncing) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-matcha-50 dark:bg-matcha-950/30 border border-matcha-200 dark:border-matcha-800">
        <span className="h-1.5 w-1.5 rounded-full bg-matcha-500 flex-shrink-0" />
        <span className="text-[10px] font-medium text-matcha-700 dark:text-matcha-400">Online</span>
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border p-3 space-y-2', cfg.bg, cfg.border)}>
      <button
        onClick={() => setShowDetail(v => !v)}
        className="w-full flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full flex-shrink-0', cfg.dot,
            status === 'reconnecting' && 'animate-pulse'
          )} />
          <StatusIcon className={cn('h-4 w-4 flex-shrink-0',
            status === 'reconnecting' && 'animate-spin',
            cfg.text
          )} />
          <span className={cn('text-xs font-bold', cfg.text)}>
            {cfg.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="rounded-full bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5">
              {pendingCount}
            </span>
          )}
          {syncing && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          {lastSync && !syncing && (
            <CheckCircle2 className="h-3 w-3 text-matcha-500" />
          )}
        </div>
      </button>

      {showDetail && (
        <div className="space-y-2 pt-1 border-t border-current/10">
          {status === 'offline' && (
            <p className="text-[11px] text-red-700 dark:text-red-300">
              Keine Verbindung. Aktionen werden lokal gespeichert und nach Wiederverbindung übertragen.
            </p>
          )}
          {status === 'reconnecting' && (
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              Verbindung wird wiederhergestellt…
            </p>
          )}

          {pendingCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {pendingCount} ausstehende Aktion{pendingCount > 1 ? 'en' : ''}
              </span>
              {status !== 'offline' && (
                <button
                  onClick={syncPendingActions}
                  disabled={syncing}
                  className="inline-flex items-center gap-1 rounded-md bg-matcha-600 hover:bg-matcha-700 text-white text-[10px] font-bold px-2 py-1 transition disabled:opacity-50"
                >
                  {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  {syncing ? 'Wird synchronisiert…' : 'Jetzt synchronisieren'}
                </button>
              )}
            </div>
          )}

          {lastSync && (
            <p className="text-[10px] text-muted-foreground">
              Zuletzt synchronisiert: {lastSync.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          )}

          {pendingCount === 0 && status === 'online' && (
            <div className="flex items-center gap-1.5 text-[11px] text-matcha-600 dark:text-matcha-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Alle Aktionen synchronisiert
            </div>
          )}
        </div>
      )}
    </div>
  );
}
