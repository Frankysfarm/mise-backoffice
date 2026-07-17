'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerFeedback {
  fahrer_id: string;
  name: string;
  avg_sterne: number;
  anzahl_bewertungen: number;
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerFeedback[];
  team_durchschnitt: number;
}

const MOCK: ApiData = {
  team_durchschnitt: 4.2,
  fahrer: [
    { fahrer_id: 'f1', name: 'Max Müller',   avg_sterne: 4.8, anzahl_bewertungen: 12, alert: false },
    { fahrer_id: 'f2', name: 'Lena Schmidt',  avg_sterne: 4.2, anzahl_bewertungen: 8,  alert: false },
    { fahrer_id: 'f3', name: 'Tom Becker',    avg_sterne: 3.1, anzahl_bewertungen: 5,  alert: true  },
  ],
};

interface Props { locationId?: string | null }

export function KitchenPhase2147FeedbackAlert({ locationId }: Props) {
  const [open, setOpen]       = useState(true);
  const [data, setData]       = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-feedback-score?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const alertFahrer  = data.fahrer.filter(f => f.alert);
  const mehrereAlert = alertFahrer.length >= 2;
  const hasAlert     = alertFahrer.length > 0;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <MessageSquare className={cn('h-4 w-4 shrink-0', hasAlert ? 'text-red-500' : 'text-muted-foreground')} />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Feedback-Alert</span>
        {hasAlert && (
          <span className={cn(
            'flex items-center gap-1 text-[9px] font-bold rounded-full px-2 py-0.5',
            mehrereAlert
              ? 'text-red-700 bg-red-100 border border-red-200'
              : 'text-amber-700 bg-amber-100 border border-amber-200',
          )}>
            <AlertTriangle className="h-2.5 w-2.5" />
            {mehrereAlert ? 'ESKALATION' : `${alertFahrer.length} NIEDRIG`}
          </span>
        )}
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          <div className="rounded-lg bg-muted/30 border px-3 py-2 flex items-center justify-between">
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Team-Ø Bewertung</p>
              <p className={cn('text-lg font-black tabular-nums', data.team_durchschnitt >= 4.0 ? 'text-green-600' : 'text-amber-600')}>
                ★ {data.team_durchschnitt.toFixed(1)}
              </p>
            </div>
            <p className="text-[9px] text-muted-foreground text-right">Ziel: ≥ 4.0 ★</p>
          </div>

          {mehrereAlert && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-red-700 font-medium leading-snug">
                Mehrere Fahrer unter 3.5 ★ — Eskalation erforderlich. Dispatcher informieren.
              </p>
            </div>
          )}

          {hasAlert ? (
            <div className="space-y-1.5">
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">Fahrer unter 3.5 ★</p>
              {alertFahrer.map(f => (
                <div key={f.fahrer_id} className="rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 flex items-center gap-2">
                  <span className="text-[11px] font-medium flex-1 truncate">{f.name}</span>
                  <span className="text-[10px] font-bold text-red-700 tabular-nums">★ {f.avg_sterne.toFixed(1)}</span>
                  <span className="text-[9px] text-muted-foreground">{f.anzahl_bewertungen} Bewertung{f.anzahl_bewertungen !== 1 ? 'en' : ''}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground text-center py-1">
              Alle Fahrer im grünen Bereich — keine Bewertungs-Alerts
            </p>
          )}
        </div>
      )}
    </div>
  );
}
