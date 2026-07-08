'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, ChevronDown, ChevronUp, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DringlichkeitsBestellung {
  id: string;
  bestellnummer: string;
  kunde_name: string;
  status: string;
  bestellt_vor_min: number;
  sla_restzeit_min: number;
  dringlichkeit: 'niedrig' | 'mittel' | 'hoch' | 'kritisch';
  dringlichkeits_score: number;
  empfehlung: string;
}

interface ApiResponse {
  ok: boolean;
  bestellungen: DringlichkeitsBestellung[];
  summary: {
    kritisch: number;
    hoch: number;
    mittel: number;
    niedrig: number;
    gesamt: number;
  };
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const DRINGLICHKEIT_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  kritisch: { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-300 dark:border-red-700', text: 'text-red-700 dark:text-red-400', label: 'Kritisch' },
  hoch:     { bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-300 dark:border-orange-700', text: 'text-orange-700 dark:text-orange-400', label: 'Hoch' },
  mittel:   { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-500', label: 'Mittel' },
  niedrig:  { bg: 'bg-slate-50 dark:bg-slate-900/30', border: 'border-slate-200 dark:border-slate-700', text: 'text-slate-600 dark:text-slate-400', label: 'Niedrig' },
};

const STATUS_LABELS: Record<string, string> = {
  neu: 'Neu',
  bestätigt: 'Bestätigt',
  in_zubereitung: 'In Zubereitung',
  fertig: 'Fertig',
};

export function KitchenPhase665DringlichkeitsQueue({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/admin/bestellungs-dringlichkeit?location_id=${locationId}`);
        const json = await res.json() as ApiResponse;
        if (active) setData(json);
      } catch {
        // noop
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 30_000);
    return () => { active = false; clearInterval(id); };
  }, [locationId]);

  if (!locationId) return null;
  if (!loading && data?.bestellungen.length === 0) return null;

  const kritisch = data?.summary?.kritisch ?? 0;
  const hoch = data?.summary?.hoch ?? 0;

  return (
    <div className={cn(
      'rounded-xl border bg-card shadow-sm',
      kritisch > 0 ? 'border-red-300 dark:border-red-700' : 'border-border',
    )}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          {kritisch > 0
            ? <Flame className="h-4 w-4 text-red-500 animate-pulse" />
            : <AlertTriangle className="h-4 w-4 text-amber-500" />
          }
          <span className="text-sm font-bold">Dringlichkeits-Queue</span>
          <span className="text-xs text-muted-foreground">
            ({data?.summary?.gesamt ?? '—'} Bestellungen)
          </span>
          {kritisch > 0 && (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400">
              {kritisch}× kritisch
            </span>
          )}
          {hoch > 0 && kritisch === 0 && (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400">
              {hoch}× hoch
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {loading && !data && (
            <p className="text-xs text-muted-foreground py-2">Lade Dringlichkeits-Queue…</p>
          )}
          {data?.bestellungen.slice(0, 8).map((b) => {
            const st = DRINGLICHKEIT_STYLES[b.dringlichkeit] ?? DRINGLICHKEIT_STYLES.niedrig;
            return (
              <div key={b.id} className={cn('rounded-lg border px-3 py-2 flex items-start gap-3', st.bg, st.border)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-foreground">#{b.bestellnummer}</span>
                    <span className={cn('text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full', st.text, 'bg-white/60 dark:bg-black/20')}>
                      {st.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{STATUS_LABELS[b.status] ?? b.status}</span>
                  </div>
                  <p className="text-xs font-medium text-foreground mt-0.5 truncate">{b.kunde_name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{b.empfehlung}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-mono font-bold tabular-nums">
                      {b.bestellt_vor_min}m
                    </span>
                  </div>
                  <div className={cn('text-[10px] font-semibold', b.sla_restzeit_min <= 5 ? 'text-red-600' : 'text-muted-foreground')}>
                    {b.sla_restzeit_min > 0 ? `${b.sla_restzeit_min}m SLA` : 'SLA!'}
                  </div>
                </div>
              </div>
            );
          })}
          {(data?.bestellungen.length ?? 0) > 8 && (
            <p className="text-[10px] text-muted-foreground text-center">
              +{(data?.bestellungen.length ?? 0) - 8} weitere Bestellungen
            </p>
          )}
        </div>
      )}
    </div>
  );
}
