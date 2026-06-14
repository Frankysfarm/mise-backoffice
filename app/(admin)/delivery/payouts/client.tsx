'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';
import { Banknote, CheckCircle2, FileText, RefreshCw } from 'lucide-react';

interface PayoutPeriod {
  id: string;
  driverId: string;
  driverName?: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  deliveriesCount: number;
  totalKm: number;
  totalBase: number;
  totalKmBonus: number;
  totalPeakBonus: number;
  totalRatingBonus: number;
  totalMilestoneBonus: number;
  totalPayout: number;
  avgRating: number | null;
  onTimeRatePct: number | null;
  status: 'draft' | 'approved' | 'paid';
  approvedAt: string | null;
}

interface PayoutSummary {
  drafts: { count: number; totalPayoutEur: number };
  approved: { count: number; totalPayoutEur: number };
  paid7d: { count: number; totalPayoutEur: number };
  topDrivers: { driverId: string; driverName?: string; totalPayoutEur: number; deliveriesCount: number }[];
}

interface PeriodsData {
  periods: PayoutPeriod[];
  count: number;
  total_payout_eur: number;
}

interface SummaryData {
  summary: PayoutSummary;
}

type StatusFilter = 'draft' | 'approved' | 'paid';

const STATUS_LABELS: Record<StatusFilter, string> = {
  draft: 'Entwurf',
  approved: 'Genehmigt',
  paid: 'Ausgezahlt',
};

function statusBadge(status: string) {
  if (status === 'paid') return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border bg-matcha-50 border-matcha-200 text-matcha-700">Ausgezahlt</span>;
  if (status === 'approved') return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border bg-blue-50 border-blue-200 text-blue-700">Genehmigt</span>;
  return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border bg-amber-50 border-amber-200 text-amber-700">Entwurf</span>;
}

export function PayoutsClient({ locationId }: { locationId: string }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('draft');
  const [periods, setPeriods] = useState<PayoutPeriod[]>([]);
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [totalPayout, setTotalPayout] = useState(0);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    setLoading(true);
    setSelected(new Set());
    Promise.all([
      fetch(`/api/delivery/admin/payouts?location_id=${locationId}&view=periods&status=${statusFilter}&limit=100`).then(r => r.ok ? r.json() : null),
      fetch(`/api/delivery/admin/payouts?location_id=${locationId}&view=summary`).then(r => r.ok ? r.json() : null),
    ]).then(([pd, sd]) => {
      if (pd?.periods) { setPeriods(pd.periods); setTotalPayout(pd.total_payout_eur ?? 0); }
      if (sd?.summary) setSummary(sd.summary);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [locationId, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const postAction = async (action: string, body: Record<string, unknown>) => {
    setActing(action);
    await fetch('/api/delivery/admin/payouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, location_id: locationId }),
    });
    setActing(null);
    load();
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const bulkApprove = () => postAction('bulk_approve', { action: 'bulk_approve', period_ids: [...selected] });
  const bulkPay = () => postAction('bulk_mark_paid', { action: 'bulk_mark_paid', period_ids: [...selected] });
  const generateDaily = () => {
    const today = new Date().toISOString().slice(0, 10);
    postAction('generate_daily', { action: 'generate_daily', date: today });
  };

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className={cn('rounded-xl border px-4 py-3', summary.drafts.count > 0 ? 'bg-amber-50 border-amber-200' : 'bg-card')}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Entwürfe</div>
            <div className={cn('font-display text-2xl font-black', summary.drafts.count > 0 ? 'text-amber-700' : '')}>{summary.drafts.count}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{euro(summary.drafts.totalPayoutEur)}</div>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Genehmigt</div>
            <div className="font-display text-2xl font-black">{summary.approved.count}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{euro(summary.approved.totalPayoutEur)}</div>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Ausgezahlt (7T)</div>
            <div className="font-display text-2xl font-black">{euro(summary.paid7d.totalPayoutEur)}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{summary.paid7d.count} Perioden</div>
          </div>
        </div>
      )}

      {/* Filter + Aktionen */}
      <div className="flex items-center gap-2 flex-wrap">
        {(Object.keys(STATUS_LABELS) as StatusFilter[]).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm font-semibold transition',
              statusFilter === s
                ? 'bg-matcha-700 text-white border-matcha-700'
                : 'bg-card border-border text-muted-foreground hover:bg-muted',
            )}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {selected.size > 0 && statusFilter === 'draft' && (
            <button onClick={bulkApprove} disabled={!!acting} className="rounded-lg border border-blue-300 bg-blue-50 text-blue-700 px-3 py-1.5 text-sm font-semibold hover:bg-blue-100 transition disabled:opacity-50">
              {selected.size} genehmigen
            </button>
          )}
          {selected.size > 0 && statusFilter === 'approved' && (
            <button onClick={bulkPay} disabled={!!acting} className="rounded-lg border border-matcha-300 bg-matcha-50 text-matcha-700 px-3 py-1.5 text-sm font-semibold hover:bg-matcha-100 transition disabled:opacity-50">
              {selected.size} als ausgezahlt markieren
            </button>
          )}
          <button onClick={generateDaily} disabled={!!acting} className="rounded-lg border border-matcha-700 bg-matcha-700 text-white px-3 py-1.5 text-sm font-semibold hover:bg-matcha-800 transition disabled:opacity-50">
            <Banknote className="h-3.5 w-3.5 inline mr-1" />
            {acting === 'generate_daily' ? 'Wird generiert…' : 'Tagesabrechnung generieren'}
          </button>
          <button onClick={load} disabled={loading} className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-sm bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50">
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {loading && <div className="flex items-center justify-center py-16 text-muted-foreground">Lade Abrechnungen…</div>}

      {!loading && periods.length === 0 && (
        <div className="flex items-center gap-2 justify-center py-16 text-muted-foreground text-sm">
          <CheckCircle2 className="h-4 w-4" />
          Keine Perioden mit Status „{STATUS_LABELS[statusFilter]}".
        </div>
      )}

      {!loading && periods.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <span className="font-semibold text-sm">{periods.length} Perioden · {euro(totalPayout)} gesamt</span>
            {statusFilter !== 'paid' && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-matcha-700"
                  checked={selected.size === periods.length}
                  onChange={() => setSelected(selected.size === periods.length ? new Set() : new Set(periods.map(p => p.id)))}
                />
                Alle
              </label>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border">
                  {statusFilter !== 'paid' && <th className="px-4 py-2 w-8" />}
                  <th className="text-left px-4 py-2">Fahrer</th>
                  <th className="text-left px-4 py-2">Zeitraum</th>
                  <th className="text-left px-4 py-2">Touren</th>
                  <th className="text-left px-4 py-2">km</th>
                  <th className="text-left px-4 py-2">Auszahlung</th>
                  <th className="text-left px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {periods.map(p => (
                  <tr key={p.id} className={cn('border-t border-border transition-colors', selected.has(p.id) ? 'bg-matcha-50/40' : 'hover:bg-muted/30')}>
                    {statusFilter !== 'paid' && (
                      <td className="px-4 py-2.5 w-8">
                        <input type="checkbox" className="accent-matcha-700" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} />
                      </td>
                    )}
                    <td className="px-4 py-2.5">
                      <div className="text-sm font-medium">{p.driverName ?? p.driverId.slice(0, 8)}</div>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground tabular-nums">
                      {new Date(p.periodStart).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                      {' – '}
                      {new Date(p.periodEnd).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                    </td>
                    <td className="px-4 py-2.5 text-sm tabular-nums">{p.deliveriesCount}</td>
                    <td className="px-4 py-2.5 text-sm tabular-nums text-muted-foreground">{p.totalKm.toFixed(1)}</td>
                    <td className="px-4 py-2.5">
                      <div className="text-sm font-bold">{euro(p.totalPayout)}</div>
                      <div className="text-[10px] text-muted-foreground">
                        Basis {euro(p.totalBase)} + km {euro(p.totalKmBonus)}{p.totalPeakBonus > 0 ? ` + peak ${euro(p.totalPeakBonus)}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {statusBadge(p.status)}
                        {(p.status === 'approved' || p.status === 'paid') && (
                          <a
                            href={`/api/pdf/lohnzettel?period_id=${p.id}&location_id=${locationId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Lohnzettel als PDF"
                            className="inline-flex items-center gap-1 rounded border border-stone-200 bg-white px-1.5 py-0.5 text-[10px] text-steel hover:bg-stone-50 transition"
                          >
                            <FileText className="h-2.5 w-2.5" /> PDF
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
