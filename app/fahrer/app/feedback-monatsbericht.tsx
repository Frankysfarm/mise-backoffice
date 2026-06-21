'use client';
import { useEffect, useState } from 'react';
import { Star, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProfileEntry {
  periodStart: string;
  avgCustomerRating: number | null;
  avgDifficulty: number | null;
  avgOverallScore: number | null;
  feedbackCount: number;
  topZone: string | null;
}

interface Props {
  driverId: string;
  locationId: string;
}

export function FahrerFeedbackMonatsbericht({ driverId, locationId }: Props) {
  const [data, setData] = useState<ProfileEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch(
        `/api/delivery/admin/tour-feedback-analytics?action=driver_profile&driver_id=${driverId}&weeks=8`,
      );
      if (!res.ok) return;
      const json = await res.json() as { profile?: ProfileEntry[] };
      setData(json.profile ?? []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!driverId || !locationId) return;
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [driverId, locationId]);

  if (loading || data.length === 0) return null;

  const latest = data[data.length - 1];
  const rating = latest.avgCustomerRating ?? 0;
  const prev = data.length > 1 ? data[data.length - 2] : null;
  const delta = prev?.avgCustomerRating != null && rating > 0
    ? rating - prev.avgCustomerRating
    : 0;

  const starBg = rating >= 4.5 ? 'bg-emerald-50 border-emerald-200' :
                 rating >= 3.5 ? 'bg-amber-50 border-amber-200' :
                 rating > 0    ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200';

  const starText = rating >= 4.5 ? 'text-emerald-700' :
                   rating >= 3.5 ? 'text-amber-700' :
                   rating > 0    ? 'text-red-700' : 'text-slate-500';

  return (
    <div className={cn('rounded-xl border overflow-hidden', starBg)}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <Star className={cn('h-4 w-4 shrink-0', starText)} />
          <span className="text-sm font-semibold text-slate-800">Mein Kunden-Feedback</span>
        </div>
        <div className="flex items-center gap-2">
          {rating > 0 && (
            <span className={cn('text-sm font-bold', starText)}>{rating.toFixed(1)}★</span>
          )}
          {delta > 0.05 && <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />}
          {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t bg-white px-4 py-3 space-y-3">
          {/* Summary KPIs */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Ø Zufriedenheit', value: rating > 0 ? `${rating.toFixed(1)}★` : '—' },
              { label: 'Ø Schwierigkeit', value: latest.avgDifficulty != null ? `${latest.avgDifficulty.toFixed(1)}/5` : '—' },
              { label: 'Bewertungen', value: latest.feedbackCount.toString() },
            ].map((k) => (
              <div key={k.label} className="rounded-lg bg-slate-50 p-2 text-center">
                <p className="text-[10px] text-slate-500 leading-tight">{k.label}</p>
                <p className="mt-0.5 text-base font-bold text-slate-800">{k.value}</p>
              </div>
            ))}
          </div>

          {/* Weekly bars */}
          {data.length > 1 && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1.5">8-Wochen-Verlauf</p>
              <div className="flex items-end gap-1 h-10">
                {data.map((e, i) => {
                  const r = e.avgCustomerRating ?? 0;
                  const h = r > 0 ? Math.round((r / 5) * 100) : 4;
                  const isLast = i === data.length - 1;
                  const barColor = r >= 4.5 ? 'bg-emerald-400' : r >= 3.5 ? 'bg-amber-400' : r > 0 ? 'bg-red-400' : 'bg-slate-200';
                  return (
                    <div key={e.periodStart} className="flex-1 flex flex-col items-center justify-end gap-0.5">
                      <div
                        className={cn('w-full rounded-t-sm transition-all', barColor, isLast ? 'opacity-100' : 'opacity-70')}
                        style={{ height: `${h}%` }}
                        title={r > 0 ? `${r.toFixed(1)}★` : 'Keine Daten'}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-0.5">
                <span className="text-[10px] text-slate-400">{data[0].periodStart.slice(5, 10)}</span>
                <span className="text-[10px] text-slate-400">Diese Woche</span>
              </div>
            </div>
          )}

          {latest.topZone && (
            <p className="text-xs text-slate-500">
              Häufigste Zone: <strong className="text-slate-700">Zone {latest.topZone}</strong>
            </p>
          )}

          {delta > 0.1 && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
              <p className="text-xs text-emerald-700">
                ↑ Deine Kundenzufriedenheit ist um <strong>+{delta.toFixed(1)}★</strong> gestiegen — weiter so!
              </p>
            </div>
          )}
          {delta < -0.1 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
              <p className="text-xs text-amber-700">
                Deine Bewertung sank um {Math.abs(delta).toFixed(1)}★ — auf freundliche Kundenansprache achten.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
