'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Phase 1695 — Schicht-Rangliste-Vorschau (Fahrer-App)
 *
 * Eigener Rang + die 2 direkt über/unter dem Fahrer + Punktabstand; 20-Min-Polling; isOnline-Guard.
 */

interface RangEintrag {
  rang: number;
  fahrer_id: string;
  fahrer_name: string;
  punkte: number;
  stopps: number;
  sla_pct: number;
}

interface ApiData {
  rangliste: RangEintrag[];
  eigener_rang: number | null;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

const POLL_MS = 20 * 60 * 1000;

const RANG_BADGE: Record<number, string> = {
  1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  2: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  3: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
};

export function FahrerPhase1695SchichtRanglisteVorschau({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!driverId || !locationId) return;
    setLoading(true);
    try {
      const url = `/api/delivery/admin/schicht-rangliste?location_id=${encodeURIComponent(locationId)}&driver_id=${encodeURIComponent(driverId)}`;
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, POLL_MS);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, locationId]);

  if (!isOnline || !driverId) return null;

  const eigenerRang = data?.eigener_rang ?? null;
  const rangliste   = data?.rangliste ?? [];

  // Zeige Einträge: die 2 über dem Fahrer + eigener + 2 darunter
  const visibleRows = (() => {
    if (!eigenerRang || !rangliste.length) return rangliste.slice(0, 5);
    const idx = rangliste.findIndex(r => r.rang === eigenerRang);
    if (idx < 0) return rangliste.slice(0, 5);
    const from = Math.max(0, idx - 2);
    const to   = Math.min(rangliste.length, idx + 3);
    return rangliste.slice(from, to);
  })();

  return (
    <div className="rounded-xl border border-border bg-card p-3 mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left"
      >
        <Trophy className={cn(
          'h-4 w-4 shrink-0',
          eigenerRang === 1 ? 'text-yellow-500' : eigenerRang && eigenerRang <= 3 ? 'text-amber-500' : 'text-matcha-500',
        )} />
        <span className="text-sm font-semibold flex-1 text-foreground">Schicht-Rangliste</span>
        {eigenerRang && (
          <span className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-black',
            RANG_BADGE[eigenerRang] ?? 'bg-muted text-foreground',
          )}>
            Rang #{eigenerRang}
          </span>
        )}
        {loading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3">
          {visibleRows.length > 0 ? (
            <div className="space-y-1.5">
              {visibleRows.map(r => {
                const isMe = r.fahrer_id === driverId;
                const delta = eigenerRang !== null && !isMe
                  ? r.rang < eigenerRang
                    ? `${data!.rangliste.find(x => x.rang === eigenerRang)!.punkte - r.punkte} Pkt zurück`
                    : `+${r.punkte - data!.rangliste.find(x => x.rang === eigenerRang)!.punkte} Pkt vorne`
                  : null;

                return (
                  <div
                    key={r.fahrer_id}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-2.5 py-2',
                      isMe
                        ? 'bg-matcha-50 dark:bg-matcha-950 border border-matcha-300 dark:border-matcha-700'
                        : 'bg-muted/40',
                    )}
                  >
                    <span className={cn(
                      'text-sm font-black w-6 text-center tabular-nums shrink-0',
                      RANG_BADGE[r.rang]
                        ? r.rang === 1 ? 'text-yellow-500' : r.rang === 2 ? 'text-slate-500' : 'text-orange-500'
                        : 'text-muted-foreground',
                    )}>
                      {r.rang}
                    </span>
                    <span className={cn(
                      'flex-1 text-xs font-medium truncate',
                      isMe ? 'text-matcha-700 dark:text-matcha-300 font-bold' : 'text-foreground',
                    )}>
                      {isMe ? 'Du' : r.fahrer_name}
                    </span>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-black tabular-nums text-foreground">{r.punkte} Pkt</div>
                      {delta && !isMe && (
                        <div className={cn(
                          'text-[9px] tabular-nums',
                          r.rang < (eigenerRang ?? 0) ? 'text-amber-500' : 'text-matcha-500',
                        )}>
                          {delta}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-3">
              {loading ? 'Rangliste wird geladen…' : 'Noch keine Daten.'}
            </div>
          )}

          <p className="text-[9px] text-muted-foreground pt-2 mt-1 border-t border-border">
            Punkte = SLA 60% + Stopps + Ø Lieferzeit · aktualisiert alle 20 Min
          </p>
        </div>
      )}
    </div>
  );
}
