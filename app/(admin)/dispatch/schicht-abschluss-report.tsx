'use client';

import { useEffect, useState } from 'react';
import {
  BarChart2, ChevronDown, ChevronUp, Clock, Loader2,
  Package, TrendingDown, TrendingUp, Users, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerEntry {
  driverId: string;
  driverName: string | null;
  toursAbgeschlossen: number;
  avgDeliveryMin: number | null;
  punctualityPct: number | null;
}

interface Report {
  date: string;
  umsatzGesamt: number;
  umsatzLiefergebuehren: number;
  bestellungenGesamt: number;
  bestellungenGeliefert: number;
  bestellungenStorniert: number;
  stornoquotePct: number;
  avgLieferzeitMin: number | null;
  slaPct: number | null;
  topZone: string | null;
  topZoneCount: number;
  peakHour: number | null;
  peakHourCount: number;
  fahrer: FahrerEntry[];
  computedAt: string;
}

interface Props {
  locationId: string | null;
}

function fmtEur(val: number) {
  return val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

function fmtHour(h: number | null) {
  if (h === null) return '–';
  return `${String(h).padStart(2, '0')}:00 Uhr`;
}

function SlaColor(pct: number | null) {
  if (pct === null) return 'text-muted-foreground';
  if (pct >= 85) return 'text-matcha-600';
  if (pct >= 70) return 'text-amber-600';
  return 'text-red-600';
}

export function DispatchSchichtAbschlussReport({ locationId }: Props) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = () => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/schicht-abschluss-report?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d) => setReport(d.report ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 transition-colors"
        onClick={() => setOpen((p) => !p)}
      >
        <BarChart2 className="h-4 w-4 text-indigo-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left text-indigo-800">
          Schicht-Abschluss-Report · Heute
        </span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        {!loading && report && (
          <span className="text-[10px] text-indigo-600 font-bold">
            {report.bestellungenGesamt} Bestellungen · {fmtEur(report.umsatzGesamt)}
          </span>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-indigo-400" /> : <ChevronDown className="h-4 w-4 text-indigo-400" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => <div key={i} className="h-10 rounded bg-muted/40 animate-pulse" />)}
            </div>
          ) : !report ? (
            <p className="text-xs text-muted-foreground">Keine Daten verfügbar.</p>
          ) : (
            <>
              {/* KPI Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { icon: Package,     label: 'Bestellungen', value: String(report.bestellungenGesamt), sub: `${report.bestellungenGeliefert} geliefert` },
                  { icon: TrendingUp,  label: 'Umsatz',       value: fmtEur(report.umsatzGesamt),       sub: `${fmtEur(report.umsatzLiefergebuehren)} Liefergebühren` },
                  { icon: Clock,       label: 'Ø Lieferzeit', value: report.avgLieferzeitMin !== null ? `${report.avgLieferzeitMin} Min` : '–', sub: '' },
                  { icon: Zap,         label: 'SLA',          value: report.slaPct !== null ? `${report.slaPct}%` : '–', sub: 'pünktlich', valueClass: SlaColor(report.slaPct) },
                  { icon: TrendingDown,label: 'Stornoquote',  value: `${report.stornoquotePct}%`,        sub: `${report.bestellungenStorniert} Stornos`, valueClass: report.stornoquotePct > 10 ? 'text-red-600' : 'text-matcha-600' },
                  { icon: Users,       label: 'Fahrer heute', value: String(report.fahrer.length),       sub: 'aktiv' },
                ].map(({ icon: Icon, label, value, sub, valueClass }) => (
                  <div key={label} className="bg-muted/30 rounded-lg p-3">
                    <div className="flex items-center gap-1 text-muted-foreground mb-1">
                      <Icon className="h-3 w-3" />
                      <span className="text-[9px] uppercase tracking-wider">{label}</span>
                    </div>
                    <div className={cn('text-lg font-black tabular-nums', valueClass ?? 'text-foreground')}>{value}</div>
                    {sub && <div className="text-[9px] text-muted-foreground">{sub}</div>}
                  </div>
                ))}
              </div>

              {/* Top zone + peak hour */}
              <div className="flex gap-3 flex-wrap text-xs">
                {report.topZone && (
                  <div className="flex-1 min-w-[120px] bg-matcha-50 border border-matcha-200 rounded-lg px-3 py-2">
                    <div className="text-[9px] text-matcha-600 uppercase font-bold mb-0.5">Top-Zone</div>
                    <div className="font-black text-matcha-700">Zone {report.topZone}</div>
                    <div className="text-[10px] text-matcha-600">{report.topZoneCount} Bestellungen</div>
                  </div>
                )}
                {report.peakHour !== null && (
                  <div className="flex-1 min-w-[120px] bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <div className="text-[9px] text-amber-600 uppercase font-bold mb-0.5">Peak-Stunde</div>
                    <div className="font-black text-amber-700">{fmtHour(report.peakHour)}</div>
                    <div className="text-[10px] text-amber-600">{report.peakHourCount} Bestellungen</div>
                  </div>
                )}
              </div>

              {/* Fahrer list */}
              {report.fahrer.length > 0 && (
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Fahrer-Performance</div>
                  <div className="divide-y rounded-lg border overflow-hidden">
                    {report.fahrer.map((f) => (
                      <div key={f.driverId} className="flex items-center gap-3 px-3 py-2 bg-card">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold truncate">{f.driverName ?? 'Unbekannt'}</div>
                          <div className="text-[9px] text-muted-foreground">{f.toursAbgeschlossen} Lieferungen</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-black tabular-nums">
                            {f.avgDeliveryMin !== null ? `${f.avgDeliveryMin} Min` : '–'}
                          </div>
                          <div className={cn('text-[9px] font-bold', SlaColor(f.punctualityPct))}>
                            {f.punctualityPct !== null ? `${f.punctualityPct}% pünktlich` : '–'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-[9px] text-muted-foreground text-right">
                Berechnet: {new Date(report.computedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
