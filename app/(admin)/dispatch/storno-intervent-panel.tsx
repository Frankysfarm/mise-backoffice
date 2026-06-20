'use client';

/**
 * DispatchStornoInterventPanel — Phase 345
 *
 * Zeigt alle hochriskanten Stornierungsereignisse + ermöglicht Voucher-Intervention.
 */

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Tag, ShieldX, ChevronDown, ChevronUp } from 'lucide-react';

interface GuardEvent {
  id: string;
  order_id: string | null;
  customer_id: string | null;
  event_type: string;
  risk_level: string;
  cancellation_count_24h: number;
  voucher_code: string | null;
  reason: string | null;
  created_at: string;
}

interface Dashboard {
  todayAttempts: number;
  todayBlocked: number;
  todayVouchersOffered: number;
  blockRate: number;
  recentEvents: GuardEvent[];
}

const RISK_COLORS: Record<string, string> = {
  medium: 'text-amber-700',
  high: 'text-orange-700',
  blocked: 'text-red-700',
};

export function DispatchStornoInterventPanel({ locationId }: { locationId: string | null }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [open, setOpen] = useState(false);
  const [voucherState, setVoucherState] = useState<Record<string, string | 'loading'>>({});

  const load = useCallback(async () => {
    if (!locationId) return;
    const res = await fetch(
      `/api/delivery/admin/cancellation-guard?action=dashboard&location_id=${locationId}`,
      { cache: 'no-store' },
    ).catch(() => null);
    if (res?.ok) setDashboard(await res.json() as Dashboard);
  }, [locationId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 90_000);
    return () => clearInterval(interval);
  }, [load]);

  const highRiskEvents = (dashboard?.recentEvents ?? []).filter(
    (e) => ['high', 'blocked'].includes(e.risk_level) && e.event_type !== 'voucher_offered',
  ).slice(0, 5);

  if (!dashboard || highRiskEvents.length === 0) return null;

  async function offerVoucher(evt: GuardEvent) {
    if (!evt.customer_id) return;
    setVoucherState((prev) => ({ ...prev, [evt.id]: 'loading' }));
    const res = await fetch('/api/delivery/admin/cancellation-guard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'offer_voucher', customer_id: evt.customer_id, order_id: evt.order_id }),
    }).catch(() => null);
    if (res?.ok) {
      const data = (await res.json()) as { voucher_code: string };
      setVoucherState((prev) => ({ ...prev, [evt.id]: data.voucher_code }));
      await load();
    } else {
      setVoucherState((prev) => { const n = { ...prev }; delete n[evt.id]; return n; });
    }
  }

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 p-3 hover:bg-stone-50 transition"
      >
        <ShieldAlert className="h-4 w-4 text-orange-600 shrink-0" />
        <span className="text-sm font-semibold flex-1 text-left">
          Stornierungsrisiko — {highRiskEvents.length} hochriskante Event{highRiskEvents.length > 1 ? 's' : ''}
        </span>
        <span className="text-xs text-muted-foreground mr-1">
          {dashboard.todayBlocked} gesperrt · {dashboard.blockRate}% Rate
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t divide-y">
          {highRiskEvents.map((evt) => {
            const vs = voucherState[evt.id];
            return (
              <div key={evt.id} className="p-3 flex items-center gap-3">
                <ShieldX className={`h-4 w-4 shrink-0 ${RISK_COLORS[evt.risk_level] ?? 'text-stone-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium">
                    Risiko: <span className={RISK_COLORS[evt.risk_level] ?? ''}>{evt.risk_level.toUpperCase()}</span>
                    {' · '}{evt.cancellation_count_24h}× in 24h
                  </div>
                  {evt.customer_id && (
                    <div className="text-[10px] text-muted-foreground font-mono">{evt.customer_id.slice(0, 12)}…</div>
                  )}
                </div>
                {vs && vs !== 'loading' ? (
                  <span className="text-xs font-mono bg-violet-50 text-violet-700 border border-violet-200 rounded px-2 py-0.5">
                    {vs}
                  </span>
                ) : evt.customer_id && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => offerVoucher(evt)}
                    disabled={vs === 'loading'}
                    className="text-xs shrink-0"
                  >
                    <Tag className="h-3 w-3 mr-1" />
                    {vs === 'loading' ? '…' : 'Voucher'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
