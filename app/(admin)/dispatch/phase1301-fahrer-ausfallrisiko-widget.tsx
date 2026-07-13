/**
 * Phase 1301 — Fahrer-Ausfallrisiko-Widget (Dispatch)
 * Zeigt Phase1299-API-Daten als Risiko-Rangliste + Farbkodierung (niedrig/mittel/hoch).
 * 30-Min-Polling. Integration: dispatch/client.tsx nach Phase1296.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { ShieldAlert, ShieldCheck, Shield, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

type RisikoStufe = 'niedrig' | 'mittel' | 'hoch';

interface FahrerRisiko {
  driver_id: string;
  fahrer_name: string;
  verspaetungen_3_tage: number;
  schicht_fehlzeiten: number;
  risiko_score: number;
  risiko_stufe: RisikoStufe;
  letzter_vorfall: string | null;
}

interface ApiData {
  fahrer: FahrerRisiko[];
  gesamt_risiko: RisikoStufe;
  hoch_risiko_anzahl: number;
  generiert_am: string;
}

const POLL_MS = 30 * 60 * 1000;

const RISIKO_CONFIG: Record<RisikoStufe, { label: string; bg: string; text: string; border: string; icon: React.ReactNode }> = {
  hoch:    { label: 'Hoch',    bg: 'bg-red-50 dark:bg-red-950/30',     text: 'text-red-700 dark:text-red-300',     border: 'border-red-200 dark:border-red-800',     icon: <ShieldAlert className="h-3.5 w-3.5" /> },
  mittel:  { label: 'Mittel',  bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800', icon: <Shield className="h-3.5 w-3.5" /> },
  niedrig: { label: 'Niedrig', bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
};

export function DispatchPhase1301FahrerAusfallrisikoWidget({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-ausfallrisiko?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
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

  const gesamtCfg = data ? RISIKO_CONFIG[data.gesamt_risiko] : null;

  return (
    <div className="rounded-2xl border bg-card p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-bold">Fahrer-Ausfallrisiko</span>
          {gesamtCfg && (
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold border', gesamtCfg.bg, gesamtCfg.text, gesamtCfg.border)}>
              {gesamtCfg.icon}
              {gesamtCfg.label}
            </span>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-lg p-1.5 hover:bg-muted transition disabled:opacity-50"
          aria-label="Aktualisieren"
        >
          <RefreshCw className={cn('h-3.5 w-3.5 text-muted-foreground', loading && 'animate-spin')} />
        </button>
      </div>

      {loading && !data && (
        <div className="space-y-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {data && data.fahrer.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-emerald-600">
          <ShieldCheck className="h-4 w-4" />
          <span>Keine Risiko-Fahrer in den letzten 3 Tagen.</span>
        </div>
      )}

      {data && data.fahrer.length > 0 && (
        <div className="space-y-1.5">
          {data.fahrer.map(f => {
            const cfg = RISIKO_CONFIG[f.risiko_stufe];
            return (
              <div
                key={f.driver_id}
                className={cn('flex items-center gap-2 rounded-lg border px-3 py-2', cfg.bg, cfg.border)}
              >
                <span className={cn(cfg.text)}>{cfg.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-xs font-bold truncate', cfg.text)}>{f.fahrer_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {f.verspaetungen_3_tage} Verspätung{f.verspaetungen_3_tage !== 1 ? 'en' : ''} · {f.schicht_fehlzeiten} Fehlzeit{f.schicht_fehlzeiten !== 1 ? 'en' : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className={cn('text-sm font-black tabular-nums', cfg.text)}>Score {f.risiko_score}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data && (
        <p className="text-[10px] text-muted-foreground mt-2 text-right">
          Letzte 3 Tage · {data.hoch_risiko_anzahl} Hoch-Risiko · {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
        </p>
      )}
    </div>
  );
}
