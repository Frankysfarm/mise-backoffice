'use client';

/**
 * StrategicInsightsDashboard — Phase 403 Frontend
 *
 * Dashboard-Kachel für Strategic Insights: InsightsSummary (critical/warning/positive counts)
 * + Top-Insight-Karte mit Acknowledge-Button.
 * API: GET /api/delivery/admin/strategic-insights?location_id=...&action=summary
 *      GET /api/delivery/admin/strategic-insights?location_id=...
 *      POST { action: 'acknowledge', insight_id, location_id }
 */

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, AlertCircle, CheckCircle2, Info,
  Lightbulb, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type InsightCategory  = 'sla' | 'revenue' | 'drivers' | 'zones' | 'kitchen' | 'customers';
type InsightSeverity  = 'critical' | 'warning' | 'info' | 'positive';

interface StrategicInsight {
  id:               string;
  category:         InsightCategory;
  insight_type:     string;
  severity:         InsightSeverity;
  title:            string;
  description:      string;
  impact_score:     number;
  recommendation:   string | null;
  is_acknowledged:  boolean;
  generated_at:     string;
}

interface InsightsSummary {
  totalInsights:  number;
  critical:       number;
  warning:        number;
  positive:       number;
  info:           number;
  unacknowledged: number;
  topInsight:     StrategicInsight | null;
}

interface Props {
  locationId: string | null;
}

const SEV_STYLE: Record<InsightSeverity, { bg: string; border: string; icon: React.ReactNode; label: string }> = {
  critical: {
    bg: 'bg-red-50',    border: 'border-red-200',
    icon: <AlertCircle className="h-4 w-4 text-red-500" />,
    label: 'Kritisch',
  },
  warning: {
    bg: 'bg-amber-50',  border: 'border-amber-200',
    icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
    label: 'Warnung',
  },
  positive: {
    bg: 'bg-green-50',  border: 'border-green-200',
    icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    label: 'Positiv',
  },
  info: {
    bg: 'bg-blue-50',   border: 'border-blue-200',
    icon: <Info className="h-4 w-4 text-blue-500" />,
    label: 'Info',
  },
};

const CAT_LABELS: Record<InsightCategory, string> = {
  sla:       'SLA',
  revenue:   'Umsatz',
  drivers:   'Fahrer',
  zones:     'Zonen',
  kitchen:   'Küche',
  customers: 'Kunden',
};

function InsightCard({
  insight, locationId, onAcknowledged,
}: {
  insight: StrategicInsight;
  locationId: string;
  onAcknowledged: (id: string) => void;
}) {
  const [acking, setAcking]   = useState(false);
  const [showRec, setShowRec] = useState(false);
  const s = SEV_STYLE[insight.severity];

  const acknowledge = async () => {
    setAcking(true);
    try {
      const res = await fetch('/api/delivery/admin/strategic-insights', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'acknowledge',
          insight_id: insight.id,
          location_id: locationId,
        }),
      });
      if (res.ok) onAcknowledged(insight.id);
    } finally {
      setAcking(false);
    }
  };

  return (
    <div className={cn('rounded-xl border p-3 space-y-2', s.bg, s.border)}>
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">{s.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {CAT_LABELS[insight.category]}
            </span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] font-bold text-muted-foreground">Score {insight.impact_score}</span>
          </div>
          <div className="text-xs font-bold text-foreground">{insight.title}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{insight.description}</div>
        </div>
      </div>

      {insight.recommendation && (
        <div>
          <button
            onClick={() => setShowRec(r => !r)}
            className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
          >
            {showRec ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Empfehlung
          </button>
          {showRec && (
            <div className="mt-1 text-[11px] text-foreground bg-white/70 rounded px-2.5 py-1.5 border border-white/50">
              {insight.recommendation}
            </div>
          )}
        </div>
      )}

      {!insight.is_acknowledged && (
        <div className="flex justify-end">
          <button
            onClick={acknowledge}
            disabled={acking}
            className={cn(
              'text-[10px] font-semibold rounded-lg px-2.5 py-1 transition-colors',
              acking
                ? 'bg-stone-100 text-muted-foreground cursor-not-allowed'
                : 'bg-white border border-stone-200 text-foreground hover:bg-stone-50',
            )}
          >
            {acking ? 'Quittiert…' : 'Quittieren'}
          </button>
        </div>
      )}
    </div>
  );
}

export function StrategicInsightsDashboard({ locationId }: Props) {
  const [summary, setSummary] = useState<InsightsSummary | null>(null);
  const [insights, setInsights] = useState<StrategicInsight[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) { setLoading(false); return; }
    try {
      const [sumRes, allRes] = await Promise.all([
        fetch(`/api/delivery/admin/strategic-insights?location_id=${locationId}&action=summary`),
        fetch(`/api/delivery/admin/strategic-insights?location_id=${locationId}`),
      ]);
      if (sumRes.ok) {
        const s = await sumRes.json();
        setSummary(s.summary ?? null);
      }
      if (allRes.ok) {
        const a = await allRes.json();
        setInsights((a.insights ?? []).filter((i: StrategicInsight) => !i.is_acknowledged));
      }
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
  }, [load]);

  const handleAcknowledged = (id: string) => {
    setInsights(prev => prev.filter(i => i.id !== id));
    setSummary(prev =>
      prev ? { ...prev, unacknowledged: Math.max(0, prev.unacknowledged - 1) } : prev,
    );
  };

  if (!locationId || loading) return null;
  if (!summary || summary.totalInsights === 0) return null;

  const visibleInsights = expanded ? insights : insights.slice(0, 2);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-stone-100">
        <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
        <div>
          <div className="text-sm font-bold text-foreground">Strategische Insights</div>
          <div className="text-[11px] text-muted-foreground">
            {summary.totalInsights} Insight{summary.totalInsights !== 1 ? 's' : ''}
            {summary.unacknowledged > 0 ? ` · ${summary.unacknowledged} ungelesen` : ''}
          </div>
        </div>

        {/* Summary chips */}
        <div className="ml-auto flex items-center gap-1.5">
          {summary.critical > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold bg-red-100 text-red-700 rounded-full px-2 py-0.5">
              <AlertCircle className="h-3 w-3" /> {summary.critical}
            </span>
          )}
          {summary.warning > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
              <AlertTriangle className="h-3 w-3" /> {summary.warning}
            </span>
          )}
          {summary.positive > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold bg-green-100 text-green-700 rounded-full px-2 py-0.5">
              <CheckCircle2 className="h-3 w-3" /> {summary.positive}
            </span>
          )}
        </div>
      </div>

      {/* Insights list */}
      {insights.length === 0 ? (
        <div className="px-5 py-5 text-center text-xs text-muted-foreground">
          <CheckCircle2 className="h-5 w-5 text-green-400 mx-auto mb-1" />
          Alle Insights quittiert — alles im grünen Bereich.
        </div>
      ) : (
        <div className="p-4 space-y-2">
          {visibleInsights.map(insight => (
            <InsightCard
              key={insight.id}
              insight={insight}
              locationId={locationId}
              onAcknowledged={handleAcknowledged}
            />
          ))}

          {insights.length > 2 && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? (
                <><ChevronUp className="h-3.5 w-3.5" /> Weniger anzeigen</>
              ) : (
                <><ChevronDown className="h-3.5 w-3.5" /> {insights.length - 2} weitere Insight{insights.length - 2 !== 1 ? 's' : ''}</>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
