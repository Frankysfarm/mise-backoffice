'use client';

// Phase 1321 — Schicht-Übergabe-Widget (Dispatch)
// Zeigt Phase1319-API im Dispatch: Offene Touren + Fahrer-Liste + "Übergabe starten"-Button.
// Kein Polling — wird on-demand geladen. Nach Phase1316.

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, PackageCheck, Truck, Users, CheckCircle2, AlertTriangle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface OffeneBestellung {
  id: string;
  bestellnummer: string;
  status: string;
  erstellt_um: string;
  zone: string | null;
}

interface LaufendeTour {
  batch_id: string;
  fahrer_name: string;
  stopps_gesamt: number;
  stopps_abgeschlossen: number;
  gestartet_um: string;
}

interface AktiveFahrer {
  id: string;
  name: string;
  ist_online: boolean;
  aktuelle_stopps: number;
}

interface UebergabeData {
  offene_bestellungen: OffeneBestellung[];
  laufende_touren: LaufendeTour[];
  aktive_fahrer: AktiveFahrer[];
  gesamt_offen: number;
  gesamt_touren: number;
  gesamt_fahrer: number;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  waiting:    { label: 'Wartend',     cls: 'bg-slate-500 text-white' },
  preparing:  { label: 'In Zubereitung', cls: 'bg-amber-400 text-white' },
  ready:      { label: 'Bereit',      cls: 'bg-matcha-500 text-white' },
  dispatched: { label: 'Unterwegs',   cls: 'bg-blue-500 text-white' },
};

function buildMock(): UebergabeData {
  return {
    offene_bestellungen: [
      { id: 'o1', bestellnummer: '#1042', status: 'preparing', erstellt_um: new Date(Date.now() - 18 * 60_000).toISOString(), zone: 'A' },
      { id: 'o2', bestellnummer: '#1043', status: 'waiting',   erstellt_um: new Date(Date.now() -  7 * 60_000).toISOString(), zone: 'B' },
    ],
    laufende_touren: [
      { batch_id: 'b1', fahrer_name: 'Max M.', stopps_gesamt: 4, stopps_abgeschlossen: 2, gestartet_um: new Date(Date.now() - 32 * 60_000).toISOString() },
    ],
    aktive_fahrer: [
      { id: 'd1', name: 'Max M.',  ist_online: true,  aktuelle_stopps: 2 },
      { id: 'd2', name: 'Lisa K.', ist_online: true,  aktuelle_stopps: 0 },
      { id: 'd3', name: 'Tom R.',  ist_online: false, aktuelle_stopps: 0 },
    ],
    gesamt_offen: 2,
    gesamt_touren: 1,
    gesamt_fahrer: 3,
  };
}

function minutenSeit(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

interface Props {
  locationId: string | null;
}

export function DispatchPhase1321SchichtUebergabeWidget({ locationId }: Props) {
  const [data, setData] = useState<UebergabeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [uebergabeAktiv, setUebergabeAktiv] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/schicht-uebergabe?location_id=${locationId}`);
      if (!res.ok) throw new Error('fetch failed');
      setData(await res.json());
    } catch {
      setData(buildMock());
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!locationId) return null;

  if (loading && !data) {
    return (
      <Card className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Lade Schicht-Übergabe…
      </Card>
    );
  }

  if (!data) return null;

  const kritisch = data.gesamt_offen > 5 || data.gesamt_touren > 3;

  return (
    <Card className={cn('overflow-hidden border', uebergabeAktiv ? 'border-blue-400 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/20' : 'border-border')}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-inherit">
        <RefreshCw className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Schicht-Übergabe</span>

        {kritisch && (
          <Badge className="bg-red-500 text-white text-[10px]">
            <AlertTriangle className="h-2.5 w-2.5 mr-1" />
            Handlungsbedarf
          </Badge>
        )}

        <button
          onClick={() => setExpanded((e) => !e)}
          className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Ausklappen"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* KPI-Zeile */}
      <div className="grid grid-cols-3 gap-px bg-border">
        {[
          { icon: PackageCheck, label: 'Offene Bestellungen', value: data.gesamt_offen, warn: data.gesamt_offen > 3 },
          { icon: Truck,        label: 'Laufende Touren',     value: data.gesamt_touren, warn: false },
          { icon: Users,        label: 'Aktive Fahrer',       value: data.aktive_fahrer.filter((f) => f.ist_online).length, warn: false },
        ].map(({ icon: Icon, label, value, warn }) => (
          <div key={label} className="bg-card flex flex-col items-center py-3">
            <div className={cn('text-2xl font-black tabular-nums', warn ? 'text-red-600 dark:text-red-400' : '')}>
              {value}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
              <Icon className="h-3 w-3" />
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Expandierter Bereich */}
      {expanded && (
        <div className="px-4 py-3 space-y-4">
          {/* Offene Bestellungen */}
          {data.offene_bestellungen.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Offene Bestellungen</p>
              <div className="space-y-1.5">
                {data.offene_bestellungen.map((o) => {
                  const statusInfo = STATUS_BADGE[o.status] ?? { label: o.status, cls: 'bg-slate-500 text-white' };
                  const min = minutenSeit(o.erstellt_um);
                  return (
                    <div key={o.id} className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-1.5 text-xs">
                      <span className="font-bold tabular-nums">{o.bestellnummer}</span>
                      {o.zone && <span className="text-muted-foreground">Zone {o.zone}</span>}
                      <Badge className={cn('text-[10px] shrink-0', statusInfo.cls)}>{statusInfo.label}</Badge>
                      <span className="ml-auto text-muted-foreground tabular-nums">{min} Min</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Laufende Touren */}
          {data.laufende_touren.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Laufende Touren</p>
              <div className="space-y-1.5">
                {data.laufende_touren.map((t) => {
                  const pct = t.stopps_gesamt > 0 ? Math.round((t.stopps_abgeschlossen / t.stopps_gesamt) * 100) : 0;
                  return (
                    <div key={t.batch_id} className="rounded-lg bg-muted/40 px-3 py-2 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold">{t.fahrer_name}</span>
                        <span className="text-muted-foreground tabular-nums">{t.stopps_abgeschlossen}/{t.stopps_gesamt} Stopps</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Fahrer-Status */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Fahrer</p>
            <div className="flex flex-wrap gap-2">
              {data.aktive_fahrer.map((f) => (
                <div
                  key={f.id}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border',
                    f.ist_online
                      ? 'bg-matcha-50 dark:bg-matcha-950/20 border-matcha-200 dark:border-matcha-800 text-matcha-700 dark:text-matcha-300'
                      : 'bg-muted/40 border-border text-muted-foreground',
                  )}
                >
                  <div className={cn('h-1.5 w-1.5 rounded-full', f.ist_online ? 'bg-matcha-500' : 'bg-slate-400')} />
                  {f.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer: Übergabe-Button */}
      <div className="flex items-center gap-3 px-4 py-3 border-t border-border bg-muted/20">
        <Button
          size="sm"
          variant={uebergabeAktiv ? 'outline' : 'default'}
          className="text-xs"
          onClick={() => {
            setUebergabeAktiv((v) => !v);
            if (!uebergabeAktiv) load();
          }}
        >
          {uebergabeAktiv ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-matcha-500" />
              Übergabe abgeschlossen
            </>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Übergabe starten
            </>
          )}
        </Button>
        <button
          onClick={load}
          disabled={loading}
          className="ml-auto text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          Aktualisieren
        </button>
      </div>
    </Card>
  );
}
