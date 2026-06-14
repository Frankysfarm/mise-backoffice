'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';
import { AlertTriangle, RefreshCw, Ticket } from 'lucide-react';

type CreditStatus = 'issued' | 'redeemed' | 'expired' | 'cancelled';

interface DeliveryCredit {
  id: string;
  orderId: string | null;
  amountEur: number;
  reason: string;
  reasonDetail: string | null;
  status: CreditStatus;
  customerName: string | null;
  customerEmail: string | null;
  expiresAt: string | null;
  redeemedAt: string | null;
  createdAt: string;
}

interface CreditSummary {
  issued: { count: number; totalAmountEur: number };
  redeemed: { count: number; totalAmountEur: number };
  expired: { count: number; totalAmountEur: number };
}

const STATUS_OPTIONS: { value: CreditStatus | ''; label: string }[] = [
  { value: '', label: 'Alle' },
  { value: 'issued', label: 'Offen' },
  { value: 'redeemed', label: 'Eingelöst' },
  { value: 'expired', label: 'Abgelaufen' },
  { value: 'cancelled', label: 'Storniert' },
];

const REASON_LABELS: Record<string, string> = {
  late_delivery: 'Verspätung',
  failed_delivery: 'Zustellfehler',
  manual: 'Manuell',
  quality: 'Qualitätsproblem',
};

function statusBadge(status: CreditStatus) {
  if (status === 'redeemed') return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border bg-matcha-50 border-matcha-200 text-matcha-700">Eingelöst</span>;
  if (status === 'issued') return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border bg-blue-50 border-blue-200 text-blue-700">Offen</span>;
  if (status === 'expired') return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border bg-muted border-border text-muted-foreground">Abgelaufen</span>;
  return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border bg-red-50 border-red-200 text-red-700">Storniert</span>;
}

export function CreditsClient({ locationId }: { locationId: string }) {
  void locationId;
  const [statusFilter, setStatusFilter] = useState<CreditStatus | ''>('issued');
  const [credits, setCredits] = useState<DeliveryCredit[]>([]);
  const [summary, setSummary] = useState<CreditSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    const url = `/api/delivery/admin/credits${statusFilter ? `?status=${statusFilter}` : '?limit=100'}`;
    Promise.all([
      fetch(url).then(r => r.ok ? r.json() : null),
      fetch('/api/delivery/admin/credits?summary=true').then(r => r.ok ? r.json() : null),
    ])
      .then(([creditData, summaryData]) => {
        if (creditData?.credits) setCredits(creditData.credits as DeliveryCredit[]);
        else if (creditData?.error) setError(creditData.error);
        if (summaryData?.summary) setSummary(summaryData.summary);
      })
      .catch(() => { setError('Fehler beim Laden'); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]);

  return (
    <div className="space-y-6">
      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border bg-blue-50 border-blue-200 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Offen</div>
            <div className="font-display text-2xl font-black text-blue-700">{summary.issued.count}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{euro(summary.issued.totalAmountEur)}</div>
          </div>
          <div className="rounded-xl border bg-matcha-50 border-matcha-200 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Eingelöst</div>
            <div className="font-display text-2xl font-black text-matcha-700">{summary.redeemed.count}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{euro(summary.redeemed.totalAmountEur)}</div>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Abgelaufen</div>
            <div className="font-display text-2xl font-black">{summary.expired.count}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{euro(summary.expired.totalAmountEur)}</div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm font-semibold transition',
              statusFilter === opt.value
                ? 'bg-matcha-700 text-white border-matcha-700'
                : 'bg-card border-border text-muted-foreground hover:bg-muted',
            )}
          >
            {opt.label}
          </button>
        ))}
        <button onClick={load} disabled={loading} className="ml-auto flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-sm bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      {loading && <div className="flex items-center justify-center py-16 text-muted-foreground">Lade Gutschriften…</div>}

      {!loading && error && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {!loading && !error && credits.length === 0 && (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Keine Gutschriften.</div>
      )}

      {!loading && credits.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <Ticket className="h-4 w-4 text-matcha-700" />
            <span className="font-semibold text-sm">{credits.length} Gutschriften</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border">
                  <th className="text-left px-4 py-2">Kunde</th>
                  <th className="text-left px-4 py-2">Betrag</th>
                  <th className="text-left px-4 py-2">Grund</th>
                  <th className="text-left px-4 py-2">Erstellt</th>
                  <th className="text-left px-4 py-2">Gültig bis</th>
                  <th className="text-left px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {credits.map(c => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-4 py-2.5">
                      <div className="text-sm font-medium">{c.customerName ?? '—'}</div>
                      {c.customerEmail && <div className="text-[11px] text-muted-foreground">{c.customerEmail}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-sm font-bold text-matcha-700">{euro(c.amountEur)}</td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">{REASON_LABELS[c.reason] ?? c.reason}</td>
                    <td className="px-4 py-2.5 text-sm tabular-nums text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString('de-DE')}
                    </td>
                    <td className="px-4 py-2.5 text-sm tabular-nums text-muted-foreground">
                      {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('de-DE') : '—'}
                    </td>
                    <td className="px-4 py-2.5">{statusBadge(c.status)}</td>
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
