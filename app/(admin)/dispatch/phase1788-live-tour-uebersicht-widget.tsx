'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, MapPin, RefreshCw, Truck } from 'lucide-react';

/**
 * Phase 1788 — Live-Tour-Übersicht-Widget (Dispatch)
 *
 * Aktive Fahrer mit Zone, offenen Stopps und ETA — kompakte Karten.
 * Nutzt /api/delivery/admin/live-touren-karte (Phase 1248).
 * 2-Min-Polling.
 */

interface FahrerPunkt {
  fahrer_id: string;
  fahrer_name: string;
  zone: string | null;
  on_tour: boolean;
  offene_stopps: number;
  naechster_stopp_adresse: string | null;
  eta_min: number | null;
  status: 'frei' | 'aktiv' | 'abweichend';
}

interface ApiResponse {
  fahrer: FahrerPunkt[];
  aktive_fahrer: number;
  freie_fahrer: number;
  offene_stopps_gesamt: number;
  location_id: string;
  generiert_am: string;
}

const STATUS_STYLE: Record<string, { label: string; dot: string; row: string }> = {
  aktiv: { label: 'Aktiv', dot: 'bg-matcha-500', row: 'border-matcha-200 dark:border-matcha-800' },
  abweichend: { label: 'Abweichung', dot: 'bg-amber-400', row: 'border-amber-200 dark:border-amber-800' },
  frei: { label: 'Frei', dot: 'bg-muted-foreground/50', row: 'border-border' },
};

interface Props {
  locationId: string | null;
  className?: string;
}

export function DispatchPhase1788LiveTourUebersichtWidget({ locationId, className }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/live-touren-karte?location_id=${locationId}`);
      if (res.ok) {
        setData(await res.json());
        setLastUpdate(new Date());
      }
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 2 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!data) return null;

  const aktiveFahrer = data.fahrer.filter(f => f.on_tour);
  const freieFahrer = data.fahrer.filter(f => !f.on_tour);

  return (
    <div className={cn('rounded-xl border bg-card text-card-foreground shadow-sm', className)}>
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3"
      >
        <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="flex-1 text-left text-sm font-bold">Live-Tour-Übersicht</span>
        {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground mr-1" />}
        <span className="text-xs font-bold text-matcha-600 dark:text-matcha-400 mr-1">
          {data.aktive_fahrer} aktiv
        </span>
        <span className="text-xs text-muted-foreground mr-1">
          · {data.offene_stopps_gesamt} Stopps
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {/* KPI-Zeile */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: 'Aktive Fahrer', value: data.aktive_fahrer, color: 'text-matcha-600 dark:text-matcha-400' },
              { label: 'Freie Fahrer', value: data.freie_fahrer, color: 'text-muted-foreground' },
              { label: 'Offene Stopps', value: data.offene_stopps_gesamt, color: 'text-saffron' },
            ].map(kpi => (
              <div key={kpi.label} className="rounded-lg bg-muted/40 px-3 py-2 text-center">
                <p className={cn('text-lg font-bold', kpi.color)}>{kpi.value}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{kpi.label}</p>
              </div>
            ))}
          </div>

          {/* Fahrer-Karten (aktiv zuerst) */}
          {[...aktiveFahrer, ...freieFahrer].map(f => {
            const s = STATUS_STYLE[f.status] ?? STATUS_STYLE.frei;
            return (
              <div
                key={f.fahrer_id}
                className={cn('flex items-start gap-3 rounded-lg border px-3 py-2.5', s.row)}
              >
                <span className={cn('h-2 w-2 rounded-full mt-1 shrink-0', s.dot)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold truncate">{f.fahrer_name}</p>
                    {f.zone && (
                      <span className="text-[10px] text-muted-foreground border border-border rounded px-1">
                        {f.zone}
                      </span>
                    )}
                  </div>
                  {f.on_tour && f.naechster_stopp_adresse && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                      <p className="text-[10px] text-muted-foreground truncate">
                        {f.naechster_stopp_adresse}
                      </p>
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {f.on_tour ? (
                    <>
                      <p className="text-xs font-bold text-saffron">{f.offene_stopps} Stopp{f.offene_stopps !== 1 ? 's' : ''}</p>
                      {f.eta_min !== null && (
                        <p className="text-[10px] text-muted-foreground">ETA {f.eta_min} Min</p>
                      )}
                    </>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  )}
                </div>
              </div>
            );
          })}

          {lastUpdate && (
            <p className="text-[10px] text-muted-foreground text-right pt-1">
              Aktualisiert {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
