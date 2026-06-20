'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ShieldAlert, ShieldX, Tag, CheckCircle, RefreshCw,
  ChevronDown, ChevronUp, Settings, List,
} from 'lucide-react';

interface CancellationGuardEvent {
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

interface CancellationGuardConfig {
  isEnabled: boolean;
  maxCancellationsPerHour: number;
  voucherEnabled: boolean;
  voucherAmountEur: number;
  blockAfterNCancellations: number;
  blockWindowHours: number;
}

interface Dashboard {
  config: CancellationGuardConfig;
  todayAttempts: number;
  todayBlocked: number;
  todayVouchersOffered: number;
  todayCancelledAllowed: number;
  blockRate: number;
  recentEvents: CancellationGuardEvent[];
  topCancellers: Array<{ customerId: string; count: number }>;
}

const EVENT_LABELS: Record<string, string> = {
  attempt: 'Versuch',
  blocked: 'Gesperrt',
  voucher_offered: 'Voucher angeboten',
  voucher_used: 'Voucher genutzt',
  cancelled_allowed: 'Stornierung erlaubt',
};

const RISK_COLORS: Record<string, string> = {
  low: 'bg-emerald-100 text-emerald-800',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-orange-100 text-orange-800',
  blocked: 'bg-red-100 text-red-800',
};

export function CancellationGuardClient() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'events' | 'cancellers' | 'config'>('events');
  const [config, setConfig] = useState<CancellationGuardConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [voucherLoading, setVoucherLoading] = useState<string | null>(null);
  const [voucherResult, setVoucherResult] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/cancellation-guard?action=dashboard', { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as Dashboard;
        setDashboard(data);
        setConfig((prev) => prev ?? data.config);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  async function saveConfig() {
    if (!config) return;
    setSaving(true);
    try {
      await fetch('/api/delivery/admin/cancellation-guard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_config', ...config }),
      });
      setSavedAt(new Date().toLocaleTimeString('de-DE'));
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function offerVoucher(event: CancellationGuardEvent) {
    if (!event.customer_id) return;
    setVoucherLoading(event.id);
    try {
      const res = await fetch('/api/delivery/admin/cancellation-guard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'offer_voucher', customer_id: event.customer_id, order_id: event.order_id }),
      });
      if (res.ok) {
        const data = (await res.json()) as { voucher_code: string };
        setVoucherResult((prev) => ({ ...prev, [event.id]: data.voucher_code }));
        await load();
      }
    } finally {
      setVoucherLoading(null);
    }
  }

  if (loading && !dashboard) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
        Lade Cancellation Guard…
      </div>
    );
  }

  const d = dashboard;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-matcha-700" />
            Smart Cancellation Guard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Stornierungsprävention · Risiko-Score · Voucher-Interventionen
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<ShieldAlert className="h-4 w-4" />} label="Versuche heute" value={d?.todayAttempts ?? 0} />
        <KpiCard icon={<ShieldX className="h-4 w-4" />} label="Gesperrt heute" value={d?.todayBlocked ?? 0} color="text-red-700" />
        <KpiCard icon={<Tag className="h-4 w-4" />} label="Voucher angeboten" value={d?.todayVouchersOffered ?? 0} color="text-violet-700" />
        <KpiCard icon={<CheckCircle className="h-4 w-4" />} label="Blockierungsrate" value={`${d?.blockRate ?? 0}%`} color={(d?.blockRate ?? 0) > 20 ? 'text-red-700' : 'text-emerald-700'} />
      </div>

      {/* Status banner */}
      {d?.config && !d.config.isEnabled && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-amber-800 text-sm flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>Cancellation Guard ist <strong>deaktiviert</strong>. Konfiguration → Guard aktivieren.</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {(['events', 'cancellers', 'config'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 px-3 text-sm font-medium transition border-b-2 -mb-px ${
              tab === t ? 'border-matcha-600 text-matcha-700' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'events' ? <><List className="h-3.5 w-3.5 inline mr-1" />Ereignisse</> : null}
            {t === 'cancellers' ? <><ShieldX className="h-3.5 w-3.5 inline mr-1" />Top-Stornierer</> : null}
            {t === 'config' ? <><Settings className="h-3.5 w-3.5 inline mr-1" />Konfiguration</> : null}
          </button>
        ))}
      </div>

      {tab === 'events' && (
        <div className="space-y-2">
          {(d?.recentEvents ?? []).length === 0 && (
            <div className="text-center text-muted-foreground py-8 text-sm">Keine Stornierungsereignisse in den letzten 24h.</div>
          )}
          {(d?.recentEvents ?? []).map((evt) => {
            const expanded = expandedId === evt.id;
            return (
              <Card key={evt.id} className="p-3">
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => setExpandedId(expanded ? null : evt.id)}
                >
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${RISK_COLORS[evt.risk_level] ?? 'bg-stone-100 text-stone-700'}`}>
                    {evt.risk_level.toUpperCase()}
                  </span>
                  <span className="text-sm font-medium flex-1">{EVENT_LABELS[evt.event_type] ?? evt.event_type}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(evt.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>

                {expanded && (
                  <div className="mt-3 pt-3 border-t space-y-2 text-sm text-muted-foreground">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {evt.customer_id && <div><span className="font-medium text-foreground">Kunde:</span> {evt.customer_id.slice(0, 8)}…</div>}
                      {evt.order_id && <div><span className="font-medium text-foreground">Bestellung:</span> {evt.order_id.slice(0, 8)}…</div>}
                      <div><span className="font-medium text-foreground">Storno 24h:</span> {evt.cancellation_count_24h}×</div>
                      {evt.voucher_code && <div><span className="font-medium text-foreground">Voucher:</span> <code className="bg-stone-100 px-1 rounded">{evt.voucher_code}</code></div>}
                    </div>
                    {evt.reason && <p className="text-xs">{evt.reason}</p>}
                    {evt.customer_id && evt.event_type !== 'voucher_offered' && evt.event_type !== 'voucher_used' && (
                      <div className="flex gap-2 mt-2">
                        {voucherResult[evt.id] ? (
                          <Badge variant="outline" className="text-violet-700 border-violet-300">
                            <Tag className="h-3 w-3 mr-1" />
                            Voucher: {voucherResult[evt.id]}
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => offerVoucher(evt)}
                            disabled={voucherLoading === evt.id}
                            className="text-xs"
                          >
                            <Tag className="h-3 w-3 mr-1" />
                            {voucherLoading === evt.id ? 'Wird erstellt…' : 'Voucher anbieten'}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'cancellers' && (
        <div className="space-y-2">
          {(d?.topCancellers ?? []).length === 0 && (
            <div className="text-center text-muted-foreground py-8 text-sm">Keine auffälligen Stornierer in den letzten 24h.</div>
          )}
          {(d?.topCancellers ?? []).map((c, i) => (
            <Card key={c.customerId} className="p-3 flex items-center gap-3">
              <span className="text-lg font-bold text-muted-foreground w-6 text-center">{i + 1}</span>
              <div className="flex-1">
                <span className="text-sm font-mono">{c.customerId.slice(0, 12)}…</span>
              </div>
              <span className={`font-bold text-lg ${c.count >= 3 ? 'text-red-600' : c.count >= 2 ? 'text-amber-600' : 'text-stone-600'}`}>
                {c.count}×
              </span>
              <span className="text-xs text-muted-foreground">Stornierungen</span>
            </Card>
          ))}
        </div>
      )}

      {tab === 'config' && config && (
        <Card className="p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Guard aktiviert</div>
              <div className="text-xs text-muted-foreground">Stornierungsprüfung ein-/ausschalten</div>
            </div>
            <button
              onClick={() => setConfig((c) => c ? { ...c, isEnabled: !c.isEnabled } : c)}
              className={`w-11 h-6 rounded-full transition-colors ${config.isEnabled ? 'bg-matcha-600' : 'bg-stone-300'}`}
            >
              <div className={`h-4 w-4 rounded-full bg-white mx-1 transition-transform ${config.isEnabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ConfigField
              label="Max. Stornierungen/Stunde"
              hint="Über diesem Limit → Hohe Risikostufe"
              value={config.maxCancellationsPerHour}
              min={1} max={10}
              onChange={(v) => setConfig((c) => c ? { ...c, maxCancellationsPerHour: v } : c)}
            />
            <ConfigField
              label="Sperre nach N Stornierungen"
              hint="Innerhalb von blockWindowHours"
              value={config.blockAfterNCancellations}
              min={2} max={20}
              onChange={(v) => setConfig((c) => c ? { ...c, blockAfterNCancellations: v } : c)}
            />
            <ConfigField
              label="Sperr-Zeitfenster (Stunden)"
              hint="Rückblick für Sperr-Zählung"
              value={config.blockWindowHours}
              min={1} max={72}
              onChange={(v) => setConfig((c) => c ? { ...c, blockWindowHours: v } : c)}
            />
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Voucher-Intervention</div>
                <div className="text-xs text-muted-foreground">Automatisch Voucher bei Hochrisiko anbieten</div>
              </div>
              <button
                onClick={() => setConfig((c) => c ? { ...c, voucherEnabled: !c.voucherEnabled } : c)}
                className={`w-11 h-6 rounded-full transition-colors ${config.voucherEnabled ? 'bg-violet-600' : 'bg-stone-300'}`}
              >
                <div className={`h-4 w-4 rounded-full bg-white mx-1 transition-transform ${config.voucherEnabled ? 'translate-x-5' : ''}`} />
              </button>
            </div>
            {config.voucherEnabled && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Voucher-Betrag (€)</label>
                <input
                  type="number"
                  min={1} max={20} step={0.5}
                  value={config.voucherAmountEur}
                  onChange={(e) => setConfig((c) => c ? { ...c, voucherAmountEur: Number(e.target.value) } : c)}
                  className="mt-1 block w-full rounded-lg border px-3 py-1.5 text-sm"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={saveConfig} disabled={saving} className="bg-matcha-700 hover:bg-matcha-800 text-white">
              {saving ? 'Wird gespeichert…' : 'Konfiguration speichern'}
            </Button>
            {savedAt && <span className="text-xs text-muted-foreground">Gespeichert: {savedAt}</span>}
          </div>
        </Card>
      )}
    </div>
  );
}

function KpiCard({
  icon, label, value, color = 'text-matcha-700',
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        <span className={color}>{icon}</span>
        {label}
      </div>
      <div className={`mt-1.5 font-display text-2xl font-bold ${color}`}>{value}</div>
    </Card>
  );
}

function ConfigField({
  label, hint, value, min, max, onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <p className="text-[10px] text-muted-foreground mb-1">{hint}</p>
      <input
        type="number"
        min={min} max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="block w-full rounded-lg border px-3 py-1.5 text-sm"
      />
    </div>
  );
}
