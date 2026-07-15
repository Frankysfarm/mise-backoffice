'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, RefreshCw, Users, ShoppingBag } from 'lucide-react';

/**
 * Phase 1778 — Schicht-Auslastungs-Prognose-Widget (Dispatch)
 *
 * Phase1776-API: Liniendiagramm nächste 2h (4 Stunden-Slots) + Fahrerbedarf-Empfehlung.
 * 15-Min-Polling; in dispatch/client.tsx.
 */

interface StundenSlot {
  uhrzeit: string;
  prognose_bestellungen: number;
  empfohlene_fahrer: number;
  historischer_avg: number;
}

interface Antwort {
  slots: StundenSlot[];
  aktuell_aktive_bestellungen: number;
  aktuell_online_fahrer: number;
  location_id: string;
  generiert_am: string;
}

interface Props {
  locationId: string | null;
  className?: string;
}

const MAX_HEIGHT = 80;

function Bar({ value, max, label, isFirst }: { value: number; max: number; label: string; isFirst: boolean }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const height = Math.max(8, Math.round((pct / 100) * MAX_HEIGHT));
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={cn(
        'text-[10px] font-bold tabular-nums',
        isFirst ? 'text-saffron' : 'text-foreground',
      )}>
        {value}
      </span>
      <div className="flex items-end" style={{ height: MAX_HEIGHT }}>
        <div
          className={cn(
            'w-8 rounded-t-md transition-all',
            isFirst ? 'bg-saffron' : 'bg-matcha-400 dark:bg-matcha-600',
          )}
          style={{ height }}
        />
      </div>
      <span className="text-[9px] text-muted-foreground tabular-nums">{label}</span>
    </div>
  );
}

export function DispatchPhase1778SchichtAuslastungsPrognoseWidget({ locationId, className }: Props) {
  const [data, setData] = useState<Antwort | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  async function load() {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/schicht-auslastungs-prognose?location_id=${locationId}`);
      if (res.ok) {
        setData(await res.json());
        setLastFetch(new Date());
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const maxOrders = data ? Math.max(...data.slots.map(s => s.prognose_bestellungen), 1) : 1;

  return (
    <div className={cn('rounded-xl border border-border bg-card mb-3', className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-saffron" />
          <span className="text-sm font-bold">Schicht-Auslastungs-Prognose</span>
          {loading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        {lastFetch && (
          <span className="text-[10px] text-muted-foreground">
            {lastFetch.getHours().toString().padStart(2, '0')}:{lastFetch.getMinutes().toString().padStart(2, '0')} Uhr
          </span>
        )}
      </div>

      <div className="px-4 py-3 space-y-4">
        {/* Live-Status */}
        {data && (
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
              <ShoppingBag className="h-4 w-4 text-saffron shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Aktive Bestellungen</p>
                <p className="text-sm font-black tabular-nums">{data.aktuell_aktive_bestellungen}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
              <Users className="h-4 w-4 text-matcha-600 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Online Fahrer</p>
                <p className="text-sm font-black tabular-nums">{data.aktuell_online_fahrer}</p>
              </div>
            </div>
          </div>
        )}

        {/* Balkendiagramm Prognose */}
        {data && data.slots.length > 0 ? (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Prognose nächste Stunden
            </p>
            <div className="flex items-end justify-around gap-1">
              {data.slots.map((slot, i) => (
                <Bar
                  key={slot.uhrzeit}
                  value={slot.prognose_bestellungen}
                  max={maxOrders}
                  label={slot.uhrzeit}
                  isFirst={i === 0}
                />
              ))}
            </div>
          </div>
        ) : !loading && (
          <p className="text-sm text-muted-foreground text-center py-2">Keine Prognose-Daten verfügbar.</p>
        )}

        {/* Fahrerbedarf-Empfehlung */}
        {data && data.slots.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Empfohlene Fahrer je Slot
            </p>
            <div className="space-y-1.5">
              {data.slots.map((slot, i) => {
                const bedarf = slot.empfohlene_fahrer;
                const delta = bedarf - (data.aktuell_online_fahrer ?? 0);
                const ok = delta <= 0;
                return (
                  <div key={slot.uhrzeit} className="flex items-center gap-3">
                    <span className="w-12 shrink-0 text-[11px] font-bold tabular-nums text-muted-foreground">
                      {slot.uhrzeit}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          i === 0 ? 'bg-saffron' : ok ? 'bg-matcha-500' : 'bg-amber-400',
                        )}
                        style={{ width: `${Math.min(100, (bedarf / 8) * 100)}%` }}
                      />
                    </div>
                    <span className={cn(
                      'w-20 shrink-0 text-right text-[11px] font-bold tabular-nums',
                      ok ? 'text-matcha-700 dark:text-matcha-400' : 'text-amber-600 dark:text-amber-400',
                    )}>
                      {bedarf} Fahrer{!ok && ` (+${delta})`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!data && !loading && (
          <p className="text-sm text-muted-foreground text-center py-4">
            {locationId ? 'Prognose wird geladen…' : 'Bitte Filiale auswählen.'}
          </p>
        )}
      </div>
    </div>
  );
}
