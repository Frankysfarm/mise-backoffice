'use client';

/**
 * SchichtExport — Phase 476
 * Schicht-Abschluss-Bericht-Generator mit CSV-Download und Live-Vorschau.
 */

import { useState } from 'react';
import { Download, FileText, ChevronDown, ChevronUp, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Summary {
  total_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  total_revenue_eur: number;
  avg_delivery_min: number | null;
  punctuality_pct: number | null;
  active_drivers: number;
  cancellation_rate_pct: number | null;
}

interface DriverKpi {
  driver_name: string;
  deliveries: number;
  avg_delivery_min: number | null;
  on_time_pct: number | null;
  total_tips_eur: number;
}

interface Report {
  date: string;
  generated_at: string;
  summary: Summary;
  drivers: DriverKpi[];
}

interface Props {
  locationId: string | null;
}

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function TrendIcon({ value, thresholdGood, thresholdBad, invert = false }: {
  value: number | null;
  thresholdGood: number;
  thresholdBad: number;
  invert?: boolean;
}) {
  if (value === null) return <Minus className="h-3 w-3 text-gray-400" />;
  const isGood = invert ? value <= thresholdGood : value >= thresholdGood;
  const isBad  = invert ? value >= thresholdBad  : value <= thresholdBad;
  if (isGood) return <TrendingUp className="h-3 w-3 text-matcha-600" />;
  if (isBad)  return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-amber-500" />;
}

export function SchichtExport({ locationId }: Props) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const buildUrl = (fmt: string) => {
    const base = `/api/delivery/admin/schicht-export?format=${fmt}&date=${date}`;
    return locationId ? `${base}&location_id=${encodeURIComponent(locationId)}` : base;
  };

  const loadPreview = async () => {
    setLoading(true);
    setReport(null);
    try {
      const r = await fetch(buildUrl('json'));
      if (r.ok) setReport(await r.json());
    } catch {
      // ignore
    }
    setLoading(false);
  };

  const downloadCsv = async () => {
    setDownloading(true);
    try {
      const r = await fetch(buildUrl('csv'));
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `schicht-bericht-${date}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
    setDownloading(false);
  };

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Schicht-Bericht-Export</span>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-500">
            CSV · JSON
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-5 py-4 space-y-4">
          {/* Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Datum:</label>
              <input
                type="date"
                value={date}
                onChange={(e) => { setDate(e.target.value); setReport(null); }}
                className="rounded-lg border border-stone-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-400"
              />
            </div>
            <button
              onClick={loadPreview}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl bg-matcha-100 border border-matcha-200 px-3 py-1.5 text-xs font-bold text-matcha-700 hover:bg-matcha-200 disabled:opacity-60 transition"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
              {loading ? 'Lade…' : 'Vorschau laden'}
            </button>
            <button
              onClick={downloadCsv}
              disabled={downloading}
              className="flex items-center gap-1.5 rounded-xl bg-matcha-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-matcha-700 disabled:opacity-60 transition"
            >
              {downloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
              {downloading ? 'Erstelle…' : 'CSV herunterladen'}
            </button>
          </div>

          {/* Preview */}
          {report && (
            <div className="space-y-4">
              {/* Summary KPIs */}
              <div>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Zusammenfassung — {report.date}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { label: 'Bestellungen', value: report.summary.total_orders.toString(), sub: `${report.summary.completed_orders} abgeschlossen` },
                    { label: 'Umsatz', value: fmtEur(report.summary.total_revenue_eur), sub: `${report.summary.active_drivers} Fahrer aktiv` },
                    { label: 'Ø Lieferzeit', value: report.summary.avg_delivery_min ? `${report.summary.avg_delivery_min} Min` : '—', sub: 'Ziel: ≤ 35 Min' },
                    { label: 'Pünktlichkeit', value: report.summary.punctuality_pct ? `${report.summary.punctuality_pct}%` : '—', sub: `Storno: ${report.summary.cancellation_rate_pct ?? 0}%` },
                  ].map((kpi) => (
                    <div key={kpi.label} className="rounded-xl bg-stone-50 p-3">
                      <div className="text-base font-black tabular-nums text-foreground">{kpi.value}</div>
                      <div className="text-[10px] font-semibold text-stone-500">{kpi.label}</div>
                      <div className="text-[9px] text-stone-400 mt-0.5">{kpi.sub}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Driver table */}
              {report.drivers.length > 0 && (
                <div>
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fahrer-KPIs</div>
                  <div className="rounded-xl border border-stone-100 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-stone-50">
                        <tr>
                          {['Fahrer', 'Lieferungen', 'Ø Lieferzeit', 'Pünktlichkeit', 'Trinkgeld'].map((h) => (
                            <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {report.drivers.map((d, i) => (
                          <tr key={d.driver_name} className={cn('border-t border-stone-50', i % 2 === 0 ? 'bg-white' : 'bg-stone-50/50')}>
                            <td className="px-3 py-2 font-medium">{d.driver_name}</td>
                            <td className="px-3 py-2 tabular-nums font-bold">{d.deliveries}</td>
                            <td className="px-3 py-2 tabular-nums">
                              <span className="flex items-center gap-1">
                                <TrendIcon value={d.avg_delivery_min} thresholdGood={35} thresholdBad={45} invert />
                                {d.avg_delivery_min ? `${d.avg_delivery_min} Min` : '—'}
                              </span>
                            </td>
                            <td className="px-3 py-2 tabular-nums">
                              <span className="flex items-center gap-1">
                                <TrendIcon value={d.on_time_pct} thresholdGood={85} thresholdBad={70} />
                                {d.on_time_pct ? `${d.on_time_pct}%` : '—'}
                              </span>
                            </td>
                            <td className="px-3 py-2 tabular-nums text-matcha-700 font-bold">
                              {fmtEur(d.total_tips_eur)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="text-[10px] text-muted-foreground">
                Generiert: {new Date(report.generated_at).toLocaleString('de-DE')}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
