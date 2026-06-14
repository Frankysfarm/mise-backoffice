'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

type FailedReason = 'not_home' | 'access_denied' | 'wrong_address' | 'customer_refused' | 'other';
type FailedResolution = 'delivered' | 'returned_to_restaurant' | 'cancelled' | 'rescheduled';

interface PendingFailedAttempt {
  id: string;
  orderId: string;
  reason: FailedReason;
  attemptNumber: number;
  notes: string | null;
  nextAttemptAt: string | null;
  resolvedAt: string | null;
  resolution: FailedResolution | null;
  createdAt: string;
  bestellnummer: string | null;
  kundeName: string | null;
  kundeAdresse: string | null;
  kundeTelefon: string | null;
  gesamtbetrag: number | null;
  driverName: string | null;
}

interface FailedAttemptStats {
  total: number;
  pending: number;
  resolved: number;
  byReason: Partial<Record<FailedReason, number>>;
  byResolution: Partial<Record<FailedResolution, number>>;
}

const REASON_LABELS: Record<string, string> = {
  not_home: 'Niemand zuhause',
  access_denied: 'Zugang verweigert',
  wrong_address: 'Falsche Adresse',
  customer_refused: 'Kunde abgelehnt',
  other: 'Sonstiges',
};

const RESOLUTION_OPTIONS: { value: FailedResolution; label: string }[] = [
  { value: 'delivered', label: 'Doch geliefert' },
  { value: 'returned_to_restaurant', label: 'Zurück gebracht' },
  { value: 'cancelled', label: 'Storniert' },
  { value: 'rescheduled', label: 'Neu eingeplant' },
];

export function FailedAttemptsClient({ locationId }: { locationId: string }) {
  const [attempts, setAttempts] = useState<PendingFailedAttempt[]>([]);
  const [stats, setStats] = useState<FailedAttemptStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/delivery/admin/failed-attempts?action=list&location_id=${locationId}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/delivery/admin/failed-attempts?action=stats&location_id=${locationId}`).then(r => r.ok ? r.json() : null),
    ]).then(([listData, statsData]) => {
      if (listData?.attempts) setAttempts(listData.attempts as PendingFailedAttempt[]);
      if (statsData?.stats) setStats(statsData.stats as FailedAttemptStats);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  const resolve = async (attemptId: string, resolution: FailedResolution) => {
    setActing(attemptId);
    await fetch('/api/delivery/admin/failed-attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resolve', attempt_id: attemptId, resolution, location_id: locationId }),
    });
    setActing(null);
    load();
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Gesamt</div>
            <div className="font-display text-2xl font-black">{stats.total}</div>
          </div>
          <div className={cn('rounded-xl border px-4 py-3', stats.pending > 0 ? 'bg-amber-50 border-amber-200' : 'bg-card')}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Offen</div>
            <div className={cn('font-display text-2xl font-black', stats.pending > 0 ? 'text-amber-700' : '')}>{stats.pending}</div>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Aufgelöst</div>
            <div className="font-display text-2xl font-black">{stats.resolved}</div>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Häufigster Grund</div>
            <div className="text-sm font-bold mt-1">
              {Object.entries(stats.byReason).sort(([, a], [, b]) => b - a)[0]
                ? REASON_LABELS[Object.entries(stats.byReason).sort(([, a], [, b]) => b - a)[0][0]] ?? '—'
                : '—'}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Aktualisieren
        </button>
      </div>

      {loading && <div className="flex items-center justify-center py-16 text-muted-foreground">Lade fehlgeschlagene Versuche…</div>}

      {!loading && attempts.length === 0 && (
        <div className="flex items-center gap-2 justify-center py-16 text-muted-foreground text-sm">
          <CheckCircle2 className="h-4 w-4 text-matcha-600" />
          Keine offenen fehlgeschlagenen Zustellversuche.
        </div>
      )}

      {!loading && attempts.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="font-semibold text-sm">{attempts.length} offene Versuche</span>
          </div>
          <div className="divide-y divide-border">
            {attempts.map(a => (
              <div key={a.id} className="px-4 py-4">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-bold">#{a.bestellnummer ?? a.orderId.slice(0, 8)}</span>
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border bg-red-50 border-red-200 text-red-700">
                        {REASON_LABELS[a.reason] ?? a.reason}
                      </span>
                      <span className="text-[11px] text-muted-foreground">Versuch #{a.attemptNumber}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {a.kundeName ?? 'Unbekannt'}
                      {a.kundeAdresse ? ` · ${a.kundeAdresse}` : ''}
                      {a.gesamtbetrag !== null ? ` · ${euro(a.gesamtbetrag)}` : ''}
                    </div>
                    {a.notes && <div className="text-[11px] text-muted-foreground mt-1 italic">„{a.notes}"</div>}
                  </div>
                  {!a.resolvedAt && (
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      {RESOLUTION_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => resolve(a.id, opt.value)}
                          disabled={acting === a.id}
                          className="rounded-md border px-2 py-1 text-[11px] font-semibold bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50"
                        >
                          {acting === a.id ? '…' : opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
