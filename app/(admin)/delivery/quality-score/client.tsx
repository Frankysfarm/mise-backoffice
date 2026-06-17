'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Star, Clock, ShieldCheck, PackageX, BarChart3, RefreshCw,
  TrendingUp, TrendingDown, Minus, ChevronDown,
} from 'lucide-react';
import type { QualityDashboard, QualityTrendRow } from '@/lib/delivery/quality-score';

interface Props {
  locationId: string;
  initial:    QualityDashboard | null;
}

// ── Score Gauge (SVG Arc) ─────────────────────────────────────────────────────

function ScoreGauge({ score, grade }: { score: number; grade: string }) {
  const radius  = 60;
  const stroke  = 12;
  const cx      = 80;
  const cy      = 80;
  const circumference = Math.PI * radius; // half-circle
  const arc = circumference * (score / 100);

  const gradeColor =
    grade === 'A' ? '#22c55e'
    : grade === 'B' ? '#84cc16'
    : grade === 'C' ? '#eab308'
    : grade === 'D' ? '#f97316'
    : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="160" height="100" viewBox="0 0 160 100">
        {/* Background arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* Score arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke={gradeColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${circumference}`}
        />
        {/* Score text */}
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize="28" fontWeight="700" fill={gradeColor}>
          {Math.round(score)}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="11" fill="#6b7280">
          von 100
        </text>
      </svg>
      <span
        className="text-2xl font-bold px-3 py-1 rounded-lg"
        style={{ backgroundColor: gradeColor + '22', color: gradeColor }}
      >
        Note {grade}
      </span>
    </div>
  );
}

// ── Dimension Bar ─────────────────────────────────────────────────────────────

function DimBar({
  label, score, icon: Icon, weight,
}: {
  label: string;
  score: number;
  icon: React.ElementType;
  weight: string;
}) {
  const color = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
        <Icon size={14} className="text-gray-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between text-xs mb-1">
          <span className="font-medium text-gray-700">{label}</span>
          <span className="text-gray-500">{weight} · <strong>{Math.round(score)}/100</strong></span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
        </div>
      </div>
    </div>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ rows }: { rows: QualityTrendRow[] }) {
  if (rows.length < 2) return <p className="text-xs text-gray-400 text-center py-4">Nicht genug Daten</p>;

  const pts = [...rows].reverse(); // ascending date
  const max = Math.max(...pts.map((r) => r.overallScore), 1);
  const min = Math.min(...pts.map((r) => r.overallScore));
  const W = 400;
  const H = 80;
  const pad = 8;

  const x = (i: number) => pad + (i / (pts.length - 1)) * (W - 2 * pad);
  const y = (v: number) => H - pad - ((v - min) / (Math.max(max - min, 1))) * (H - 2 * pad);

  const path = pts.map((r, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(r.overallScore)}`).join(' ');
  const area = `${path} L ${x(pts.length - 1)} ${H} L ${x(0)} ${H} Z`;

  const gradeColors: Record<string, string> = { A: '#22c55e', B: '#84cc16', C: '#eab308', D: '#f97316', F: '#ef4444' };

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20">
        <defs>
          <linearGradient id="qs-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#qs-grad)" />
        <path d={path} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((r, i) => (
          <circle key={i} cx={x(i)} cy={y(r.overallScore)} r="3" fill={gradeColors[r.grade] ?? '#6b7280'} />
        ))}
      </svg>
      <div className="flex justify-between text-xs text-gray-400 px-1 -mt-1">
        <span>{pts[0]?.scoreDate?.slice(5)}</span>
        <span>{pts[pts.length - 1]?.scoreDate?.slice(5)}</span>
      </div>
    </div>
  );
}

// ── Trend Icon ────────────────────────────────────────────────────────────────

function Trend({ today, yesterday }: { today: number | null; yesterday: number | null }) {
  if (today == null || yesterday == null) return null;
  const diff = today - yesterday;
  if (Math.abs(diff) < 0.5) return <Minus size={14} className="text-gray-400" />;
  if (diff > 0) return <TrendingUp size={14} className="text-green-500" />;
  return <TrendingDown size={14} className="text-red-500" />;
}

// ── Main Client ───────────────────────────────────────────────────────────────

export function QualityScoreClient({ locationId, initial }: Props) {
  const [data, setData]       = useState<QualityDashboard | null>(initial);
  const [loading, setLoading] = useState(false);
  const [tab, setTab]         = useState<'overview' | 'trend' | 'tips'>('overview');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/quality-score?action=dashboard&location_id=${locationId}`);
      const json = await res.json() as { ok: boolean; dashboard: QualityDashboard };
      if (json.ok) setData(json.dashboard);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  const handleSnapshot = async () => {
    setLoading(true);
    try {
      await fetch('/api/delivery/admin/quality-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'snapshot', location_id: locationId }),
      });
      await load();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const today     = data?.today;
  const yesterday = data?.yesterday;

  return (
    <>
      <PageHeader
        title="Qualitäts-Score"
        description="Täglicher Composite-Score (0–100) aus Pünktlichkeit, Zufriedenheit, Genauigkeit, SLA und Stornierungen."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </Button>
            <Button size="sm" onClick={handleSnapshot} disabled={loading}>
              Score neu berechnen
            </Button>
          </div>
        }
      />

      {/* KPI Band */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Heute" value={today ? `${Math.round(today.overallScore)}/100` : '–'} sub={today?.grade ? `Note ${today.grade}` : '–'} color="indigo" />
        <KpiCard label="Gestern" value={yesterday ? `${Math.round(yesterday.overallScore)}/100` : '–'} sub={yesterday?.grade ? `Note ${yesterday.grade}` : '–'} color="violet" />
        <KpiCard label="7-Tage-Ø" value={data ? `${Math.round(data.weeklyAvg)}/100` : '–'} sub="Wochenschnitt" color="blue" />
        <KpiCard label="Schwächste Dimension" value={today?.weakestDimension ?? yesterday?.weakestDimension ?? '–'} sub="Verbesserungspotenzial" color="amber" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {(['overview', 'trend', 'tips'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              tab === t ? 'bg-white shadow text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'overview' ? 'Übersicht' : t === 'trend' ? '30-Tage-Trend' : 'Empfehlungen'}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {today ? (
            <Card className="p-6">
              <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <span>Heute</span>
                <Trend today={today.overallScore} yesterday={yesterday?.overallScore ?? null} />
              </h3>
              <div className="flex flex-col items-center mb-6">
                <ScoreGauge score={today.overallScore} grade={today.grade} />
              </div>
              <div className="space-y-3">
                <DimBar label="Pünktlichkeit"       score={today.components.scoreOntime}       icon={Clock}       weight="30%" />
                <DimBar label="Kundenzufriedenheit" score={today.components.scoreSatisfaction} icon={Star}        weight="25%" />
                <DimBar label="Bestellgenauigkeit"  score={today.components.scoreAccuracy}     icon={PackageX}    weight="20%" />
                <DimBar label="SLA-Einhaltung"      score={today.components.scoreSla}          icon={ShieldCheck} weight="15%" />
                <DimBar label="Stornierungsrate"    score={today.components.scoreCancel}       icon={BarChart3}   weight="10%" />
              </div>
            </Card>
          ) : (
            <Card className="p-6 flex flex-col items-center justify-center gap-3 text-gray-400">
              <BarChart3 size={32} />
              <p className="text-sm">Noch kein Score für heute.</p>
              <Button size="sm" onClick={handleSnapshot}>Jetzt berechnen</Button>
            </Card>
          )}

          {yesterday ? (
            <Card className="p-6">
              <h3 className="font-semibold text-gray-700 mb-4">Gestern</h3>
              <div className="flex flex-col items-center mb-6">
                <ScoreGauge score={yesterday.overallScore} grade={yesterday.grade} />
              </div>
              <div className="space-y-3">
                <DimBar label="Pünktlichkeit"       score={yesterday.components.scoreOntime}       icon={Clock}       weight="30%" />
                <DimBar label="Kundenzufriedenheit" score={yesterday.components.scoreSatisfaction} icon={Star}        weight="25%" />
                <DimBar label="Bestellgenauigkeit"  score={yesterday.components.scoreAccuracy}     icon={PackageX}    weight="20%" />
                <DimBar label="SLA-Einhaltung"      score={yesterday.components.scoreSla}          icon={ShieldCheck} weight="15%" />
                <DimBar label="Stornierungsrate"    score={yesterday.components.scoreCancel}       icon={BarChart3}   weight="10%" />
              </div>
            </Card>
          ) : (
            <Card className="p-6 flex items-center justify-center text-gray-400 text-sm">
              Kein Score für gestern.
            </Card>
          )}

          {/* Raw Metrics */}
          {today && (
            <Card className="p-4 lg:col-span-2">
              <h3 className="font-semibold text-gray-700 mb-3 text-sm">Rohdaten (heute)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricChip label="Gesamtbestellungen" value={today.totalOrders} />
                <MetricChip label="Pünktlich geliefert" value={today.ontimeOrders} />
                <MetricChip label="Ø Bewertung" value={today.avgRating != null ? `${today.avgRating} ★` : '–'} />
                <MetricChip label="Stornierungsrate" value={today.cancelRatePct != null ? `${today.cancelRatePct.toFixed(1)} %` : '–'} />
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Trend Tab */}
      {tab === 'trend' && (
        <Card className="p-6">
          <h3 className="font-semibold text-gray-700 mb-4">Score-Verlauf (30 Tage)</h3>
          {data && data.trend.length > 0 ? (
            <>
              <Sparkline rows={data.trend} />
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1 text-gray-500 font-medium">Datum</th>
                      <th className="text-right py-1 text-gray-500 font-medium">Score</th>
                      <th className="text-right py-1 text-gray-500 font-medium">Note</th>
                      <th className="text-right py-1 text-gray-500 font-medium hidden sm:table-cell">Pünktlich</th>
                      <th className="text-right py-1 text-gray-500 font-medium hidden sm:table-cell">Zufrieden.</th>
                      <th className="text-right py-1 text-gray-500 font-medium hidden sm:table-cell">Bestellungen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.trend.map((r) => (
                      <tr key={r.scoreDate} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-1.5 text-gray-600">{r.scoreDate}</td>
                        <td className="py-1.5 text-right font-semibold">{Math.round(r.overallScore)}</td>
                        <td className="py-1.5 text-right">
                          <GradeBadge grade={r.grade} />
                        </td>
                        <td className="py-1.5 text-right hidden sm:table-cell">{Math.round(r.scoreOntime)}</td>
                        <td className="py-1.5 text-right hidden sm:table-cell">{Math.round(r.scoreSatisfaction)}</td>
                        <td className="py-1.5 text-right hidden sm:table-cell">{r.totalOrders}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">Noch keine Verlaufsdaten vorhanden.</p>
          )}
        </Card>
      )}

      {/* Tips Tab */}
      {tab === 'tips' && (
        <div className="space-y-4">
          {data?.improvement && (
            <Card className="p-5 border-l-4 border-amber-400 bg-amber-50">
              <p className="text-sm font-semibold text-amber-800 mb-1">Top-Empfehlung</p>
              <p className="text-sm text-amber-700">{data.improvement}</p>
            </Card>
          )}
          <Card className="p-5">
            <h3 className="font-semibold text-gray-700 mb-4">Verbesserungs-Leitfaden</h3>
            <div className="space-y-3">
              {TIPS.map((tip) => (
                <div key={tip.dim} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-indigo-100">
                    <tip.Icon size={13} className="text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{tip.dim}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{tip.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

// ── Helper Components ─────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) {
  const ring: Record<string, string> = {
    indigo: 'border-indigo-200 bg-indigo-50',
    violet: 'border-violet-200 bg-violet-50',
    blue:   'border-blue-200 bg-blue-50',
    amber:  'border-amber-200 bg-amber-50',
  };
  return (
    <div className={`rounded-xl border p-4 ${ring[color] ?? ''}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900 truncate">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-base font-semibold text-gray-800 mt-0.5">{value}</p>
    </div>
  );
}

function GradeBadge({ grade }: { grade: string }) {
  const colors: Record<string, string> = {
    A: 'bg-green-100 text-green-700',
    B: 'bg-lime-100 text-lime-700',
    C: 'bg-yellow-100 text-yellow-700',
    D: 'bg-orange-100 text-orange-700',
    F: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${colors[grade] ?? 'bg-gray-100 text-gray-600'}`}>
      {grade}
    </span>
  );
}

const TIPS = [
  { dim: 'Pünktlichkeit',       Icon: Clock,       text: 'Fahrerkapazität zu Stoßzeiten erhöhen. Küchen-Timing optimieren (Kitchen-Prep-Learning nutzen).' },
  { dim: 'Kundenzufriedenheit', Icon: Star,        text: 'Fahrer-Schulungen für Kundeninteraktion. Trinkgeld-Anreize aktivieren. Bewertungslink prompter versenden.' },
  { dim: 'Bestellgenauigkeit',  Icon: PackageX,    text: 'Stornierungsgründe analysieren. Küchenfehler im Feedback-Sentiment prüfen.' },
  { dim: 'SLA-Einhaltung',      Icon: ShieldCheck, text: 'SLA-Eskalationsschwellen anpassen. Kapazitätslücken im Capacity Planner schließen.' },
  { dim: 'Stornierungsrate',    Icon: BarChart3,   text: 'Fehlerquellen (Küche, Fahrer, Logistik) trennen. Vorauszahlungsquote erhöhen.' },
];
