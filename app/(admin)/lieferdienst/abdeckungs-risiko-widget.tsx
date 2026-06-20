'use client';
/**
 * LieferdienstAbdeckungsRisikoWidget
 * Shows 7-day driver coverage risk based on approved absences.
 * Polls /api/delivery/admin/driver-absences?action=coverage every 10min.
 */
import { useEffect, useState } from 'react';
import { Users, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CoverageDay {
  date: string;
  absentDrivers: number;
  scheduledDrivers: number;
  availabilityPct: number;
  risk: 'low' | 'medium' | 'high';
}

export function LieferdienstAbdeckungsRisikoWidget() {
  const [days, setDays]       = useState<CoverageDay[]>([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const now  = new Date().toISOString().slice(0, 10);
      const end  = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const res  = await fetch(`/api/delivery/admin/driver-absences?action=coverage&from=${now}&to=${end}`);
      if (!res.ok) return;
      const json = await res.json() as { coverage?: CoverageDay[] };
      setDays(json.coverage ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  if (loading || days.length === 0) return null;

  const highRisk = days.filter((d) => d.risk === 'high').length;
  const medRisk  = days.filter((d) => d.risk === 'medium').length;

  const riskColor: Record<string, string> = {
    low:    'bg-emerald-500',
    medium: 'bg-amber-500',
    high:   'bg-red-500',
  };
  const riskLabel: Record<string, string> = {
    low: 'OK', medium: 'Mittel', high: 'Kritisch',
  };

  const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
      >
        <Users className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-bold text-foreground">Abdeckungs-Risiko (7 Tage)</span>
          <span className="ml-2 text-xs text-muted-foreground">
            {highRisk > 0 && <span className="text-red-600 font-semibold">{highRisk}× kritisch </span>}
            {medRisk  > 0 && <span className="text-amber-600 font-semibold">{medRisk}× mittel</span>}
            {highRisk === 0 && medRisk === 0 && <span className="text-emerald-600">Alles OK</span>}
          </span>
        </div>
        {(highRisk > 0 || medRisk > 0) && <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3">
          {/* Bar chart */}
          <div className="flex items-end gap-1 h-16">
            {days.map((d) => {
              const dateObj = new Date(d.date + 'T12:00:00Z');
              const pct = d.availabilityPct;
              const height = Math.max(10, pct);
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={cn('w-full rounded-t transition-all', riskColor[d.risk])}
                    style={{ height: `${height}%` }}
                    title={`${d.availabilityPct}% verfügbar`}
                  />
                  <span className="text-[9px] text-muted-foreground">
                    {dayNames[dateObj.getUTCDay()]}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-3 flex-wrap">
            {(['low', 'medium', 'high'] as const).map((r) => (
              <span key={r} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className={cn('h-2 w-2 rounded-full', riskColor[r])} />
                {riskLabel[r]}
              </span>
            ))}
          </div>

          {/* Day details */}
          <div className="space-y-1">
            {days.filter((d) => d.risk !== 'low').map((d) => (
              <div
                key={d.date}
                className={cn(
                  'rounded-lg px-3 py-2 text-xs flex items-center justify-between',
                  d.risk === 'high' ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
                )}
              >
                <span className={cn('font-semibold', d.risk === 'high' ? 'text-red-700' : 'text-amber-700')}>
                  {new Date(d.date + 'T12:00:00Z').toLocaleDateString('de-DE', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                <span className={d.risk === 'high' ? 'text-red-600' : 'text-amber-600'}>
                  {d.absentDrivers} abwesend · {d.availabilityPct}% verfügbar
                </span>
              </div>
            ))}
            {days.every((d) => d.risk === 'low') && (
              <p className="text-xs text-emerald-600 font-semibold text-center py-1">
                ✓ Keine kritischen Abwesenheiten in den nächsten 7 Tagen
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
