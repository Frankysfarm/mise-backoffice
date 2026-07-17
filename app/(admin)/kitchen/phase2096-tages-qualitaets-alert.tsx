'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Award, ChevronDown, ChevronUp, Loader2, ThumbsUp } from 'lucide-react';

interface FahrerQualitaet {
  driver_id: string;
  name: string;
  qualitaets_score: number;
  storno_pct: number;
  bewertung_avg: number;
  touren: number;
}

interface ApiData {
  fahrer: FahrerQualitaet[];
  team_score: number;
  alert_niedriger_score: boolean;
}

interface Props {
  locationId?: string | null;
}

const MOCK: ApiData = {
  fahrer: [
    { driver_id: '1', name: 'Tom H.', qualitaets_score: 64, storno_pct: 14, bewertung_avg: 3.8, touren: 7 },
    { driver_id: '2', name: 'Jana R.', qualitaets_score: 67, storno_pct: 11, bewertung_avg: 4.0, touren: 6 },
  ],
  team_score: 80,
  alert_niedriger_score: false,
};

export function KitchenPhase2096TagesQualitaetsAlert({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/tages-qualitaets-score?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { load(); const t = setInterval(load, 10 * 60_000); return () => clearInterval(t); }, [load]);

  const schwacheFahrer = data.fahrer.filter(f => f.qualitaets_score < 70);
  const hasAlert = data.alert_niedriger_score || schwacheFahrer.length > 0;

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 border-b hover:bg-muted/30 transition-colors"
      >
        <Award className={cn('h-4 w-4 shrink-0', hasAlert ? 'text-amber-500' : 'text-matcha-600')} />
        <span className="text-xs font-bold uppercase tracking-wider">Tages-Qualitäts-Alert</span>
        {hasAlert ? (
          <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">
            {schwacheFahrer.length} Fahrer &lt;70
          </span>
        ) : (
          <span className="ml-1 rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
            Team Ø {data.team_score} ✓
          </span>
        )}
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        <span className="ml-auto">
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </span>
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {!hasAlert && (
            <div className="flex items-center gap-2 rounded-xl border border-matcha-200 bg-matcha-50 px-3 py-2 text-xs text-matcha-700">
              <ThumbsUp className="h-4 w-4 shrink-0" />
              <span className="font-semibold">Alle Fahrer über 70 Qualitätspunkten — Team läuft gut</span>
            </div>
          )}

          {hasAlert && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="font-semibold">{schwacheFahrer.length} Fahrer mit niedrigem Qualitäts-Score — Koordination prüfen</span>
            </div>
          )}

          {schwacheFahrer.length > 0 && (
            <div className="space-y-1.5">
              {schwacheFahrer.map(f => (
                <div key={f.driver_id} className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2 text-[11px]">
                  <span className="font-bold text-amber-800 shrink-0">{f.name}</span>
                  <span className="text-muted-foreground">Score: <strong className="text-amber-700">{f.qualitaets_score}</strong></span>
                  <span className="text-muted-foreground">✗ {f.storno_pct}% Storno</span>
                  <span className="text-muted-foreground">★ {f.bewertung_avg.toFixed(1)}</span>
                  <span className="ml-auto text-muted-foreground">{f.touren} Touren</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-muted/30 px-2 py-2 text-center">
              <div className="text-[10px] text-muted-foreground">Team-Score</div>
              <div className={cn('text-lg font-black tabular-nums', data.team_score >= 80 ? 'text-matcha-600' : data.team_score >= 70 ? 'text-amber-600' : 'text-red-600')}>
                {data.team_score}
              </div>
            </div>
            <div className="rounded-xl bg-muted/30 px-2 py-2 text-center">
              <div className="text-[10px] text-muted-foreground">Gut ≥70</div>
              <div className="text-lg font-black text-matcha-600 tabular-nums">
                {data.fahrer.filter(f => f.qualitaets_score >= 70).length}
              </div>
            </div>
            <div className="rounded-xl bg-muted/30 px-2 py-2 text-center">
              <div className="text-[10px] text-muted-foreground">Risiko &lt;70</div>
              <div className={cn('text-lg font-black tabular-nums', schwacheFahrer.length > 0 ? 'text-amber-600' : 'text-muted-foreground')}>
                {schwacheFahrer.length}
              </div>
            </div>
          </div>

          <div className="text-[10px] text-muted-foreground text-right">10-Min-Update</div>
        </div>
      )}
    </div>
  );
}
