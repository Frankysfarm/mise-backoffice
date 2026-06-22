'use client';

/**
 * Phase 424 – ManagementReportPanel
 * Wöchentliche KPI-Zusammenfassung für Lieferdienst-Admins.
 * Umsatz, Lieferungen, Pünktlichkeit, Stornorate, Ø Lieferzeit,
 * Top-Fahrer, Zonen-Gewinner/Verlierer, Vorwochenvergleich, PDF-Druck.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  ChevronDown, ChevronUp, RefreshCw,
  Trophy, TrendingUp, TrendingDown, Minus,
  Euro, Bike, Clock, Target, AlertTriangle,
  Printer, CheckCircle2, XCircle, MapPin,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

// ── Typen ──────────────────────────────────────────────────────────────────────

interface ManagementReport {
  id:                   string;
  locationId:           string;
  wocheVon:             string;
  wocheBis:             string;
  umsatzEur:            number;
  lieferungen:          number;
  puenktlichkeitPct:    number;
  topFahrerId:          string | null;
  topFahrerName:        string | null;
  topZone:              string | null;
  schlechtesteZone:     string | null;
  cancellationRate:     number;
  avgDeliveryMin:       number | null;
  vergleichVorwochePct: number | null;
  generiertAm:          string;
}

// ── Formatierung ──────────────────────────────────────────────────────────────

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function fmtTs(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function fmtPct(v: number, decimals = 1) {
  return v.toFixed(decimals) + ' %';
}

// ── Trend-Pfeil ───────────────────────────────────────────────────────────────

function TrendPfeil({
  pct, positiveIsGood = true,
}: {
  pct: number | null;
  positiveIsGood?: boolean;
}) {
  if (pct === null) return <Minus className="w-4 h-4 text-stone-400" />;
  const isPositive = pct > 0;
  const isGood     = positiveIsGood ? isPositive : !isPositive;
  if (pct === 0) return <Minus className="w-4 h-4 text-stone-400" />;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-semibold ${isGood ? 'text-matcha-600' : 'text-red-600'}`}>
      {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
      {Math.abs(pct).toFixed(1)} %
    </span>
  );
}

// ── KPI-Kachel ────────────────────────────────────────────────────────────────

function KpiTile({
  label, value, sub, icon: Icon, trend, trendPositiveGood = true,
}: {
  label:              string;
  value:              string;
  sub?:               string;
  icon:               React.ElementType;
  trend?:             number | null;
  trendPositiveGood?: boolean;
}) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-stone-500 text-xs">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className="text-2xl font-bold text-stone-900 leading-tight">{value}</div>
      <div className="flex items-center justify-between">
        {sub  && <span className="text-xs text-stone-400">{sub}</span>}
        {trend !== undefined && (
          <TrendPfeil pct={trend ?? null} positiveIsGood={trendPositiveGood} />
        )}
      </div>
    </div>
  );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────

interface Props {
  locationId: string | null;
}

export function ManagementReportPanel({ locationId }: Props) {
  const [open,       setOpen]       = useState(false);
  const [reports,    setReports]    = useState<ManagementReport[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [computing,  setComputing]  = useState(false);
  const [lastFetch,  setLastFetch]  = useState<string | null>(null);
  const [activeIdx,  setActiveIdx]  = useState(0);   // which week is shown

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res  = await fetch(`/api/delivery/admin/management-report?location_id=${locationId}`);
      const data = await res.json() as ManagementReport[] | null;
      if (Array.isArray(data)) { setReports(data); setActiveIdx(0); }
    } finally {
      setLoading(false);
      setLastFetch(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
    }
  }, [locationId]);

  useEffect(() => { if (open && locationId) load(); }, [open, locationId, load]);

  const compute = async () => {
    if (!locationId) return;
    setComputing(true);
    try {
      await fetch('/api/delivery/admin/management-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'compute', location_id: locationId }),
      });
      await load();
    } finally {
      setComputing(false);
    }
  };

  const printReport = () => window.print();

  const report = reports[activeIdx] ?? null;

  // Chart-Daten: letzte 4 Wochen Umsatz-Bars
  const chartData = [...reports].reverse().map(r => ({
    label: fmtDate(r.wocheVon).slice(0, 5),
    umsatz: Math.round(r.umsatzEur),
    isCurrent: r.id === reports[0]?.id,
  }));

  return (
    <section className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          <span className="font-semibold text-stone-800">Management-Wochenbericht</span>
          {reports.length > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              KW {getKW(reports[0]?.wocheVon ?? '')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-stone-400 text-xs">
          {lastFetch && <span>Stand {lastFetch}</span>}
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-stone-100 space-y-5 pt-4">
          {/* Lade-Zustand */}
          {loading && (
            <div className="text-center text-stone-400 text-sm py-8">Lade Wochenberichte…</div>
          )}

          {/* Leer-Zustand */}
          {!loading && reports.length === 0 && (
            <div className="text-center py-8 space-y-3">
              <p className="text-stone-500 text-sm">Noch kein Wochenbericht vorhanden.</p>
              <button
                onClick={compute}
                disabled={computing}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
              >
                {computing ? 'Berechne…' : 'Jetzt Bericht erstellen'}
              </button>
            </div>
          )}

          {/* Haupt-Inhalt */}
          {!loading && report && (
            <>
              {/* Woche Tabs */}
              {reports.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {reports.map((r, i) => (
                    <button
                      key={r.id}
                      onClick={() => setActiveIdx(i)}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        i === activeIdx
                          ? 'bg-amber-500 border-amber-500 text-white font-semibold'
                          : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      {fmtDate(r.wocheVon).slice(0, 5)} – {fmtDate(r.wocheBis).slice(0, 5)}
                    </button>
                  ))}
                </div>
              )}

              {/* Woche Label */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-stone-500">
                  KW {getKW(report.wocheVon)} &nbsp;·&nbsp;
                  {fmtDate(report.wocheVon)} – {fmtDate(report.wocheBis)}
                </div>
                <div className="text-xs text-stone-400">Stand: {fmtTs(report.generiertAm)}</div>
              </div>

              {/* KPI-Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <KpiTile
                  label="Umsatz"
                  value={fmtEur(report.umsatzEur)}
                  icon={Euro}
                  trend={report.vergleichVorwochePct}
                  trendPositiveGood
                />
                <KpiTile
                  label="Lieferungen"
                  value={report.lieferungen.toLocaleString('de-DE')}
                  icon={Bike}
                  trend={null}
                />
                <KpiTile
                  label="Pünktlichkeit"
                  value={fmtPct(report.puenktlichkeitPct)}
                  sub={report.puenktlichkeitPct >= 85 ? 'Ziel erreicht' : 'Unter Ziel (85 %)'}
                  icon={Target}
                  trendPositiveGood
                />
                <KpiTile
                  label="Stornorate"
                  value={fmtPct(report.cancellationRate * 100)}
                  sub={report.cancellationRate < 0.05 ? 'Gut' : 'Optimierungsbedarf'}
                  icon={XCircle}
                  trendPositiveGood={false}
                />
                {report.avgDeliveryMin !== null && (
                  <KpiTile
                    label="Ø Lieferzeit"
                    value={`${Math.round(report.avgDeliveryMin)} Min`}
                    sub="Ziel: ≤ 35 Min"
                    icon={Clock}
                    trendPositiveGood={false}
                  />
                )}
                {report.vergleichVorwochePct !== null && (
                  <div className="bg-white border border-stone-200 rounded-xl p-4 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-stone-500 text-xs">
                      <TrendingUp className="w-3.5 h-3.5" />
                      vs. Vorwoche
                    </div>
                    <TrendPfeil pct={report.vergleichVorwochePct} positiveIsGood />
                    <span className="text-xs text-stone-400">Umsatz-Vergleich</span>
                  </div>
                )}
              </div>

              {/* Top-Fahrer + Zonen */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Top-Fahrer Badge */}
                {report.topFahrerName && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center text-white font-bold text-lg">
                      {report.topFahrerName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs text-amber-600 font-medium uppercase tracking-wide">
                        Top-Fahrer der Woche
                      </div>
                      <div className="text-stone-800 font-semibold">{report.topFahrerName}</div>
                      <div className="text-xs text-stone-400">Höchster Ø-Score</div>
                    </div>
                    <Trophy className="w-5 h-5 text-amber-400 ml-auto" />
                  </div>
                )}

                {/* Zonen-Übersicht */}
                {(report.topZone || report.schlechtesteZone) && (
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-2">
                    <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> Zonen
                    </div>
                    {report.topZone && (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-matcha-500" />
                        <span className="text-sm text-stone-700">
                          <span className="font-semibold">Top-Zone:</span> Zone {report.topZone}
                          <span className="text-stone-400 text-xs ml-1">(meiste Bestellungen)</span>
                        </span>
                      </div>
                    )}
                    {report.schlechtesteZone && (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        <span className="text-sm text-stone-700">
                          <span className="font-semibold">Optimierungsbedarf:</span> Zone {report.schlechtesteZone}
                          <span className="text-stone-400 text-xs ml-1">(schlechteste Pünktlichkeit)</span>
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Umsatz-Verlauf Chart */}
              {chartData.length > 1 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
                    Umsatz-Verlauf letzte Wochen
                  </div>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#a8a29e' }} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip
                          formatter={(v: number) => [fmtEur(v), 'Umsatz']}
                          contentStyle={{ fontSize: 12, border: '1px solid #e7e5e4', borderRadius: 8 }}
                        />
                        <Bar dataKey="umsatz" radius={[4, 4, 0, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell
                              key={index}
                              fill={entry.isCurrent ? '#f59e0b' : '#d6d3d1'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                <div className="flex gap-2">
                  <button
                    onClick={load}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                    Aktualisieren
                  </button>
                  <button
                    onClick={compute}
                    disabled={computing}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-50 disabled:opacity-50 transition-colors"
                  >
                    {computing ? 'Berechne…' : 'Neu berechnen'}
                  </button>
                </div>
                <button
                  onClick={printReport}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
                  title="Bericht drucken / als PDF speichern"
                >
                  <Printer className="w-3 h-3" />
                  PDF / Drucken
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

// ── Hilfsfunktion: Kalenderwoche ──────────────────────────────────────────────

function getKW(isoDate: string): number {
  if (!isoDate) return 0;
  const d   = new Date(isoDate + 'T12:00:00Z');
  const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const dayNr = Math.floor((d.getTime() - jan1.getTime()) / 86_400_000);
  return Math.ceil((dayNr + jan1.getUTCDay() + 1) / 7);
}
