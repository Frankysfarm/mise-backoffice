'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield, Euro, Clock, AlertTriangle, CheckCircle2, XCircle,
  RefreshCw, Settings, ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Typen ─────────────────────────────────────────────────────────────────────

interface SlaCompConfig {
  locationId: string;
  enabled: boolean;
  thresholdMin: number;
  amountEur: number;
  maxPerCustomerMonth: number;
}

interface SlaCompSummary {
  totalIssued: number;
  totalEurIssued: number;
  avgDelayMin: number | null;
  config: SlaCompConfig;
}

interface SlaCompEvent {
  id: string;
  orderId: string;
  customerEmail: string | null;
  customerName: string | null;
  deliveredAt: string | null;
  delayMin: number;
  thresholdMin: number;
  compensationEur: number;
  status: 'issued' | 'failed' | 'skipped';
  skipReason: string | null;
  processedAt: string;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function fmtEur(n: number): string {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function statusBadge(status: string, skipReason: string | null) {
  if (status === 'issued')  return <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium"><CheckCircle2 className="h-3 w-3" />Erstattet</span>;
  if (status === 'failed')  return <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-medium"><XCircle className="h-3 w-3" />Fehler</span>;
  const label = skipReason === 'delay_below_threshold' ? 'Pünktlich'
              : skipReason === 'monthly_limit_reached' ? 'Limit erreicht'
              : 'Übersprungen';
  return <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">{label}</span>;
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export function SlaCompensationClient({ locationId }: { locationId: string }) {
  const [events, setEvents]     = useState<SlaCompEvent[]>([]);
  const [summary, setSummary]   = useState<SlaCompSummary | null>(null);
  const [loading, setLoading]   = useState(true);
  const [processing, setProc]   = useState(false);
  const [showConfig, setShowCfg] = useState(false);
  const [saving, setSaving]     = useState(false);

  // Lokale Konfig-Werte
  const [cfgEnabled, setCfgEnabled] = useState(true);
  const [cfgThreshold, setCfgThreshold] = useState(15);
  const [cfgAmount, setCfgAmount]   = useState(2.00);
  const [cfgLimit, setCfgLimit]     = useState(3);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/sla-compensation');
      const d   = await res.json();
      setEvents((d.events as SlaCompEvent[]) ?? []);
      const s = d.summary as SlaCompSummary;
      setSummary(s);
      if (s?.config) {
        setCfgEnabled(s.config.enabled);
        setCfgThreshold(s.config.thresholdMin);
        setCfgAmount(s.config.amountEur);
        setCfgLimit(s.config.maxPerCustomerMonth);
      }
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function process() {
    setProc(true);
    try {
      await fetch('/api/delivery/admin/sla-compensation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process' }),
      });
      await load();
    } finally {
      setProc(false);
    }
  }

  async function saveConfig() {
    setSaving(true);
    try {
      await fetch('/api/delivery/admin/sla-compensation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled:               cfgEnabled,
          threshold_min:         cfgThreshold,
          amount_eur:            cfgAmount,
          max_per_customer_month: cfgLimit,
        }),
      });
      await load();
      setShowCfg(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* KPI-Leiste */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500 mb-1">Erstattungen (30 Tage)</div>
          <div className="text-2xl font-bold text-blue-600">{summary?.totalIssued ?? '—'}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500 mb-1">Gesamtbetrag</div>
          <div className="text-2xl font-bold text-emerald-600">
            {summary ? fmtEur(summary.totalEurIssued) : '—'}
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500 mb-1">Ø Verspätung</div>
          <div className="text-2xl font-bold text-orange-600">
            {summary?.avgDelayMin != null ? `${summary.avgDelayMin} Min` : '—'}
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500 mb-1">Status</div>
          <div className={cn(
            'text-2xl font-bold flex items-center gap-1',
            summary?.config.enabled ? 'text-emerald-600' : 'text-gray-400',
          )}>
            {summary?.config.enabled ? <><CheckCircle2 className="h-6 w-6" /> Aktiv</> : <><XCircle className="h-6 w-6" /> Inaktiv</>}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={process}
          disabled={processing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Shield className={cn('h-4 w-4', processing && 'animate-pulse')} />
          {processing ? 'Verarbeite…' : 'Jetzt prüfen'}
        </button>

        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Aktualisieren
        </button>

        <button
          onClick={() => setShowCfg(!showConfig)}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors ml-auto"
        >
          <Settings className="h-4 w-4" />
          Einstellungen
          {showConfig ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        <div className="flex items-center gap-2 text-xs text-gray-500 bg-blue-50 px-3 py-2 rounded-lg">
          <AlertTriangle className="h-3 w-3 text-blue-500" />
          Läuft automatisch alle 30 Min via Cron
        </div>
      </div>

      {/* Konfig-Panel */}
      {showConfig && summary && (
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h3 className="font-semibold text-gray-800">Kompensations-Einstellungen</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Aktiv */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="text-sm font-medium text-gray-700">Automatische Kompensation</div>
                <div className="text-xs text-gray-500">Bei Verspätungen automatisch Guthaben ausstellen</div>
              </div>
              <button onClick={() => setCfgEnabled(!cfgEnabled)} className="text-blue-600">
                {cfgEnabled
                  ? <ToggleRight className="h-8 w-8" />
                  : <ToggleLeft className="h-8 w-8 text-gray-400" />
                }
              </button>
            </div>

            {/* Schwellenwert */}
            <div className="p-3 border rounded-lg">
              <label className="text-sm font-medium text-gray-700 block mb-2">
                <Clock className="h-3.5 w-3.5 inline mr-1" />
                Verspätungs-Schwellenwert (Minuten)
              </label>
              <input
                type="number"
                min={5}
                max={60}
                value={cfgThreshold}
                onChange={(e) => setCfgThreshold(Number(e.target.value))}
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
              <div className="text-xs text-gray-400 mt-1">Kompensation ab {cfgThreshold} Min über ETA</div>
            </div>

            {/* Betrag */}
            <div className="p-3 border rounded-lg">
              <label className="text-sm font-medium text-gray-700 block mb-2">
                <Euro className="h-3.5 w-3.5 inline mr-1" />
                Guthaben-Betrag (EUR)
              </label>
              <input
                type="number"
                min={0.50}
                max={20}
                step={0.50}
                value={cfgAmount}
                onChange={(e) => setCfgAmount(Number(e.target.value))}
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
            </div>

            {/* Monatslimit */}
            <div className="p-3 border rounded-lg">
              <label className="text-sm font-medium text-gray-700 block mb-2">Max. Kompensationen/Kunde/Monat</label>
              <input
                type="number"
                min={1}
                max={10}
                value={cfgLimit}
                onChange={(e) => setCfgLimit(Number(e.target.value))}
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={saveConfig}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Speichern…' : 'Einstellungen speichern'}
            </button>
            <button
              onClick={() => setShowCfg(false)}
              className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Events-Liste */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Kompensations-Verlauf (30 Tage)</h3>
          <span className="text-sm text-gray-500">{events.length} Einträge</span>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-12">Lade…</div>
        ) : events.length === 0 ? (
          <div className="text-center py-12">
            <Shield className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">Noch keine Kompensationen</p>
            <p className="text-xs text-gray-400 mt-1">Kompensationen erscheinen hier sobald Verspätungen erkannt werden</p>
          </div>
        ) : (
          <div className="divide-y">
            {events.map((e) => (
              <div key={e.id} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    {statusBadge(e.status, e.skipReason)}
                    <span className="text-xs text-gray-500">
                      {e.customerName ?? e.customerEmail ?? 'Anonymer Kunde'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    Verspätet: <strong className="text-orange-600">{e.delayMin} Min</strong>
                    {' '}(Schwelle: {e.thresholdMin} Min) ·{' '}
                    {e.deliveredAt ? fmtDateTime(e.deliveredAt) : '—'}
                  </div>
                </div>
                {e.status === 'issued' && (
                  <div className="text-sm font-semibold text-emerald-700">
                    +{fmtEur(e.compensationEur)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
