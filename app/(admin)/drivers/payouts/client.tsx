'use client';

import { useState, useEffect, useTransition } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Banknote, Check, ChevronRight, Clock, Euro, Loader2,
  RefreshCw, TrendingUp, Users, Zap,
} from 'lucide-react';

type Location = { id: string; name: string };

interface PayoutSummary {
  today: {
    activeDrivers: number;
    totalDeliveries: number;
    totalPayoutEur: number;
    avgPerDelivery: number;
  };
  pending: {
    draftPeriods: number;
    totalAmountEur: number;
  };
  topDriverToday: { driverId: string; driverName: string; deliveries: number; totalEur: number }[];
}

interface PayoutRecord {
  id: string;
  driverId: string;
  driverName?: string;
  orderId: string | null;
  baseAmount: number;
  kmBonus: number;
  peakBonus: number;
  ratingBonus: number;
  milestoneBonus: number;
  totalAmount: number;
  deliveryKm: number | null;
  wasPeakTime: boolean;
  completedAt: string;
  paidOut: boolean;
}

interface PayoutPeriod {
  id: string;
  driverId: string;
  driverName?: string;
  periodStart: string;
  periodEnd: string;
  periodType: string;
  deliveriesCount: number;
  totalKm: number;
  totalPayout: number;
  avgRating: number | null;
  onTimeRatePct: number | null;
  status: 'draft' | 'approved' | 'paid';
  approvedAt: string | null;
  paidAt: string | null;
}

function fmtEur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const TAB_LABELS = ['Übersicht', 'Einzelabrechnungen', 'Perioden'] as const;
type Tab = typeof TAB_LABELS[number];

export function PayoutsClient({
  defaultLocationId,
  locations,
}: {
  defaultLocationId: string;
  locations: Location[];
}) {
  const [locationId, setLocationId] = useState(defaultLocationId);
  const [tab, setTab] = useState<Tab>('Übersicht');
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [records, setRecords] = useState<PayoutRecord[]>([]);
  const [periods, setPeriods] = useState<PayoutPeriod[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function load() {
    setLoading(true);
    setActionMsg(null);
    try {
      if (tab === 'Übersicht') {
        const r = await fetch(`/api/delivery/admin/payouts?location_id=${locationId}&view=summary`);
        const d = await r.json();
        setSummary(d.summary ?? null);
      } else if (tab === 'Einzelabrechnungen') {
        const r = await fetch(`/api/delivery/admin/payouts?location_id=${locationId}&view=records&limit=100`);
        const d = await r.json();
        setRecords(d.records ?? []);
      } else {
        const r = await fetch(`/api/delivery/admin/payouts?location_id=${locationId}&view=periods`);
        const d = await r.json();
        setPeriods(d.periods ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [locationId, tab]);

  async function generateDaily() {
    const date = new Date().toISOString().slice(0, 10);
    setLoading(true);
    try {
      const r = await fetch('/api/delivery/admin/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_daily', location_id: locationId, date }),
      });
      const d = await r.json();
      setActionMsg(d.message ?? 'Perioden generiert.');
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function approvePeriod(periodId: string) {
    startTransition(async () => {
      await fetch('/api/delivery/admin/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve_period', period_id: periodId }),
      });
      await load();
    });
  }

  async function markPaid(periodId: string) {
    startTransition(async () => {
      await fetch('/api/delivery/admin/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_paid', period_id: periodId }),
      });
      await load();
    });
  }

  const locName = locations.find((l) => l.id === locationId)?.name ?? 'Standort';

  return (
    <div className="space-y-4 p-4 pb-12">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {locations.length > 1 && (
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="rounded-lg border bg-background px-3 py-1.5 text-sm"
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        )}
        <div className="flex rounded-lg border overflow-hidden text-sm">
          {TAB_LABELS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-3 py-1.5 transition-colors',
                tab === t ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Aktualisieren
        </button>
        {tab === 'Perioden' && (
          <button
            onClick={generateDaily}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Zap className="h-3.5 w-3.5" />
            Tages-Abschluss
          </button>
        )}
      </div>

      {actionMsg && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-800">
          {actionMsg}
        </div>
      )}

      {/* Tab: Übersicht */}
      {tab === 'Übersicht' && (
        loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : summary ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryCard icon={<Users className="h-4 w-4" />} label="Aktive Fahrer" value={String(summary.today.activeDrivers)} />
              <SummaryCard icon={<TrendingUp className="h-4 w-4" />} label="Lieferungen heute" value={String(summary.today.totalDeliveries)} />
              <SummaryCard icon={<Euro className="h-4 w-4" />} label="Gesamt-Payout heute" value={fmtEur(summary.today.totalPayoutEur)} accent />
              <SummaryCard icon={<Banknote className="h-4 w-4" />} label="Ø pro Lieferung" value={fmtEur(summary.today.avgPerDelivery)} />
            </div>

            {summary.topDriverToday.length > 0 && (
              <Card className="p-4">
                <h3 className="mb-3 text-sm font-semibold">Top-Fahrer heute</h3>
                <div className="divide-y">
                  {summary.topDriverToday.map((d, i) => (
                    <div key={d.driverId} className="flex items-center gap-3 py-2.5">
                      <span className="w-5 text-center text-xs font-bold text-muted-foreground">#{i + 1}</span>
                      <span className="flex-1 text-sm font-medium">{d.driverName || 'Unbekannt'}</span>
                      <span className="text-xs text-muted-foreground">{d.deliveries} Lief.</span>
                      <span className="font-semibold text-sm tabular-nums">{fmtEur(d.totalEur)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {summary.pending.draftPeriods > 0 && (
              <Card className="p-4 border-amber-200 bg-amber-50">
                <div className="flex items-center gap-2 text-amber-800 text-sm">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>
                    <strong>{summary.pending.draftPeriods}</strong> offene Abrechnungsperioden ({fmtEur(summary.pending.totalAmountEur)}) warten auf Freigabe.
                  </span>
                  <button
                    onClick={() => setTab('Perioden')}
                    className="ml-auto flex items-center gap-1 text-amber-700 hover:text-amber-900 font-medium"
                  >
                    Ansehen <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Card>
            )}

            {summary.today.totalDeliveries === 0 && (
              <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
                Heute noch keine abgeschlossenen Lieferungen mit Abrechnungsdaten.
              </div>
            )}
          </div>
        ) : (
          <EmptyState text="Keine Daten verfügbar." />
        )
      )}

      {/* Tab: Einzelabrechnungen */}
      {tab === 'Einzelabrechnungen' && (
        loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : records.length > 0 ? (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Fahrer</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Zeitpunkt</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Basis</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">km</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Peak</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Bonus</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground font-bold">Gesamt</th>
                    <th className="px-4 py-2 text-center font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {records.map((rec) => (
                    <tr key={rec.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 font-medium">{rec.driverName ?? '—'}</td>
                      <td className="px-4 py-2 text-muted-foreground tabular-nums">{fmtDateTime(rec.completedAt)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmtEur(rec.baseAmount)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {rec.kmBonus > 0 ? `+${fmtEur(rec.kmBonus)}` : '—'}
                        {rec.deliveryKm ? <span className="text-[10px] ml-1 opacity-60">{rec.deliveryKm.toFixed(1)}km</span> : null}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {rec.wasPeakTime ? (
                          <span className="text-amber-600">+{fmtEur(rec.peakBonus)}</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {(rec.ratingBonus + rec.milestoneBonus) > 0
                          ? `+${fmtEur(rec.ratingBonus + rec.milestoneBonus)}`
                          : '—'}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-bold">{fmtEur(rec.totalAmount)}</td>
                      <td className="px-4 py-2 text-center">
                        {rec.paidOut ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 text-[10px]">Bezahlt</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">Offen</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <EmptyState text="Keine Einzelabrechnungen in den letzten 7 Tagen." />
        )
      )}

      {/* Tab: Perioden */}
      {tab === 'Perioden' && (
        loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : periods.length > 0 ? (
          <div className="space-y-2">
            {periods.map((p) => (
              <Card key={p.id} className="p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{p.driverName ?? 'Fahrer'}</span>
                      <PeriodStatusBadge status={p.status} />
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {fmtDate(p.periodStart)} – {fmtDate(p.periodEnd)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>{p.deliveriesCount} Lieferungen</span>
                      <span>{p.totalKm.toFixed(1)} km</span>
                      {p.avgRating && <span>Ø {p.avgRating.toFixed(1)} ⭐</span>}
                      {p.onTimeRatePct != null && <span>{p.onTimeRatePct.toFixed(0)}% pünktlich</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold tabular-nums">{fmtEur(p.totalPayout)}</span>
                    {p.status === 'draft' && (
                      <button
                        onClick={() => approvePeriod(p.id)}
                        disabled={isPending}
                        className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        <Check className="h-3 w-3" /> Freigeben
                      </button>
                    )}
                    {p.status === 'approved' && (
                      <button
                        onClick={() => markPaid(p.id)}
                        disabled={isPending}
                        className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        <Banknote className="h-3 w-3" /> Als bezahlt markieren
                      </button>
                    )}
                    {p.status === 'paid' && p.paidAt && (
                      <span className="text-xs text-muted-foreground">Bezahlt {fmtDate(p.paidAt)}</span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
            <p className="mb-3">Noch keine Abrechnungsperioden.</p>
            <button
              onClick={generateDaily}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Zap className="h-3.5 w-3.5" />
              Heutigen Tages-Abschluss generieren
            </button>
          </div>
        )
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <Card className={cn('p-4', accent && 'border-primary/30 bg-primary/5')}>
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className={cn('text-xl font-bold tabular-nums', accent && 'text-primary')}>{value}</div>
    </Card>
  );
}

function PeriodStatusBadge({ status }: { status: 'draft' | 'approved' | 'paid' }) {
  if (status === 'paid') return <Badge className="bg-green-100 text-green-700 text-[10px]">Bezahlt</Badge>;
  if (status === 'approved') return <Badge className="bg-blue-100 text-blue-700 text-[10px]">Freigegeben</Badge>;
  return <Badge variant="secondary" className="text-[10px]">Entwurf</Badge>;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
