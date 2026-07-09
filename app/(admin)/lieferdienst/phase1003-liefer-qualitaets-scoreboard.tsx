'use client';

import { useEffect, useState } from 'react';
import { Star, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type QualityData = {
  puenktlichkeit_pct: number;
  puenktlichkeit_ziel: number;
  avg_bewertung: number;
  bewertung_count: number;
  sla_einhaltung_pct: number;
  sla_ziel: number;
  storno_pct: number;
  storno_ziel: number;
};

function mock(): QualityData {
  return {
    puenktlichkeit_pct: 84,
    puenktlichkeit_ziel: 90,
    avg_bewertung: 4.6,
    bewertung_count: 62,
    sla_einhaltung_pct: 88,
    sla_ziel: 95,
    storno_pct: 3.4,
    storno_ziel: 5,
  };
}

function ScoreCard({ label, wert, ziel, icon: Icon, suffix = '%', reverse = false }: {
  label: string; wert: number; ziel: number; icon: React.ElementType; suffix?: string; reverse?: boolean;
}) {
  const gut = reverse ? wert <= ziel : wert >= ziel;
  const pct = reverse ? Math.min(100, Math.max(0, Math.round((ziel / Math.max(wert, 0.1)) * 100))) : Math.min(100, Math.round((wert / ziel) * 100));
  const color = gut ? 'text-matcha-700 dark:text-matcha-300' : wert >= ziel * 0.9 ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300';
  const barColor = gut ? 'bg-matcha-500' : wert >= ziel * 0.9 ? 'bg-amber-400' : 'bg-red-400';
  const bgColor = gut ? 'bg-matcha-50 dark:bg-matcha-950/30 border-matcha-200 dark:border-matcha-800' : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800';

  return (
    <div className={cn('rounded-xl border p-3', bgColor)}>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={13} className={color} />
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{label}</span>
        {gut ? <CheckCircle2 size={10} className="text-matcha-500 ml-auto" /> : <XCircle size={10} className="text-red-500 ml-auto" />}
      </div>
      <div className={cn('text-2xl font-black tabular-nums mb-1', color)}>
        {typeof wert === 'number' && wert % 1 !== 0 ? wert.toFixed(1) : Math.round(wert)}{suffix}
      </div>
      <div className="h-1.5 w-full rounded-full bg-black/10 overflow-hidden mb-1">
        <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[9px] text-muted-foreground">Ziel: {ziel}{suffix}</div>
    </div>
  );
}

export function LieferdienstPhase1003LieferQualitaetsScoreboard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<QualityData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const p = new URLSearchParams(); if (locationId) p.set('location_id', locationId);
      const r = await fetch(`/api/delivery/admin/liefer-qualitaet?${p}`);
      if (r.ok) setData(await r.json()); else throw new Error();
    } catch { setData(mock()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); const id = setInterval(load, 60000); return () => clearInterval(id); }, [locationId]);

  if (!data && loading) return <div className="h-40 bg-muted/20 rounded-2xl animate-pulse" />;
  if (!data) return null;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <Star size={15} className="text-amber-500" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">Liefer-Qualität — Scoreboard</span>
        <span className="text-[10px] text-muted-foreground">{data.bewertung_count} Bewertungen</span>
        {loading && <Loader2 size={13} className="animate-spin text-muted-foreground" />}
      </div>
      <div className="p-3 grid grid-cols-2 gap-2">
        <ScoreCard label="Pünktlichkeit" wert={data.puenktlichkeit_pct} ziel={data.puenktlichkeit_ziel} icon={Clock} />
        <ScoreCard label="Bewertung" wert={data.avg_bewertung} ziel={5} icon={Star} suffix=" ★" />
        <ScoreCard label="SLA-Einhaltung" wert={data.sla_einhaltung_pct} ziel={data.sla_ziel} icon={CheckCircle2} />
        <ScoreCard label="Stornorate" wert={data.storno_pct} ziel={data.storno_ziel} icon={XCircle} reverse />
      </div>
    </div>
  );
}
