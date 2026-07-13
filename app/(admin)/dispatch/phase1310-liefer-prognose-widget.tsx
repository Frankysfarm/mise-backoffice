'use client';

// Phase 1310 — Liefer-Prognose-Widget (Dispatch)
// ETA-Prognose je Zone + Engpass-Warnung aus liefer-prognose API
// 5-Min-Polling · locationId-Prop · nach Phase1306

import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, CheckCircle, Clock, RefreshCw, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

type EngpassStufe = 'ok' | 'warnung' | 'kritisch';

interface ZonePrognose {
  zone: string;
  eta_min: number;
  queue_laenge: number;
  aktive_fahrer: number;
  engpass: EngpassStufe;
  empfehlung: string | null;
}

interface LieferPrognose {
  zonen: ZonePrognose[];
  gesamt_eta_min: number;
  gesamt_engpass: EngpassStufe;
  aktive_fahrer_gesamt: number;
  offene_bestellungen: number;
  generiert_am: string;
}

const MOCK: LieferPrognose = {
  zonen: [
    { zone: 'A', eta_min: 18, queue_laenge: 4, aktive_fahrer: 2, engpass: 'ok',       empfehlung: null },
    { zone: 'B', eta_min: 28, queue_laenge: 7, aktive_fahrer: 2, engpass: 'warnung',  empfehlung: 'Fahrer-Auslastung erhöht.' },
    { zone: 'C', eta_min: 42, queue_laenge: 6, aktive_fahrer: 1, engpass: 'kritisch', empfehlung: 'Sofort weiteren Fahrer einsetzen!' },
    { zone: 'D', eta_min: 22, queue_laenge: 3, aktive_fahrer: 1, engpass: 'ok',       empfehlung: null },
  ],
  gesamt_eta_min: 27,
  gesamt_engpass: 'warnung',
  aktive_fahrer_gesamt: 6,
  offene_bestellungen: 20,
  generiert_am: new Date().toISOString(),
};

const POLL_MS = 5 * 60 * 1000;

const ENGPASS_CFG: Record<EngpassStufe, { bg: string; border: string; text: string; badge: string; dot: string }> = {
  ok:       { bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-300', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300', dot: 'bg-emerald-500' },
  warnung:  { bg: 'bg-amber-50 dark:bg-amber-950/20',   border: 'border-amber-200 dark:border-amber-800',   text: 'text-amber-700 dark:text-amber-300',   badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',   dot: 'bg-amber-500' },
  kritisch: { bg: 'bg-red-50 dark:bg-red-950/20',       border: 'border-red-200 dark:border-red-800',       text: 'text-red-700 dark:text-red-300',       badge: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',           dot: 'bg-red-500' },
};

interface Props {
  locationId: string | null;
}

export function DispatchPhase1310LieferPrognoseWidget({ locationId }: Props) {
  const [data, setData] = useState<LieferPrognose | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/liefer-prognose?location_id=${locationId}`);
      setData(res.ok ? await res.json() : MOCK);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  if (!locationId) return null;

  const gesamtCfg = ENGPASS_CFG[data?.gesamt_engpass ?? 'ok'];

  return (
    <div className={cn('rounded-xl border p-3 mb-3', gesamtCfg.bg, gesamtCfg.border)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Truck className={cn('h-4 w-4', gesamtCfg.text)} />
          <span className={cn('text-xs font-bold', gesamtCfg.text)}>Liefer-Prognose</span>
          {data && (
            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', gesamtCfg.badge)}>
              Ø {data.gesamt_eta_min} Min
            </span>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded p-1 hover:bg-black/5 dark:hover:bg-white/10 transition"
          aria-label="Aktualisieren"
        >
          <RefreshCw className={cn('h-3 w-3 text-muted-foreground', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Gesamt-Header */}
      {data && (
        <div className="flex items-center gap-3 mb-2 pb-2 border-b border-current/10">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">{data.offene_bestellungen} Bestellungen</span>
          </div>
          <div className="flex items-center gap-1">
            <Truck className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">{data.aktive_fahrer_gesamt} Fahrer aktiv</span>
          </div>
          {data.gesamt_engpass !== 'ok' && (
            <span className={cn('flex items-center gap-1 text-[10px] font-bold ml-auto', gesamtCfg.text)}>
              <AlertTriangle className="h-3 w-3" />
              {data.gesamt_engpass === 'kritisch' ? 'KRITISCH' : 'WARNUNG'}
            </span>
          )}
          {data.gesamt_engpass === 'ok' && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 ml-auto">
              <CheckCircle className="h-3 w-3" />
              Stabil
            </span>
          )}
        </div>
      )}

      {/* Zonen-Grid */}
      {data && (
        <div className="grid grid-cols-2 gap-1.5">
          {data.zonen.map((z) => {
            const cfg = ENGPASS_CFG[z.engpass];
            return (
              <div key={z.zone} className={cn('rounded-lg border px-2.5 py-2', cfg.bg, cfg.border)}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className={cn('text-[10px] font-bold', cfg.text)}>Zone {z.zone}</span>
                  <span className={cn('inline-flex h-1.5 w-1.5 rounded-full shrink-0', cfg.dot)} />
                </div>
                <p className={cn('text-base font-black tabular-nums', cfg.text)}>
                  {z.eta_min} <span className="text-[10px] font-medium">Min</span>
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">{z.queue_laenge}×</span>
                  <span className="text-[10px] text-muted-foreground">{z.aktive_fahrer} Fhr.</span>
                </div>
                {z.empfehlung && (
                  <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{z.empfehlung}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {loading && !data && (
        <div className="grid grid-cols-2 gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <p className="text-[10px] text-muted-foreground mt-1.5 text-right">
          Stand: {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
        </p>
      )}
    </div>
  );
}
