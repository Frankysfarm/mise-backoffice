'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, MessageSquare, TrendingUp, RefreshCw, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { KundenFeedbackAnalyse } from '@/app/api/delivery/admin/kunden-feedback-analyse/route';

// Phase 1451 — Kunden-Feedback-Dashboard (Dispatch)
// Phase1449-API: Ø-Sterne + Top-Kommentare + 7-Tage-Trend; 20-Min-Polling; nach Phase1446

interface Props {
  locationId?: string | null;
}

const POLL_MS = 20 * 60 * 1000;

const MOCK: KundenFeedbackAnalyse = {
  avg_sterne: 4.2,
  total_bewertungen: 184,
  top_kommentare: [
    { text: 'Sehr schnelle Lieferung', anzahl: 31 },
    { text: 'Essen noch warm angekommen', anzahl: 24 },
    { text: 'Freundlicher Fahrer', anzahl: 19 },
    { text: 'Alles vollständig', anzahl: 14 },
    { text: 'Nächstes Mal wieder', anzahl: 11 },
  ],
  sieben_tage_trend: [
    { datum: '', avg_sterne: 4.0, anzahl: 10 },
    { datum: '', avg_sterne: 4.3, anzahl: 14 },
    { datum: '', avg_sterne: 3.9, anzahl: 8 },
    { datum: '', avg_sterne: 4.5, anzahl: 18 },
    { datum: '', avg_sterne: 4.1, anzahl: 11 },
    { datum: '', avg_sterne: 4.4, anzahl: 16 },
    { datum: '', avg_sterne: 4.2, anzahl: 13 },
  ],
  location_id: 'mock',
  generiert_am: new Date().toISOString(),
};

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            'w-3.5 h-3.5',
            i < Math.round(value) ? 'text-amber-400 fill-amber-400' : 'text-slate-200 dark:text-slate-700',
          )}
        />
      ))}
    </div>
  );
}

function TrendBar({ value, max }: { value: number; max: number }) {
  const h = max > 0 ? Math.round((value / max) * 100) : 0;
  const color =
    value >= 4.5 ? 'bg-emerald-400 dark:bg-emerald-500' :
    value >= 4.0 ? 'bg-blue-400 dark:bg-blue-500' :
    value >= 3.5 ? 'bg-amber-400 dark:bg-amber-500' :
    'bg-red-400 dark:bg-red-500';
  return (
    <div className="flex flex-col items-center gap-0.5 flex-1">
      <div className="w-full flex flex-col justify-end" style={{ height: 32 }}>
        <div className={cn('w-full rounded-t transition-all duration-500', color)} style={{ height: `${h}%` }} />
      </div>
      <span className="text-[9px] tabular-nums text-slate-400">{value > 0 ? value.toFixed(1) : '—'}</span>
    </div>
  );
}

export function DispatchPhase1451KundenFeedbackDashboard({ locationId }: Props) {
  const [data, setData] = useState<KundenFeedbackAnalyse>(MOCK);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = useCallback(() => {
    if (!locationId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/kunden-feedback-analyse?location_id=${locationId}`)
      .then(r => r.json())
      .then((d: KundenFeedbackAnalyse) => { setData(d); setLastUpdate(new Date()); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, POLL_MS);
    return () => clearInterval(iv);
  }, [load]);

  const maxTrend = Math.max(...data.sieben_tage_trend.map(t => t.avg_sterne), 5);
  const maxKommentar = data.top_kommentare[0]?.anzahl ?? 1;

  return (
    <Card className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1">
          Kunden-Feedback
        </span>
        {loading && <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />}
        {!loading && lastUpdate && (
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* KPI: Ø Sterne */}
      <div className="flex items-center gap-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-2.5">
        <div className="space-y-0.5">
          <div className="text-3xl font-black tabular-nums text-amber-700 dark:text-amber-300 leading-none">
            {data.avg_sterne.toFixed(1)}
          </div>
          <StarRating value={data.avg_sterne} />
        </div>
        <div className="flex-1">
          <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">Ø Kundenbewertung</div>
          <div className="text-[10px] text-amber-600/70 dark:text-amber-400/70">
            {data.total_bewertungen.toLocaleString('de-DE')} Bewertungen gesamt
          </div>
        </div>
      </div>

      {/* 7-Tage-Trend */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3 text-slate-400" />
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">7-Tage-Trend</span>
        </div>
        <div className="flex items-end gap-1 h-12 px-1">
          {data.sieben_tage_trend.map((tag, i) => (
            <TrendBar key={tag.datum || i} value={tag.avg_sterne} max={maxTrend} />
          ))}
        </div>
        <div className="flex justify-between px-1">
          <span className="text-[9px] text-slate-400">vor 6 Tagen</span>
          <span className="text-[9px] text-slate-400">heute</span>
        </div>
      </div>

      {/* Top-Kommentare */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <MessageSquare className="w-3 h-3 text-slate-400" />
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Häufigste Kommentare</span>
        </div>
        <div className="space-y-1.5">
          {data.top_kommentare.map(k => {
            const balken = Math.round((k.anzahl / maxKommentar) * 100);
            return (
              <div key={k.text} className="space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-700 dark:text-slate-300 truncate">{k.text}</span>
                  <span className="text-[10px] font-bold tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                    {k.anzahl}×
                  </span>
                </div>
                <div className="h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-400 dark:bg-blue-500 transition-all duration-500"
                    style={{ width: `${balken}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!locationId && (
        <p className="text-[10px] text-slate-400 text-center">Demo-Daten — location_id fehlt</p>
      )}
    </Card>
  );
}
