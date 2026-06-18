'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  MessageSquarePlus, RefreshCw, Star, AlertTriangle,
  Users, TrendingDown, ThumbsUp, ThumbsDown, Smile,
  Frown, Meh, ChevronDown, ChevronRight,
} from 'lucide-react';
import type {
  FeedbackDashboard, DriverFeedbackReport, DriverFeedbackRow,
  IssueFrequency,
} from '@/lib/delivery/driver-feedback';

interface Props {
  locationId: string;
  initial: FeedbackDashboard | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, dec = 1): string {
  if (n == null) return '—';
  return n.toFixed(dec);
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function ratingColor(r: number | null): string {
  if (r == null) return 'text-muted-foreground';
  if (r >= 4.5) return 'text-green-600';
  if (r >= 3.5) return 'text-lime-600';
  if (r >= 2.5) return 'text-amber-500';
  return 'text-red-500';
}

function RatingStars({ rating }: { rating: number | null }) {
  if (rating == null) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-3.5 w-3.5 ${s <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`}
        />
      ))}
    </span>
  );
}

function MoodBadge({ mood }: { mood: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    great:       { label: 'Super',       cls: 'bg-green-100 text-green-700' },
    good:        { label: 'Gut',         cls: 'bg-lime-100 text-lime-700' },
    neutral:     { label: 'Neutral',     cls: 'bg-slate-100 text-slate-600' },
    tired:       { label: 'Müde',        cls: 'bg-amber-100 text-amber-700' },
    frustrated:  { label: 'Frustriert',  cls: 'bg-red-100 text-red-700' },
  };
  const m = map[mood] ?? { label: mood, cls: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${m.cls}`}>{m.label}</span>
  );
}

const ISSUE_LABELS: Record<string, string> = {
  navigation:  'Navigation',
  customer:    'Kunde',
  app:         'App',
  vehicle:     'Fahrzeug',
  timing:      'Timing',
  route:       'Route',
  support:     'Support',
  other:       'Sonstiges',
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, label, value, sub, accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <Card className={`p-4 ${accent ? 'border-matcha-400 bg-matcha-50/40' : ''}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
        <Icon className="h-3.5 w-3.5 text-matcha-700" />
        {label}
      </div>
      <div className={`text-2xl font-extrabold ${accent ? 'text-matcha-700' : ''}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}

// ── Issue Frequency Bar ───────────────────────────────────────────────────────

function IssueBar({ issues }: { issues: IssueFrequency[] }) {
  if (issues.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine Issues gemeldet.</p>;
  }
  const max = Math.max(...issues.map((i) => i.occurrenceCount), 1);
  return (
    <div className="space-y-2">
      {issues.map((iss) => (
        <div key={iss.issueType} className="flex items-center gap-2">
          <span className="w-24 text-xs text-right text-muted-foreground shrink-0">
            {ISSUE_LABELS[iss.issueType] ?? iss.issueType}
          </span>
          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-red-400 rounded-full"
              style={{ width: `${(iss.occurrenceCount / max) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-slate-700 w-6 text-right">
            {iss.occurrenceCount}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Driver Row ─────────────────────────────────────────────────────────────────

function DriverRow({ row, onSelect }: { row: DriverFeedbackRow; onSelect: () => void }) {
  const negativeRatio = row.totalReports > 0
    ? (row.negativeCount / row.totalReports) * 100
    : 0;
  const alert = negativeRatio > 30 || row.badMoodCount > row.totalReports * 0.4;
  return (
    <tr
      className={`cursor-pointer hover:bg-slate-50 transition-colors ${alert ? 'bg-red-50/40' : ''}`}
      onClick={onSelect}
    >
      <td className="px-3 py-2 text-sm font-medium">
        {alert && <AlertTriangle className="h-3.5 w-3.5 text-red-500 inline mr-1" />}
        {row.driverName ?? row.driverId.slice(0, 8)}
      </td>
      <td className="px-3 py-2 text-center">
        <RatingStars rating={row.avgRating} />
        <div className={`text-xs font-bold ${ratingColor(row.avgRating)}`}>
          {fmt(row.avgRating)}
        </div>
      </td>
      <td className="px-3 py-2 text-center text-sm">{row.totalReports}</td>
      <td className="px-3 py-2 text-center">
        <span className="text-green-600 font-semibold text-xs">{row.positiveCount}↑</span>
        {' / '}
        <span className="text-red-500 font-semibold text-xs">{row.negativeCount}↓</span>
      </td>
      <td className="px-3 py-2 text-center text-xs">{row.reportsWithIssues}</td>
      <td className="px-3 py-2 text-center text-xs text-muted-foreground">
        {row.lastFeedbackAt ? fmtTime(row.lastFeedbackAt) : '—'}
      </td>
    </tr>
  );
}

// ── Recent Feedback Card ───────────────────────────────────────────────────────

function FeedbackCard({ r }: { r: DriverFeedbackReport }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`border rounded-lg overflow-hidden cursor-pointer ${r.rating <= 2 ? 'border-red-200' : r.rating >= 4 ? 'border-green-200' : 'border-slate-200'}`}
      onClick={() => setOpen((o) => !o)}
    >
      <div className="flex items-center gap-3 px-3 py-2">
        <RatingStars rating={r.rating} />
        <MoodBadge mood={r.mood} />
        <span className="text-xs text-muted-foreground ml-auto">{fmtTime(r.submittedAt)}</span>
        {r.issueTypes.length > 0 && (
          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">
            {r.issueTypes.length} Issue{r.issueTypes.length > 1 ? 's' : ''}
          </span>
        )}
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </div>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t bg-slate-50/60 text-xs space-y-1">
          {r.issueTypes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {r.issueTypes.map((it) => (
                <span key={it} className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">
                  {ISSUE_LABELS[it] ?? it}
                </span>
              ))}
            </div>
          )}
          {r.note && <p className="text-slate-700 italic">&ldquo;{r.note}&rdquo;</p>}
          <p className="text-muted-foreground">
            {r.toursToday} Touren heute · Fahrer: {r.driverId.slice(0, 8)}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function DriverFeedbackClient({ locationId, initial }: Props) {
  const [data, setData] = useState<FeedbackDashboard | null>(initial);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'drivers' | 'recent'>('overview');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/driver-feedback?action=dashboard&location_id=${locationId}`,
      );
      const json = await res.json() as { ok: boolean; dashboard: FeedbackDashboard };
      if (json.ok) setData(json.dashboard);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  const ov = data?.overview ?? null;
  const positivePct = ov && ov.totalReports7d > 0
    ? Math.round((ov.positive7d / ov.totalReports7d) * 100)
    : null;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <PageHeader
        title="Fahrer-Feedback Loop"
        subtitle="Stimmung, Issues und Verbesserungs-Signale aus Fahrer-Feedback"
        icon={<MessageSquarePlus className="h-5 w-5 text-matcha-700" />}
        actions={
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-6">
        {/* KPI-Band */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={Star}
            label="Ø Rating (7 Tage)"
            value={fmt(ov?.avgRating7d)}
            sub="Skala 1–5"
            accent
          />
          <KpiCard
            icon={Users}
            label="Feedback-Berichte (7 Tage)"
            value={ov?.totalReports7d.toString() ?? '—'}
            sub={`${ov?.driversWithFeedback ?? '—'} Fahrer`}
          />
          <KpiCard
            icon={ThumbsUp}
            label="Positiv-Rate"
            value={positivePct != null ? `${positivePct}%` : '—'}
            sub={`${ov?.positive7d ?? 0} positive Berichte`}
          />
          <KpiCard
            icon={TrendingDown}
            label="Schlechte Stimmung"
            value={ov?.badMood7d.toString() ?? '—'}
            sub="Müde / Frustriert (7 Tage)"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b">
          {(['overview', 'drivers', 'recent'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-matcha-600 text-matcha-700'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'overview' ? 'Übersicht' : tab === 'drivers' ? 'Fahrer' : 'Letzte Berichte'}
            </button>
          ))}
        </div>

        {/* Tab: Übersicht */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Issue Frequency */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h3 className="font-semibold text-sm">Häufigste Probleme (letzte 14 Tage)</h3>
              </div>
              <IssueBar issues={data?.issueFrequency ?? []} />
            </Card>

            {/* Mood Distribution */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Smile className="h-4 w-4 text-blue-500" />
                <h3 className="font-semibold text-sm">Stimmungs-Verteilung (7 Tage)</h3>
              </div>
              {ov && ov.totalReports7d > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Smile className="h-4 w-4 text-green-500 shrink-0" />
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium">Gut / Super</span>
                        <span>{Math.round(((ov.totalReports7d - ov.badMood7d - (ov.totalReports7d - ov.positive7d - ov.negative7d - (ov.badMood7d))) / ov.totalReports7d) * 100)}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-400 rounded-full"
                          style={{ width: `${Math.round(((ov.totalReports7d - ov.badMood7d) / ov.totalReports7d) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Frown className="h-4 w-4 text-red-500 shrink-0" />
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium">Müde / Frustriert</span>
                        <span>{Math.round((ov.badMood7d / ov.totalReports7d) * 100)}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-400 rounded-full"
                          style={{ width: `${Math.round((ov.badMood7d / ov.totalReports7d) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <ThumbsDown className="h-4 w-4 text-amber-500 shrink-0" />
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium">Negatives Rating (1–2 Sterne)</span>
                        <span>{Math.round((ov.negative7d / ov.totalReports7d) * 100)}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full"
                          style={{ width: `${Math.round((ov.negative7d / ov.totalReports7d) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Meh className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Noch kein Feedback in den letzten 7 Tagen.</p>
                </div>
              )}
            </Card>

            {/* Info Box */}
            <Card className="p-5 lg:col-span-2 bg-blue-50/60 border-blue-200">
              <h3 className="font-semibold text-sm text-blue-800 mb-2">So funktioniert der Feedback Loop</h3>
              <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                <li>Fahrer geben nach jeder Tour optional Feedback: 1–5 Sterne, Stimmung, Issue-Types und eine kurze Notiz.</li>
                <li>Issues werden aggregiert und als Heatmap dargestellt (Navigation, Kunden, App, Fahrzeug, Timing, Route).</li>
                <li>Fahrer mit dauerhaft schlechtem Feedback (≥30% negativ, 7 Tage) werden automatisch im Wellbeing-System flagged.</li>
                <li>Die Cron-Engine aggregiert täglich um 04:00 UTC alle Standorte und bereinigt Daten nach 90 Tagen.</li>
              </ul>
            </Card>
          </div>
        )}

        {/* Tab: Fahrer */}
        {activeTab === 'drivers' && (
          <Card className="overflow-hidden">
            {(data?.driverRows ?? []).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Noch kein Fahrer-Feedback vorhanden.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Fahrer</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Ø Rating</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Berichte</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Positiv / Neg.</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Mit Issues</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Letztes Feedback</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(data?.driverRows ?? []).map((row) => (
                    <DriverRow key={row.driverId} row={row} onSelect={() => {}} />
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}

        {/* Tab: Letzte Berichte */}
        {activeTab === 'recent' && (
          <div className="space-y-2">
            {(data?.recentReports ?? []).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquarePlus className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Noch keine Berichte vorhanden.</p>
              </div>
            ) : (
              (data?.recentReports ?? []).map((r) => (
                <FeedbackCard key={r.id} r={r} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
