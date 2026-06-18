'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BookmarkCheck, RefreshCw, Clock, Package, Euro, Users,
  AlertTriangle, CheckCircle, ChevronDown, ChevronRight,
  TrendingUp, Truck, ChefHat, Star, FileText, Bell,
} from 'lucide-react';
import type {
  HandoverDashboard, HandoverReport, OpenOrderSummary,
  ActiveAlertSummary, TopDriverSummary,
} from '@/lib/delivery/shift-handover';

interface Props {
  locationId: string;
  employeeId: string;
  initial: HandoverDashboard | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, decimals = 0): string {
  if (n == null) return '—';
  return n.toFixed(decimals);
}

function fmtEur(n: number): string {
  return `€${n.toFixed(2)}`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function onTimeColor(pct: number): string {
  if (pct >= 90) return 'text-green-600';
  if (pct >= 75) return 'text-amber-500';
  return 'text-red-500';
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, label, value, sub, accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <Card className={`p-4 ${accent ? 'border-matcha-400 bg-matcha-50/40' : ''}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
        <Icon className="h-3.5 w-3.5 text-matcha-700" />
        {label}
      </div>
      <div className="font-display text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}

// ── SLA Bar ───────────────────────────────────────────────────────────────────

function SlaBar({ onTime, late }: { onTime: number; late: number }) {
  const total = onTime + late;
  if (total === 0) return <div className="text-xs text-muted-foreground">Keine SLA-Daten</div>;
  const pct = Math.round((onTime / total) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{onTime} pünktlich</span>
        <span>{late} verspätet</span>
      </div>
      <div className="h-2 bg-red-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className={`text-sm font-bold ${onTimeColor(pct)}`}>{pct}% pünktlich</div>
    </div>
  );
}

// ── Open Order Row ────────────────────────────────────────────────────────────

function OpenOrderRow({ o }: { o: OpenOrderSummary }) {
  const urgent = o.waitMin >= 30;
  return (
    <div className={`flex items-center justify-between text-sm py-1.5 border-b last:border-0 ${urgent ? 'text-red-600' : ''}`}>
      <span className="font-mono font-bold">{o.bestellnummer}</span>
      <span className="text-muted-foreground">{o.zone ?? '—'}</span>
      <span className={urgent ? 'font-bold' : ''}>{o.waitMin} Min</span>
      <span>{fmtEur(o.gesamtbetrag)}</span>
      <span className={`text-xs px-1.5 py-0.5 rounded ${
        o.status === 'in_zubereitung' ? 'bg-amber-100 text-amber-700'
        : o.status === 'fertig' ? 'bg-blue-100 text-blue-700'
        : 'bg-gray-100 text-gray-600'
      }`}>{o.status}</span>
    </div>
  );
}

// ── Alert Row ────────────────────────────────────────────────────────────────

function AlertRow({ a }: { a: ActiveAlertSummary }) {
  return (
    <div className={`flex items-start gap-2 text-sm py-1.5 border-b last:border-0 ${
      a.severity === 'critical' ? 'text-red-600' : a.severity === 'warning' ? 'text-amber-600' : 'text-foreground'
    }`}>
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="font-bold">{a.alert_type}</span>
        <span className="text-muted-foreground ml-2">{a.message}</span>
      </div>
      <span className="text-xs text-muted-foreground shrink-0">vor {a.createdMin} Min</span>
    </div>
  );
}

// ── Driver Row ────────────────────────────────────────────────────────────────

function DriverRow({ d, rank }: { d: TopDriverSummary; rank: number }) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
  return (
    <div className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
      <span className="font-bold min-w-[2rem]">{medal}</span>
      <span className="flex-1">{d.name}</span>
      <span className="text-muted-foreground">{d.toursCompleted} Touren</span>
      <span className="text-muted-foreground ml-3">{d.deliveries} Stops</span>
      <span className={`ml-3 font-bold ${onTimeColor(d.onTimeRate)}`}>{d.onTimeRate}%</span>
    </div>
  );
}

// ── History Row ───────────────────────────────────────────────────────────────

function HistoryRow({ report }: { report: HandoverReport }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          {report.acknowledged_at
            ? <CheckCircle className="h-4 w-4 text-green-500" />
            : <Bell className="h-4 w-4 text-amber-500" />}
          <div>
            <div className="text-sm font-bold">{fmtTime(report.period_start)} – {fmtTime(report.period_end)}</div>
            <div className="text-xs text-muted-foreground">
              {report.orders_total} Bestellungen · {fmtEur(report.revenue_eur)} · {fmt(report.on_time_rate_pct, 1)}% SLA
              {report.orders_pending_end > 0 && (
                <span className="ml-2 text-amber-600 font-bold">{report.orders_pending_end} offen</span>
              )}
            </div>
          </div>
        </div>
        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="border-t p-3 bg-muted/20 text-sm space-y-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><div className="font-bold">{report.orders_delivered}</div><div className="text-xs text-muted-foreground">Geliefert</div></div>
            <div><div className="font-bold">{report.drivers_active}</div><div className="text-xs text-muted-foreground">Fahrer aktiv</div></div>
            <div><div className="font-bold">{report.tours_completed}</div><div className="text-xs text-muted-foreground">Touren</div></div>
          </div>
          {report.incidents_open_end > 0 && (
            <div className="text-amber-600 font-bold">{report.incidents_open_end} offene Incidents</div>
          )}
          {report.notes && (
            <div className="text-muted-foreground italic">Notiz: {report.notes}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ShiftHandoverClient({ locationId, employeeId, initial }: Props) {
  const [data, setData] = useState<HandoverDashboard | null>(initial);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/shift-handover?location_id=${locationId}`);
      if (res.ok) setData(await res.json() as HandoverDashboard);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    const id = setInterval(reload, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [reload]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch('/api/delivery/admin/shift-handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', period_hours: 8 }),
      });
      if (res.ok) await reload();
    } finally {
      setGenerating(false);
    }
  }

  async function handleAcknowledge(reportId: string) {
    setAcknowledging(true);
    try {
      await fetch('/api/delivery/admin/shift-handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'acknowledge', report_id: reportId }),
      });
      await reload();
    } finally {
      setAcknowledging(false);
    }
  }

  async function handleSaveNote(reportId: string) {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await fetch('/api/delivery/admin/shift-handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_note', report_id: reportId, notes: noteText.trim() }),
      });
      setNoteText('');
      await reload();
    } finally {
      setSavingNote(false);
    }
  }

  const latest = data?.latest ?? null;
  const history = data?.history ?? [];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Schicht-Übergabe"
        description="Automatischer Übergabe-Bericht mit KPIs, offenen Bestellungen und Incidents"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Aktualisieren
            </Button>
            <Button size="sm" onClick={handleGenerate} disabled={generating}>
              <FileText className="h-4 w-4 mr-1.5" />
              {generating ? 'Generiere…' : 'Neuer Bericht'}
            </Button>
          </div>
        }
      />

      {/* ── KPI-Band ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={TrendingUp}
          label="7-Tage SLA-Ø"
          value={`${fmt(data?.avgOnTimeRatePct7d ?? null, 1)}%`}
          sub="Ø Pünktlichkeit 7 Tage"
          accent={(data?.avgOnTimeRatePct7d ?? 0) >= 90}
        />
        <KpiCard
          icon={Euro}
          label="Umsatz-Ø 7 Tage"
          value={fmtEur(data?.avgRevenueEur7d ?? 0)}
          sub="Ø je Schicht"
        />
        <KpiCard
          icon={FileText}
          label="Berichte gesamt"
          value={String(data?.totalReports ?? 0)}
          sub="Alle Schicht-Übergaben"
        />
        <KpiCard
          icon={Bell}
          label="Offene Items"
          value={String(latest?.orders_pending_end ?? 0)}
          sub="Bestellungen noch offen"
          accent={(latest?.orders_pending_end ?? 0) > 0}
        />
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b">
        {(['current', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === tab
                ? 'border-matcha-600 text-matcha-700'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'current' ? 'Aktuelle Übergabe' : `Verlauf (${history.length})`}
          </button>
        ))}
      </div>

      {/* ── Aktuelle Übergabe ─────────────────────────────────────────────── */}
      {activeTab === 'current' && (
        <>
          {!latest ? (
            <Card className="p-8 text-center text-muted-foreground">
              <BookmarkCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Noch kein Übergabe-Bericht vorhanden</p>
              <p className="text-sm mt-1">Klicke auf „Neuer Bericht" um den ersten Bericht zu generieren.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Header */}
              <Card className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Schichtzeitraum</div>
                    <div className="font-bold">{fmtTime(latest.period_start)} – {fmtTime(latest.period_end)}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {latest.shift_period_hours}h · Erstellt: {fmtTime(latest.generated_at)}
                      {latest.acknowledged_at && (
                        <span className="ml-2 text-green-600">✓ Quittiert {fmtTime(latest.acknowledged_at)}</span>
                      )}
                    </div>
                  </div>
                  {!latest.acknowledged_at && (
                    <Button size="sm" variant="outline" onClick={() => handleAcknowledge(latest.id)} disabled={acknowledging}>
                      <CheckCircle className="h-4 w-4 mr-1.5" />
                      {acknowledging ? 'Speichere…' : 'Als gelesen markieren'}
                    </Button>
                  )}
                </div>
              </Card>

              {/* KPIs der Schicht */}
              <div className="grid md:grid-cols-3 gap-4">
                {/* Bestellungen */}
                <Card className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <Package className="h-4 w-4 text-matcha-700" />
                    Bestellungen
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><div className="text-muted-foreground text-xs">Gesamt</div><div className="font-bold text-lg">{latest.orders_total}</div></div>
                    <div><div className="text-muted-foreground text-xs">Geliefert</div><div className="font-bold text-lg text-green-600">{latest.orders_delivered}</div></div>
                    <div><div className="text-muted-foreground text-xs">Storniert</div><div className="font-bold">{latest.orders_cancelled}</div></div>
                    <div><div className="text-muted-foreground text-xs">Noch offen</div><div className={`font-bold ${latest.orders_pending_end > 0 ? 'text-amber-600' : ''}`}>{latest.orders_pending_end}</div></div>
                  </div>
                </Card>

                {/* SLA */}
                <Card className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <Clock className="h-4 w-4 text-matcha-700" />
                    SLA & Zeiten
                  </div>
                  <SlaBar onTime={latest.sla_on_time} late={latest.sla_late} />
                  <div className="text-xs text-muted-foreground">
                    Ø Lieferzeit: <span className="font-bold text-foreground">{fmt(latest.avg_delivery_min, 1)} Min</span>
                  </div>
                </Card>

                {/* Umsatz */}
                <Card className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <Euro className="h-4 w-4 text-matcha-700" />
                    Umsatz
                  </div>
                  <div className="font-display text-2xl font-bold">{fmtEur(latest.revenue_eur)}</div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div>Liefergebühren: <span className="font-bold text-foreground">{fmtEur(latest.delivery_fees_eur)}</span></div>
                    <div>Ø Bestellwert: <span className="font-bold text-foreground">{latest.avg_order_value_eur != null ? fmtEur(latest.avg_order_value_eur) : '—'}</span></div>
                  </div>
                </Card>
              </div>

              {/* Fahrer + Küche */}
              <div className="grid md:grid-cols-2 gap-4">
                <Card className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <Truck className="h-4 w-4 text-matcha-700" />
                    Fahrer & Touren
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center text-sm">
                    <div><div className="font-bold text-lg">{latest.drivers_active}</div><div className="text-xs text-muted-foreground">Aktive Fahrer</div></div>
                    <div><div className="font-bold text-lg">{latest.tours_completed}</div><div className="text-xs text-muted-foreground">Touren</div></div>
                    <div><div className="font-bold text-lg">{latest.drivers_shifts_completed}</div><div className="text-xs text-muted-foreground">Schichten</div></div>
                  </div>
                  {latest.top_drivers_json.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs font-bold text-muted-foreground mb-1.5">Top-Fahrer</div>
                      {latest.top_drivers_json.map((d, i) => (
                        <DriverRow key={d.driverId} d={d} rank={i + 1} />
                      ))}
                    </div>
                  )}
                </Card>

                <Card className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <ChefHat className="h-4 w-4 text-matcha-700" />
                    Küche & Incidents
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><div className="text-muted-foreground text-xs">Ø Zubereitungszeit</div><div className="font-bold">{latest.avg_prep_min != null ? `${fmt(latest.avg_prep_min, 1)} Min` : '—'}</div></div>
                    <div><div className="text-muted-foreground text-xs">Warte &gt;15 Min</div><div className={`font-bold ${latest.orders_waited_gt_15min > 0 ? 'text-amber-600' : ''}`}>{latest.orders_waited_gt_15min}</div></div>
                    <div><div className="text-muted-foreground text-xs">Incidents erstellt</div><div className="font-bold">{latest.incidents_created}</div></div>
                    <div><div className="text-muted-foreground text-xs">Incidents offen</div><div className={`font-bold ${latest.incidents_open_end > 0 ? 'text-red-600' : 'text-green-600'}`}>{latest.incidents_open_end}</div></div>
                  </div>
                </Card>
              </div>

              {/* Offene Bestellungen */}
              {latest.open_orders_json.length > 0 && (
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-sm font-bold mb-3">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Offene Bestellungen ({latest.open_orders_json.length})
                  </div>
                  <div className="text-xs text-muted-foreground grid grid-cols-5 font-bold mb-1.5">
                    <span>Nummer</span><span>Zone</span><span>Wartezeit</span><span>Betrag</span><span>Status</span>
                  </div>
                  {latest.open_orders_json.map(o => (
                    <OpenOrderRow key={o.id} o={o} />
                  ))}
                </Card>
              )}

              {/* Aktive Alarme */}
              {latest.active_alerts_json.length > 0 && (
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-sm font-bold mb-3">
                    <Bell className="h-4 w-4 text-red-500" />
                    Offene Alarme ({latest.active_alerts_json.length})
                  </div>
                  {latest.active_alerts_json.map(a => (
                    <AlertRow key={a.id} a={a} />
                  ))}
                </Card>
              )}

              {/* Notizen */}
              <Card className="p-4">
                <div className="flex items-center gap-2 text-sm font-bold mb-3">
                  <Star className="h-4 w-4 text-matcha-700" />
                  Notizen für nächste Schicht
                </div>
                {latest.notes && (
                  <div className="text-sm bg-amber-50 border border-amber-200 rounded p-3 mb-3 text-amber-900">
                    {latest.notes}
                  </div>
                )}
                <div className="flex gap-2">
                  <textarea
                    className="flex-1 text-sm border rounded p-2 resize-none h-20 focus:outline-none focus:ring-1 focus:ring-matcha-400"
                    placeholder="Hinweise für die nächste Schicht…"
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                  />
                  <Button
                    size="sm"
                    onClick={() => handleSaveNote(latest.id)}
                    disabled={savingNote || !noteText.trim()}
                    className="self-end"
                  >
                    {savingNote ? 'Speichere…' : 'Speichern'}
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      {/* ── Verlauf ───────────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-2">
          {history.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">Noch keine Berichte im Verlauf.</Card>
          ) : (
            history.map(r => <HistoryRow key={r.id} report={r} />)
          )}
        </div>
      )}
    </div>
  );
}
