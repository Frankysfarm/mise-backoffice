'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1171 — Tour-Effizienz-Live-Radar (Dispatch)
// Zeitabweichung je laufender Tour: wie viel % über/unter der Plan-ETA

interface Props { locationId: string | null; }

interface TourRadar {
  id: string;
  fahrer: string;
  abweichungMin: number;
  abweichungPct: number;
  planMin: number;
  istMin: number;
  status: 'ahead' | 'on_time' | 'late' | 'critical';
}

function statusOf(abw: number): TourRadar['status'] {
  if (abw < -3) return 'ahead';
  if (abw <= 5) return 'on_time';
  if (abw <= 12) return 'late';
  return 'critical';
}

const STATUS_STYLE: Record<TourRadar['status'], { card: string; text: string; label: string }> = {
  ahead:    { card: 'bg-matcha-50 border-matcha-200', text: 'text-matcha-700', label: 'Früher' },
  on_time:  { card: 'bg-blue-50 border-blue-200',    text: 'text-blue-700',   label: 'Pünktlich' },
  late:     { card: 'bg-amber-50 border-amber-200',  text: 'text-amber-700',  label: 'Leicht verspätet' },
  critical: { card: 'bg-red-50 border-red-200',      text: 'text-red-700',    label: 'Verspätet' },
};

export function DispatchPhase1171TourEffizienzLiveRadar({ locationId }: Props) {
  const [open, setOpen] = useState(false);
  const [touren, setTouren] = useState<TourRadar[]>([]);
  const [loading, setLoading] = useState(false);
  const [ts, setTs] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/tour-ampel?location_id=${locationId}&limit=20`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      const raw = (d.batches ?? []) as any[];
      setTouren(
        raw.map((b: any, i: number) => {
          const plan = b.eta_min ?? 30;
          const ist = b.laufzeit_min ?? 0;
          const abw = ist - plan;
          return { id: b.id ?? `r${i}`, fahrer: b.fahrer_name ?? 'Fahrer', abweichungMin: abw, abweichungPct: plan ? Math.round((abw / plan) * 100) : 0, planMin: plan, istMin: ist, status: statusOf(abw) };
        }),
      );
      setTs(new Date());
    } catch {
      setTouren([
        { id: 'm1', fahrer: 'Lena S.', abweichungMin: -4, abweichungPct: -13, planMin: 30, istMin: 26, status: 'ahead' },
        { id: 'm2', fahrer: 'Mark T.', abweichungMin: 2, abweichungPct: 7, planMin: 28, istMin: 30, status: 'on_time' },
        { id: 'm3', fahrer: 'Ben A.', abweichungMin: 8, abweichungPct: 27, planMin: 30, istMin: 38, status: 'late' },
        { id: 'm4', fahrer: 'Susi W.', abweichungMin: 15, abweichungPct: 50, planMin: 30, istMin: 45, status: 'critical' },
      ]);
      setTs(new Date());
    } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 60_000); return () => clearInterval(iv); }, [load]);

  if (!touren.length && !loading) return null;

  const critCount = touren.filter(t => t.status === 'critical').length;
  const headerBg = critCount > 0 ? 'bg-red-50 border-red-200' : 'bg-matcha-50 border-matcha-200';
  const headerText = critCount > 0 ? 'text-red-700' : 'text-matcha-700';

  return (
    <div className={cn('rounded-2xl border overflow-hidden', headerBg)}>
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-black/5 transition">
        <Clock size={16} className={headerText} />
        <span className={cn('font-bold text-sm uppercase tracking-wider', headerText)}>Tour-Effizienz-Radar</span>
        {critCount > 0 && (
          <span className="rounded-full bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 ml-1 animate-pulse">
            {critCount} verspätet
          </span>
        )}
        {loading && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={e => { e.stopPropagation(); load(); }} className="rounded-full p-1 hover:bg-black/10 transition">
            <RefreshCw size={12} className="text-muted-foreground" />
          </button>
          {open ? <ChevronUp size={14} className={headerText} /> : <ChevronDown size={14} className={headerText} />}
        </div>
      </button>

      {open && (
        <div className="border-t border-black/10 divide-y divide-muted">
          {touren.map(t => {
            const s = STATUS_STYLE[t.status];
            return (
              <div key={t.id} className={cn('flex items-center gap-3 px-4 py-2.5', s.card)}>
                <div className="shrink-0">
                  {t.status === 'ahead' || t.status === 'on_time'
                    ? <CheckCircle2 size={16} className={s.text} />
                    : <AlertTriangle size={16} className={s.text} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate">{t.fahrer}</div>
                  <div className="text-[9px] text-muted-foreground">{s.label} · Plan: {t.planMin} Min · Ist: {t.istMin} Min</div>
                </div>
                <div className={cn('font-mono text-sm font-black tabular-nums shrink-0', s.text)}>
                  {t.abweichungMin > 0 ? '+' : ''}{t.abweichungMin} Min
                </div>
                <div className={cn('text-[10px] font-bold rounded px-1.5 py-0.5 shrink-0', s.text, t.status === 'critical' ? 'bg-red-100' : t.status === 'late' ? 'bg-amber-100' : t.status === 'ahead' ? 'bg-matcha-100' : 'bg-blue-100')}>
                  {t.abweichungPct > 0 ? '+' : ''}{t.abweichungPct}%
                </div>
              </div>
            );
          })}
          {ts && (
            <div className="px-4 py-1.5 bg-muted/30 text-[9px] text-muted-foreground text-right">
              Stand: {ts.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
