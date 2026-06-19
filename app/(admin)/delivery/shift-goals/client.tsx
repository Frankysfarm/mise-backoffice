'use client';

import { useState, useEffect, useCallback } from 'react';
import { Target, Clock, Euro, ShoppingBag, Save, RefreshCw, TrendingUp, CheckCircle2, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ShiftGoalConfig, ShiftGoalsDashboard } from '@/lib/delivery/shift-goals';

interface Props {
  locationId: string | null;
  initialConfig: ShiftGoalConfig | null;
}

interface DashboardData extends ShiftGoalsDashboard {
  ok?: boolean;
}

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
        {label}
      </div>
      <div className={cn('text-2xl font-black tabular-nums', accent ?? 'text-foreground')}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}

function GaugeMini({
  pct,
  color,
}: {
  pct: number;
  color: string;
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${clamped}%`, backgroundColor: color }}
      />
    </div>
  );
}

export function ShiftGoalsClient({ locationId, initialConfig }: Props) {
  const defaults: ShiftGoalConfig = initialConfig ?? {
    targetOrders: 60,
    targetRevenue: 1500,
    shiftHoursTotal: 8,
    shiftStartHour: 10,
  };

  const [form, setForm] = useState<ShiftGoalConfig>(defaults);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!locationId) { setLoading(false); return; }
    try {
      const res = await fetch(
        `/api/delivery/admin/shift-goals?location_id=${locationId}`,
      );
      if (res.ok) {
        const d = (await res.json()) as DashboardData;
        setDashboard(d);
        setForm({
          targetOrders: d.targetOrders,
          targetRevenue: d.targetRevenue,
          shiftHoursTotal: d.shiftHoursTotal,
          shiftStartHour: d.shiftStartHour,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    loadDashboard();
    const iv = setInterval(loadDashboard, 60_000);
    return () => clearInterval(iv);
  }, [loadDashboard]);

  async function save() {
    if (!locationId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/delivery/admin/shift-goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      const d = (await res.json()) as DashboardData;
      setDashboard(d);
      setSavedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  }

  const pace = dashboard?.pace ?? 'on_track';
  const paceStyle =
    pace === 'ahead'
      ? { label: 'Über Plan', icon: TrendingUp, cls: 'text-emerald-400' }
      : pace === 'behind'
      ? { label: 'Unter Plan', icon: AlertTriangle, cls: 'text-amber-400' }
      : { label: 'Im Plan', icon: CheckCircle2, cls: 'text-blue-400' };
  const PaceIcon = paceStyle.icon;

  const ordersPct = dashboard
    ? (dashboard.actualOrders / Math.max(1, dashboard.targetOrders)) * 100
    : 0;
  const revPct = dashboard
    ? (dashboard.actualRevenue / Math.max(1, dashboard.targetRevenue)) * 100
    : 0;
  const timePct = dashboard
    ? (dashboard.shiftHoursElapsed / Math.max(1, dashboard.shiftHoursTotal)) * 100
    : 0;

  const gaugeColor = (pct: number) =>
    pct >= 90 ? '#4ade80' : pct >= 65 ? '#facc15' : '#f87171';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schichtziele"
        description="Tages-/Schichtziele je Standort konfigurieren — live im Tagesziel-Cockpit sichtbar."
      />

      {/* Live KPIs */}
      {loading ? (
        <div className="text-sm text-muted-foreground animate-pulse">Lade…</div>
      ) : !locationId ? (
        <div className="text-sm text-muted-foreground">Kein Standort zugewiesen.</div>
      ) : (
        <div className="space-y-4">
          {/* Pace Banner */}
          {dashboard && (
            <div
              className={cn(
                'flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold',
                pace === 'ahead'
                  ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-400'
                  : pace === 'behind'
                  ? 'border-amber-500/30 bg-amber-950/20 text-amber-400'
                  : 'border-blue-500/30 bg-blue-950/20 text-blue-400',
              )}
            >
              <PaceIcon className="h-4 w-4" />
              {paceStyle.label} — Prognose:{' '}
              {dashboard.projectedOrders} Bestellungen ·{' '}
              €{Math.round(dashboard.projectedRevenue).toLocaleString('de-DE')} Umsatz
            </div>
          )}

          {/* KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              label="Bestellungen"
              value={`${dashboard?.actualOrders ?? 0} / ${form.targetOrders}`}
              sub={`${Math.round(ordersPct)}% des Ziels`}
              accent={gaugeColor(ordersPct) === '#4ade80' ? 'text-emerald-400' : gaugeColor(ordersPct) === '#facc15' ? 'text-amber-400' : 'text-red-400'}
            />
            <KpiCard
              label="Umsatz"
              value={`€${Math.round(dashboard?.actualRevenue ?? 0).toLocaleString('de-DE')}`}
              sub={`Ziel: €${form.targetRevenue.toLocaleString('de-DE')}`}
              accent={gaugeColor(revPct) === '#4ade80' ? 'text-emerald-400' : gaugeColor(revPct) === '#facc15' ? 'text-amber-400' : 'text-red-400'}
            />
            <KpiCard
              label="Lieferungen"
              value={String(dashboard?.actualDeliveries ?? 0)}
              sub={dashboard?.avgDeliveryMin ? `Ø ${Math.round(dashboard.avgDeliveryMin)} Min` : 'keine Daten'}
            />
            <KpiCard
              label="Schichtzeit"
              value={`${Math.round((dashboard?.shiftHoursElapsed ?? 0) * 10) / 10}h`}
              sub={`von ${form.shiftHoursTotal}h · Start: ${form.shiftStartHour}:00 UTC`}
            />
          </div>

          {/* Progress bars */}
          <Card className="p-4 space-y-3">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
              Fortschritt
            </div>
            {[
              { label: 'Bestellungen', pct: ordersPct },
              { label: 'Umsatz', pct: revPct },
              { label: 'Schichtzeit', pct: timePct },
            ].map(({ label, pct }) => (
              <div key={label} className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{label}</span>
                  <span>{Math.round(pct)}%</span>
                </div>
                <GaugeMini pct={pct} color={gaugeColor(pct)} />
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Config Form */}
      <Card className="p-5 space-y-5">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Target className="h-4 w-4 text-matcha-400" />
          <span className="font-bold text-sm">Ziele konfigurieren</span>
          <button
            onClick={loadDashboard}
            disabled={loading}
            className="ml-auto p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Target Orders */}
          <label className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-widest">
              <ShoppingBag className="h-3 w-3" />
              Ziel-Bestellungen
            </div>
            <input
              type="number"
              min={1}
              max={999}
              value={form.targetOrders}
              onChange={(e) =>
                setForm((f) => ({ ...f, targetOrders: Number(e.target.value) }))
              }
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500"
            />
            <div className="text-[11px] text-muted-foreground">
              Anzahl Bestellungen bis Schichtende
            </div>
          </label>

          {/* Target Revenue */}
          <label className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-widest">
              <Euro className="h-3 w-3" />
              Ziel-Umsatz (€)
            </div>
            <input
              type="number"
              min={0}
              max={99999}
              step={50}
              value={form.targetRevenue}
              onChange={(e) =>
                setForm((f) => ({ ...f, targetRevenue: Number(e.target.value) }))
              }
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500"
            />
            <div className="text-[11px] text-muted-foreground">Angestrebter Tagesumsatz</div>
          </label>

          {/* Shift Hours */}
          <label className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-widest">
              <Clock className="h-3 w-3" />
              Schichtdauer (Stunden)
            </div>
            <input
              type="number"
              min={1}
              max={24}
              step={0.5}
              value={form.shiftHoursTotal}
              onChange={(e) =>
                setForm((f) => ({ ...f, shiftHoursTotal: Number(e.target.value) }))
              }
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500"
            />
            <div className="text-[11px] text-muted-foreground">
              Gesamtlänge der Hauptschicht
            </div>
          </label>

          {/* Shift Start Hour */}
          <label className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-widest">
              <Clock className="h-3 w-3" />
              Schichtstart (UTC-Stunde)
            </div>
            <input
              type="number"
              min={0}
              max={23}
              value={form.shiftStartHour}
              onChange={(e) =>
                setForm((f) => ({ ...f, shiftStartHour: Number(e.target.value) }))
              }
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500"
            />
            <div className="text-[11px] text-muted-foreground">
              z.&nbsp;B. 10 = Schichtbeginn um 10:00 UTC
            </div>
          </label>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3 pt-2 border-t border-border">
          <button
            onClick={save}
            disabled={saving || !locationId}
            className="inline-flex items-center gap-2 rounded-lg bg-matcha-600 px-4 py-2 text-sm font-bold text-white hover:bg-matcha-700 disabled:opacity-40 transition"
          >
            {saving ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {saving ? 'Speichern…' : 'Ziele speichern'}
          </button>
          {savedAt && (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Gespeichert{' '}
              {savedAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {error && (
            <span className="text-xs text-red-400">{error}</span>
          )}
        </div>

        {/* Info box */}
        <div className="rounded-lg bg-muted/30 border border-border p-3 text-xs text-muted-foreground space-y-1">
          <div className="font-bold text-foreground/70 mb-1">So funktioniert es:</div>
          <div>• Das Tagesziel-Cockpit im Lieferdienst-Dashboard liest diese Konfiguration.</div>
          <div>• Ist-Werte werden aus <code className="font-mono">customer_orders</code> berechnet (seit Schichtstart).</div>
          <div>• Prognose = Ist-Tempo × verbleibende Schichtzeit.</div>
          <div>• Schichtstart-Stunde ist UTC — lokale Umrechnung je nach Zeitzone.</div>
        </div>
      </Card>
    </div>
  );
}
