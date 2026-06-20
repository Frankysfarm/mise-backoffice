'use client';

import { useEffect, useState } from 'react';
import { Map, AlertTriangle, Clock } from 'lucide-react';

interface HeatmapSummary {
  tilesTotal: number;
  stopsCovered: number;
  underservedCount: number;
  underservedHigh: number;
  avgDeliveryMin: number | null;
  lateRateOverall: number | null;
}

export function HeatmapKpi({ locationId: _locationId }: { locationId: string }) {
  const [summary, setSummary] = useState<HeatmapSummary | null>(null);

  useEffect(() => {
    fetch('/api/delivery/admin/tour-heatmap?action=dashboard')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { summary?: HeatmapSummary } | null) => d?.summary && setSummary(d.summary))
      .catch(() => {});
    const iv = setInterval(() => {
      fetch('/api/delivery/admin/tour-heatmap?action=dashboard')
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { summary?: HeatmapSummary } | null) => d?.summary && setSummary(d.summary))
        .catch(() => {});
    }, 10 * 60 * 1000);
    return () => clearInterval(iv);
  }, []);

  if (!summary) {
    return (
      <div className="rounded-xl border p-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-32 mb-3" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-muted rounded" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Map className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-semibold">Tour Heatmap</span>
        </div>
        <a href="/delivery/tour-heatmap" className="text-xs text-indigo-600 hover:underline">
          Details →
        </a>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <div className="text-lg font-bold">{summary.tilesTotal}</div>
          <div className="text-xs text-muted-foreground">Kacheln</div>
        </div>
        <div className="text-center">
          <div className={`text-lg font-bold ${summary.underservedHigh > 0 ? 'text-red-600' : summary.underservedCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {summary.underservedCount}
          </div>
          <div className="text-xs text-muted-foreground">Unterversorgt</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold">
            {summary.avgDeliveryMin != null ? `${summary.avgDeliveryMin}` : '–'}
          </div>
          <div className="text-xs text-muted-foreground">Ø Min.</div>
        </div>
      </div>
      {(summary.underservedHigh > 0 || (summary.lateRateOverall != null && summary.lateRateOverall > 30)) && (
        <div className={`flex items-center gap-2 text-xs p-2 rounded ${summary.underservedHigh > 0 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
          {summary.underservedHigh > 0 ? (
            <AlertTriangle className="h-3 w-3 shrink-0" />
          ) : (
            <Clock className="h-3 w-3 shrink-0" />
          )}
          {summary.underservedHigh > 0
            ? `${summary.underservedHigh} kritische Zone${summary.underservedHigh > 1 ? 'n' : ''} mit Verspätungen`
            : `Verspätungsrate ${summary.lateRateOverall}% — prüfen`}
        </div>
      )}
    </div>
  );
}
