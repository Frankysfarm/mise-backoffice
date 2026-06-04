'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn, euro } from '@/lib/utils';
import {
  BarChart3, Banknote, Bike, CreditCard, Download, FileText, Globe, MailOpen, Package, Ticket, TrendingDown, TrendingUp, Users,
} from 'lucide-react';

// ─── Perioden-Report Typen ───────────────────────────────────────────────────
type PeriodSummary = {
  totalOrders: number;
  totalDeliveries: number;
  completedOrders: number;
  cancelledOrders: number;
  totalRevenue: number | null;
  avgDailyOrders: number;
  onTimePct: number | null;
  avgEtaDeviationMin: number | null;
  activeDriversUnique: number;
  daysIncluded: number;
};
type PeriodDriver = {
  driverName: string | null;
  driverVehicle: string | null;
  deliveries: number;
  onTimePct: number | null;
  avgEtaDeviationMin: number | null;
};
type DailyBreakdownItem = {
  date: string;
  orders: { total: number; completed: number };
  revenue: { total: number | null };
};
type PeriodReportData = {
  periodStart: string;
  periodEnd: string;
  summary: PeriodSummary;
  dailyBreakdown: DailyBreakdownItem[];
  topDrivers: PeriodDriver[];
};
// ────────────────────────────────────────────────────────────────────────────

type Order = {
  bestellnummer: string;
  status: string;
  typ: string;
  gesamtbetrag: number;
  zahlungsart: string;
  bezahlt: boolean;
  bestellt_am: string;
  external_source: string | null;
};
type PosTx = { brutto_gesamt: number; zahlungsart: string; created_at: string; typ: string; storniert: boolean };
type TopItem = { name: string; menge: number; einzelpreis: number };
type Redemption = { rabatt_betrag: number; created_at: string };
type CampaignStat = { versendet_count: number; geoeffnet_count: number; geklickt_count: number };

export function AnalyticsDashboard({
  orders, pos, posPrev, topItems, onlineDrivers, activeEmployees, redemptions, campaigns, today, locationId,
}: {
  orders: Order[]; pos: PosTx[]; posPrev: PosTx[];
  topItems: TopItem[];
  onlineDrivers: number; activeEmployees: number;
  redemptions: Redemption[];
  campaigns: CampaignStat[];
  today: string;
  locationId: string | null;
}) {
  // =============== KPIs ===============
  const kpis = useMemo(() => {
    const posSum = pos.filter((p) => !p.storniert).reduce((s, t) => s + Number(t.brutto_gesamt), 0);
    const posPrevSum = posPrev.reduce((s, t) => s + Number(t.brutto_gesamt), 0);
    const shopSum = orders.reduce((s, o) => s + Number(o.gesamtbetrag), 0);
    const totalRevenue = posSum + shopSum;

    const orderCount = orders.length + pos.length;
    const avgTicket = orderCount > 0 ? totalRevenue / orderCount : 0;

    const trend = posPrevSum > 0 ? ((posSum - posPrevSum) / posPrevSum) * 100 : null;

    return { totalRevenue, posSum, shopSum, orderCount, avgTicket, trend };
  }, [orders, pos, posPrev]);

  // =============== Tagesverlauf (letzte 14 Tage) ===============
  const dailyTrend = useMemo(() => {
    const now = new Date();
    const buckets: { date: string; label: string; total: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
      const iso = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit' });
      buckets.push({ date: iso, label, total: 0 });
    }
    const map = new Map(buckets.map((b) => [b.date, b]));
    orders.forEach((o) => {
      const d = o.bestellt_am.slice(0, 10);
      const b = map.get(d);
      if (b) b.total += Number(o.gesamtbetrag);
    });
    pos.forEach((t) => {
      if (t.storniert) return;
      const d = t.created_at.slice(0, 10);
      const b = map.get(d);
      if (b) b.total += Number(t.brutto_gesamt);
    });
    return buckets;
  }, [orders, pos]);

  // =============== Kanal-Verteilung ===============
  const channels = useMemo(() => {
    const map = new Map<string, { name: string; icon: string; revenue: number; orders: number; color: string }>();
    map.set('pos', { name: 'Kasse', icon: '💰', revenue: 0, orders: 0, color: '#d4a843' });
    map.set('shop', { name: 'Eigener Shop', icon: '🍵', revenue: 0, orders: 0, color: '#14532d' });
    map.set('lieferando', { name: 'Lieferando', icon: '🧡', revenue: 0, orders: 0, color: '#f97316' });
    map.set('ubereats', { name: 'Uber Eats', icon: '🟩', revenue: 0, orders: 0, color: '#10b981' });
    map.set('wolt', { name: 'Wolt', icon: '💙', revenue: 0, orders: 0, color: '#3b82f6' });

    pos.forEach((t) => {
      if (t.storniert) return;
      const p = map.get('pos')!;
      p.revenue += Number(t.brutto_gesamt);
      p.orders++;
    });
    orders.forEach((o) => {
      const key = o.external_source || 'shop';
      const m = map.get(key);
      if (m) { m.revenue += Number(o.gesamtbetrag); m.orders++; }
    });
    return Array.from(map.values()).filter((c) => c.orders > 0).sort((a, b) => b.revenue - a.revenue);
  }, [orders, pos]);

  // =============== Zahlungsarten ===============
  const paymentTypes = useMemo(() => {
    const map = new Map<string, { name: string; icon: React.ReactNode; total: number; count: number }>();
    const add = (key: string, name: string, icon: React.ReactNode, amount: number) => {
      const ex = map.get(key);
      if (ex) { ex.total += amount; ex.count++; }
      else map.set(key, { name, icon, total: amount, count: 1 });
    };
    pos.forEach((t) => {
      if (t.storniert) return;
      const k = t.zahlungsart;
      const label = k === 'bar' ? 'Bar' : k === 'karte' ? 'Karte' : k === 'digital' ? 'Digital' : k;
      const ic = k === 'bar' ? <Banknote size={14} /> : k === 'karte' ? <CreditCard size={14} /> : <Globe size={14} />;
      add(k, label, ic, Number(t.brutto_gesamt));
    });
    orders.forEach((o) => {
      const k = o.zahlungsart;
      const label = k === 'bar' ? 'Bar' : k === 'karte' ? 'Karte' : k === 'online' || k === 'stripe' ? 'Online' : k;
      const ic = k === 'bar' ? <Banknote size={14} /> : k === 'karte' ? <CreditCard size={14} /> : <Globe size={14} />;
      add(label.toLowerCase(), label, ic, Number(o.gesamtbetrag));
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [orders, pos]);

  // =============== Top-Seller ===============
  const topSellers = useMemo(() => {
    const map = new Map<string, { name: string; menge: number; umsatz: number }>();
    topItems.forEach((i) => {
      const ex = map.get(i.name);
      if (ex) { ex.menge += Number(i.menge); ex.umsatz += Number(i.einzelpreis) * Number(i.menge); }
      else map.set(i.name, { name: i.name, menge: Number(i.menge), umsatz: Number(i.einzelpreis) * Number(i.menge) });
    });
    return Array.from(map.values()).sort((a, b) => b.menge - a.menge).slice(0, 8);
  }, [topItems]);

  // =============== Peak-Hours Heatmap ===============
  const peakHours = useMemo(() => {
    // grid: 7 days × 24 hours, summe umsatz
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
    const count = (time: string, amount: number) => {
      const d = new Date(time);
      const day = (d.getDay() + 6) % 7; // Monday = 0
      const hour = d.getHours();
      grid[day][hour] += amount;
    };
    orders.forEach((o) => count(o.bestellt_am, Number(o.gesamtbetrag)));
    pos.forEach((t) => { if (!t.storniert) count(t.created_at, Number(t.brutto_gesamt)); });
    const max = Math.max(1, ...grid.flat());
    return { grid, max };
  }, [orders, pos]);

  // =============== Vouchers / Campaigns ===============
  const voucherSum = redemptions.reduce((s, r) => s + Number(r.rabatt_betrag), 0);
  const campaignTotal = campaigns.reduce((s, c) => s + c.versendet_count, 0);
  const campaignOpenRate = campaigns.length > 0
    ? Math.round(campaigns.reduce((s, c) => s + (c.geoeffnet_count / Math.max(1, c.versendet_count)), 0) / campaigns.length * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Hero-KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          icon={<TrendingUp size={16} />}
          label="Umsatz (30T)"
          value={euro(kpis.totalRevenue)}
          tone="accent"
          trend={kpis.trend}
        />
        <KPICard icon={<Package size={16} />} label="Bestellungen" value={kpis.orderCount.toString()} />
        <KPICard icon={<CreditCard size={16} />} label="⌀ Bon" value={euro(kpis.avgTicket)} />
        <KPICard icon={<Bike size={16} />} label="Fahrer online" value={onlineDrivers.toString()} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Umsatz-Trend-Chart */}
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-baseline justify-between mb-5">
            <div>
              <h2 className="font-display font-bold">Umsatz · letzte 14 Tage</h2>
              <div className="text-xs text-muted-foreground">Shop + Kasse + Lieferplattformen</div>
            </div>
            <div className="font-display text-2xl font-bold">{euro(kpis.totalRevenue)}</div>
          </div>

          <TrendChart data={dailyTrend} />
        </Card>

        {/* Kanal-Verteilung */}
        <Card className="p-6">
          <h2 className="font-display font-bold mb-4">Kanäle</h2>
          {channels.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Noch keine Daten</div>
          ) : (
            <div className="space-y-3">
              {channels.map((c) => {
                const pct = kpis.totalRevenue > 0 ? (c.revenue / kpis.totalRevenue) * 100 : 0;
                return (
                  <div key={c.name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-2"><span className="text-base">{c.icon}</span>{c.name}</span>
                      <span className="font-display font-bold">{euro(c.revenue)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{c.orders} Orders · {pct.toFixed(0)}%</div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top-Seller */}
        <Card className="p-6">
          <h2 className="font-display font-bold mb-4">Top-Seller</h2>
          {topSellers.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Noch keine verkauften Artikel</div>
          ) : (
            <div className="space-y-2">
              {topSellers.map((s, i) => {
                const maxMenge = topSellers[0].menge;
                const pct = (s.menge / maxMenge) * 100;
                return (
                  <div key={s.name} className="flex items-center gap-3">
                    <div className="font-display font-bold text-muted-foreground w-6 text-xs">{i + 1}.</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold truncate">{s.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{s.menge}×</span>
                      </div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden mt-1">
                        <div className="h-full bg-gradient-to-r from-matcha-700 to-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="font-display font-bold text-sm w-20 text-right">{euro(s.umsatz)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Zahlungsarten */}
        <Card className="p-6">
          <h2 className="font-display font-bold mb-4">Zahlungsarten</h2>
          {paymentTypes.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Keine Umsätze</div>
          ) : (
            <div className="space-y-3">
              {paymentTypes.map((p) => {
                const pct = kpis.totalRevenue > 0 ? (p.total / kpis.totalRevenue) * 100 : 0;
                return (
                  <div key={p.name} className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-matcha-100 text-matcha-700 flex items-center justify-center shrink-0">
                      {p.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{p.name}</span>
                        <span className="font-display font-bold">{euro(p.total)}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {p.count} Transaktionen · {pct.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Peak-Hours Heatmap */}
      <Card className="p-6">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h2 className="font-display font-bold">Umsatz-Heatmap</h2>
            <div className="text-xs text-muted-foreground">Wochentag × Stunde · letzte 30 Tage</div>
          </div>
        </div>
        <PeakHeatmap grid={peakHours.grid} max={peakHours.max} />
      </Card>

      {/* Marketing-Box */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Ticket size={12} /> Gutschein-Einlösungen
          </div>
          <div className="mt-2 font-display text-2xl font-bold">{redemptions.length}</div>
          <div className="text-xs text-muted-foreground">Rabatt-Volumen: {euro(voucherSum)}</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <MailOpen size={12} /> Versendete Emails
          </div>
          <div className="mt-2 font-display text-2xl font-bold">{campaignTotal}</div>
          <div className="text-xs text-muted-foreground">Ø Öffnungsrate: {campaignOpenRate}%</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Users size={12} /> Aktive Mitarbeiter
          </div>
          <div className="mt-2 font-display text-2xl font-bold">{activeEmployees}</div>
          <div className="text-xs text-muted-foreground">davon {onlineDrivers} Fahrer online</div>
        </Card>
      </div>

      {/* Perioden-Report Lieferservice */}
      {locationId && <PeriodReportPanel locationId={locationId} />}

      {/* BI-Export */}
      {locationId && <ExportPanel locationId={locationId} today={today} />}
    </div>
  );
}

function ExportPanel({ locationId, today }: { locationId: string; today: string }) {
  const [loading, setLoading] = useState<string | null>(null);

  const from30 = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  async function downloadCSV(format: 'orders' | 'drivers') {
    setLoading(format);
    try {
      const params = new URLSearchParams({ format, location_id: locationId, from: from30, to: today });
      const res = await fetch(`/api/delivery/admin/reporting/export?${params}`);
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = format === 'orders' ? `mise-bestellungen-${today}.csv` : `mise-fahrer-${today}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <FileText size={16} className="text-matcha-700" />
        <h2 className="font-display font-bold">Daten-Export · letzte 30 Tage</h2>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => downloadCSV('orders')}
          disabled={loading === 'orders'}
          className="inline-flex items-center gap-2 rounded-lg border border-matcha-300 bg-matcha-50 px-4 py-2 text-sm font-semibold text-matcha-800 hover:bg-matcha-100 disabled:opacity-50 transition"
        >
          <Download size={14} />
          {loading === 'orders' ? 'Wird erstellt…' : 'Bestellungen CSV'}
        </button>
        <button
          onClick={() => downloadCSV('drivers')}
          disabled={loading === 'drivers'}
          className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-50 transition"
        >
          <Download size={14} />
          {loading === 'drivers' ? 'Wird erstellt…' : 'Fahrer-Performance CSV'}
        </button>
      </div>
      <div className="mt-3 text-[11px] text-muted-foreground">
        Export-Zeitraum: {from30} — {today} · Max. 10 000 Zeilen · RFC-4180-CSV
      </div>
    </Card>
  );
}

// ─── Perioden-Report Panel ───────────────────────────────────────────────────

const PERIOD_LABELS: Record<string, string> = {
  weekly: 'Diese Woche',
  monthly: 'Dieser Monat',
  last30: 'Letzte 30 Tage',
};

function PeriodReportPanel({ locationId }: { locationId: string }) {
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'last30'>('weekly');
  const [report, setReport] = useState<PeriodReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErr(null);

    const params = new URLSearchParams({ type: 'period', location_id: locationId });
    if (period === 'last30') {
      params.set('period_type', 'custom');
      params.set('from', new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10));
      params.set('to', new Date().toISOString().slice(0, 10));
    } else {
      params.set('period_type', period);
    }

    fetch(`/api/delivery/admin/reporting?${params}`)
      .then((r) => r.json())
      .then((data: PeriodReportData & { error?: string }) => {
        if (data.error) { setErr(data.error); return; }
        setReport(data);
      })
      .catch(() => setErr('Netzwerkfehler'))
      .finally(() => setLoading(false));
  }, [locationId, period]);

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-matcha-700" />
          <h2 className="font-display font-bold">Liefer-Report</h2>
          <span className="text-xs text-muted-foreground">Bestellungen · Umsatz · Pünktlichkeit</span>
        </div>
        <div className="flex gap-1">
          {(['weekly', 'monthly', 'last30'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-semibold transition',
                period === p
                  ? 'bg-matcha-800 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70',
              )}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="h-40 flex items-center justify-center text-sm text-muted-foreground animate-pulse">
          Lade Report…
        </div>
      )}

      {!loading && err && (
        <div className="h-20 flex items-center justify-center text-sm text-red-500">{err}</div>
      )}

      {!loading && !err && report && (
        <div className="space-y-5">
          <div className="text-xs text-muted-foreground">
            {report.periodStart} — {report.periodEnd}
            {' · '}{report.summary.daysIncluded} {report.summary.daysIncluded === 1 ? 'Tag' : 'Tage'}
            {' · '}{PERIOD_LABELS[period]}
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <PeriodKPI label="Bestellungen" value={String(report.summary.totalOrders)} sub={`Ø ${report.summary.avgDailyOrders.toFixed(1)}/Tag`} />
            <PeriodKPI label="Liefer-Umsatz" value={report.summary.totalRevenue != null ? euro(report.summary.totalRevenue) : '—'} tone="accent" />
            <PeriodKPI
              label="Abgeschlossen"
              value={String(report.summary.completedOrders)}
              sub={report.summary.totalOrders > 0
                ? `${Math.round(report.summary.completedOrders / report.summary.totalOrders * 100)}%`
                : '—'}
            />
            <PeriodKPI
              label="Pünktlichkeit"
              value={report.summary.onTimePct != null ? `${report.summary.onTimePct.toFixed(1)}%` : '—'}
              tone={report.summary.onTimePct != null ? (report.summary.onTimePct >= 80 ? 'good' : report.summary.onTimePct >= 60 ? 'warn' : 'bad') : undefined}
            />
            <PeriodKPI
              label="Ø ETA-Abw."
              value={report.summary.avgEtaDeviationMin != null
                ? `${report.summary.avgEtaDeviationMin > 0 ? '+' : ''}${report.summary.avgEtaDeviationMin.toFixed(1)} Min`
                : '—'}
              sub={`${report.summary.activeDriversUnique} Fahrer aktiv`}
            />
          </div>

          {/* Tagesverlauf */}
          {report.dailyBreakdown.length > 1 && (
            <div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Tagesverlauf — Bestellungen
              </div>
              <PeriodMiniChart data={report.dailyBreakdown} />
            </div>
          )}

          {/* Top-Fahrer */}
          {report.topDrivers.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Top-Fahrer
              </div>
              <div className="divide-y divide-border/50">
                {report.topDrivers.slice(0, 5).map((d, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 text-sm">
                    <div className="font-display font-bold text-muted-foreground w-5 text-xs shrink-0">{i + 1}.</div>
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <span className="font-semibold truncate">{d.driverName ?? 'Unbekannt'}</span>
                      {d.driverVehicle && (
                        <span className="text-[10px] text-muted-foreground bg-muted rounded px-1 py-0.5 shrink-0">
                          {d.driverVehicle}
                        </span>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-display font-bold text-sm">{d.deliveries} Liefg.</div>
                      <div className="flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
                        {d.onTimePct != null && (
                          <span className={cn(
                            d.onTimePct >= 80 ? 'text-matcha-700' : d.onTimePct >= 60 ? 'text-amber-600' : 'text-red-500',
                          )}>
                            {d.onTimePct.toFixed(1)}% pünktl.
                          </span>
                        )}
                        {d.avgEtaDeviationMin != null && (
                          <span>Ø {d.avgEtaDeviationMin > 0 ? '+' : ''}{d.avgEtaDeviationMin.toFixed(1)} Min</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.summary.totalOrders === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Keine Liefer-Daten für diesen Zeitraum.
              <br />
              <span className="text-[11px]">Migration 026 ausführen oder anderen Zeitraum wählen.</span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function PeriodKPI({
  label, value, sub, tone,
}: {
  label: string; value: string; sub?: string;
  tone?: 'accent' | 'good' | 'warn' | 'bad';
}) {
  const bg = tone === 'accent'
    ? 'bg-matcha-900 text-white'
    : tone === 'good'
      ? 'bg-matcha-50 text-matcha-900'
      : tone === 'warn'
        ? 'bg-amber-50 text-amber-900'
        : tone === 'bad'
          ? 'bg-red-50 text-red-900'
          : 'bg-muted/50';
  const subColor = tone === 'accent' ? 'text-matcha-300' : tone === 'good' ? 'text-matcha-600' : tone === 'warn' ? 'text-amber-600' : tone === 'bad' ? 'text-red-500' : 'text-muted-foreground';
  return (
    <div className={cn('rounded-xl p-3', bg)}>
      <div className={cn('text-[9px] font-bold uppercase tracking-[0.15em] mb-1', tone === 'accent' ? 'text-matcha-300' : 'text-muted-foreground')}>{label}</div>
      <div className="font-display font-bold text-lg leading-tight">{value}</div>
      {sub && <div className={cn('text-[10px] mt-0.5', subColor)}>{sub}</div>}
    </div>
  );
}

function PeriodMiniChart({ data }: { data: DailyBreakdownItem[] }) {
  const maxOrders = Math.max(1, ...data.map((d) => d.orders.total));
  return (
    <div className="flex items-end gap-px h-16">
      {data.map((d, i) => {
        const pct = (d.orders.total / maxOrders) * 100;
        const label = new Date(`${d.date}T12:00:00`).toLocaleDateString('de-DE', {
          weekday: 'short', day: '2-digit',
        });
        return (
          <div
            key={i}
            className="flex-1 flex flex-col items-center justify-end group"
            title={`${label}: ${d.orders.total} Bestellungen`}
          >
            <div
              className="w-full bg-gradient-to-t from-matcha-700 to-accent rounded-t hover:brightness-110 transition"
              style={{ height: `${pct}%`, minHeight: d.orders.total > 0 ? '3px' : '0' }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function KPICard({
  icon, label, value, tone, trend,
}: {
  icon: React.ReactNode; label: string; value: string;
  tone?: 'accent'; trend?: number | null;
}) {
  return (
    <Card className={cn('p-5', tone === 'accent' && 'bg-gradient-to-br from-matcha-900 to-matcha-700 text-white border-0')}>
      <div className={cn('flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em]', tone === 'accent' ? 'text-matcha-200' : 'text-muted-foreground')}>
        {icon}
        {label}
      </div>
      <div className="mt-2 font-display text-2xl md:text-3xl font-bold tracking-tight">{value}</div>
      {trend != null && (
        <div className={cn(
          'mt-1 text-xs font-semibold inline-flex items-center gap-1',
          trend >= 0 ? (tone === 'accent' ? 'text-accent' : 'text-matcha-700') : 'text-red-500',
        )}>
          {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {trend >= 0 ? '+' : ''}{trend.toFixed(1)}% vs. Vorperiode
        </div>
      )}
    </Card>
  );
}

function TrendChart({ data }: { data: { label: string; total: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  return (
    <div className="space-y-3">
      {/* Bars */}
      <div className="flex items-end gap-1.5 h-40">
        {data.map((d, i) => {
          const pct = (d.total / max) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end group">
              <div
                className="relative w-full bg-gradient-to-t from-matcha-700 to-accent rounded-t hover:brightness-110 transition cursor-default"
                style={{ height: `${pct}%`, minHeight: d.total > 0 ? '4px' : '0' }}
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-matcha-900 text-white text-[10px] font-mono rounded px-2 py-0.5 opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none">
                  {d.total > 0 ? euro(d.total) : '—'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {/* Labels */}
      <div className="flex gap-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-[9px] text-muted-foreground text-center truncate">{d.label.split(',')[0]}</div>
        ))}
      </div>
    </div>
  );
}

function PeakHeatmap({ grid, max }: { grid: number[][]; max: number }) {
  const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        {/* Hour labels */}
        <div className="flex items-center gap-px mb-1 pl-8">
          {Array.from({ length: 24 }).map((_, h) => (
            <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground">{h % 3 === 0 ? `${h}` : ''}</div>
          ))}
        </div>
        {grid.map((dayRow, di) => (
          <div key={di} className="flex items-center gap-px mb-px">
            <div className="w-8 text-xs font-bold text-muted-foreground">{days[di]}</div>
            {dayRow.map((val, h) => {
              const intensity = val / max;
              return (
                <div
                  key={h}
                  className="flex-1 h-5 rounded-sm transition"
                  style={{ backgroundColor: intensity > 0 ? `rgba(20, 83, 45, ${Math.min(1, 0.1 + intensity * 0.9)})` : '#f5f5f5' }}
                  title={`${days[di]} ${h}:00 — ${euro(val)}`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
