'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { UserX, Calendar, AlertTriangle, ChevronDown, ChevronUp, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';

type AbsenceRow = {
  id: string;
  employee_id: string;
  employee_name: string;
  date_from: string;
  date_to: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
};

type CoverageDay = {
  date: string;
  total_drivers: number;
  absent_drivers: number;
  coverage_pct: number;
  risk_level: 'ok' | 'low' | 'critical';
};

type Data = {
  today: AbsenceRow[];
  upcoming: AbsenceRow[];
  coverage: CoverageDay[];
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

const STATUS_META = {
  pending:  { label: 'Ausstehend', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  approved: { label: 'Genehmigt',  cls: 'bg-matcha-100 text-matcha-700 border-matcha-200' },
  rejected: { label: 'Abgelehnt',  cls: 'bg-red-100 text-red-700 border-red-200' },
};

const RISK_META = {
  ok:       { label: 'OK',       dot: 'bg-matcha-500', bar: 'bg-matcha-500' },
  low:      { label: 'Niedrig',  dot: 'bg-amber-400',  bar: 'bg-amber-400'  },
  critical: { label: 'Kritisch', dot: 'bg-red-500',    bar: 'bg-red-500'    },
};

export function FahrerAbwesenheitsUebersicht({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const [todayRes, upcomingRes] = await Promise.all([
        fetch(`/api/delivery/admin/driver-absences?action=today&location_id=${locationId}`),
        fetch(`/api/delivery/admin/driver-absences?action=upcoming&days=7&location_id=${locationId}`),
      ]);
      const today: AbsenceRow[] = todayRes.ok ? await todayRes.json() : [];
      const upcoming: AbsenceRow[] = upcomingRes.ok ? await upcomingRes.json() : [];

      // Build simple coverage overview from upcoming
      const now = new Date();
      const coverage: CoverageDay[] = Array.from({ length: 5 }, (_, i) => {
        const d = new Date(now);
        d.setDate(now.getDate() + i);
        const dateStr = d.toISOString().slice(0, 10);
        const absentCount = upcoming.filter(a => {
          const from = a.date_from.slice(0, 10);
          const to = a.date_to.slice(0, 10);
          return a.status === 'approved' && from <= dateStr && to >= dateStr;
        }).length;
        const total = 6; // assume 6 active drivers per location by default
        const coverage_pct = Math.max(0, Math.round(((total - absentCount) / total) * 100));
        const risk_level: CoverageDay['risk_level'] = coverage_pct < 50 ? 'critical' : coverage_pct < 80 ? 'low' : 'ok';
        return { date: dateStr, total_drivers: total, absent_drivers: absentCount, coverage_pct, risk_level };
      });

      setData({ today: today.slice(0, 5), upcoming: upcoming.slice(0, 8), coverage });
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const hasCritical = data?.coverage.some(c => c.risk_level === 'critical') ?? false;
  const todayCount = data?.today.length ?? 0;

  return (
    <div className={cn('rounded-xl border overflow-hidden', hasCritical ? 'border-red-200 bg-red-50/30' : 'border-stone-200 bg-white')}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <UserX className={cn('h-4 w-4', hasCritical ? 'text-red-500' : 'text-stone-500')} />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Fahrer-Abwesenheiten</span>
          {todayCount > 0 && (
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold border', hasCritical ? 'bg-red-100 text-red-700 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200')}>
              {todayCount} heute abwesend
            </span>
          )}
          {todayCount === 0 && data && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-matcha-100 text-matcha-700 border border-matcha-200">
              Alle verfügbar
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {open && (
            <button
              onClick={(e) => { e.stopPropagation(); refresh(); }}
              disabled={refreshing}
              className="p-1.5 rounded-lg hover:bg-muted transition disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3 w-3 text-muted-foreground', refreshing && 'animate-spin')} />
            </button>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t px-5 py-4 space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lade Abwesenheiten…
            </div>
          )}

          {!loading && !locationId && (
            <p className="text-sm text-muted-foreground">Bitte Standort auswählen.</p>
          )}

          {!loading && data && locationId && (
            <>
              {/* 5-Tage-Kapazitätsübersicht */}
              <div>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" /> 5-Tage-Verfügbarkeit
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {data.coverage.map((day) => {
                    const rm = RISK_META[day.risk_level];
                    const isToday = day.date === new Date().toISOString().slice(0, 10);
                    return (
                      <div
                        key={day.date}
                        className={cn(
                          'rounded-lg border p-2 text-center',
                          isToday ? 'border-matcha-300 bg-matcha-50' : 'border-stone-100 bg-white',
                          day.risk_level === 'critical' && 'border-red-200 bg-red-50',
                          day.risk_level === 'low' && 'border-amber-200 bg-amber-50',
                        )}
                      >
                        <div className="text-[9px] font-bold text-muted-foreground uppercase">
                          {new Date(day.date).toLocaleDateString('de-DE', { weekday: 'short' })}
                        </div>
                        <div className={cn('text-base font-black tabular-nums', day.risk_level === 'critical' ? 'text-red-600' : day.risk_level === 'low' ? 'text-amber-600' : 'text-matcha-700')}>
                          {day.coverage_pct}%
                        </div>
                        <div className={cn('mx-auto mt-1 h-1 w-6 rounded-full', rm.bar)} style={{ opacity: 0.7 }} />
                        {day.absent_drivers > 0 && (
                          <div className="text-[8px] text-muted-foreground mt-0.5">{day.absent_drivers} fehlt</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Heute abwesend */}
              {data.today.length > 0 && (
                <div>
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3 text-amber-500" /> Heute abwesend
                  </div>
                  <div className="space-y-1.5">
                    {data.today.map((a) => {
                      const sm = STATUS_META[a.status];
                      return (
                        <div key={a.id} className="flex items-center justify-between rounded-lg border border-stone-100 bg-stone-50 px-3 py-2">
                          <div>
                            <div className="text-xs font-bold text-foreground">{a.employee_name}</div>
                            {a.reason && <div className="text-[10px] text-muted-foreground">{a.reason}</div>}
                          </div>
                          <span className={cn('rounded-full border px-2 py-0.5 text-[9px] font-bold', sm.cls)}>
                            {sm.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {data.today.length === 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-matcha-50 border border-matcha-200 px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 text-matcha-600 shrink-0" />
                  <span className="text-sm font-semibold text-matcha-700">Heute alle Fahrer verfügbar</span>
                </div>
              )}

              {/* Kommende Abwesenheiten */}
              {data.upcoming.length > 0 && (
                <div>
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Nächste 7 Tage
                  </div>
                  <div className="space-y-1">
                    {data.upcoming.slice(0, 6).map((a) => {
                      const sm = STATUS_META[a.status];
                      const fromDate = fmtDate(a.date_from);
                      const toDate = fmtDate(a.date_to);
                      const sameDay = a.date_from.slice(0, 10) === a.date_to.slice(0, 10);
                      return (
                        <div key={a.id} className="flex items-center gap-3 rounded-lg border border-stone-100 px-3 py-2 bg-white">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-foreground truncate">{a.employee_name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {sameDay ? fromDate : `${fromDate} – ${toDate}`}
                            </div>
                          </div>
                          <span className={cn('rounded-full border px-2 py-0.5 text-[9px] font-bold shrink-0', sm.cls)}>
                            {sm.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
