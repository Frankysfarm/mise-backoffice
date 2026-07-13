'use client';

// Phase 1281 — Fahrer-Feedback-Übersicht (Lieferdienst)
// Aggregierte Kunden-Zufriedenheits-Daten aus Phase1279-API
// Positiv/Negativ-Quote je Fahrer + Trend-Balken; 10-Min-Polling; locationId-Prop

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, ThumbsDown, ThumbsUp, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerFeedback {
  fahrer_id: string;
  fahrer_name: string;
  positiv: number;
  negativ: number;
  gesamt: number;
  positiv_quote: number;
  trend: 'steigend' | 'fallend' | 'stabil';
}

interface ApiResponse {
  fahrer: FahrerFeedback[];
  gesamt_positiv_quote: number;
  zeitraum_stunden: number;
  location_id: string;
  generiert_am: string;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: '1', fahrer_name: 'Max M.',  positiv: 18, negativ: 2,  gesamt: 20, positiv_quote: 90, trend: 'steigend' },
    { fahrer_id: '2', fahrer_name: 'Anna K.', positiv: 12, negativ: 3,  gesamt: 15, positiv_quote: 80, trend: 'stabil' },
    { fahrer_id: '3', fahrer_name: 'Tom S.',  positiv: 7,  negativ: 5,  gesamt: 12, positiv_quote: 58, trend: 'fallend' },
    { fahrer_id: '4', fahrer_name: 'Lisa W.', positiv: 21, negativ: 1,  gesamt: 22, positiv_quote: 95, trend: 'steigend' },
    { fahrer_id: '5', fahrer_name: 'Jan B.',  positiv: 9,  negativ: 4,  gesamt: 13, positiv_quote: 69, trend: 'stabil' },
  ],
  gesamt_positiv_quote: 80,
  zeitraum_stunden: 8,
  location_id: '',
  generiert_am: new Date().toISOString(),
};

const TREND_STYLE = {
  steigend: { icon: TrendingUp,   cls: 'text-emerald-600 dark:text-emerald-400' },
  fallend:  { icon: TrendingDown, cls: 'text-red-500 dark:text-red-400' },
  stabil:   { icon: TrendingUp,   cls: 'text-slate-400 dark:text-slate-500' },
};

function quoteFarbe(q: number): string {
  if (q >= 85) return 'text-emerald-600 dark:text-emerald-400';
  if (q >= 70) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function balkenFarbe(q: number): string {
  if (q >= 85) return 'bg-emerald-500';
  if (q >= 70) return 'bg-amber-400';
  return 'bg-red-500';
}

export function LieferdienstPhase1281FahrerFeedbackUebersicht({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!locationId) { setData(MOCK); setLoading(false); return; }
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-feedback-uebersicht?location_id=${locationId}`);
      if (!r.ok) throw new Error();
      setData(await r.json());
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        <ThumbsUp className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="flex-1 text-xs font-bold uppercase tracking-wider text-foreground">
          Fahrer-Feedback-Übersicht
        </span>
        {data && (
          <span className={cn('text-sm font-black tabular-nums', quoteFarbe(data.gesamt_positiv_quote))}>
            {data.gesamt_positiv_quote}% positiv
          </span>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-4 py-3 space-y-3">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lade Feedback-Daten…
            </div>
          )}

          {!loading && data && (
            <>
              <div className="grid grid-cols-3 gap-2 text-center mb-1">
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-2">
                  <div className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">Positiv-Quote</div>
                  <div className={cn('text-xl font-black tabular-nums', quoteFarbe(data.gesamt_positiv_quote))}>
                    {data.gesamt_positiv_quote}%
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-2">
                  <div className="text-[10px] font-bold uppercase text-muted-foreground">Fahrer</div>
                  <div className="text-xl font-black tabular-nums text-foreground">{data.fahrer.length}</div>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-2">
                  <div className="text-[10px] font-bold uppercase text-muted-foreground">Zeitraum</div>
                  <div className="text-xl font-black tabular-nums text-foreground">{data.zeitraum_stunden}h</div>
                </div>
              </div>

              <div className="space-y-2">
                {data.fahrer
                  .sort((a, b) => b.positiv_quote - a.positiv_quote)
                  .map(f => {
                    const ts = TREND_STYLE[f.trend];
                    const TrendIcon = ts.icon;
                    return (
                      <div key={f.fahrer_id} className="flex items-center gap-2">
                        <span className="w-20 shrink-0 text-xs font-semibold text-foreground truncate">{f.fahrer_name}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all duration-700', balkenFarbe(f.positiv_quote))}
                            style={{ width: `${f.positiv_quote}%` }}
                          />
                        </div>
                        <span className={cn('w-10 shrink-0 text-right text-xs font-black tabular-nums', quoteFarbe(f.positiv_quote))}>
                          {f.positiv_quote}%
                        </span>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <ThumbsUp className="h-3 w-3 text-emerald-500" />
                          <span className="text-[10px] tabular-nums text-muted-foreground">{f.positiv}</span>
                          <ThumbsDown className="h-3 w-3 text-red-400 ml-1" />
                          <span className="text-[10px] tabular-nums text-muted-foreground">{f.negativ}</span>
                        </div>
                        <TrendIcon className={cn('h-3.5 w-3.5 shrink-0', ts.cls)} />
                      </div>
                    );
                  })}
              </div>

              <div className="pt-1 text-[10px] text-muted-foreground text-right">
                Letzte Aktualisierung: {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
