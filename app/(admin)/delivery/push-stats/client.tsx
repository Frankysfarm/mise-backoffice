'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, Smartphone, Globe } from 'lucide-react';

interface ChannelStats {
  total_24h: number;
  delivered_24h: number;
  failed_24h: number;
  delivery_rate: number | null;
  pending_now: number;
}

interface PushStats {
  mise: ChannelStats;
  webpush: ChannelStats;
  type_breakdown: Record<string, number>;
  since: string;
}

export function PushStatsClient({ locationId }: { locationId: string }) {
  const [stats, setStats] = useState<PushStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch(`/api/delivery/admin/push-stats?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.mise) setStats(d as PushStats); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [locationId]);

  const renderChannel = (label: string, icon: React.ReactNode, ch: ChannelStats) => (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-matcha-100 text-matcha-800 flex items-center justify-center">{icon}</div>
        <div className="font-display font-bold">{label}</div>
        {ch.pending_now > 0 && (
          <span className="ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold border bg-amber-50 border-amber-200 text-amber-700">
            {ch.pending_now} ausstehend
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Gesamt 24h</div>
          <div className="font-display text-xl font-black mt-0.5">{ch.total_24h}</div>
        </div>
        <div className="rounded-lg bg-matcha-50 px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Zugestellt</div>
          <div className="font-display text-xl font-black text-matcha-700 mt-0.5">{ch.delivered_24h}</div>
        </div>
        <div className={cn('rounded-lg px-3 py-2', ch.failed_24h > 0 ? 'bg-red-50' : 'bg-muted/40')}>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Fehlgeschlagen</div>
          <div className={cn('font-display text-xl font-black mt-0.5', ch.failed_24h > 0 ? 'text-red-700' : '')}>{ch.failed_24h}</div>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Erfolgsrate</div>
          <div className="font-display text-xl font-black mt-0.5">
            {ch.delivery_rate !== null ? `${ch.delivery_rate} %` : '—'}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Aktualisieren
        </button>
        {stats && (
          <span className="text-xs text-muted-foreground">
            Seit {new Date(stats.since).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
          </span>
        )}
      </div>

      {loading && <div className="flex items-center justify-center py-16 text-muted-foreground">Lade Push-Statistiken…</div>}

      {!loading && stats && (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            {renderChannel('Mise Push (Expo/VoIP)', <Smartphone className="h-4 w-4" />, stats.mise)}
            {renderChannel('Web Push (VAPID)', <Globe className="h-4 w-4" />, stats.webpush)}
          </div>

          {Object.keys(stats.type_breakdown).length > 0 && (
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <div className="font-display font-bold text-sm">Push-Typen (letzte 24h)</div>
              <div className="space-y-1.5">
                {Object.entries(stats.type_breakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => {
                    const total = Object.values(stats.type_breakdown).reduce((s, n) => s + n, 0);
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={type} className="flex items-center gap-3">
                        <div className="w-36 text-xs font-medium truncate">{type}</div>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-matcha-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="w-12 text-xs text-right font-bold tabular-nums">{count}</div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
