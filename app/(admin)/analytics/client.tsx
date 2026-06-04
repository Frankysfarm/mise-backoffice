'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn, euro } from '@/lib/utils';
import {
  AlertTriangle, BarChart3, Banknote, Bell, Bike, CheckCircle2, CreditCard, Download, FileText, Globe, Link2, MailOpen, Package, Plus, RefreshCw, Settings2, Ticket, Trash2, TrendingDown, TrendingUp, Users, Webhook, X,
} from 'lucide-react';

// ─── Delivery Config Typen ───────────────────────────────────────────────────
type ConfigSettingRow = {
  key: string;
  effective_value: number;
  default_value: number;
  custom_value: number | null;
  is_customised: boolean;
  description: string;
  category: string;
  min_value: number | null;
  max_value: number | null;
  updated_at: string | null;
};
type ConfigResponse = {
  settings: ConfigSettingRow[];
  grouped: Record<string, ConfigSettingRow[]>;
  categories: string[];
  total: number;
  customised_count: number;
  _fallback?: boolean;
  _hint?: string;
};
// ────────────────────────────────────────────────────────────────────────────

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

      {/* Liefer-Konfiguration */}
      {locationId && <DeliveryConfigPanel locationId={locationId} />}

      {/* Betriebsalarme */}
      {locationId && <AlertsPanel locationId={locationId} />}

      {/* Webhook-Verwaltung */}
      {locationId && <WebhooksPanel locationId={locationId} />}
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

// ─── Delivery Config Panel ────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  dispatch:  'Dispatch-Engine',
  bundling:  'Touren-Bündelung',
  zones:     'Liefer-Zonen',
  eta:       'ETA-Berechnung',
  kitchen:   'Küchen-Timing',
  scoring:   'Fahrer-Scoring',
  general:   'Allgemein',
};

const KEY_UNITS: Record<string, string> = {
  dispatch_escalation_min: 'min',
  dispatch_max_radius_km: 'km',
  dispatch_stale_batch_min: 'min',
  dispatch_max_attempts: 'x',
  bundling_max_detour_km: 'km',
  bundling_max_stops: 'Stopps',
  bundling_time_window_min: 'min',
  zone_a_radius_km: 'km',
  zone_b_radius_km: 'km',
  zone_c_radius_km: 'km',
  eta_base_min: 'min',
  eta_buffer_pct: '%',
  eta_avg_speed_kmh: 'km/h',
  kitchen_prep_default_min: 'min',
  kitchen_sync_interval_min: 'min',
  scoring_weight_distance: '%',
  scoring_weight_capacity: '%',
  scoring_weight_rating: '%',
  scoring_weight_zone: '%',
  scoring_weight_priority: '%',
};

function DeliveryConfigPanel({ locationId }: { locationId: string }) {
  const [data, setData] = useState<ConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

  const load = () => {
    setLoading(true);
    setErr(null);
    fetch(`/api/delivery/admin/config?location_id=${locationId}`)
      .then((r) => r.json())
      .then((d: ConfigResponse & { error?: string }) => {
        if (d.error) { setErr(d.error); return; }
        setData(d);
      })
      .catch(() => setErr('Netzwerkfehler'))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [locationId]);

  async function saveSetting(key: string, value: number) {
    setSaving(key);
    try {
      const res = await fetch('/api/delivery/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId, key, value }),
      });
      if (!res.ok) {
        const j = await res.json() as { error?: string };
        setErr(j.error ?? 'Fehler beim Speichern');
        return;
      }
      setSavedKeys((prev) => new Set([...prev, key]));
      setTimeout(() => setSavedKeys((prev) => {
        const n = new Set(prev);
        n.delete(key);
        return n;
      }), 2000);
      load();
    } finally {
      setSaving(null);
    }
  }

  async function resetAll() {
    if (!confirm('Alle angepassten Einstellungen auf System-Defaults zurücksetzen?')) return;
    setResetting(true);
    try {
      const res = await fetch('/api/delivery/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId, action: 'reset' }),
      });
      if (res.ok) load();
      else {
        const j = await res.json() as { error?: string };
        setErr(j.error ?? 'Reset fehlgeschlagen');
      }
    } finally {
      setResetting(false);
    }
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Settings2 size={16} className="text-matcha-700" />
          <h2 className="font-display font-bold">Liefer-Konfiguration</h2>
          {data && (
            <span className="text-xs text-muted-foreground">
              {data.total} Parameter
              {data.customised_count > 0 && (
                <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                  {data.customised_count} angepasst
                </span>
              )}
            </span>
          )}
          {data?._fallback && (
            <span className="text-[10px] text-orange-500 font-medium ml-2">Migration 027 fehlt — Defaults</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted transition disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Aktualisieren
          </button>
          {data && data.customised_count > 0 && (
            <button
              onClick={resetAll}
              disabled={resetting}
              className="rounded-md px-2.5 py-1 text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 transition disabled:opacity-50"
            >
              {resetting ? 'Wird zurückgesetzt…' : 'Alle zurücksetzen'}
            </button>
          )}
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>
      )}

      {loading && !data && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {data.categories.map((cat) => {
            const rows = data.grouped[cat] ?? [];
            const catLabel = CATEGORY_LABELS[cat] ?? cat;
            const customCount = rows.filter((r) => r.is_customised).length;
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {catLabel}
                  </span>
                  {customCount > 0 && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                      {customCount}×
                    </span>
                  )}
                </div>
                <div className="divide-y divide-border rounded-lg border overflow-hidden">
                  {rows.map((row) => (
                    <ConfigRow
                      key={row.key}
                      row={row}
                      saving={saving === row.key}
                      saved={savedKeys.has(row.key)}
                      onSave={saveSetting}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function ConfigRow({
  row,
  saving,
  saved,
  onSave,
}: {
  row: ConfigSettingRow;
  saving: boolean;
  saved: boolean;
  onSave: (key: string, value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(row.effective_value));
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraft(String(row.effective_value));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function cancel() {
    setEditing(false);
    setDraft(String(row.effective_value));
  }

  function commit() {
    const num = parseFloat(draft);
    if (isNaN(num)) { cancel(); return; }
    if (row.min_value !== null && num < row.min_value) { setDraft(String(row.min_value)); return; }
    if (row.max_value !== null && num > row.max_value) { setDraft(String(row.max_value)); return; }
    setEditing(false);
    if (num !== row.effective_value) onSave(row.key, num);
  }

  const unit = KEY_UNITS[row.key] ?? '';

  return (
    <div className={cn(
      'flex items-center gap-3 px-3 py-2.5 transition',
      row.is_customised ? 'bg-amber-50/50' : 'bg-background',
    )}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-mono text-foreground/80 truncate">{row.key}</span>
          {row.is_customised && (
            <span className="shrink-0 rounded-full bg-amber-200 px-1.5 py-px text-[9px] font-bold text-amber-800">
              ANGEPASST
            </span>
          )}
        </div>
        {row.description && (
          <div className="text-[10px] text-muted-foreground truncate mt-0.5">{row.description}</div>
        )}
      </div>

      {row.is_customised && (
        <div className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
          Default: {row.default_value}{unit ? ' ' + unit : ''}
        </div>
      )}

      <div className="shrink-0 flex items-center gap-1.5">
        {editing ? (
          <>
            <input
              ref={inputRef}
              type="number"
              value={draft}
              min={row.min_value ?? undefined}
              max={row.max_value ?? undefined}
              step={unit === 'km' || unit === '%' || unit === 'km/h' ? '0.1' : '1'}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') cancel();
              }}
              onBlur={commit}
              className="w-20 rounded border border-matcha-400 bg-white px-2 py-0.5 text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-matcha-500"
            />
            <span className="text-[10px] text-muted-foreground">{unit}</span>
          </>
        ) : (
          <button
            onClick={startEdit}
            disabled={saving}
            className={cn(
              'rounded px-2.5 py-0.5 text-xs font-mono font-semibold transition',
              row.is_customised
                ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                : 'bg-muted text-foreground hover:bg-muted/70',
            )}
          >
            {saving ? '…' : `${row.effective_value}${unit ? ' ' + unit : ''}`}
          </button>
        )}
        {saved && !editing && (
          <CheckCircle2 size={12} className="text-matcha-600 shrink-0" />
        )}
      </div>
    </div>
  );
}

// ─── Alerts Panel ─────────────────────────────────────────────────────────────

type AlertSeverity = 'info' | 'warning' | 'critical';

type DeliveryAlert = {
  id: string;
  alert_type: string;
  severity: AlertSeverity;
  message: string;
  details: Record<string, unknown> | null;
  created_at: string;
  resolved_at: string | null;
};

type AlertsResponse = {
  alerts: DeliveryAlert[];
  total: number;
  critical: number;
  warning: number;
  error?: string;
};

const ALERT_TYPE_LABELS: Record<string, string> = {
  dispatch_queue_high:    'Dispatch-Queue überfüllt',
  no_drivers_online:      'Kein Fahrer online',
  kitchen_overload:       'Küche überlastet',
  stale_orders_critical:  'Bestellungen nicht zugewiesen',
  eta_accuracy_low:       'ETA-Genauigkeit niedrig',
};

function AlertsPanel({ locationId }: { locationId: string }) {
  const [data, setData]             = useState<AlertsResponse | null>(null);
  const [loading, setLoading]       = useState(true);
  const [resolving, setResolving]   = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [err, setErr]               = useState<string | null>(null);
  const [evalResult, setEvalResult] = useState<{ created: number; resolved: number } | null>(null);

  const load = () => {
    setLoading(true);
    setErr(null);
    fetch(`/api/delivery/admin/alerts?location_id=${locationId}&view=active`)
      .then((r) => r.json())
      .then((d: AlertsResponse) => {
        if (d.error) { setErr(d.error); return; }
        setData(d);
      })
      .catch(() => setErr('Netzwerkfehler'))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [locationId]);

  async function resolveAlert(id: string) {
    setResolving(id);
    try {
      const res = await fetch(`/api/delivery/admin/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve' }),
      });
      if (res.ok) load();
      else {
        const j = await res.json() as { error?: string };
        setErr(j.error ?? 'Fehler beim Auflösen');
      }
    } finally {
      setResolving(null);
    }
  }

  async function resolveAll() {
    if (!confirm('Alle aktiven Alarme auflösen?')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId, action: 'resolve_all' }),
      });
      if (res.ok) load();
      else {
        const j = await res.json() as { error?: string };
        setErr(j.error ?? 'Fehler');
      }
    } finally {
      setLoading(false);
    }
  }

  async function evaluate() {
    setEvaluating(true);
    setEvalResult(null);
    try {
      const res = await fetch('/api/delivery/admin/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId, action: 'evaluate' }),
      });
      const j = await res.json() as { created?: number; resolved?: number; error?: string };
      if (j.error) { setErr(j.error); return; }
      setEvalResult({ created: j.created ?? 0, resolved: j.resolved ?? 0 });
      load();
    } finally {
      setEvaluating(false);
    }
  }

  const hasCritical = (data?.critical ?? 0) > 0;

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Bell size={16} className={hasCritical ? 'text-red-600 animate-pulse' : 'text-matcha-700'} />
          <h2 className="font-display font-bold">Betriebsalarme</h2>
          {data && data.total > 0 && (
            <span className={cn(
              'text-xs inline-flex items-center rounded-full px-1.5 py-0.5 font-semibold',
              hasCritical ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800',
            )}>
              {data.total} aktiv
            </span>
          )}
          {data && data.total === 0 && (
            <span className="text-[11px] text-muted-foreground">Keine aktiven Alarme</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {evalResult && (
            <span className="text-[10px] text-muted-foreground">
              +{evalResult.created} neu · {evalResult.resolved} gelöst
            </span>
          )}
          <button
            onClick={evaluate}
            disabled={evaluating}
            className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted transition disabled:opacity-50"
          >
            <RefreshCw size={12} className={evaluating ? 'animate-spin' : ''} />
            Regeln prüfen
          </button>
          {data && data.total > 0 && (
            <button
              onClick={resolveAll}
              disabled={loading}
              className="rounded-md px-2.5 py-1 text-xs font-semibold bg-muted text-foreground hover:bg-muted/70 transition"
            >
              Alle auflösen
            </button>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted transition disabled:opacity-50"
            title="Aktualisieren"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>
      )}

      {loading && !data && (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {data && data.total === 0 && !loading && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 size={14} />
          System läuft normal — keine aktiven Alarme.
        </div>
      )}

      {data && data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((alert) => {
            const isCritical = alert.severity === 'critical';
            const isWarning  = alert.severity === 'warning';
            const ageMin = Math.round((Date.now() - new Date(alert.created_at).getTime()) / 60_000);
            return (
              <div
                key={alert.id}
                className={cn(
                  'flex items-start gap-3 rounded-lg border px-4 py-3',
                  isCritical ? 'border-red-200 bg-red-50' : isWarning ? 'border-amber-200 bg-amber-50' : 'border-border bg-background',
                )}
              >
                <AlertTriangle size={14} className={cn(
                  'shrink-0 mt-0.5',
                  isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-muted-foreground',
                )} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      'text-[10px] font-bold uppercase tracking-wide rounded-full px-1.5 py-px',
                      isCritical ? 'bg-red-200 text-red-800' : isWarning ? 'bg-amber-200 text-amber-800' : 'bg-muted text-muted-foreground',
                    )}>
                      {isCritical ? 'KRITISCH' : isWarning ? 'WARNUNG' : 'INFO'}
                    </span>
                    <span className="text-xs font-semibold text-foreground">
                      {ALERT_TYPE_LABELS[alert.alert_type] ?? alert.alert_type}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      vor {ageMin < 1 ? '<1' : ageMin} Min
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-foreground/80 line-clamp-2">{alert.message}</p>
                </div>
                <button
                  onClick={() => resolveAlert(alert.id)}
                  disabled={resolving === alert.id}
                  className="shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-muted/80 transition disabled:opacity-50"
                >
                  {resolving === alert.id ? '…' : 'Auflösen'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── Webhooks Panel ───────────────────────────────────────────────────────────

const ALL_EVENTS = [
  'order_received', 'order_dispatched', 'order_bundled', 'order_held',
  'batch_created', 'batch_assigned', 'batch_picked_up', 'batch_completed', 'batch_cancelled',
  'stop_delivered', 'driver_online', 'driver_offline', 'eta_updated',
  'kitchen_ready', 'kitchen_cooking',
  'delay_first_notice', 'delay_critical_notice', 'delay_compensation_created',
  'order_scheduled', 'order_released_for_dispatch',
] as const;

const EVENT_LABELS: Record<string, string> = {
  order_received:               'Bestellung eingegangen',
  order_dispatched:             'Bestellung dispatcht',
  order_bundled:                'Bestellung gebündelt',
  order_held:                   'Bestellung gehalten',
  batch_created:                'Batch erstellt',
  batch_assigned:               'Batch zugewiesen',
  batch_picked_up:              'Abgeholt (on_route)',
  batch_completed:              'Tour abgeschlossen',
  batch_cancelled:              'Tour storniert',
  stop_delivered:               'Stop zugestellt',
  driver_online:                'Fahrer online',
  driver_offline:               'Fahrer offline',
  eta_updated:                  'ETA aktualisiert',
  kitchen_ready:                'Küche: fertig',
  kitchen_cooking:              'Küche: kocht',
  delay_first_notice:           'Erste Verspätungswarnung',
  delay_critical_notice:        'Kritische Verspätung',
  delay_compensation_created:   'Gutschein erstellt',
  order_scheduled:              'Vorbestellung erstellt',
  order_released_for_dispatch:  'Vorbestellung freigegeben',
};

type WebhookWithStats = {
  id: string;
  url: string;
  description: string | null;
  is_active: boolean;
  events: string[];
  last_delivered_at: string | null;
  consecutive_failures: number;
  created_at: string;
  total_delivered: number;
  pending_deliveries: number;
  failed_deliveries: number;
};

type WebhooksListResponse = {
  webhooks: WebhookWithStats[];
  total: number;
  migration_pending?: boolean;
  error?: string;
};

type TestResult = {
  ok: boolean;
  status: number | null;
  body: string | null;
  signature: string | null;
  error?: string;
};

function WebhooksPanel({ locationId }: { locationId: string }) {
  const [data, setData]               = useState<WebhooksListResponse | null>(null);
  const [loading, setLoading]         = useState(true);
  const [err, setErr]                 = useState<string | null>(null);
  const [showAdd, setShowAdd]         = useState(false);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [testing, setTesting]         = useState<string | null>(null);
  const [deleting, setDeleting]       = useState<string | null>(null);
  const [toggling, setToggling]       = useState<string | null>(null);

  // Add-form state
  const [newUrl, setNewUrl]           = useState('');
  const [newSecret, setNewSecret]     = useState('');
  const [newDesc, setNewDesc]         = useState('');
  const [newEvents, setNewEvents]     = useState<string[]>(['batch_completed', 'batch_cancelled']);
  const [adding, setAdding]           = useState(false);
  const [addErr, setAddErr]           = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setErr(null);
    fetch(`/api/delivery/admin/webhooks?location_id=${locationId}`)
      .then((r) => r.json())
      .then((d: WebhooksListResponse) => {
        if (d.error) { setErr(d.error); return; }
        setData(d);
      })
      .catch(() => setErr('Netzwerkfehler'))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [locationId]);

  async function toggleWebhook(wh: WebhookWithStats) {
    setToggling(wh.id);
    try {
      const res = await fetch(`/api/delivery/admin/webhooks/${wh.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId, is_active: !wh.is_active }),
      });
      if (res.ok) load();
      else {
        const j = await res.json() as { error?: string };
        setErr(j.error ?? 'Toggle-Fehler');
      }
    } finally {
      setToggling(null);
    }
  }

  async function deleteWebhook(id: string) {
    if (!confirm('Webhook löschen? Alle Delivery-Logs werden ebenfalls entfernt.')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/delivery/admin/webhooks/${id}?location_id=${locationId}`, {
        method: 'DELETE',
      });
      if (res.ok) load();
      else {
        const j = await res.json() as { error?: string };
        setErr(j.error ?? 'Fehler beim Löschen');
      }
    } finally {
      setDeleting(null);
    }
  }

  async function testWebhook(id: string) {
    setTesting(id);
    try {
      const res = await fetch(`/api/delivery/admin/webhooks/${id}?action=test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId }),
      });
      const j = await res.json() as TestResult & { error?: string };
      setTestResults((prev) => ({ ...prev, [id]: j }));
    } finally {
      setTesting(null);
    }
  }

  async function addWebhook() {
    setAddErr(null);
    if (!newUrl.startsWith('https://')) { setAddErr('URL muss mit https:// beginnen'); return; }
    if (newSecret.length < 16)          { setAddErr('Secret muss mind. 16 Zeichen haben'); return; }
    if (newEvents.length === 0)         { setAddErr('Mindestens ein Event wählen'); return; }
    setAdding(true);
    try {
      const res = await fetch('/api/delivery/admin/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: locationId,
          url: newUrl,
          secret: newSecret,
          events: newEvents,
          description: newDesc || undefined,
        }),
      });
      if (res.ok) {
        setShowAdd(false);
        setNewUrl(''); setNewSecret(''); setNewDesc(''); setNewEvents(['batch_completed', 'batch_cancelled']);
        load();
      } else {
        const j = await res.json() as { error?: string };
        setAddErr(j.error ?? 'Fehler beim Erstellen');
      }
    } finally {
      setAdding(false);
    }
  }

  function toggleEvent(ev: string) {
    setNewEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev],
    );
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Webhook size={16} className="text-matcha-700" />
          <h2 className="font-display font-bold">Webhooks</h2>
          {data && (
            <span className="text-xs text-muted-foreground">
              {data.total} konfiguriert
            </span>
          )}
          {data?.migration_pending && (
            <span className="text-[10px] text-orange-500 font-medium ml-1">Migration 025 fehlt</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted transition disabled:opacity-50"
            title="Aktualisieren"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => { setShowAdd((v) => !v); setAddErr(null); }}
            className="flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold bg-matcha-600 text-white hover:bg-matcha-700 transition"
          >
            <Plus size={12} />
            Webhook hinzufügen
          </button>
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>
      )}

      {/* Add-Formular */}
      {showAdd && (
        <div className="mb-5 rounded-xl border border-matcha-200 bg-matcha-50/40 p-4 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-matcha-800 mb-1">Neuer Webhook</div>
          {addErr && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{addErr}</div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                URL (https://)
              </label>
              <input
                type="url"
                placeholder="https://mein-system.de/webhook"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="w-full rounded-md border border-input bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-matcha-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Secret (min. 16 Zeichen)
              </label>
              <input
                type="text"
                placeholder="mein-geheimes-passwort-lang"
                value={newSecret}
                onChange={(e) => setNewSecret(e.target.value)}
                className="w-full rounded-md border border-input bg-white px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-matcha-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Beschreibung (optional)
            </label>
            <input
              type="text"
              placeholder="z.B. POS-Integration Buchhaltung"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full rounded-md border border-input bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-matcha-500"
            />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Events abonnieren
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_EVENTS.map((ev) => (
                <button
                  key={ev}
                  type="button"
                  onClick={() => toggleEvent(ev)}
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[10px] font-semibold transition',
                    newEvents.includes(ev)
                      ? 'border-matcha-500 bg-matcha-100 text-matcha-800'
                      : 'border-border bg-background text-muted-foreground hover:border-matcha-300',
                  )}
                >
                  {EVENT_LABELS[ev] ?? ev}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={addWebhook}
              disabled={adding}
              className="rounded-md px-4 py-1.5 text-xs font-semibold bg-matcha-600 text-white hover:bg-matcha-700 transition disabled:opacity-50"
            >
              {adding ? 'Wird erstellt…' : 'Erstellen'}
            </button>
            <button
              onClick={() => { setShowAdd(false); setAddErr(null); }}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted transition"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {loading && !data && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {data && data.total === 0 && !loading && !showAdd && (
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
          <Link2 size={16} className="shrink-0" />
          <div>
            <div className="font-medium text-foreground">Noch keine Webhooks konfiguriert</div>
            <div className="text-xs mt-0.5">
              Verbinde externe Systeme (POS, Buchhaltung, Analytics) — alle Delivery-Events werden HMAC-signiert übertragen.
            </div>
          </div>
        </div>
      )}

      {data && data.webhooks.length > 0 && (
        <div className="space-y-3">
          {data.webhooks.map((wh) => {
            const testR = testResults[wh.id];
            const lastDelivered = wh.last_delivered_at
              ? new Date(wh.last_delivered_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
              : null;
            return (
              <div
                key={wh.id}
                className={cn(
                  'rounded-xl border p-4 transition',
                  wh.is_active ? 'border-border bg-background' : 'border-dashed border-border bg-muted/30',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'mt-0.5 h-2.5 w-2.5 rounded-full shrink-0',
                    wh.is_active
                      ? wh.consecutive_failures > 0 ? 'bg-amber-500' : 'bg-matcha-500'
                      : 'bg-muted-foreground/40',
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-semibold text-foreground truncate max-w-[300px]">
                        {wh.url}
                      </span>
                      {!wh.is_active && (
                        <span className="rounded-full bg-muted px-1.5 py-px text-[9px] font-bold uppercase text-muted-foreground">
                          INAKTIV
                        </span>
                      )}
                      {wh.consecutive_failures > 0 && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-px text-[9px] font-bold text-amber-800">
                          {wh.consecutive_failures} Fehler
                        </span>
                      )}
                    </div>
                    {wh.description && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">{wh.description}</div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 size={10} className="text-matcha-500" />
                        {wh.total_delivered} zugestellt
                      </span>
                      {wh.pending_deliveries > 0 && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <RefreshCw size={10} />
                          {wh.pending_deliveries} ausstehend
                        </span>
                      )}
                      {wh.failed_deliveries > 0 && (
                        <span className="flex items-center gap-1 text-red-600">
                          <X size={10} />
                          {wh.failed_deliveries} fehlgeschlagen
                        </span>
                      )}
                      {lastDelivered && (
                        <span>Letzte Zustellung: {lastDelivered}</span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {wh.events.slice(0, 6).map((ev) => (
                        <span key={ev} className="rounded-full bg-muted/60 px-1.5 py-px text-[9px] font-medium text-muted-foreground">
                          {EVENT_LABELS[ev] ?? ev}
                        </span>
                      ))}
                      {wh.events.length > 6 && (
                        <span className="rounded-full bg-muted/60 px-1.5 py-px text-[9px] font-medium text-muted-foreground">
                          +{wh.events.length - 6}
                        </span>
                      )}
                    </div>
                    {testR && (
                      <div className={cn(
                        'mt-2 rounded-md px-2.5 py-1.5 text-[10px] font-mono',
                        testR.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800',
                      )}>
                        {testR.ok
                          ? `✓ HTTP ${testR.status} — Test erfolgreich`
                          : `✗ ${testR.error ?? `HTTP ${testR.status}`}`
                        }
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => testWebhook(wh.id)}
                      disabled={testing === wh.id}
                      className="rounded-md px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-muted transition disabled:opacity-50"
                      title="Test-Event senden"
                    >
                      {testing === wh.id ? '…' : 'Test'}
                    </button>
                    <button
                      onClick={() => toggleWebhook(wh)}
                      disabled={toggling === wh.id}
                      className={cn(
                        'rounded-md px-2 py-1 text-[10px] font-semibold transition disabled:opacity-50',
                        wh.is_active
                          ? 'text-amber-700 hover:bg-amber-50'
                          : 'text-matcha-700 hover:bg-matcha-50',
                      )}
                    >
                      {toggling === wh.id ? '…' : wh.is_active ? 'Deaktivieren' : 'Aktivieren'}
                    </button>
                    <button
                      onClick={() => deleteWebhook(wh.id)}
                      disabled={deleting === wh.id}
                      className="rounded-md p-1 text-muted-foreground hover:text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                      title="Webhook löschen"
                    >
                      {deleting === wh.id ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
