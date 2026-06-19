'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Star, MessageSquare, RefreshCw, TrendingUp, Loader2,
  ChevronDown, ChevronUp, AlertTriangle, UtensilsCrossed, Users,
} from 'lucide-react';

// ── Typen ────────────────────────────────────────────────────────────────────

interface SurveyDailyRow {
  surveyDate: string;
  responseCount: number;
  avgQ1: number | null;
  avgQ2: number | null;
  avgQ3: number | null;
  avgOverall: number | null;
  q1LowCount: number;
  q2LowCount: number;
  q3LowCount: number;
  notesCount: number;
}

interface SurveyOverview {
  totalResponses7d: number;
  avgQ1_7d: number | null;
  avgQ2_7d: number | null;
  avgQ3_7d: number | null;
  avgOverall7d: number | null;
  kitchenIssues7d: number;
  tourIssues7d: number;
  customerIssues7d: number;
}

interface SurveyNote {
  note: string;
  submittedAt: string;
}

interface Dashboard {
  overview: SurveyOverview | null;
  trends: SurveyDailyRow[];
  recentNotes: SurveyNote[];
  totalAllTime: number;
}

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

function ratingColor(v: number | null) {
  if (v === null) return 'text-muted-foreground';
  if (v >= 4) return 'text-green-600';
  if (v >= 3) return 'text-amber-600';
  return 'text-red-600';
}

function ratingBg(v: number | null) {
  if (v === null) return 'bg-muted';
  if (v >= 4) return 'bg-green-100';
  if (v >= 3) return 'bg-amber-50';
  return 'bg-red-50';
}

function StarRow({ value, label }: { value: number | null; label: string }) {
  const stars = Math.round(value ?? 0);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-40 truncate">{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            size={12}
            className={i <= stars ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}
          />
        ))}
      </div>
      <span className={`text-sm font-semibold tabular-nums ${ratingColor(value)}`}>
        {value !== null ? value.toFixed(1) : '—'}
      </span>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-1 ${accent ?? 'bg-card'}`}>
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

// ── Trend-Tabelle ────────────────────────────────────────────────────────────

function TrendTable({ trends }: { trends: SurveyDailyRow[] }) {
  if (trends.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">Noch keine Daten.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="text-left py-2 pr-4">Datum</th>
            <th className="text-right px-2">Antworten</th>
            <th className="text-right px-2">Tour ⌀</th>
            <th className="text-right px-2">Küche ⌀</th>
            <th className="text-right px-2">Kunden ⌀</th>
            <th className="text-right px-2">Gesamt ⌀</th>
            <th className="text-right pl-2">Probleme</th>
          </tr>
        </thead>
        <tbody>
          {[...trends].reverse().map((row) => {
            const issues = row.q1LowCount + row.q2LowCount + row.q3LowCount;
            return (
              <tr key={row.surveyDate} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-2 pr-4 font-medium text-xs">{row.surveyDate}</td>
                <td className="text-right px-2 tabular-nums">{row.responseCount}</td>
                <td className={`text-right px-2 tabular-nums font-medium ${ratingColor(row.avgQ1)}`}>
                  {row.avgQ1?.toFixed(1) ?? '—'}
                </td>
                <td className={`text-right px-2 tabular-nums font-medium ${ratingColor(row.avgQ2)}`}>
                  {row.avgQ2?.toFixed(1) ?? '—'}
                </td>
                <td className={`text-right px-2 tabular-nums font-medium ${ratingColor(row.avgQ3)}`}>
                  {row.avgQ3?.toFixed(1) ?? '—'}
                </td>
                <td className={`text-right px-2 tabular-nums font-bold ${ratingColor(row.avgOverall)}`}>
                  {row.avgOverall?.toFixed(1) ?? '—'}
                </td>
                <td className="text-right pl-2 tabular-nums">
                  {issues > 0 ? (
                    <span className="text-red-600 font-semibold">{issues}</span>
                  ) : (
                    <span className="text-green-500">0</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Kommentare ───────────────────────────────────────────────────────────────

function NotesList({ notes }: { notes: SurveyNote[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? notes : notes.slice(0, 5);

  if (notes.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">Keine Kommentare vorhanden.</p>;
  }

  return (
    <div className="space-y-2">
      {visible.map((n, i) => (
        <div key={i} className="flex gap-3 p-3 rounded-lg border bg-muted/20">
          <MessageSquare size={14} className="text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm">{n.note}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(n.submittedAt).toLocaleString('de-DE', {
                day: '2-digit', month: '2-digit', year: '2-digit',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>
        </div>
      ))}
      {notes.length > 5 && (
        <button
          onClick={() => setExpanded((p) => !p)}
          className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? 'Weniger anzeigen' : `${notes.length - 5} weitere anzeigen`}
        </button>
      )}
    </div>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

type Tab = 'overview' | 'trends' | 'notes';

export function TourSurveyClient() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('overview');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const res  = await fetch('/api/delivery/admin/tour-survey?action=dashboard');
      const json = await res.json() as { ok?: boolean; dashboard?: Dashboard; error?: string };
      if (!json.ok) throw new Error(json.error ?? 'Unbekannter Fehler');
      setDashboard(json.dashboard ?? null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">
        {error}
      </div>
    );
  }

  const ov = dashboard?.overview;

  return (
    <div className="space-y-6 p-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Fahrer-Feedback-Terminal</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Anonyme Post-Tour-Kurzumfrage — 3 Fragen · Stern-Rating 1–5
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Aktualisieren
        </button>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Antworten (7 Tage)"
          value={ov?.totalResponses7d ?? 0}
          sub={`${dashboard?.totalAllTime ?? 0} gesamt`}
          icon={<Star size={14} />}
        />
        <KpiCard
          label="Gesamt-Score ⌀"
          value={ov?.avgOverall7d != null ? ov.avgOverall7d.toFixed(1) : '—'}
          sub="Alle 3 Fragen"
          icon={<TrendingUp size={14} />}
          accent={ov?.avgOverall7d != null ? ratingBg(ov.avgOverall7d) : undefined}
        />
        <KpiCard
          label="Küchen-Probleme"
          value={ov?.kitchenIssues7d ?? 0}
          sub="Bewertung ≤ 2 (7 Tage)"
          icon={<UtensilsCrossed size={14} />}
          accent={(ov?.kitchenIssues7d ?? 0) > 0 ? 'bg-amber-50 border-amber-200' : undefined}
        />
        <KpiCard
          label="Kunden-Probleme"
          value={ov?.customerIssues7d ?? 0}
          sub="Bewertung ≤ 2 (7 Tage)"
          icon={<Users size={14} />}
          accent={(ov?.customerIssues7d ?? 0) > 0 ? 'bg-amber-50 border-amber-200' : undefined}
        />
      </div>

      {/* 3-Fragen-Score-Übersicht */}
      {ov && (
        <div className="rounded-xl border p-4 bg-card space-y-3">
          <h2 className="text-sm font-semibold">Ø-Bewertungen der letzten 7 Tage</h2>
          <StarRow value={ov.avgQ1_7d} label="Wie reibungslos lief die Tour?" />
          <StarRow value={ov.avgQ2_7d} label="War die Küche vorbereitet?" />
          <StarRow value={ov.avgQ3_7d} label="Wie war der Kundenkontakt?" />
          {(ov.tourIssues7d + ov.kitchenIssues7d + ov.customerIssues7d) > 0 && (
            <div className="flex items-center gap-2 pt-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertTriangle size={13} />
              {ov.tourIssues7d + ov.kitchenIssues7d + ov.customerIssues7d} schlechte Bewertungen (≤ 2 Sterne) in den letzten 7 Tagen
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div>
        <div className="flex border-b mb-4 gap-4 text-sm">
          {([
            ['overview', 'Übersicht'],
            ['trends', 'Verlauf (14 Tage)'],
            ['notes', `Kommentare (${dashboard?.recentNotes.length ?? 0})`],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`pb-2 border-b-2 transition-colors ${
                tab === key ? 'border-primary font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="rounded-xl border p-4 bg-card">
            <h2 className="text-sm font-semibold mb-3">Fragebogen-Vorschau</h2>
            <ol className="space-y-3 text-sm">
              {[
                { q: 'Wie reibungslos lief die Tour?', key: 'q1_tour_smoothness' },
                { q: 'War die Küche pünktlich vorbereitet?', key: 'q2_kitchen_readiness' },
                { q: 'Wie war der Kundenkontakt?', key: 'q3_customer_contact' },
              ].map((item, i) => (
                <li key={item.key} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium">{item.q}</p>
                    <div className="flex gap-1 mt-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} size={14} className="text-muted-foreground/30" />
                      ))}
                      <span className="text-xs text-muted-foreground ml-1">1–5 Sterne</span>
                    </div>
                  </div>
                </li>
              ))}
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center">
                  +
                </span>
                <div>
                  <p className="text-muted-foreground">Optionaler anonymer Kommentar (max. 280 Zeichen)</p>
                </div>
              </li>
            </ol>
            <p className="text-xs text-muted-foreground mt-4 border-t pt-3">
              Alle Antworten sind anonym — Admin sieht keine Fahrernamen, nur aggregierte Scores.
            </p>
          </div>
        )}

        {tab === 'trends' && (
          <div className="rounded-xl border p-4 bg-card">
            <h2 className="text-sm font-semibold mb-3">Tages-Verlauf (14 Tage)</h2>
            <TrendTable trends={dashboard?.trends ?? []} />
          </div>
        )}

        {tab === 'notes' && (
          <div className="rounded-xl border p-4 bg-card">
            <h2 className="text-sm font-semibold mb-3">Anonyme Kommentare</h2>
            <NotesList notes={dashboard?.recentNotes ?? []} />
          </div>
        )}
      </div>
    </div>
  );
}
