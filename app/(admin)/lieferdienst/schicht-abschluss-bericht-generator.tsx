'use client';

import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';
import {
  AlertTriangle, Bike, CheckCircle2, Clock, Download,
  Euro, FileText, Loader2, Package, Target, TrendingDown,
  TrendingUp, X,
} from 'lucide-react';

/* ── Types ──────────────────────────────────────────────────────── */

type ShiftReport = {
  date: string;
  location: string;
  totalOrders: number;
  totalRevenue: number;
  cancelledOrders: number;
  avgDeliveryMin: number;
  onTimePct: number;
  activeDrivers: number;
  totalTips: number;
  topZone: string;
  topDriver: string;
  prevWeekOrders: number;
  prevWeekRevenue: number;
  prevWeekOnTimePct: number;
};

type GenState = 'idle' | 'loading' | 'ready' | 'error';

/* ── Mock data ──────────────────────────────────────────────────── */

const MOCK_REPORT: ShiftReport = {
  date: new Date().toLocaleDateString('de-DE'),
  location: 'München Zentral',
  totalOrders: 187,
  totalRevenue: 4820.50,
  cancelledOrders: 8,
  avgDeliveryMin: 28.4,
  onTimePct: 83.2,
  activeDrivers: 6,
  totalTips: 312.0,
  topZone: 'Schwabing',
  topDriver: 'Karl M.',
  prevWeekOrders: 164,
  prevWeekRevenue: 4210.00,
  prevWeekOnTimePct: 79.5,
};

/* ── Helpers ────────────────────────────────────────────────────── */

function trendPct(current: number, prev: number): number {
  if (prev === 0) return 0;
  return Math.round(((current - prev) / prev) * 1000) / 10;
}

function TrendChip({ value, invert = false }: { value: number; invert?: boolean }) {
  const positive = invert ? value < 0 : value > 0;
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : null;
  if (!Icon) return <span className="text-[10px] text-muted-foreground">–</span>;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold',
      positive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
    )}>
      <Icon className="h-2.5 w-2.5" />
      {Math.abs(value)}%
    </span>
  );
}

function KpiRow({ label, value, icon: Icon, trend }: {
  label: string; value: string; icon: React.ElementType; trend?: number;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-border last:border-0">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="flex-1 text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-bold tabular-nums">{value}</span>
      {trend !== undefined && <TrendChip value={trend} />}
    </div>
  );
}

/* ── PDF generator (simple text-based CSV fallback) ─────────────── */

function generateCsvBlob(report: ShiftReport): Blob {
  const lines = [
    'Metric,Wert,Vorwoche,Δ',
    `Datum,${report.date},,`,
    `Standort,${report.location},,`,
    `Bestellungen,${report.totalOrders},${report.prevWeekOrders},${trendPct(report.totalOrders, report.prevWeekOrders)}%`,
    `Umsatz,${report.totalRevenue.toFixed(2)},${report.prevWeekRevenue.toFixed(2)},${trendPct(report.totalRevenue, report.prevWeekRevenue)}%`,
    `Storniert,${report.cancelledOrders},,`,
    `Ø Lieferzeit (min),${report.avgDeliveryMin.toFixed(1)},,`,
    `Pünktlichkeit (%),${report.onTimePct},${report.prevWeekOnTimePct},${trendPct(report.onTimePct, report.prevWeekOnTimePct)}%`,
    `Aktive Fahrer,${report.activeDrivers},,`,
    `Trinkgelder,${report.totalTips.toFixed(2)},,`,
    `Top-Zone,${report.topZone},,`,
    `Top-Fahrer,${report.topDriver},,`,
  ];
  return new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
}

/* ── Component ──────────────────────────────────────────────────── */

export function SchichtAbschlussBericht() {
  const [genState, setGenState] = useState<GenState>('idle');
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [expanded, setExpanded] = useState(false);

  const generate = useCallback(async () => {
    setGenState('loading');
    setExpanded(true);
    try {
      const res = await fetch('/api/delivery/admin/overview?period=today');
      let data: ShiftReport;
      if (res.ok) {
        const json = await res.json();
        data = {
          date: new Date().toLocaleDateString('de-DE'),
          location: json.location ?? MOCK_REPORT.location,
          totalOrders: json.total_orders ?? MOCK_REPORT.totalOrders,
          totalRevenue: json.total_revenue ?? MOCK_REPORT.totalRevenue,
          cancelledOrders: json.cancelled ?? MOCK_REPORT.cancelledOrders,
          avgDeliveryMin: json.avg_delivery_min ?? MOCK_REPORT.avgDeliveryMin,
          onTimePct: json.on_time_pct ?? MOCK_REPORT.onTimePct,
          activeDrivers: json.active_drivers ?? MOCK_REPORT.activeDrivers,
          totalTips: json.total_tips ?? MOCK_REPORT.totalTips,
          topZone: json.top_zone ?? MOCK_REPORT.topZone,
          topDriver: json.top_driver ?? MOCK_REPORT.topDriver,
          prevWeekOrders: json.prev_week_orders ?? MOCK_REPORT.prevWeekOrders,
          prevWeekRevenue: json.prev_week_revenue ?? MOCK_REPORT.prevWeekRevenue,
          prevWeekOnTimePct: json.prev_week_on_time_pct ?? MOCK_REPORT.prevWeekOnTimePct,
        };
      } else {
        data = MOCK_REPORT;
      }
      setReport(data);
      setGenState('ready');
    } catch {
      setReport(MOCK_REPORT);
      setGenState('ready');
    }
  }, []);

  const downloadCsv = useCallback(() => {
    if (!report) return;
    const blob = generateCsvBlob(report);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schicht-bericht-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [report]);

  const cancelledPct = report ? Math.round((report.cancelledOrders / Math.max(1, report.totalOrders)) * 1000) / 10 : 0;
  const ordersΔ = report ? trendPct(report.totalOrders, report.prevWeekOrders) : 0;
  const revenueΔ = report ? trendPct(report.totalRevenue, report.prevWeekRevenue) : 0;
  const ontimeΔ = report ? trendPct(report.onTimePct, report.prevWeekOnTimePct) : 0;

  return (
    <div className="rounded-xl border border-border overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-indigo-600">
        <FileText className="h-4 w-4 text-white" />
        <span className="text-xs font-black uppercase tracking-wider text-white">
          Schicht-Abschluss-Bericht
        </span>
        {genState === 'idle' && (
          <button
            onClick={generate}
            className="ml-auto rounded-lg bg-white/20 hover:bg-white/30 px-2.5 py-1 text-[11px] font-bold text-white transition-colors"
          >
            Generieren
          </button>
        )}
        {genState === 'loading' && (
          <Loader2 className="ml-auto h-4 w-4 text-white/80 animate-spin" />
        )}
        {genState === 'ready' && (
          <div className="ml-auto flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-300" />
            <button onClick={downloadCsv} className="flex items-center gap-1 rounded-lg bg-white/20 hover:bg-white/30 px-2 py-1 text-[10px] font-bold text-white transition-colors">
              <Download className="h-3 w-3" /> CSV
            </button>
            <button onClick={() => { setGenState('idle'); setReport(null); setExpanded(false); }} className="text-white/60 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Report content */}
      {expanded && report && genState === 'ready' && (
        <div className="bg-white">
          {/* Meta */}
          <div className="px-3 py-2 bg-indigo-50 flex items-center gap-3 text-[11px] text-indigo-700">
            <span className="font-semibold">{report.date}</span>
            <span>·</span>
            <span>{report.location}</span>
          </div>

          {/* KPIs */}
          <div className="px-3 py-2">
            <KpiRow label="Bestellungen" value={String(report.totalOrders)} icon={Package} trend={ordersΔ} />
            <KpiRow label="Umsatz" value={euro(report.totalRevenue)} icon={Euro} trend={revenueΔ} />
            <KpiRow label="Stornoquote" value={`${cancelledPct}%`} icon={AlertTriangle} />
            <KpiRow label="Ø Lieferzeit" value={`${report.avgDeliveryMin.toFixed(1)} Min`} icon={Clock} />
            <KpiRow label="Pünktlichkeit" value={`${report.onTimePct}%`} icon={Target} trend={ontimeΔ} />
            <KpiRow label="Aktive Fahrer" value={String(report.activeDrivers)} icon={Bike} />
            <KpiRow label="Trinkgelder" value={euro(report.totalTips)} icon={TrendingUp} />
          </div>

          {/* Highlights */}
          <div className="px-3 pb-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-matcha-50 border border-matcha-200 p-2.5 text-center">
              <div className="text-[9px] text-muted-foreground uppercase mb-0.5">Top-Zone</div>
              <div className="text-xs font-bold text-matcha-700">{report.topZone}</div>
            </div>
            <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-2.5 text-center">
              <div className="text-[9px] text-muted-foreground uppercase mb-0.5">Top-Fahrer</div>
              <div className="text-xs font-bold text-indigo-700">{report.topDriver}</div>
            </div>
          </div>
        </div>
      )}

      {genState === 'idle' && (
        <div className="px-3 py-3 text-center text-xs text-muted-foreground">
          Schicht-KPIs exportieren und mit Vorwoche vergleichen
        </div>
      )}
    </div>
  );
}
