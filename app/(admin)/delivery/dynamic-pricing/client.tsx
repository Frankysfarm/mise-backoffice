'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, Zap, Euro, Clock, Settings,
  ToggleLeft, ToggleRight, RefreshCw, Search, ChevronDown, ChevronUp,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Typen ────────────────────────────────────────────────────────────────────

interface DynamicPricingConfig {
  locationId:            string;
  isEnabled:             boolean;
  multiplierNormal:      number;
  multiplierSurgeLow:    number;
  multiplierSurgeMid:    number;
  multiplierSurgeHigh:   number;
  maxSurchargeEur:       number;
  offPeakEnabled:        boolean;
  offPeakDiscountPct:    number;
  offPeakStartHour:      number;
  offPeakEndHour:        number;
  customerBannerEnabled: boolean;
  updatedAt:             string;
}

interface TodayStats {
  eventsToday:      number;
  surgeEvents:      number;
  offPeakEvents:    number;
  avgMultiplier:    number | null;
  extraRevenueEur:  number;
  discountGivenEur: number;
}

interface PricingEvent {
  id:                string;
  orderId:           string | null;
  pricingReason:     string;
  baseFeeEur:        number;
  appliedMultiplier: number;
  discountPct:       number;
  finalFeeEur:       number;
  surgeLevel:        string | null;
  hourUtc:           number;
  createdAt:         string;
}

interface HourlyPattern {
  hour:          number;
  avgMultiplier: number;
  events:        number;
}

interface PreviewResult {
  baseFeeEur:        number;
  appliedMultiplier: number;
  discountPct:       number;
  finalFeeEur:       number;
  surchargeEur:      number;
  discountEur:       number;
  pricingReason:     string;
  bannerText:        string | null;
}

type SurgeLevel = 'none' | 'elevated' | 'high' | 'extreme';

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function euro(v: number) {
  return `€${v.toFixed(2)}`;
}

function reasonLabel(r: string): string {
  const MAP: Record<string, string> = {
    normal:       'Normal',
    surge_low:    'Surge niedrig',
    surge_mid:    'Surge mittel',
    surge_high:   'Surge hoch',
    off_peak:     'Off-Peak',
    off_peak_surge: 'Off-Peak + Surge',
  };
  return MAP[r] ?? r;
}

function reasonColor(r: string): string {
  if (r.startsWith('surge_high')) return 'text-red-600 bg-red-50';
  if (r.startsWith('surge_mid')) return 'text-orange-600 bg-orange-50';
  if (r.startsWith('surge_low')) return 'text-amber-600 bg-amber-50';
  if (r.startsWith('off_peak')) return 'text-emerald-600 bg-emerald-50';
  return 'text-stone-600 bg-stone-100';
}

function surgeLabel(l: string | null): string {
  const MAP: Record<string, string> = {
    none: 'Keine', elevated: 'Erhöht', high: 'Hoch', extreme: 'Extrem',
  };
  return l ? (MAP[l] ?? l) : '—';
}

// ─── KPI-Karte ───────────────────────────────────────────────────────────────

function KpiCard({
  title, value, sub, icon: Icon, color,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4 flex gap-3 items-start">
      <div className={cn('p-2 rounded-lg', color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-steel">{title}</p>
        <p className="text-lg font-bold text-char truncate">{value}</p>
        {sub && <p className="text-xs text-steel mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Slider-Zeile ─────────────────────────────────────────────────────────────

function SliderRow({
  label, value, min, max, step, onChange, disabled, suffix = '×',
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-sm text-char">{label}</span>
        <span className="text-sm font-mono font-semibold text-char">
          {suffix === '€' ? euro(value) : `${value.toFixed(2)}${suffix}`}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-amber-500 disabled:opacity-40"
      />
      <div className="flex justify-between text-[10px] text-steel">
        <span>{suffix === '€' ? euro(min) : `${min}${suffix}`}</span>
        <span>{suffix === '€' ? euro(max) : `${max}${suffix}`}</span>
      </div>
    </div>
  );
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

export function DynamicPricingClient({ locationId }: { locationId: string }) {
  const [tab, setTab] = useState<'config' | 'preview' | 'log'>('config');
  const [config, setConfig]           = useState<DynamicPricingConfig | null>(null);
  const [todayStats, setTodayStats]   = useState<TodayStats | null>(null);
  const [events, setEvents]           = useState<PricingEvent[]>([]);
  const [hourly, setHourly]           = useState<HourlyPattern[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [toggling, setToggling]       = useState(false);
  const [saved, setSaved]             = useState(false);
  const [localCfg, setLocalCfg]       = useState<DynamicPricingConfig | null>(null);

  // Preview
  const [prevBaseFee, setPrevBaseFee]   = useState(2.99);
  const [prevSurge, setPrevSurge]       = useState<SurgeLevel>('none');
  const [preview, setPreview]           = useState<PreviewResult | null>(null);
  const [previewing, setPreviewing]     = useState(false);

  // Expand Ereignis-Log row
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/dynamic-pricing?action=dashboard');
      if (!res.ok) return;
      const d = await res.json() as {
        config: DynamicPricingConfig;
        todayStats: TodayStats;
        recentEvents: PricingEvent[];
        hourlyPattern: HourlyPattern[];
      };
      setConfig(d.config);
      setLocalCfg(d.config);
      setTodayStats(d.todayStats);
      setEvents(d.recentEvents);
      setHourly(d.hourlyPattern);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleToggle() {
    if (!config) return;
    setToggling(true);
    try {
      const res = await fetch('/api/delivery/admin/dynamic-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle' }),
      });
      const d = await res.json() as { config: DynamicPricingConfig };
      setConfig(d.config);
      setLocalCfg(d.config);
    } finally {
      setToggling(false);
    }
  }

  async function handleSave() {
    if (!localCfg) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/delivery/admin/dynamic-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_config', ...localCfg }),
      });
      const d = await res.json() as { config: DynamicPricingConfig };
      setConfig(d.config);
      setLocalCfg(d.config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    setPreviewing(true);
    setPreview(null);
    try {
      const res = await fetch('/api/delivery/admin/dynamic-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview',
          baseFeeEur: prevBaseFee,
          surgeLevel: prevSurge,
        }),
      });
      const d = await res.json() as { preview: PreviewResult };
      setPreview(d.preview);
    } finally {
      setPreviewing(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-steel">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span>Lade Dynamic Pricing…</span>
      </div>
    );
  }

  const cfg = localCfg ?? config;
  const isEnabled = config?.isEnabled ?? false;

  return (
    <div className="p-6 max-w-4xl space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-char">Dynamic Pricing Engine</h1>
          <p className="text-sm text-steel mt-1">
            Surge-basierte Liefergebühren mit Off-Peak-Rabatten und Admin-Konfiguration
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void load()}
            className="p-2 rounded-lg border border-stone-200 hover:bg-stone-50 text-steel"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => void handleToggle()}
            disabled={toggling}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
              isEnabled
                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                : 'bg-stone-100 text-steel hover:bg-stone-200 border border-stone-200',
            )}
          >
            {isEnabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
            {isEnabled ? 'Aktiv' : 'Deaktiviert'}
          </button>
        </div>
      </div>

      {/* Status-Banner */}
      {!isEnabled && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-amber-800 text-sm">
          <Info className="h-4 w-4 shrink-0" />
          Dynamic Pricing ist deaktiviert. Aktivieren um surge-basierte Liefergebühren anzuwenden.
        </div>
      )}

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          title="Status"
          value={isEnabled ? 'Aktiv' : 'Inaktiv'}
          sub="Dynamisches Pricing"
          icon={isEnabled ? ToggleRight : ToggleLeft}
          color={isEnabled ? 'bg-emerald-100 text-emerald-600' : 'bg-stone-100 text-stone-500'}
        />
        <KpiCard
          title="Ø Multiplikator heute"
          value={todayStats?.avgMultiplier != null ? `×${todayStats.avgMultiplier.toFixed(2)}` : '—'}
          sub={`${todayStats?.eventsToday ?? 0} Ereignisse`}
          icon={TrendingUp}
          color="bg-amber-100 text-amber-600"
        />
        <KpiCard
          title="Mehrumsatz Surge"
          value={todayStats ? euro(todayStats.extraRevenueEur) : '—'}
          sub={`${todayStats?.surgeEvents ?? 0} Surge-Events`}
          icon={Euro}
          color="bg-blue-100 text-blue-600"
        />
        <KpiCard
          title="Off-Peak-Rabatte"
          value={todayStats ? euro(todayStats.discountGivenEur) : '—'}
          sub={`${todayStats?.offPeakEvents ?? 0} Rabatt-Events`}
          icon={TrendingDown}
          color="bg-violet-100 text-violet-600"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 rounded-xl p-1">
        {(['config', 'preview', 'log'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === t ? 'bg-white text-char shadow-sm' : 'text-steel hover:text-char',
            )}
          >
            {t === 'config' ? 'Konfiguration' : t === 'preview' ? 'Live-Preview' : 'Ereignis-Log'}
          </button>
        ))}
      </div>

      {/* Tab: Konfiguration */}
      {tab === 'config' && cfg && (
        <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-6">

          {/* Surge-Multiplikatoren */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-char flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Surge-Multiplikatoren
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <SliderRow
                label="Normal (kein Surge)"
                value={cfg.multiplierNormal}
                min={1.0} max={1.5} step={0.05}
                disabled={!cfg.isEnabled}
                onChange={(v) => setLocalCfg((c) => c ? { ...c, multiplierNormal: v } : c)}
              />
              <SliderRow
                label="Surge — Erhöht"
                value={cfg.multiplierSurgeLow}
                min={1.0} max={2.0} step={0.05}
                disabled={!cfg.isEnabled}
                onChange={(v) => setLocalCfg((c) => c ? { ...c, multiplierSurgeLow: v } : c)}
              />
              <SliderRow
                label="Surge — Hoch"
                value={cfg.multiplierSurgeMid}
                min={1.0} max={2.5} step={0.1}
                disabled={!cfg.isEnabled}
                onChange={(v) => setLocalCfg((c) => c ? { ...c, multiplierSurgeMid: v } : c)}
              />
              <SliderRow
                label="Surge — Extrem"
                value={cfg.multiplierSurgeHigh}
                min={1.0} max={3.0} step={0.1}
                disabled={!cfg.isEnabled}
                onChange={(v) => setLocalCfg((c) => c ? { ...c, multiplierSurgeHigh: v } : c)}
              />
            </div>
            <SliderRow
              label="Max. Aufpreis (Kappen-Limit)"
              value={cfg.maxSurchargeEur}
              min={0} max={10} step={0.5}
              suffix="€"
              disabled={!cfg.isEnabled}
              onChange={(v) => setLocalCfg((c) => c ? { ...c, maxSurchargeEur: v } : c)}
            />
          </div>

          {/* Off-Peak */}
          <div className="space-y-4 border-t border-stone-100 pt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-char flex items-center gap-2">
                <Clock className="h-4 w-4 text-violet-500" />
                Off-Peak-Rabatt
              </h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cfg.offPeakEnabled}
                  disabled={!cfg.isEnabled}
                  onChange={(e) => setLocalCfg((c) => c ? { ...c, offPeakEnabled: e.target.checked } : c)}
                  className="accent-violet-500"
                />
                <span className="text-sm text-steel">{cfg.offPeakEnabled ? 'Aktiv' : 'Inaktiv'}</span>
              </label>
            </div>
            {cfg.offPeakEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <SliderRow
                  label="Rabatt-Prozent"
                  value={cfg.offPeakDiscountPct}
                  min={0} max={50} step={5}
                  suffix="%"
                  disabled={!cfg.isEnabled}
                  onChange={(v) => setLocalCfg((c) => c ? { ...c, offPeakDiscountPct: v } : c)}
                />
                <SliderRow
                  label="Start-Stunde (UTC)"
                  value={cfg.offPeakStartHour}
                  min={0} max={23} step={1}
                  suffix="h"
                  disabled={!cfg.isEnabled}
                  onChange={(v) => setLocalCfg((c) => c ? { ...c, offPeakStartHour: v } : c)}
                />
                <SliderRow
                  label="End-Stunde (UTC)"
                  value={cfg.offPeakEndHour}
                  min={0} max={23} step={1}
                  suffix="h"
                  disabled={!cfg.isEnabled}
                  onChange={(v) => setLocalCfg((c) => c ? { ...c, offPeakEndHour: v } : c)}
                />
              </div>
            )}
          </div>

          {/* Kunden-Banner */}
          <div className="border-t border-stone-100 pt-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-char">Transparenz-Banner für Kunden</p>
              <p className="text-xs text-steel mt-0.5">Zeigt Kunden warum die Gebühr abweicht</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={cfg.customerBannerEnabled}
                onChange={(e) => setLocalCfg((c) => c ? { ...c, customerBannerEnabled: e.target.checked } : c)}
                className="accent-amber-500"
              />
              <span className="text-sm text-steel">{cfg.customerBannerEnabled ? 'Aktiv' : 'Inaktiv'}</span>
            </label>
          </div>

          {/* Speichern */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="px-4 py-2 bg-char text-white rounded-lg text-sm font-semibold hover:bg-stone-700 disabled:opacity-50"
            >
              {saving ? 'Speichern…' : 'Konfiguration speichern'}
            </button>
            {saved && <span className="text-xs text-emerald-600">✓ Gespeichert</span>}
          </div>
        </div>
      )}

      {/* Tab: Live-Preview */}
      {tab === 'preview' && (
        <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-6">
          <h3 className="text-sm font-semibold text-char flex items-center gap-2">
            <Search className="h-4 w-4 text-blue-500" />
            Gebühr-Vorschau
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="text-xs text-steel">Basis-Liefergebühr (€)</label>
              <input
                type="number"
                min={0}
                max={15}
                step={0.5}
                value={prevBaseFee}
                onChange={(e) => setPrevBaseFee(parseFloat(e.target.value))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-steel">Surge-Level</label>
              <select
                value={prevSurge}
                onChange={(e) => setPrevSurge(e.target.value as SurgeLevel)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="none">Kein Surge</option>
                <option value="elevated">Erhöht</option>
                <option value="high">Hoch</option>
                <option value="extreme">Extrem</option>
              </select>
            </div>
          </div>
          <button
            onClick={() => void handlePreview()}
            disabled={previewing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {previewing ? 'Berechne…' : 'Vorschau berechnen'}
          </button>

          {preview && (
            <div className="bg-stone-50 rounded-xl border border-stone-200 p-5 space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-steel">Basis-Gebühr</p>
                  <p className="text-xl font-bold text-char">{euro(preview.baseFeeEur)}</p>
                </div>
                <div>
                  <p className="text-xs text-steel">Multiplikator</p>
                  <p className="text-xl font-bold text-char">×{preview.appliedMultiplier.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-steel">Finale Gebühr</p>
                  <p className="text-xl font-bold text-emerald-700">{euro(preview.finalFeeEur)}</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <span className={cn('px-2 py-1 rounded-full text-xs font-medium', reasonColor(preview.pricingReason))}>
                  {reasonLabel(preview.pricingReason)}
                </span>
                {preview.discountPct > 0 && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-violet-50 text-violet-700">
                    -{preview.discountPct.toFixed(0)}% Rabatt ({euro(preview.discountEur)})
                  </span>
                )}
                {preview.surchargeEur > 0 && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700">
                    +{euro(preview.surchargeEur)} Aufpreis
                  </span>
                )}
              </div>
              {preview.bannerText && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-center gap-2">
                  <Info className="h-4 w-4 shrink-0" />
                  Kunden-Banner: „{preview.bannerText}"
                </div>
              )}
            </div>
          )}

          {/* Stündliches Muster */}
          {hourly.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-steel uppercase tracking-wide">
                Ø Multiplikator nach Stunde (7 Tage)
              </h4>
              <div className="flex gap-1 items-end h-16">
                {Array.from({ length: 24 }, (_, h) => {
                  const entry = hourly.find((x) => x.hour === h);
                  const m = entry?.avgMultiplier ?? 1.0;
                  const height = Math.max(4, Math.min(64, (m - 0.9) * 120));
                  return (
                    <div key={h} className="flex-1 flex flex-col items-center justify-end gap-0.5" title={`${h}h: ×${m.toFixed(2)}`}>
                      <div
                        style={{ height: `${height}px` }}
                        className={cn('w-full rounded-t', m >= 1.5 ? 'bg-red-400' : m >= 1.2 ? 'bg-amber-400' : 'bg-blue-300')}
                      />
                      {h % 4 === 0 && <span className="text-[9px] text-steel">{h}h</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Ereignis-Log */}
      {tab === 'log' && (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-char flex items-center gap-2">
              <Settings className="h-4 w-4 text-steel" />
              Letzte Pricing-Ereignisse
            </h3>
            <span className="text-xs text-steel">{events.length} Einträge</span>
          </div>
          {events.length === 0 ? (
            <div className="p-8 text-center text-steel text-sm">Noch keine Pricing-Ereignisse</div>
          ) : (
            <div className="divide-y divide-stone-100">
              {events.map((ev) => (
                <div key={ev.id}>
                  <button
                    onClick={() => setExpanded((x) => x === ev.id ? null : ev.id)}
                    className="w-full px-5 py-3 flex items-center justify-between hover:bg-stone-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 text-left">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', reasonColor(ev.pricingReason))}>
                        {reasonLabel(ev.pricingReason)}
                      </span>
                      <span className="text-sm text-char font-medium">{euro(ev.finalFeeEur)}</span>
                      <span className="text-xs text-steel">×{ev.appliedMultiplier.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-steel">
                        {new Date(ev.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {expanded === ev.id ? (
                        <ChevronUp className="h-3 w-3 text-steel" />
                      ) : (
                        <ChevronDown className="h-3 w-3 text-steel" />
                      )}
                    </div>
                  </button>
                  {expanded === ev.id && (
                    <div className="px-5 pb-3 bg-stone-50 text-xs text-steel grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div><span className="font-medium text-char">Basis:</span> {euro(ev.baseFeeEur)}</div>
                      <div><span className="font-medium text-char">Surge:</span> {surgeLabel(ev.surgeLevel)}</div>
                      <div><span className="font-medium text-char">Rabatt:</span> {ev.discountPct.toFixed(0)}%</div>
                      <div><span className="font-medium text-char">Stunde:</span> {ev.hourUtc}:00 UTC</div>
                      {ev.orderId && (
                        <div className="col-span-2 md:col-span-4">
                          <span className="font-medium text-char">Order:</span>{' '}
                          <span className="font-mono">{ev.orderId}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
