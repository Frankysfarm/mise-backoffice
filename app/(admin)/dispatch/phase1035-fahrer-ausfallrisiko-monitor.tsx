'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronDown, ChevronUp, UserX, RefreshCw } from 'lucide-react';

/**
 * Phase 1035 — Fahrer-Ausfallrisiko-Monitor (Dispatch)
 *
 * Frühwarnung welche Fahrer heute wahrscheinlich nicht erscheinen.
 * 5-Minuten-Polling.
 */

interface Props {
  locationId: string | null;
}

interface FahrerRisiko {
  fahrer_id: string;
  fahrer_name: string;
  risiko_pct: number;
  risiko_level: 'kritisch' | 'hoch' | 'mittel' | 'niedrig';
  absenz_rate_pct: number;
  letzte_schicht_tage_her: number;
  empfehlung: string;
}

interface ApiResponse {
  fahrer: FahrerRisiko[];
  kritisch_count: number;
  location_id: string | null;
  generiert_am: string;
}

const LEVEL_STYLE = {
  kritisch: { bg: 'bg-red-50',    border: 'border-red-200',    badge: 'bg-red-500 text-white',    bar: 'bg-red-500',    label: 'Kritisch' },
  hoch:     { bg: 'bg-amber-50',  border: 'border-amber-200',  badge: 'bg-amber-400 text-white',  bar: 'bg-amber-400',  label: 'Hoch'     },
  mittel:   { bg: 'bg-blue-50',   border: 'border-blue-200',   badge: 'bg-blue-400 text-white',   bar: 'bg-blue-400',   label: 'Mittel'   },
  niedrig:  { bg: 'bg-matcha-50', border: 'border-matcha-200', badge: 'bg-matcha-500 text-white', bar: 'bg-matcha-500', label: 'Niedrig'  },
};

const POLL_MS = 5 * 60 * 1000;

export function DispatchPhase1035FahrerAusfallrisiko({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const url = locationId
          ? `/api/delivery/admin/fahrer-ausfallrisiko?location_id=${locationId}`
          : '/api/delivery/admin/fahrer-ausfallrisiko';
        const res = await fetch(url);
        if (res.ok) setData(await res.json());
      } finally {
        setLoading(false);
      }
    }
    load();
    const iv = setInterval(load, POLL_MS);
    return () => clearInterval(iv);
  }, [locationId]);

  const visibleFahrer = (data?.fahrer ?? []).filter(f => f.risiko_level !== 'niedrig');
  const kritischCount = data?.kritisch_count ?? 0;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <UserX className="h-4 w-4 text-red-500" />
          <span className="text-sm font-bold">Fahrer-Ausfallrisiko</span>
          {kritischCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700 border border-red-300 animate-pulse">
              <AlertTriangle className="h-2.5 w-2.5" />
              {kritischCount} kritisch
            </span>
          )}
          {loading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {visibleFahrer.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground text-center py-3">
              {data ? 'Alle Fahrer ohne erhöhtes Ausfallrisiko.' : 'Filiale wählen…'}
            </p>
          )}

          {visibleFahrer.map(f => {
            const s = LEVEL_STYLE[f.risiko_level];
            return (
              <div
                key={f.fahrer_id}
                className={cn('rounded-lg border p-3 space-y-2', s.bg, s.border)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-black shrink-0', s.badge)}>
                      {s.label}
                    </span>
                    <span className="text-xs font-bold truncate">{f.fahrer_name}</span>
                  </div>
                  <span className="text-sm font-black tabular-nums shrink-0">{f.risiko_pct}%</span>
                </div>

                <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', s.bar)}
                    style={{ width: `${f.risiko_pct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Absenzrate {f.absenz_rate_pct}% · letzte Schicht vor {f.letzte_schicht_tage_her}d</span>
                  <span className="font-medium">{f.empfehlung}</span>
                </div>
              </div>
            );
          })}

          {data && (
            <p className="text-[10px] text-muted-foreground text-right">
              Letzte 30 Tage · Stand {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
