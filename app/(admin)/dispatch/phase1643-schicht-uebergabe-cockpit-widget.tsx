'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OffeneBestellung {
  id: string;
  bestellnummer: string;
  status: string;
  erstellt_um: string;
  zone: string | null;
}

interface AktiveTour {
  batch_id: string;
  fahrer_name: string;
  stopps_gesamt: number;
  stopps_abgeschlossen: number;
  gestartet_um: string;
}

interface FahrerStatus {
  id: string;
  name: string;
  ist_online: boolean;
  aktuelle_stopps: number;
  letzter_kontakt: string | null;
}

interface KuecheAuslastung {
  location_id: string;
  location_name: string;
  auslastungsgrad: number;
  status: 'niedrig' | 'normal' | 'hoch' | 'kritisch';
}

interface CockpitData {
  offene_bestellungen: OffeneBestellung[];
  aktive_touren: AktiveTour[];
  fahrer_status: FahrerStatus[];
  kuechen_auslastung: KuecheAuslastung[];
  gesamt_offen: number;
  gesamt_touren: number;
  gesamt_fahrer_online: number;
  gesamt_auslastung: number;
}

interface Props {
  locationId: string | null;
}

const AUSLASTUNG_STYLE: Record<string, string> = {
  niedrig: 'text-emerald-600',
  normal:  'text-blue-600',
  hoch:    'text-amber-600',
  kritisch: 'text-red-600',
};

function minutesAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

export function DispatchPhase1643SchichtUebergabeCockpitWidget({ locationId }: Props) {
  const [data, setData] = useState<CockpitData | null>(null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [lastFetch, setLastFetch] = useState<number | null>(null);

  const fetch = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await window.fetch(`/api/delivery/admin/schicht-uebergabe-cockpit?location_id=${locationId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastFetch(Date.now());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetch();
    const iv = setInterval(fetch, 10 * 60_000);
    return () => clearInterval(iv);
  }, [fetch]);

  if (!locationId) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">Schicht-Übergabe-Cockpit</span>
          {data && (
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-bold',
              data.gesamt_offen > 5 ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground',
            )}>
              {data.gesamt_offen} offen
            </span>
          )}
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-2">
          {lastFetch && (
            <span className="text-[10px] text-muted-foreground hidden sm:block">
              vor {Math.floor((Date.now() - lastFetch) / 60_000)} Min
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); fetch(); }}
            className="rounded p-1 hover:bg-muted transition"
            title="Aktualisieren"
          >
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-3">
          {!data && !loading && (
            <div className="text-sm text-muted-foreground text-center py-4">Keine Daten verfügbar.</div>
          )}

          {data && (
            <>
              {/* Schnellzahlen */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Offen', value: data.gesamt_offen, warn: data.gesamt_offen > 5 },
                  { label: 'Touren', value: data.gesamt_touren, warn: false },
                  { label: 'Fahrer online', value: data.gesamt_fahrer_online, warn: data.gesamt_fahrer_online === 0 },
                  { label: 'Auslastung', value: `${Math.round(data.gesamt_auslastung * 100)}%`, warn: data.gesamt_auslastung > 0.8 },
                ].map(({ label, value, warn }) => (
                  <div key={label} className={cn('rounded-lg border p-2 text-center', warn ? 'border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900' : 'border-border bg-muted/30')}>
                    <div className={cn('text-lg font-bold tabular-nums', warn ? 'text-red-700' : '')}>{value}</div>
                    <div className="text-[10px] text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>

              {/* Offene Bestellungen */}
              {data.offene_bestellungen.length > 0 && (
                <div>
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Offene Bestellungen</div>
                  <div className="space-y-1">
                    {data.offene_bestellungen.slice(0, 5).map((b) => (
                      <div key={b.id} className="flex items-center gap-2 text-xs">
                        <span className="font-bold w-16 shrink-0 truncate">{b.bestellnummer}</span>
                        <span className="text-muted-foreground capitalize flex-1 truncate">{b.status.replace('_', ' ')}</span>
                        {b.zone && <span className="rounded bg-muted px-1 py-0.5 text-[9px] font-semibold shrink-0">Z{b.zone}</span>}
                        <span className="text-muted-foreground tabular-nums shrink-0">{minutesAgo(b.erstellt_um)} Min</span>
                      </div>
                    ))}
                    {data.offene_bestellungen.length > 5 && (
                      <div className="text-[10px] text-muted-foreground">+{data.offene_bestellungen.length - 5} weitere</div>
                    )}
                  </div>
                </div>
              )}

              {/* Aktive Touren */}
              {data.aktive_touren.length > 0 && (
                <div>
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Aktive Touren</div>
                  <div className="space-y-1">
                    {data.aktive_touren.map((t) => {
                      const pct = t.stopps_gesamt > 0 ? (t.stopps_abgeschlossen / t.stopps_gesamt) * 100 : 0;
                      return (
                        <div key={t.batch_id} className="flex items-center gap-2 text-xs">
                          <span className="font-medium w-20 shrink-0 truncate">{t.fahrer_name}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="tabular-nums shrink-0 text-muted-foreground">{t.stopps_abgeschlossen}/{t.stopps_gesamt}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Fahrer Status */}
              {data.fahrer_status.length > 0 && (
                <div>
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fahrer-Status</div>
                  <div className="flex flex-wrap gap-1.5">
                    {data.fahrer_status.map((f) => (
                      <div
                        key={f.id}
                        className={cn(
                          'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                          f.ist_online ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', f.ist_online ? 'bg-emerald-500' : 'bg-muted-foreground')} />
                        {f.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Küchen-Auslastung */}
              {data.kuechen_auslastung.length > 0 && (
                <div>
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Küchen-Auslastung</div>
                  {data.kuechen_auslastung.map((k) => (
                    <div key={k.location_id} className="flex items-center gap-2 text-xs">
                      <span className="flex-1 truncate text-muted-foreground">{k.location_name}</span>
                      <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', k.status === 'kritisch' ? 'bg-red-500' : k.status === 'hoch' ? 'bg-amber-400' : 'bg-emerald-500')}
                          style={{ width: `${Math.round(k.auslastungsgrad * 100)}%` }}
                        />
                      </div>
                      <span className={cn('font-bold tabular-nums shrink-0', AUSLASTUNG_STYLE[k.status] ?? 'text-foreground')}>
                        {Math.round(k.auslastungsgrad * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
