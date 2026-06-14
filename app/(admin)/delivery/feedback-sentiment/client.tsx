'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare, ThumbsUp, ThumbsDown, Minus, Flag,
  RefreshCw, TrendingUp, Hash, AlertTriangle, Star,
  ChevronDown, ChevronUp, BarChart2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Typen ─────────────────────────────────────────────────────────────────────

type SentimentLabel = 'positive' | 'neutral' | 'negative';

interface FeedbackRow {
  id: string;
  ratingId: string;
  driverId: string | null;
  orderId: string | null;
  rawComment: string;
  ratingScore: number;
  sentimentScore: number;
  sentimentLabel: SentimentLabel;
  keywords: string[];
  topics: string[];
  isFlagged: boolean;
  analyzedAt: string;
}

interface Dashboard {
  summary: {
    totalAnalyzed: number;
    positiveCount: number;
    neutralCount: number;
    negativeCount: number;
    positivePct: number;
    negativePct: number;
    avgSentiment: number;
    flaggedCount: number;
    lastAnalyzedAt: string | null;
  };
  trend: Array<{
    day: string;
    total: number;
    positiveCount: number;
    negativeCount: number;
    avgSentiment: number;
  }>;
  topKeywords: Array<{ keyword: string; count: number; avgSentiment: number }>;
  flaggedComments: FeedbackRow[];
  unanalyzedCount: number;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

const SENTIMENT_COLOR: Record<SentimentLabel, string> = {
  positive: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  neutral: 'bg-gray-100 text-gray-600 border-gray-200',
  negative: 'bg-red-100 text-red-700 border-red-200',
};

const SENTIMENT_ICON: Record<SentimentLabel, React.ReactNode> = {
  positive: <ThumbsUp className="h-3.5 w-3.5" />,
  neutral: <Minus className="h-3.5 w-3.5" />,
  negative: <ThumbsDown className="h-3.5 w-3.5" />,
};

const SENTIMENT_LABEL_DE: Record<SentimentLabel, string> = {
  positive: 'Positiv',
  neutral: 'Neutral',
  negative: 'Negativ',
};

const TOPIC_LABEL: Record<string, string> = {
  driver: '🛵 Fahrer',
  food: '🍕 Essen',
  time: '⏱️ Zeit',
  packaging: '📦 Verpackung',
  price: '💰 Preis',
  delivery: '📍 Lieferung',
  other: '📝 Sonstiges',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function SentimentBadge({ label }: { label: SentimentLabel }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold', SENTIMENT_COLOR[label])}>
      {SENTIMENT_ICON[label]}
      {SENTIMENT_LABEL_DE[label]}
    </span>
  );
}

function StarRating({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={cn('h-3 w-3', i < score ? 'fill-current' : 'fill-none opacity-30')} />
      ))}
      <span className="ml-1 text-[10px] font-bold text-amber-700">{score}/5</span>
    </span>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
      <div className={cn('mb-2 flex h-9 w-9 items-center justify-center rounded-xl', color ?? 'bg-gray-100 text-gray-600')}>
        {icon}
      </div>
      <div className="text-2xl font-black text-gray-900">{value}</div>
      <div className="text-xs font-semibold text-gray-500">{label}</div>
      {sub && <div className="mt-0.5 text-[10px] text-gray-400">{sub}</div>}
    </div>
  );
}

function CommentCard({ row, expanded, onToggle }: { row: FeedbackRow; expanded: boolean; onToggle: () => void }) {
  return (
    <div
      className={cn(
        'rounded-xl border p-3 transition-all',
        row.isFlagged ? 'border-red-200 bg-red-50/50' : 'border-black/5 bg-white',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <SentimentBadge label={row.sentimentLabel} />
        <StarRating score={row.ratingScore} />
        {row.isFlagged && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 border border-red-200">
            <Flag className="h-3 w-3" /> Geflaggt
          </span>
        )}
        <span className="ml-auto text-[10px] text-gray-400">
          {fmtDate(row.analyzedAt)} · {fmtTime(row.analyzedAt)}
        </span>
        <button
          type="button"
          onClick={onToggle}
          className="text-gray-400 hover:text-gray-600"
          aria-label="Details"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      <p className={cn('mt-2 text-sm text-gray-800 leading-relaxed', !expanded && 'line-clamp-2')}>
        &ldquo;{row.rawComment}&rdquo;
      </p>

      {expanded && (
        <div className="mt-2 space-y-1.5">
          <div className="flex flex-wrap gap-1">
            {row.keywords.map((kw) => (
              <span key={kw} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600 font-mono">
                {kw}
              </span>
            ))}
          </div>
          {row.topics.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {row.topics.map((t) => (
                <span key={t} className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">
                  {TOPIC_LABEL[t] ?? t}
                </span>
              ))}
            </div>
          )}
          <div className="text-[10px] text-gray-400">
            Score: <span className={cn('font-bold', row.sentimentScore >= 0 ? 'text-emerald-600' : 'text-red-600')}>
              {row.sentimentScore > 0 ? '+' : ''}{row.sentimentScore.toFixed(3)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Mini Trend Chart (SVG) ─────────────────────────────────────────────────────

function TrendChart({ data }: { data: Dashboard['trend'] }) {
  if (!data.length) return <div className="h-24 flex items-center justify-center text-xs text-gray-400">Keine Daten</div>;

  const ordered = [...data].reverse();
  const maxTotal = Math.max(...ordered.map((d) => d.total), 1);
  const W = 400;
  const H = 80;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      {ordered.map((d, i) => {
        const barW = W / ordered.length - 2;
        const x = i * (W / ordered.length) + 1;
        const posH = (d.positiveCount / maxTotal) * H;
        const negH = (d.negativeCount / maxTotal) * H;
        const neuH = Math.max(0, ((d.total - d.positiveCount - d.negativeCount) / maxTotal) * H);
        let yOff = H;

        const bars = [
          { h: posH, fill: '#10b981' },
          { h: neuH, fill: '#9ca3af' },
          { h: negH, fill: '#f87171' },
        ];

        return bars.map(({ h, fill }, j) => {
          yOff -= h;
          return h > 0 ? (
            <rect key={`${i}-${j}`} x={x} y={yOff} width={barW} height={h} fill={fill} opacity={0.75} rx={1} />
          ) : null;
        });
      })}
    </svg>
  );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────

type Tab = 'overview' | 'feed' | 'flagged';

export default function FeedbackSentimentClient() {
  const [tab, setTab] = useState<Tab>('overview');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [feed, setFeed] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/feedback-sentiment?action=dashboard');
      if (res.ok) {
        const data = await res.json() as Dashboard;
        setDashboard(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFeed = useCallback(async () => {
    const res = await fetch('/api/delivery/admin/feedback-sentiment?action=feed&limit=50');
    if (res.ok) {
      const data = await res.json() as { comments: FeedbackRow[] };
      setFeed(data.comments);
    }
  }, []);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);
  useEffect(() => {
    if (tab === 'feed') void loadFeed();
  }, [tab, loadFeed]);

  async function handleAnalyzeAll() {
    setAnalyzing(true);
    try {
      await fetch('/api/delivery/admin/feedback-sentiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze_all' }),
      });
      await loadDashboard();
      if (tab === 'feed') await loadFeed();
    } finally {
      setAnalyzing(false);
    }
  }

  const s = dashboard?.summary;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Übersicht' },
    { id: 'feed', label: 'Kommentar-Feed' },
    { id: 'flagged', label: `Geflaggt${s?.flaggedCount ? ` (${s.flaggedCount})` : ''}` },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Feedback-Sentiment-Analyse</h1>
          <p className="text-sm text-gray-500">Keyword-basierte Stimmungsanalyse aller Bewertungskommentare</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Aktualisieren
          </button>
          <button
            type="button"
            onClick={() => void handleAnalyzeAll()}
            disabled={analyzing}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50 transition"
          >
            <BarChart2 className="h-4 w-4" />
            {analyzing ? 'Analysiere…' : `Analysieren${(dashboard?.unanalyzedCount ?? 0) > 0 ? ` (${dashboard!.unanalyzedCount} neu)` : ''}`}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          icon={<MessageSquare className="h-5 w-5" />}
          label="Analysiert"
          value={(s?.totalAnalyzed ?? 0).toLocaleString('de-DE')}
          sub={s?.lastAnalyzedAt ? `Zuletzt ${fmtDate(s.lastAnalyzedAt)}` : 'Noch keine Analyse'}
          color="bg-indigo-100 text-indigo-700"
        />
        <KpiCard
          icon={<ThumbsUp className="h-5 w-5" />}
          label="Positiv"
          value={`${s?.positivePct ?? 0}%`}
          sub={`${(s?.positiveCount ?? 0).toLocaleString('de-DE')} Kommentare`}
          color="bg-emerald-100 text-emerald-700"
        />
        <KpiCard
          icon={<ThumbsDown className="h-5 w-5" />}
          label="Negativ"
          value={`${s?.negativePct ?? 0}%`}
          sub={`${(s?.negativeCount ?? 0).toLocaleString('de-DE')} Kommentare`}
          color="bg-red-100 text-red-700"
        />
        <KpiCard
          icon={<Flag className="h-5 w-5" />}
          label="Geflaggt"
          value={(s?.flaggedCount ?? 0).toLocaleString('de-DE')}
          sub="Kritische Kommentare"
          color="bg-orange-100 text-orange-700"
        />
      </div>

      {/* Avg Sentiment Bar */}
      {s && s.totalAnalyzed > 0 && (
        <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold text-gray-700">Ø Sentiment-Score</span>
            <span className={cn('font-black text-lg', s.avgSentiment >= 0 ? 'text-emerald-600' : 'text-red-600')}>
              {s.avgSentiment > 0 ? '+' : ''}{s.avgSentiment.toFixed(3)}
            </span>
          </div>
          <div className="relative h-3 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={cn('absolute top-0 h-3 rounded-full transition-all', s.avgSentiment >= 0 ? 'bg-emerald-400 left-1/2' : 'bg-red-400 right-1/2')}
              style={{ width: `${Math.abs(s.avgSentiment) * 50}%` }}
            />
            <div className="absolute left-1/2 top-0 h-3 w-0.5 bg-gray-400 opacity-50" />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-gray-400">
            <span>−1.0 sehr negativ</span>
            <span>0 neutral</span>
            <span>+1.0 sehr positiv</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition',
              tab === t.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Übersicht */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* Trend Chart */}
          {dashboard && dashboard.trend.length > 0 && (
            <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-semibold text-gray-700">30-Tage-Trend</span>
                <div className="ml-auto flex gap-2 text-[10px]">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-emerald-400 inline-block" />Positiv</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-gray-400 inline-block" />Neutral</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-red-400 inline-block" />Negativ</span>
                </div>
              </div>
              <TrendChart data={dashboard.trend} />
              <div className="mt-1 flex justify-between text-[10px] text-gray-400">
                {dashboard.trend.length > 0 && (
                  <>
                    <span>{fmtDate(dashboard.trend[dashboard.trend.length - 1].day)}</span>
                    <span>{fmtDate(dashboard.trend[0].day)}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Top Keywords */}
          {dashboard && dashboard.topKeywords.length > 0 && (
            <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Hash className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-semibold text-gray-700">Top-Keywords (30 Tage)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {dashboard.topKeywords.map((kw) => (
                  <div
                    key={kw.keyword}
                    className={cn(
                      'flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs',
                      kw.avgSentiment >= 0.1 ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : kw.avgSentiment <= -0.1 ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-gray-200 bg-gray-50 text-gray-600',
                    )}
                  >
                    <span className="font-mono font-semibold">{kw.keyword}</span>
                    <span className="rounded bg-white/60 px-1 text-[10px] font-bold">{kw.count}×</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sentiment-Verteilung */}
          {s && s.totalAnalyzed > 0 && (
            <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
              <div className="mb-3 text-sm font-semibold text-gray-700">Stimmungsverteilung</div>
              <div className="space-y-2">
                {([
                  { label: 'Positiv' as SentimentLabel, count: s.positiveCount, pct: s.positivePct, color: 'bg-emerald-400' },
                  { label: 'Neutral' as SentimentLabel, count: s.neutralCount, pct: Math.round((s.neutralCount / s.totalAnalyzed) * 100 * 10) / 10, color: 'bg-gray-300' },
                  { label: 'Negativ' as SentimentLabel, count: s.negativeCount, pct: s.negativePct, color: 'bg-red-400' },
                ] as const).map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <SentimentBadge label={item.label} />
                    <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className={cn('h-2.5 rounded-full transition-all', item.color)} style={{ width: `${item.pct}%` }} />
                    </div>
                    <span className="w-14 text-right text-xs font-bold text-gray-600">{item.pct}%</span>
                    <span className="w-10 text-right text-[10px] text-gray-400">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {s?.totalAnalyzed === 0 && !loading && (
            <div className="rounded-2xl border border-dashed border-indigo-300 bg-indigo-50 p-8 text-center">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 text-indigo-400" />
              <p className="font-semibold text-indigo-700">Noch keine Analyse</p>
              <p className="text-sm text-indigo-500 mt-1">Klicke auf &quot;Analysieren&quot; um alle Bewertungskommentare auszuwerten.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Kommentar-Feed */}
      {tab === 'feed' && (
        <div className="space-y-2">
          {feed.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
              Keine analysierten Kommentare vorhanden.
            </div>
          )}
          {feed.map((row) => (
            <CommentCard
              key={row.id}
              row={row}
              expanded={expandedId === row.id}
              onToggle={() => setExpandedId((id) => (id === row.id ? null : row.id))}
            />
          ))}
        </div>
      )}

      {/* Tab: Geflaggt */}
      {tab === 'flagged' && (
        <div className="space-y-2">
          {(dashboard?.flaggedComments ?? []).length === 0 && (
            <div className="rounded-xl border border-dashed border-green-200 bg-green-50 p-8 text-center">
              <ThumbsUp className="h-8 w-8 mx-auto mb-2 text-green-400" />
              <p className="font-semibold text-green-700">Keine kritischen Kommentare</p>
              <p className="text-sm text-green-500 mt-1">Alle Bewertungen sind im grünen Bereich.</p>
            </div>
          )}
          {(dashboard?.flaggedComments ?? []).map((row) => (
            <CommentCard
              key={row.id}
              row={row}
              expanded={expandedId === row.id}
              onToggle={() => setExpandedId((id) => (id === row.id ? null : row.id))}
            />
          ))}

          {(dashboard?.flaggedComments ?? []).length > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-orange-50 border border-orange-200 px-4 py-3 text-xs text-orange-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Geflaggte Kommentare haben ≤ 2 Sterne oder kritische Keywords. Admin-Review empfohlen.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
