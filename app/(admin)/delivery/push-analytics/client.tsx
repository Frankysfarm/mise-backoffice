'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Bell, BellRing, MessageCircle, Smartphone,
  TrendingUp, TrendingDown, Minus, RefreshCw,
  CheckCircle2, XCircle, AlertCircle, Activity,
  BarChart3, Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';

// ── Typen ─────────────────────────────────────────────────────────────────────

type PushChannel = 'vapid' | 'whatsapp' | 'driver';

interface ChannelSummary {
  channel:          PushChannel;
  sent7d:           number;
  delivered7d:      number;
  failed7d:         number;
  expired7d:        number;
  read7d:           number;
  deliveryRatePct:  number | null;
  readRatePct:      number | null;
}

interface DailyTrendRow {
  date:            string;
  vapidSent:       number;
  waSent:          number;
  driverSent:      number;
  vapidDelivered:  number;
  waDelivered:     number;
  driverDelivered: number;
}

interface EventBreakdown {
  channel:         PushChannel;
  eventType:       string;
  sent30d:         number;
  delivered30d:    number;
  failed30d:       number;
  deliveryRatePct: number | null;
}

interface Dashboard {
  totalSent7d:             number;
  totalDelivered7d:        number;
  overallDeliveryRatePct:  number | null;
  waReadRatePct:           number | null;
  vapidActiveSubs:         number;
  channels:                ChannelSummary[];
  trend14d:                DailyTrendRow[];
  eventBreakdown:          EventBreakdown[];
  generatedAt:             string;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

const CHANNEL_META: Record<PushChannel, { label: string; color: string; bgColor: string; Icon: React.ElementType }> = {
  vapid:     { label: 'Browser Push (VAPID)', color: 'text-blue-600',   bgColor: 'bg-blue-50',   Icon: BellRing },
  whatsapp:  { label: 'WhatsApp',             color: 'text-green-600',  bgColor: 'bg-green-50',  Icon: MessageCircle },
  driver:    { label: 'Fahrer-App Push',      color: 'text-orange-600', bgColor: 'bg-orange-50', Icon: Smartphone },
};

function pct(v: number | null): string {
  if (v === null) return '—';
  return `${v.toFixed(1)} %`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
}

function rateColor(v: number | null): string {
  if (v === null) return 'text-muted-foreground';
  if (v >= 90) return 'text-emerald-600';
  if (v >= 70) return 'text-amber-600';
  return 'text-red-600';
}

// ── Trend-Balkendiagramm ─────────────────────────────────────────────────────

function TrendChart({ data }: { data: DailyTrendRow[] }) {
  const maxVal = Math.max(1, ...data.map((r) => r.vapidSent + r.waSent + r.driverSent));

  return (
    <div className="space-y-1.5">
      <div className="flex gap-4 text-[10px] font-medium text-muted-foreground mb-3">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />VAPID</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />WhatsApp</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />Fahrer</span>
      </div>
      <div className="flex items-end gap-1 h-32">
        {data.map((row) => {
          const total = row.vapidSent + row.waSent + row.driverSent;
          const h     = Math.round((total / maxVal) * 100);
          const vH    = maxVal > 0 ? Math.round((row.vapidSent / maxVal) * 100) : 0;
          const wH    = maxVal > 0 ? Math.round((row.waSent / maxVal) * 100) : 0;
          const dH    = maxVal > 0 ? Math.round((row.driverSent / maxVal) * 100) : 0;
          return (
            <div key={row.date} className="flex-1 flex flex-col items-center gap-0.5 group relative">
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-popover border rounded px-2 py-1 text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none shadow-sm">
                <div className="font-semibold">{fmtDate(row.date)}</div>
                <div className="text-blue-600">VAPID: {row.vapidSent}</div>
                <div className="text-green-600">WA: {row.waSent}</div>
                <div className="text-orange-600">Fahrer: {row.driverSent}</div>
                <div className="font-bold border-t mt-1 pt-1">Gesamt: {total}</div>
              </div>
              {/* Stacked bar */}
              <div className="w-full flex flex-col justify-end" style={{ height: 120 }}>
                <div className="w-full rounded-sm overflow-hidden flex flex-col-reverse" style={{ height: `${h}%`, minHeight: total > 0 ? 2 : 0 }}>
                  <div className="bg-blue-500 w-full"    style={{ height: `${vH}%` }} />
                  <div className="bg-green-500 w-full"   style={{ height: `${wH}%` }} />
                  <div className="bg-orange-500 w-full"  style={{ height: `${dH}%` }} />
                </div>
              </div>
              <span className="text-[9px] text-muted-foreground mt-0.5 hidden sm:block">
                {fmtDate(row.date).split(' ')[0]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Kanal-Zeile ──────────────────────────────────────────────────────────────

function ChannelRow({ c }: { c: ChannelSummary }) {
  const meta = CHANNEL_META[c.channel];
  const Icon = meta.Icon;
  const total = c.sent7d + c.failed7d;
  const barW  = total > 0 ? Math.round((c.delivered7d / (total || 1)) * 100) : 0;

  return (
    <div className="grid grid-cols-[180px_1fr] gap-4 items-center py-3 border-b last:border-0">
      <div className="flex items-center gap-2">
        <div className={cn('p-1.5 rounded', meta.bgColor)}>
          <Icon size={14} className={meta.color} />
        </div>
        <span className="text-sm font-medium">{meta.label}</span>
      </div>
      <div className="grid grid-cols-5 gap-2 text-sm">
        <div className="text-right">
          <div className="font-bold">{c.sent7d.toLocaleString('de-DE')}</div>
          <div className="text-[10px] text-muted-foreground">Versendet</div>
        </div>
        <div className="text-right">
          <div className={cn('font-bold', rateColor(c.deliveryRatePct))}>{pct(c.deliveryRatePct)}</div>
          <div className="text-[10px] text-muted-foreground">Zustellung</div>
        </div>
        <div className="text-right">
          <div className="font-bold">{c.failed7d.toLocaleString('de-DE')}</div>
          <div className="text-[10px] text-muted-foreground">Fehlgeschlagen</div>
        </div>
        <div className="text-right">
          <div className={cn('font-bold', rateColor(c.readRatePct ?? null))}>{pct(c.readRatePct ?? null)}</div>
          <div className="text-[10px] text-muted-foreground">Gelesen</div>
        </div>
        <div className="flex items-center">
          <div className="w-full bg-muted rounded-full h-1.5">
            <div
              className={cn('h-1.5 rounded-full', c.deliveryRatePct !== null && c.deliveryRatePct >= 90 ? 'bg-emerald-500' : c.deliveryRatePct !== null && c.deliveryRatePct >= 70 ? 'bg-amber-500' : 'bg-red-500')}
              style={{ width: `${barW}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Event-Tabelle ─────────────────────────────────────────────────────────────

function EventTable({ rows }: { rows: EventBreakdown[] }) {
  const [filter, setFilter] = useState<PushChannel | 'all'>('all');
  const filtered = filter === 'all' ? rows : rows.filter((r) => r.channel === filter);

  return (
    <div>
      <div className="flex gap-2 mb-3 flex-wrap">
        {(['all', 'vapid', 'whatsapp', 'driver'] as const).map((ch) => (
          <button
            key={ch}
            onClick={() => setFilter(ch)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              filter === ch
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-muted-foreground border-border hover:border-foreground',
            )}
          >
            {ch === 'all' ? 'Alle' : CHANNEL_META[ch].label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left py-2 pr-4">Kanal</th>
              <th className="text-left py-2 pr-4">Event-Typ</th>
              <th className="text-right py-2 pr-4">Versendet</th>
              <th className="text-right py-2 pr-4">Zugestellt</th>
              <th className="text-right py-2 pr-4">Fehlgeschlagen</th>
              <th className="text-right py-2">Zustellrate</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 20).map((r) => {
              const meta = CHANNEL_META[r.channel];
              const Icon = meta.Icon;
              return (
                <tr key={`${r.channel}-${r.eventType}`} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2 pr-4">
                    <div className={cn('flex items-center gap-1.5 text-xs font-medium', meta.color)}>
                      <Icon size={12} /> {meta.label}
                    </div>
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{r.eventType}</td>
                  <td className="py-2 pr-4 text-right font-medium">{r.sent30d.toLocaleString('de-DE')}</td>
                  <td className="py-2 pr-4 text-right text-emerald-600">{r.delivered30d.toLocaleString('de-DE')}</td>
                  <td className="py-2 pr-4 text-right text-red-500">{r.failed30d.toLocaleString('de-DE')}</td>
                  <td className="py-2 text-right">
                    <span className={cn('font-bold', rateColor(r.deliveryRatePct))}>
                      {pct(r.deliveryRatePct)}
                    </span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted-foreground text-sm">
                  Noch keine Daten — Berechnung läuft täglich um 02:00 UTC
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Haupt-Client ──────────────────────────────────────────────────────────────

export function PushAnalyticsClient({ locationId }: { locationId: string }) {
  const [data, setData]       = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [days, setDays]       = useState(7);
  const [activeTab, setActiveTab] = useState<'overview' | 'events'>('overview');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/push-analytics?action=dashboard&days=${days}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const handleCompute = async () => {
    setComputing(true);
    await fetch('/api/delivery/admin/push-analytics?action=compute');
    setComputing(false);
    load();
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
      </div>
    );
  }

  const d = data;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Push-Analytics"
        description="Kanal-übergreifende Performance aller Benachrichtigungen — VAPID, WhatsApp und Fahrer-Push."
      />

      {/* Header Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Zeitraum-Selector */}
        <div className="flex rounded-lg border overflow-hidden text-sm">
          {([7, 14, 30] as const).map((n) => (
            <button
              key={n}
              onClick={() => setDays(n)}
              className={cn(
                'px-3 py-1.5 font-medium transition-colors',
                days === n ? 'bg-foreground text-background' : 'bg-background text-muted-foreground hover:bg-muted',
              )}
            >
              {n}d
            </button>
          ))}
        </div>

        <button
          onClick={handleCompute}
          disabled={computing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw size={14} className={computing ? 'animate-spin' : ''} />
          {computing ? 'Berechne…' : 'Neu berechnen'}
        </button>

        {d && (
          <span className="text-xs text-muted-foreground ml-auto">
            Aktualisiert: {new Date(d.generatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            <Activity size={12} className="text-matcha-700" />
            Versendet ({days}d)
          </div>
          <div className="font-display text-2xl font-bold">
            {(d?.totalSent7d ?? 0).toLocaleString('de-DE')}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            <CheckCircle2 size={12} className="text-emerald-600" />
            Gesamt-Zustellrate
          </div>
          <div className={cn('font-display text-2xl font-bold', rateColor(d?.overallDeliveryRatePct ?? null))}>
            {pct(d?.overallDeliveryRatePct ?? null)}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            <Eye size={12} className="text-green-600" />
            WA Read-Rate
          </div>
          <div className={cn('font-display text-2xl font-bold', rateColor(d?.waReadRatePct ?? null))}>
            {pct(d?.waReadRatePct ?? null)}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            <Bell size={12} className="text-blue-600" />
            VAPID Abonnenten
          </div>
          <div className="font-display text-2xl font-bold">
            {(d?.vapidActiveSubs ?? 0).toLocaleString('de-DE')}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            <XCircle size={12} className="text-red-500" />
            Zustellfehler ({days}d)
          </div>
          <div className="font-display text-2xl font-bold text-red-600">
            {((d?.totalSent7d ?? 0) - (d?.totalDelivered7d ?? 0)).toLocaleString('de-DE')}
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {([
          { key: 'overview', label: 'Übersicht & Trend', icon: BarChart3 },
          { key: 'events',   label: 'Event-Aufschlüsselung', icon: AlertCircle },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === key
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Übersicht & Trend */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Kanal-Vergleich */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp size={16} />
              Kanal-Vergleich ({days} Tage)
            </h3>
            <div className="divide-y">
              {/* Header */}
              <div className="grid grid-cols-[180px_1fr] gap-4 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <div>Kanal</div>
                <div className="grid grid-cols-5 gap-2">
                  <div className="text-right">Versendet</div>
                  <div className="text-right">Zustellrate</div>
                  <div className="text-right">Fehler</div>
                  <div className="text-right">Gelesen</div>
                  <div></div>
                </div>
              </div>
              {(d?.channels ?? [] as ChannelSummary[]).map((c: ChannelSummary) => <ChannelRow key={c.channel} c={c} />)}
            </div>
          </Card>

          {/* 14-Tage-Trend */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <BarChart3 size={16} />
              Versand-Trend (14 Tage)
            </h3>
            {d?.trend14d && d.trend14d.length > 0 ? (
              <TrendChart data={d.trend14d} />
            ) : (
              <div className="text-center text-muted-foreground text-sm py-8">
                Noch keine Trend-Daten — Berechnung läuft täglich um 02:00 UTC
              </div>
            )}
          </Card>

          {/* Kanal-Badges */}
          <div className="grid md:grid-cols-3 gap-4">
            {(d?.channels ?? [] as ChannelSummary[]).map((c: ChannelSummary) => {
              const meta = CHANNEL_META[c.channel];
              const Icon = meta.Icon;
              const rate = c.deliveryRatePct;
              const icon = rate === null ? <Minus size={14} /> : rate >= 90 ? <TrendingUp size={14} /> : rate >= 70 ? <Minus size={14} /> : <TrendingDown size={14} />;
              return (
                <Card key={c.channel} className="p-4">
                  <div className={cn('flex items-center gap-2 mb-3', meta.color)}>
                    <div className={cn('p-1.5 rounded', meta.bgColor)}><Icon size={14} /></div>
                    <span className="font-semibold text-sm">{meta.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Versendet</div>
                      <div className="font-bold">{c.sent7d.toLocaleString('de-DE')}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Zustellrate</div>
                      <div className={cn('font-bold flex items-center gap-1', rateColor(rate))}>
                        {icon} {pct(rate)}
                      </div>
                    </div>
                    {c.read7d > 0 && (
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Gelesen</div>
                        <div className="font-bold">{c.read7d.toLocaleString('de-DE')}</div>
                      </div>
                    )}
                    {c.expired7d > 0 && (
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Abgelaufen</div>
                        <div className="font-bold text-muted-foreground">{c.expired7d.toLocaleString('de-DE')}</div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: Event-Aufschlüsselung */}
      {activeTab === 'events' && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <AlertCircle size={16} />
            Event-Typen (letzte 30 Tage)
          </h3>
          <EventTable rows={d?.eventBreakdown ?? []} />
        </Card>
      )}
    </div>
  );
}
