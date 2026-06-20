'use client';

import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Heart, TrendingUp, RefreshCw, Settings, Star, Zap, Clock,
  CheckCircle, Euro, BarChart3, ChevronDown, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SmartTipDashboard, SmartTipConfig } from '@/lib/delivery/smart-tip-engine';

interface Props {
  locationId: string;
  initial: SmartTipDashboard;
}

type Tab = 'overview' | 'recent' | 'config';

function fmt(n: number | null | undefined, dec = 0): string {
  if (n == null) return '—';
  return n.toFixed(dec);
}
function fmtEur(n: number | null | undefined): string {
  if (n == null) return '—';
  return `€${n.toFixed(2)}`;
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function PunctualityBadge({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-muted-foreground text-xs">—</span>;
  if (delta >= 5)
    return <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">+{fmt(delta, 1)} Min früh</span>;
  if (delta >= 0)
    return <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">Pünktlich</span>;
  return <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">{fmt(delta, 1)} Min</span>;
}

export function SmartTipEngineClient({ locationId, initial }: Props) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<SmartTipConfig>(initial.config);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/smart-tip-engine?location_id=${locationId}`);
      const json = await res.json();
      if (json.ok) {
        setData(json as SmartTipDashboard);
        setConfig(json.config);
      }
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  const saveConfig = useCallback(async () => {
    setSaving(true);
    try {
      await fetch('/api/delivery/admin/smart-tip-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_config',
          location_id: locationId,
          is_enabled: config.isEnabled,
          base_pct: config.basePct,
          boost_pct_punctual: config.boostPctPunctual,
          penalty_pct_late: config.penaltyPctLate,
          driver_score_boost: config.driverScoreBoost,
          min_suggestion_eur: config.minSuggestionEur,
          max_suggestion_eur: config.maxSuggestionEur,
        }),
      });
      await reload();
    } finally {
      setSaving(false);
    }
  }, [config, locationId, reload]);

  const { stats } = data;

  const kpis = [
    {
      icon: <Zap size={16} />,
      label: 'Vorschläge gezeigt (30T)',
      value: fmt(stats.suggestionsShown30d),
      color: 'text-blue-700',
      bg: 'bg-blue-50',
    },
    {
      icon: <CheckCircle size={16} />,
      label: 'Trinkgeld gegeben (30T)',
      value: fmt(stats.tipsChosen30d),
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
    },
    {
      icon: <TrendingUp size={16} />,
      label: 'Konversionsrate',
      value: `${fmt(stats.conversionRate, 1)}%`,
      color: 'text-purple-700',
      bg: 'bg-purple-50',
    },
    {
      icon: <Euro size={16} />,
      label: 'Ø Trinkgeld gewählt',
      value: fmtEur(stats.avgActualTipEur),
      color: 'text-amber-700',
      bg: 'bg-amber-50',
    },
  ];

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Übersicht', icon: <BarChart3 size={14} /> },
    { id: 'recent', label: 'Letzte Vorschläge', icon: <Clock size={14} /> },
    { id: 'config', label: 'Konfiguration', icon: <Settings size={14} /> },
  ];

  return (
    <div className="space-y-6">
      {/* KPI-Karten */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <div className={cn('flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest', k.color)}>
              <span className={cn('p-1 rounded', k.bg)}>{k.icon}</span>
              {k.label}
            </div>
            <div className="mt-2 font-display text-2xl font-bold">{k.value}</div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition',
              tab === t.id
                ? 'border-matcha-600 text-matcha-800'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 pb-2">
          <Button size="sm" variant="outline" onClick={reload} disabled={loading}>
            <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Übersicht */}
      {tab === 'overview' && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-5 space-y-4">
            <div className="font-display font-bold text-base flex items-center gap-2">
              <Star size={16} className="text-amber-500" /> Trinkgeld-Performance
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ø Vorschlag (mid)</span>
                <span className="font-bold">{fmtEur(stats.avgMidSuggestionEur)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ø Gewählt</span>
                <span className="font-bold">{fmtEur(stats.avgActualTipEur)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tip vs. Vorschlag</span>
                <span className={cn('font-bold', stats.tipVsSuggestionRatio >= 100 ? 'text-emerald-700' : 'text-amber-700')}>
                  {fmt(stats.tipVsSuggestionRatio, 1)}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Konversionsrate</span>
                <span className="font-bold">{fmt(stats.conversionRate, 1)}%</span>
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="font-display font-bold text-base flex items-center gap-2">
              <Heart size={16} className="text-rose-500" /> Status
            </div>
            <div className="flex items-center gap-3">
              <span className={cn(
                'px-3 py-1.5 rounded-full text-sm font-bold',
                data.config.isEnabled
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-600',
              )}>
                {data.config.isEnabled ? '✓ Aktiv' : '○ Deaktiviert'}
              </span>
            </div>
            <div className="text-sm space-y-1.5 mt-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Basis-Prozentsatz</span>
                <span className="font-mono font-bold">{fmt(data.config.basePct, 0)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pünktlichkeits-Bonus</span>
                <span className="font-mono font-bold text-emerald-700">+{fmt(data.config.boostPctPunctual, 0)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Verspätungs-Malus</span>
                <span className="font-mono font-bold text-amber-700">-{fmt(data.config.penaltyPctLate, 0)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fahrer-Score-Boost</span>
                <span className={cn('font-bold text-xs', data.config.driverScoreBoost ? 'text-emerald-700' : 'text-muted-foreground')}>
                  {data.config.driverScoreBoost ? 'Aktiv (±5%)' : 'Inaktiv'}
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Letzte Vorschläge */}
      {tab === 'recent' && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {['Datum', 'Bestellwert', 'Low / Mid / High', 'Pünktlichkeit', 'Fahrer-Score', 'Gewählt'].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.recentSuggestions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                      Noch keine Vorschläge vorhanden
                    </td>
                  </tr>
                )}
                {data.recentSuggestions.map((row) => {
                  const isExpanded = expandedRows.has(row.id);
                  return (
                    <>
                      <tr
                        key={row.id}
                        className="hover:bg-muted/30 cursor-pointer"
                        onClick={() => setExpandedRows((prev) => {
                          const next = new Set(prev);
                          if (next.has(row.id)) next.delete(row.id); else next.add(row.id);
                          return next;
                        })}
                      >
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">{fmtDate(row.shownAt)}</td>
                        <td className="px-4 py-2.5 font-mono">{fmtEur(row.orderValueEur)}</td>
                        <td className="px-4 py-2.5 font-mono text-xs">
                          <span className="text-slate-500">{fmtEur(row.suggestedLowEur)}</span>
                          {' / '}
                          <span className="font-bold text-matcha-800">{fmtEur(row.suggestedMidEur)}</span>
                          {' / '}
                          <span className="text-emerald-700">{fmtEur(row.suggestedHighEur)}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <PunctualityBadge delta={row.punctualityDeltaMin} />
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs">{fmt(row.driverScore, 0)}</td>
                        <td className="px-4 py-2.5">
                          {row.actualTipEur !== null ? (
                            <span className="font-bold text-emerald-700">{fmtEur(row.actualTipEur)}</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${row.id}-detail`} className="bg-muted/20">
                          <td colSpan={6} className="px-4 py-2 text-xs text-muted-foreground">
                            <span className="font-semibold mr-2">Grund:</span>{row.reason ?? '—'}
                            {row.deliveryMin !== null && (
                              <span className="ml-4">
                                <span className="font-semibold">Lieferzeit:</span> {fmt(row.deliveryMin, 1)} Min
                                {row.etaMin !== null && ` (ETA: ${fmt(row.etaMin, 1)} Min)`}
                              </span>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Konfiguration */}
      {tab === 'config' && (
        <Card className="p-6 space-y-5 max-w-xl">
          <div className="font-display font-bold text-base">Konfiguration</div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Smart Tip Engine aktiv</label>
            <button
              onClick={() => setConfig((c) => ({ ...c, isEnabled: !c.isEnabled }))}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                config.isEnabled ? 'bg-matcha-600' : 'bg-muted',
              )}
            >
              <span className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                config.isEnabled ? 'translate-x-6' : 'translate-x-1',
              )} />
            </button>
          </div>

          {[
            { key: 'basePct' as const, label: 'Basis-Prozentsatz (%)', min: 5, max: 30, step: 1 },
            { key: 'boostPctPunctual' as const, label: 'Pünktlichkeits-Bonus (%)', min: 0, max: 20, step: 1 },
            { key: 'penaltyPctLate' as const, label: 'Verspätungs-Malus (%)', min: 0, max: 20, step: 1 },
            { key: 'minSuggestionEur' as const, label: 'Mindest-Vorschlag (€)', min: 0.5, max: 5, step: 0.5 },
            { key: 'maxSuggestionEur' as const, label: 'Maximal-Vorschlag (€)', min: 2, max: 20, step: 0.5 },
          ].map(({ key, label, min, max, step }) => (
            <div key={key} className="space-y-1">
              <div className="flex justify-between text-sm">
                <label className="font-medium">{label}</label>
                <span className="font-mono font-bold text-matcha-800">{config[key]}</span>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={config[key]}
                onChange={(e) => setConfig((c) => ({ ...c, [key]: parseFloat(e.target.value) }))}
                className="w-full accent-matcha-600"
              />
            </div>
          ))}

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Fahrer-Score-Boost (±5%)</label>
            <button
              onClick={() => setConfig((c) => ({ ...c, driverScoreBoost: !c.driverScoreBoost }))}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                config.driverScoreBoost ? 'bg-matcha-600' : 'bg-muted',
              )}
            >
              <span className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                config.driverScoreBoost ? 'translate-x-6' : 'translate-x-1',
              )} />
            </button>
          </div>

          <Button onClick={saveConfig} disabled={saving} className="w-full">
            {saving ? 'Speichert…' : 'Konfiguration speichern'}
          </Button>
        </Card>
      )}
    </div>
  );
}
