'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, CheckCircle2, Clock, RefreshCw, Upload,
  WifiOff, Wifi, Database, Loader2,
} from 'lucide-react';

/* ── Types ──────────────────────────────────────────────────────── */

type SyncItem = {
  id: string;
  type: 'stop_complete' | 'proof_photo' | 'status_update' | 'feedback';
  payload: Record<string, unknown>;
  timestamp: string;
  attempts: number;
};

type SyncState = {
  online: boolean;
  pendingItems: SyncItem[];
  lastSyncAt: string | null;
  syncInProgress: boolean;
  totalSynced: number;
};

/* ── Offline storage helpers ────────────────────────────────────── */

const STORAGE_KEY = 'mise_offline_queue';

function readQueue(): SyncItem[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SyncItem[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: SyncItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch { /* quota exceeded — ignore */ }
}

function clearQueue() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export function enqueueOfflineAction(type: SyncItem['type'], payload: Record<string, unknown>) {
  const queue = readQueue();
  queue.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, type, payload, timestamp: new Date().toISOString(), attempts: 0 });
  writeQueue(queue);
}

/* ── Type label map ─────────────────────────────────────────────── */

const TYPE_LABELS: Record<SyncItem['type'], string> = {
  stop_complete:  'Stop abgeschlossen',
  proof_photo:    'Foto-Nachweis',
  status_update:  'Status-Update',
  feedback:       'Fahrer-Feedback',
};

/* ── Component ──────────────────────────────────────────────────── */

export function OfflineSyncManager() {
  const [state, setState] = useState<SyncState>({
    online: true,
    pendingItems: [],
    lastSyncAt: null,
    syncInProgress: false,
    totalSynced: 0,
  });
  const [expanded, setExpanded] = useState(false);
  const syncingRef = useRef(false);

  // Poll online status + queue
  useEffect(() => {
    function update() {
      setState((s) => ({
        ...s,
        online: navigator.onLine,
        pendingItems: readQueue(),
      }));
    }
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    const iv = setInterval(update, 5000);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      clearInterval(iv);
    };
  }, []);

  // Auto-sync when coming online
  const syncNow = useCallback(async () => {
    if (syncingRef.current) return;
    const queue = readQueue();
    if (queue.length === 0) return;

    syncingRef.current = true;
    setState((s) => ({ ...s, syncInProgress: true }));

    let synced = 0;
    const remaining: SyncItem[] = [];

    for (const item of queue) {
      try {
        // Map type to API endpoint
        const endpoint = item.type === 'stop_complete'
          ? '/api/delivery/tours/sync-stop'
          : item.type === 'proof_photo'
          ? '/api/delivery/tours/sync-proof'
          : item.type === 'status_update'
          ? '/api/delivery/driver/shift-status'
          : '/api/delivery/driver/feedback';

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...item.payload, _offline_id: item.id, _offline_ts: item.timestamp }),
        });

        if (res.ok) {
          synced++;
        } else {
          remaining.push({ ...item, attempts: item.attempts + 1 });
        }
      } catch {
        remaining.push({ ...item, attempts: item.attempts + 1 });
      }
    }

    writeQueue(remaining.filter((i) => i.attempts < 5));
    setState((s) => ({
      ...s,
      pendingItems: remaining,
      lastSyncAt: new Date().toISOString(),
      syncInProgress: false,
      totalSynced: s.totalSynced + synced,
    }));
    syncingRef.current = false;
  }, []);

  useEffect(() => {
    if (state.online && state.pendingItems.length > 0) {
      syncNow();
    }
  }, [state.online, state.pendingItems.length, syncNow]);

  const hasPending = state.pendingItems.length > 0;

  // Don't show if online and no pending items
  if (state.online && !hasPending && state.lastSyncAt === null) return null;

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden shadow-sm',
      !state.online ? 'border-amber-400' : hasPending ? 'border-blue-400' : 'border-matcha-300',
    )}>
      {/* Header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2.5',
          !state.online ? 'bg-amber-50' : hasPending ? 'bg-blue-50' : 'bg-matcha-50',
        )}
      >
        {!state.online
          ? <WifiOff className="h-4 w-4 text-amber-600 shrink-0" />
          : hasPending
          ? <Upload className="h-4 w-4 text-blue-600 shrink-0 animate-bounce" />
          : <Wifi className="h-4 w-4 text-matcha-600 shrink-0" />}

        <span className="flex-1 text-left text-xs font-bold">
          {!state.online
            ? 'Offline-Modus aktiv'
            : hasPending
            ? `Synchronisierung… ${state.pendingItems.length} offen`
            : 'Synchronisiert'}
        </span>

        {state.syncInProgress && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />}
        {!state.syncInProgress && hasPending && (
          <span className="rounded-full bg-blue-500 px-2 py-0.5 text-[9px] font-bold text-white">
            {state.pendingItems.length}
          </span>
        )}
        {!hasPending && state.lastSyncAt && (
          <CheckCircle2 className="h-3.5 w-3.5 text-matcha-600" />
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="bg-white divide-y divide-border">
          {/* Status row */}
          <div className="flex items-center gap-3 px-3 py-2 text-[11px]">
            <Database className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">
              {hasPending
                ? `${state.pendingItems.length} Aktionen in Warteschlange`
                : 'Keine ausstehenden Aktionen'}
            </span>
            {state.online && hasPending && !state.syncInProgress && (
              <button
                onClick={syncNow}
                className="ml-auto flex items-center gap-1 rounded-md bg-blue-500 px-2 py-1 text-[10px] font-bold text-white hover:bg-blue-600"
              >
                <RefreshCw className="h-3 w-3" /> Jetzt sync
              </button>
            )}
          </div>

          {/* Pending items list */}
          {state.pendingItems.slice(0, 5).map((item) => (
            <div key={item.id} className="flex items-center gap-2 px-3 py-1.5">
              <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
              <span className="text-[10px] font-medium">{TYPE_LABELS[item.type]}</span>
              <span className="ml-auto text-[9px] text-muted-foreground flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" />
                {new Date(item.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </span>
              {item.attempts > 0 && (
                <span className="text-[9px] text-red-500">Versuch {item.attempts}</span>
              )}
            </div>
          ))}
          {state.pendingItems.length > 5 && (
            <div className="px-3 py-1 text-[10px] text-muted-foreground text-center">
              +{state.pendingItems.length - 5} weitere
            </div>
          )}

          {/* Last sync info */}
          {state.lastSyncAt && (
            <div className="px-3 py-1.5 text-[10px] text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-matcha-500" />
              Zuletzt sync: {new Date(state.lastSyncAt).toLocaleTimeString('de-DE')}
              {state.totalSynced > 0 && ` · ${state.totalSynced} übertragen`}
            </div>
          )}

          {!state.online && (
            <div className="px-3 py-2 bg-amber-50 text-[10px] text-amber-700 font-medium">
              Aktionen werden lokal gespeichert und beim nächsten Online-Gang automatisch übertragen.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
