'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Zap, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

/**
 * Phase 1699 — Fahrer-Reaktionszeit-Monitor (Dispatch)
 *
 * Zeit zwischen Dispatch-Zeitstempel und erstem Check-In je Fahrer heute.
 * Ampel: grün <2 Min / gelb 2-5 Min / rot >5 Min.
 * Props-basiert (batches); useMemo.
 */

interface BatchInput {
  id: string;
  fahrer_id?: string | null;
  fahrer_name?: string | null;
  dispatched_at?: string | null;
  status?: string | null;
  first_checkin_at?: string | null;
  accepted_at?: string | null;
  started_at?: string | null;
}

interface Props {
  batches: BatchInput[];
}

type Ampel = 'gruen' | 'gelb' | 'rot';

interface FahrerReaktion {
  fahrer_id: string;
  fahrer_name: string;
  reaktionszeit_min: number | null;
  anzahl_touren: number;
  ampel: Ampel;
}

const AMPEL_DOT: Record<Ampel, string> = {
  gruen: 'bg-matcha-500',
  gelb:  'bg-amber-400',
  rot:   'bg-red-500',
};

const AMPEL_TEXT: Record<Ampel, string> = {
  gruen: 'text-matcha-600 dark:text-matcha-400',
  gelb:  'text-amber-600 dark:text-amber-400',
  rot:   'text-red-600 dark:text-red-400',
};

const AMPEL_LABEL: Record<Ampel, string> = {
  gruen: 'Schnell',
  gelb:  'OK',
  rot:   'Langsam',
};

function ampelOf(min: number | null): Ampel {
  if (min === null) return 'gelb';
  if (min < 2)  return 'gruen';
  if (min <= 5) return 'gelb';
  return 'rot';
}

function parseReaktionszeit(b: BatchInput): number | null {
  const dispatchedRaw = b.dispatched_at;
  const checkinRaw    = b.first_checkin_at ?? b.accepted_at ?? b.started_at;
  if (!dispatchedRaw || !checkinRaw) return null;
  const dispatched = new Date(dispatchedRaw).getTime();
  const checkin    = new Date(checkinRaw).getTime();
  if (isNaN(dispatched) || isNaN(checkin) || checkin <= dispatched) return null;
  return parseFloat(((checkin - dispatched) / 60_000).toFixed(1));
}

export function DispatchPhase1699FahrerReaktionszeitMonitor({ batches }: Props) {
  const [open, setOpen] = useState(true);

  const fahrer = useMemo<FahrerReaktion[]>(() => {
    const heute = new Date();
    heute.setHours(0, 0, 0, 0);
    const heeutMs = heute.getTime();

    const map = new Map<string, { name: string; zeiten: number[]; touren: number }>();

    for (const b of batches) {
      if (!b.fahrer_id) continue;
      const dispMs = b.dispatched_at ? new Date(b.dispatched_at).getTime() : 0;
      if (dispMs < heeutMs) continue; // nur heute

      const entry = map.get(b.fahrer_id) ?? {
        name: b.fahrer_name ?? `Fahrer ${b.fahrer_id.slice(0, 4)}`,
        zeiten: [],
        touren: 0,
      };
      entry.touren++;
      const rz = parseReaktionszeit(b);
      if (rz !== null) entry.zeiten.push(rz);
      map.set(b.fahrer_id, entry);
    }

    return Array.from(map.entries())
      .map(([id, e]) => {
        const avg = e.zeiten.length
          ? parseFloat((e.zeiten.reduce((s, v) => s + v, 0) / e.zeiten.length).toFixed(1))
          : null;
        return {
          fahrer_id: id,
          fahrer_name: e.name,
          reaktionszeit_min: avg,
          anzahl_touren: e.touren,
          ampel: ampelOf(avg),
        };
      })
      .sort((a, b) => {
        const aMin = a.reaktionszeit_min ?? 999;
        const bMin = b.reaktionszeit_min ?? 999;
        return aMin - bMin;
      });
  }, [batches]);

  const roteAnzahl = fahrer.filter(f => f.ampel === 'rot').length;
  const avgTeam = useMemo(() => {
    const valid = fahrer.filter(f => f.reaktionszeit_min !== null);
    if (!valid.length) return null;
    return parseFloat((valid.reduce((s, f) => s + (f.reaktionszeit_min ?? 0), 0) / valid.length).toFixed(1));
  }, [fahrer]);

  return (
    <div className="rounded-xl border border-border bg-card p-3 mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left"
      >
        <Zap className="h-4 w-4 shrink-0 text-amber-500" />
        <span className="text-sm font-semibold flex-1 text-foreground">Reaktionszeit-Monitor</span>
        {roteAnzahl > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400">
            <AlertTriangle className="h-3 w-3" />{roteAnzahl} langsam
          </span>
        )}
        {avgTeam !== null && (
          <span className={cn('text-[10px] font-bold ml-2', AMPEL_TEXT[ampelOf(avgTeam)])}>
            Ø {avgTeam} Min
          </span>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {fahrer.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-2">
              Noch keine Dispatch-Daten für heute.
            </div>
          )}

          {fahrer.length > 0 && (
            <>
              {/* Legend */}
              <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-matcha-500 inline-block" /> &lt;2 Min schnell</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" /> 2–5 Min ok</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" /> &gt;5 Min langsam</span>
              </div>

              {/* Fahrer rows */}
              <div className="space-y-1.5">
                {fahrer.map(f => (
                  <div key={f.fahrer_id} className="flex items-center gap-2">
                    <span className={cn('h-2 w-2 rounded-full shrink-0', AMPEL_DOT[f.ampel])} />
                    <span className="flex-1 text-[12px] font-medium truncate text-foreground">{f.fahrer_name}</span>
                    <span className="text-[10px] text-muted-foreground">{f.anzahl_touren} Tour{f.anzahl_touren !== 1 ? 'en' : ''}</span>
                    <span className={cn('w-14 text-right text-[12px] font-bold tabular-nums', AMPEL_TEXT[f.ampel])}>
                      {f.reaktionszeit_min !== null ? `${f.reaktionszeit_min} Min` : '–'}
                    </span>
                    <span className={cn('text-[10px] font-bold w-14 text-right', AMPEL_TEXT[f.ampel])}>
                      {AMPEL_LABEL[f.ampel]}
                    </span>
                  </div>
                ))}
              </div>

              {/* Team average */}
              {avgTeam !== null && (
                <div className="flex items-center justify-between pt-1 border-t border-border">
                  <span className="text-[11px] text-muted-foreground font-medium">Team-Ø heute</span>
                  <span className={cn('text-[12px] font-bold tabular-nums', AMPEL_TEXT[ampelOf(avgTeam)])}>
                    {avgTeam} Min
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
