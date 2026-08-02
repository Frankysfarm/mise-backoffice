'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle,
  Clock, Star, Users, Package, Euro, MapPin, Zap, BarChart2,
  Award, Activity, Target, Shield, Layers, RefreshCw
} from 'lucide-react';

type Ampel = 'ok' | 'warn' | 'critical' | 'overdue';

function ampelColor(a: Ampel) {
  if (a === 'ok') return 'text-emerald-400';
  if (a === 'warn') return 'text-amber-400';
  if (a === 'critical') return 'text-orange-400';
  return 'text-red-500';
}
function ampelBg(a: Ampel) {
  if (a === 'ok') return 'bg-emerald-500/10 border-emerald-500/30';
  if (a === 'warn') return 'bg-amber-500/10 border-amber-500/30';
  if (a === 'critical') return 'bg-orange-500/10 border-orange-500/30';
  return 'bg-red-500/10 border-red-500/30';
}

interface ZoneKpi {
  zone: string;
  lieferungen: number;
  umsatz: number;
  avg_eta_min: number;
  sla_rate: number;
  ampel: Ampel;
  trend: number; // % change vs. yesterday
}

interface SchichtKpi {
  schicht: string; // Früh/Mittag/Abend
  lieferungen: number;
  umsatz: number;
  fahrer: number;
  sla_rate: number;
  bewertung: number;
  auslastung: number; // %
}

interface LoyalitaetsSegment {
  segment: string; // Neu/Gelegentlich/Stamm/Premium
  kunden: number;
  orders: number;
  umsatz: number;
  churn_risk: number; // %
  ampel: Ampel;
}

interface PeakPrognose {
  stunde: number; // 0-23
  prognose_orders: number;
  kapazitaet: number;
  auslastung: number; // %
  ampel: Ampel;
}

interface DashboardData {
  // 21 KPIs
  total_lieferungen: number;
  total_umsatz: number;
  avg_lieferzeit_min: number;
  sla_rate: number;
  bewertung_avg: number;
  aktive_fahrer: number;
  gesamt_km: number;
  umsatz_pro_fahrer: number;
  orders_pro_fahrer: number;
  storno_rate: number;
  neu_kunden_rate: number;
  repeat_rate: number;
  peak_auslastung: number;
  co2_ersparnis_kg: number;
  eco_score: number;
  kapazitaet_score: number;
  quality_score: number;
  fairness_index: number;
  schicht_gesundheits_score: number;
  zone_balance_index: number;
  gesamt_performance_score: number;
  // sub-tables
  zonen: ZoneKpi[];
  schichten: SchichtKpi[];
  loyalitaet: LoyalitaetsSegment[];
  peak_prognose: PeakPrognose[];
  location_name: string;
}

function mock(): DashboardData {
  return {
    total_lieferungen: 347,
    total_umsatz: 12480,
    avg_lieferzeit_min: 28,
    sla_rate: 91.4,
    bewertung_avg: 4.6,
    aktive_fahrer: 14,
    gesamt_km: 1842,
    umsatz_pro_fahrer: 891,
    orders_pro_fahrer: 24.8,
    storno_rate: 2.3,
    neu_kunden_rate: 18.2,
    repeat_rate: 63.7,
    peak_auslastung: 87,
    co2_ersparnis_kg: 124,
    eco_score: 78,
    kapazitaet_score: 82,
    quality_score: 89,
    fairness_index: 0.91,
    schicht_gesundheits_score: 84,
    zone_balance_index: 0.76,
    gesamt_performance_score: 86,
    location_name: 'Hauptstandort',
    zonen: [
      { zone: 'Nord', lieferungen: 112, umsatz: 4200, avg_eta_min: 25, sla_rate: 94.6, ampel: 'ok', trend: 3.2 },
      { zone: 'Mitte', lieferungen: 89, umsatz: 3100, avg_eta_min: 31, sla_rate: 88.8, ampel: 'warn', trend: -1.4 },
      { zone: 'Süd', lieferungen: 76, umsatz: 2700, avg_eta_min: 29, sla_rate: 92.1, ampel: 'ok', trend: 5.7 },
      { zone: 'West', lieferungen: 70, umsatz: 2480, avg_eta_min: 38, sla_rate: 81.4, ampel: 'critical', trend: -6.3 },
    ],
    schichten: [
      { schicht: 'Früh', lieferungen: 95, umsatz: 3200, fahrer: 5, sla_rate: 93.7, bewertung: 4.7, auslastung: 72 },
      { schicht: 'Mittag', lieferungen: 148, umsatz: 5600, fahrer: 9, sla_rate: 89.2, bewertung: 4.5, auslastung: 94 },
      { schicht: 'Abend', lieferungen: 104, umsatz: 3680, fahrer: 7, sla_rate: 91.3, bewertung: 4.6, auslastung: 81 },
    ],
    loyalitaet: [
      { segment: 'Premium', kunden: 87, orders: 6.4, umsatz: 4800, churn_risk: 4, ampel: 'ok' },
      { segment: 'Stamm', kunden: 234, orders: 3.8, umsatz: 5200, churn_risk: 12, ampel: 'ok' },
      { segment: 'Gelegentlich', kunden: 412, orders: 1.9, umsatz: 2100, churn_risk: 38, ampel: 'warn' },
      { segment: 'Neu', kunden: 163, orders: 1.1, umsatz: 380, churn_risk: 71, ampel: 'critical' },
    ],
    peak_prognose: [
      { stunde: 11, prognose_orders: 48, kapazitaet: 55, auslastung: 87, ampel: 'warn' },
      { stunde: 12, prognose_orders: 67, kapazitaet: 55, auslastung: 122, ampel: 'overdue' },
      { stunde: 18, prognose_orders: 58, kapazitaet: 63, auslastung: 92, ampel: 'warn' },
      { stunde: 19, prognose_orders: 74, kapazitaet: 63, auslastung: 117, ampel: 'overdue' },
      { stunde: 20, prognose_orders: 52, kapazitaet: 63, auslastung: 83, ampel: 'warn' },
    ],
  };
}

type Tab = 'kpis' | 'zonen' | 'schichten' | 'loyalitaet' | 'peak' | 'eco';

export function LieferdienstPhase5549StatistikenDashboardV60({
  locationId,
}: {
  locationId: string | null;
}) {
  const [data, setData] = useState<DashboardData>(mock());
  const [tab, setTab] = useState<Tab>('kpis');
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/statistiken-dashboard?locationId=${locationId}`);
      if (r.ok) {
        const json = await r.json();
        setData(json);
      }
    } catch {
      // mock fallback
    } finally {
      setLoading(false);
      setLastUpdate(new Date());
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const perf = data.gesamt_performance_score;
  const perfAmpel: Ampel = perf >= 85 ? 'ok' : perf >= 70 ? 'warn' : perf >= 55 ? 'critical' : 'overdue';

  const kpis = [
    { icon: Package, label: 'Lieferungen', value: data.total_lieferungen.toString(), unit: '', ampel: 'ok' as Ampel },
    { icon: Euro, label: 'Umsatz', value: `${(data.total_umsatz / 1000).toFixed(1)}k`, unit: '€', ampel: 'ok' as Ampel },
    { icon: Clock, label: 'Ø Lieferzeit', value: data.avg_lieferzeit_min.toString(), unit: 'min', ampel: data.avg_lieferzeit_min <= 30 ? 'ok' as Ampel : data.avg_lieferzeit_min <= 40 ? 'warn' as Ampel : 'critical' as Ampel },
    { icon: Target, label: 'SLA-Rate', value: data.sla_rate.toFixed(1), unit: '%', ampel: data.sla_rate >= 90 ? 'ok' as Ampel : data.sla_rate >= 80 ? 'warn' as Ampel : 'critical' as Ampel },
    { icon: Star, label: 'Bewertung', value: data.bewertung_avg.toFixed(1), unit: '★', ampel: data.bewertung_avg >= 4.5 ? 'ok' as Ampel : data.bewertung_avg >= 4.0 ? 'warn' as Ampel : 'critical' as Ampel },
    { icon: Users, label: 'Fahrer', value: data.aktive_fahrer.toString(), unit: '', ampel: 'ok' as Ampel },
    { icon: MapPin, label: 'Gesamt-km', value: data.gesamt_km.toString(), unit: 'km', ampel: 'ok' as Ampel },
    { icon: Euro, label: '€/Fahrer', value: data.umsatz_pro_fahrer.toFixed(0), unit: '€', ampel: data.umsatz_pro_fahrer >= 800 ? 'ok' as Ampel : 'warn' as Ampel },
    { icon: BarChart2, label: 'Orders/Fahr.', value: data.orders_pro_fahrer.toFixed(1), unit: '', ampel: data.orders_pro_fahrer >= 20 ? 'ok' as Ampel : 'warn' as Ampel },
    { icon: AlertTriangle, label: 'Storno', value: data.storno_rate.toFixed(1), unit: '%', ampel: data.storno_rate <= 3 ? 'ok' as Ampel : data.storno_rate <= 5 ? 'warn' as Ampel : 'critical' as Ampel },
    { icon: Users, label: 'Neukunden', value: data.neu_kunden_rate.toFixed(1), unit: '%', ampel: data.neu_kunden_rate >= 15 ? 'ok' as Ampel : 'warn' as Ampel },
    { icon: RefreshCw, label: 'Repeat-Rate', value: data.repeat_rate.toFixed(1), unit: '%', ampel: data.repeat_rate >= 60 ? 'ok' as Ampel : data.repeat_rate >= 45 ? 'warn' as Ampel : 'critical' as Ampel },
    { icon: Activity, label: 'Peak-Ausl.', value: data.peak_auslastung.toString(), unit: '%', ampel: data.peak_auslastung <= 90 ? 'ok' as Ampel : data.peak_auslastung <= 110 ? 'warn' as Ampel : 'critical' as Ampel },
    { icon: Zap, label: 'CO₂-Ersparnis', value: data.co2_ersparnis_kg.toString(), unit: 'kg', ampel: 'ok' as Ampel },
    { icon: Shield, label: 'Eco-Score', value: data.eco_score.toString(), unit: '/100', ampel: data.eco_score >= 75 ? 'ok' as Ampel : data.eco_score >= 55 ? 'warn' as Ampel : 'critical' as Ampel },
    { icon: Layers, label: 'Kapazität', value: data.kapazitaet_score.toString(), unit: '/100', ampel: data.kapazitaet_score >= 80 ? 'ok' as Ampel : 'warn' as Ampel },
    { icon: CheckCircle, label: 'Qualität', value: data.quality_score.toString(), unit: '/100', ampel: data.quality_score >= 85 ? 'ok' as Ampel : data.quality_score >= 70 ? 'warn' as Ampel : 'critical' as Ampel },
    { icon: Award, label: 'Fairness-Idx', value: data.fairness_index.toFixed(2), unit: '', ampel: data.fairness_index >= 0.85 ? 'ok' as Ampel : data.fairness_index >= 0.7 ? 'warn' as Ampel : 'critical' as Ampel },
    { icon: Activity, label: 'Schicht-Score', value: data.schicht_gesundheits_score.toString(), unit: '/100', ampel: data.schicht_gesundheits_score >= 80 ? 'ok' as Ampel : 'warn' as Ampel },
    { icon: MapPin, label: 'Zonen-Balance', value: data.zone_balance_index.toFixed(2), unit: '', ampel: data.zone_balance_index >= 0.8 ? 'ok' as Ampel : data.zone_balance_index >= 0.6 ? 'warn' as Ampel : 'critical' as Ampel },
    { icon: TrendingUp, label: 'Gesamt-Score', value: data.gesamt_performance_score.toString(), unit: '/100', ampel: perfAmpel },
  ];

  const tabs: { id: Tab; label: string }[] = [
    { id: 'kpis', label: '21 KPIs' },
    { id: 'zonen', label: 'Zonen' },
    { id: 'schichten', label: 'Schichten' },
    { id: 'loyalitaet', label: 'Loyalität' },
    { id: 'peak', label: 'Peak-Prog.' },
    { id: 'eco', label: 'Eco & Score' },
  ];

  return (
    <div className="rounded-xl border border-violet-500/30 bg-[#0f0f1a] p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-bold text-white tracking-wide">
            Statistiken-Dashboard V60
          </h2>
          <p className="text-xs text-slate-400">{data.location_name} · 21 KPIs · Zonen · Schichten · Loyalität · Peak</p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <RefreshCw className="w-3 h-3 text-violet-400 animate-spin" />}
          <span className="text-[10px] text-slate-500">{lastUpdate.toLocaleTimeString('de')}</span>
          <span className={`px-2 py-0.5 rounded text-xs font-bold border ${ampelBg(perfAmpel)} ${ampelColor(perfAmpel)}`}>
            Score {data.gesamt_performance_score}/100
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
              tab === t.id
                ? 'bg-violet-600 text-white'
                : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: 21 KPIs */}
      {tab === 'kpis' && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className={`rounded-lg border p-2 ${ampelBg(k.ampel)}`}>
                <div className="flex items-center gap-1 mb-1">
                  <Icon className={`w-3 h-3 ${ampelColor(k.ampel)}`} />
                  <span className="text-[9px] text-slate-400 truncate">{k.label}</span>
                </div>
                <div className={`text-sm font-bold ${ampelColor(k.ampel)}`}>
                  {k.value}<span className="text-[9px] ml-0.5 text-slate-500">{k.unit}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: Zonen */}
      {tab === 'zonen' && (
        <div className="space-y-2">
          <p className="text-[10px] text-slate-500">Zonen-Performance — SLA, ETA, Trend</p>
          {data.zonen.map((z) => (
            <div key={z.zone} className={`rounded-lg border p-3 ${ampelBg(z.ampel)}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-white">{z.zone}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${ampelColor(z.ampel)}`}>
                    SLA {z.sla_rate.toFixed(1)}%
                  </span>
                  <span className={`text-[10px] flex items-center gap-0.5 ${z.trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {z.trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {z.trend >= 0 ? '+' : ''}{z.trend.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1 text-[10px] text-slate-400">
                <div><span className="text-white font-semibold">{z.lieferungen}</span> Lief.</div>
                <div><span className="text-white font-semibold">{(z.umsatz / 1000).toFixed(1)}k</span> €</div>
                <div><span className="text-white font-semibold">{z.avg_eta_min}</span> min ETA</div>
                <div>
                  <span className={`font-semibold ${ampelColor(z.ampel)}`}>
                    {z.ampel === 'ok' ? 'Gut' : z.ampel === 'warn' ? 'Achtung' : 'Kritisch'}
                  </span>
                </div>
              </div>
              {/* Bar */}
              <div className="mt-2 h-1 rounded bg-white/10">
                <div
                  className={`h-full rounded ${z.ampel === 'ok' ? 'bg-emerald-500' : z.ampel === 'warn' ? 'bg-amber-500' : 'bg-orange-500'}`}
                  style={{ width: `${z.sla_rate}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Schichten */}
      {tab === 'schichten' && (
        <div className="space-y-2">
          <p className="text-[10px] text-slate-500">Schicht-Analyse — Früh / Mittag / Abend</p>
          {data.schichten.map((s) => {
            const auslAmpel: Ampel = s.auslastung <= 85 ? 'ok' : s.auslastung <= 100 ? 'warn' : 'critical';
            return (
              <div key={s.schicht} className={`rounded-lg border p-3 ${ampelBg(auslAmpel)}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white">{s.schicht}</span>
                  <span className={`text-xs font-bold ${ampelColor(auslAmpel)}`}>{s.auslastung}% Auslastung</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-400">
                  <div>
                    <div className="text-white font-bold text-sm">{s.lieferungen}</div>
                    <div>Lieferungen</div>
                  </div>
                  <div>
                    <div className="text-white font-bold text-sm">{(s.umsatz / 1000).toFixed(1)}k€</div>
                    <div>Umsatz</div>
                  </div>
                  <div>
                    <div className="text-white font-bold text-sm">{s.fahrer}</div>
                    <div>Fahrer</div>
                  </div>
                  <div>
                    <div className={`font-bold text-sm ${s.sla_rate >= 90 ? 'text-emerald-400' : s.sla_rate >= 80 ? 'text-amber-400' : 'text-orange-400'}`}>{s.sla_rate.toFixed(1)}%</div>
                    <div>SLA</div>
                  </div>
                  <div>
                    <div className="text-amber-400 font-bold text-sm">{'★'.repeat(Math.round(s.bewertung))}</div>
                    <div>{s.bewertung.toFixed(1)}</div>
                  </div>
                  <div>
                    <div className={`font-bold text-sm ${ampelColor(auslAmpel)}`}>{s.auslastung}%</div>
                    <div>Auslastung</div>
                  </div>
                </div>
                <div className="mt-2 h-1.5 rounded bg-white/10">
                  <div
                    className={`h-full rounded ${auslAmpel === 'ok' ? 'bg-emerald-500' : auslAmpel === 'warn' ? 'bg-amber-500' : 'bg-orange-500'}`}
                    style={{ width: `${Math.min(s.auslastung, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
          <div className="rounded-lg border border-violet-500/20 bg-violet-900/10 p-3 text-[10px] text-slate-400">
            <span className="text-violet-300 font-semibold">Schicht-Gesundheits-Score: </span>
            <span className={`font-bold text-sm ml-1 ${data.schicht_gesundheits_score >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>{data.schicht_gesundheits_score}/100</span>
          </div>
        </div>
      )}

      {/* Tab: Loyalität */}
      {tab === 'loyalitaet' && (
        <div className="space-y-2">
          <p className="text-[10px] text-slate-500">Kunden-Loyalitäts-Matrix — Churn-Risiko pro Segment</p>
          {data.loyalitaet.map((seg) => (
            <div key={seg.segment} className={`rounded-lg border p-3 ${ampelBg(seg.ampel)}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-white">{seg.segment}</span>
                <span className={`text-xs font-bold ${ampelColor(seg.ampel)}`}>
                  Churn-Risiko {seg.churn_risk}%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-400">
                <div><span className="text-white font-semibold">{seg.kunden}</span> Kunden</div>
                <div>Ø <span className="text-white font-semibold">{seg.orders.toFixed(1)}</span> Orders/Mo</div>
                <div><span className="text-white font-semibold">{(seg.umsatz / 1000).toFixed(1)}k</span> €</div>
              </div>
              {/* Churn bar */}
              <div className="mt-2 h-1 rounded bg-white/10">
                <div
                  className={`h-full rounded ${seg.churn_risk <= 15 ? 'bg-emerald-500' : seg.churn_risk <= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${seg.churn_risk}%` }}
                />
              </div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div className="rounded-lg border border-violet-500/20 bg-violet-900/10 p-2 text-center">
              <div className="text-xs text-slate-400">Neukunden-Rate</div>
              <div className={`text-lg font-bold ${data.neu_kunden_rate >= 15 ? 'text-emerald-400' : 'text-amber-400'}`}>{data.neu_kunden_rate.toFixed(1)}%</div>
            </div>
            <div className="rounded-lg border border-violet-500/20 bg-violet-900/10 p-2 text-center">
              <div className="text-xs text-slate-400">Repeat-Rate</div>
              <div className={`text-lg font-bold ${data.repeat_rate >= 60 ? 'text-emerald-400' : 'text-amber-400'}`}>{data.repeat_rate.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Peak-Prognose */}
      {tab === 'peak' && (
        <div className="space-y-2">
          <p className="text-[10px] text-slate-500">Peak-Prognose-Ampel — Überlast-Stunden-Warnung</p>
          {data.peak_prognose.map((p) => (
            <div key={p.stunde} className={`rounded-lg border p-3 ${ampelBg(p.ampel)}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-white">{p.stunde}:00 Uhr</span>
                <span className={`text-xs font-bold ${ampelColor(p.ampel)}`}>
                  {p.auslastung}% Auslastung
                  {p.auslastung > 100 && <span className="ml-1 text-[10px]">⚠ ÜBERLAST</span>}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-400 mb-2">
                <div>Prog. <span className="text-white font-semibold">{p.prognose_orders}</span> Orders</div>
                <div>Kap. <span className="text-white font-semibold">{p.kapazitaet}</span> Slots</div>
                <div>Δ <span className={`font-semibold ${p.prognose_orders > p.kapazitaet ? 'text-red-400' : 'text-emerald-400'}`}>{p.prognose_orders - p.kapazitaet}</span></div>
              </div>
              <div className="h-2 rounded bg-white/10 relative overflow-hidden">
                <div
                  className={`h-full rounded ${p.ampel === 'ok' ? 'bg-emerald-500' : p.ampel === 'warn' ? 'bg-amber-500' : p.ampel === 'critical' ? 'bg-orange-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(p.auslastung, 100)}%` }}
                />
              </div>
            </div>
          ))}
          <div className="rounded-lg border border-violet-500/20 bg-violet-900/10 p-3 text-[10px] text-slate-400">
            <div className="flex justify-between items-center">
              <span className="text-violet-300 font-semibold">Peak-Auslastung heute (max):</span>
              <span className={`text-lg font-bold ${data.peak_auslastung <= 90 ? 'text-emerald-400' : data.peak_auslastung <= 110 ? 'text-amber-400' : 'text-red-400'}`}>
                {data.peak_auslastung}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Eco & Score */}
      {tab === 'eco' && (
        <div className="space-y-3">
          <p className="text-[10px] text-slate-500">Nachhaltigkeit + Gesamtbewertung</p>
          {/* Eco metrics */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
              <Zap className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
              <div className="text-xl font-bold text-emerald-400">{data.co2_ersparnis_kg} kg</div>
              <div className="text-[10px] text-slate-400">CO₂-Ersparnis heute</div>
            </div>
            <div className={`rounded-lg border p-3 text-center ${ampelBg(data.eco_score >= 75 ? 'ok' : data.eco_score >= 55 ? 'warn' : 'critical')}`}>
              <Shield className={`w-5 h-5 mx-auto mb-1 ${data.eco_score >= 75 ? 'text-emerald-400' : data.eco_score >= 55 ? 'text-amber-400' : 'text-orange-400'}`} />
              <div className={`text-xl font-bold ${data.eco_score >= 75 ? 'text-emerald-400' : data.eco_score >= 55 ? 'text-amber-400' : 'text-orange-400'}`}>{data.eco_score}/100</div>
              <div className="text-[10px] text-slate-400">Eco-Score</div>
            </div>
          </div>
          {/* Score breakdown */}
          <div className="space-y-1.5">
            {[
              { label: 'Gesamtperformance', val: data.gesamt_performance_score, max: 100 },
              { label: 'Schicht-Gesundheit', val: data.schicht_gesundheits_score, max: 100 },
              { label: 'Kapazitäts-Score', val: data.kapazitaet_score, max: 100 },
              { label: 'Qualitäts-Score', val: data.quality_score, max: 100 },
              { label: 'Eco-Score', val: data.eco_score, max: 100 },
              { label: 'Fairness-Index', val: Math.round(data.fairness_index * 100), max: 100 },
              { label: 'Zonen-Balance', val: Math.round(data.zone_balance_index * 100), max: 100 },
            ].map((s) => {
              const a: Ampel = s.val >= 80 ? 'ok' : s.val >= 60 ? 'warn' : s.val >= 40 ? 'critical' : 'overdue';
              return (
                <div key={s.label}>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                    <span>{s.label}</span>
                    <span className={`font-semibold ${ampelColor(a)}`}>{s.val}/{s.max}</span>
                  </div>
                  <div className="h-1.5 rounded bg-white/10">
                    <div
                      className={`h-full rounded transition-all ${a === 'ok' ? 'bg-emerald-500' : a === 'warn' ? 'bg-amber-500' : a === 'critical' ? 'bg-orange-500' : 'bg-red-500'}`}
                      style={{ width: `${s.val}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
