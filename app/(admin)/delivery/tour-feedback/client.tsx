'use client';
import { useState, useEffect } from 'react';
import { Star, TrendingUp, AlertCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FeedbackDashboard } from '@/lib/delivery/tour-feedback';

interface Props {
  locationId: string;
  initial: FeedbackDashboard | null;
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function StarVal({ v }: { v: number }) {
  return (
    <span className={cn('font-bold', v >= 4 ? 'text-emerald-600' : v >= 3 ? 'text-amber-600' : 'text-red-600')}>
      {v > 0 ? v.toFixed(1) : '—'}★
    </span>
  );
}

const ISSUE_LABELS: Record<string, string> = {
  parking: 'Parken',
  customer: 'Kunde',
  navigation: 'Navigation',
  address: 'Adresse',
};

export function TourFeedbackClient({ locationId, initial }: Props) {
  const [data, setData] = useState<FeedbackDashboard | null>(initial);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async (d = days) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/tour-feedback?action=dashboard&days=${d}&location_id=${locationId}`
      );
      if (res.ok) setData(await res.json() as FeedbackDashboard);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(days); }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDays = (d: number) => { setDays(d); };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Star className="h-6 w-6 text-amber-500" />
            Tour-Feedback
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Fahrer-Bewertungen nach Tourablauf</p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => handleDays(d)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg border font-medium transition-colors',
                days === d
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              )}
            >
              {d}T
            </button>
          ))}
          <button
            onClick={() => load()}
            disabled={loading}
            className="p-2 rounded-lg border bg-white hover:bg-gray-50 text-gray-600 disabled:opacity-40"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {!data || data.totalFeedbacks === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center text-gray-400">
          <Star className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Noch keine Bewertungen im gewählten Zeitraum</p>
          <p className="text-sm mt-1">Fahrer bewerten Touren direkt in der Fahrer-App nach Abschluss</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Bewertungen" value={String(data.totalFeedbacks)} sub={`letzte ${days} Tage`} />
            <KpiCard label="Ø Gesamt-Score" value={data.avgOverallScore > 0 ? `${data.avgOverallScore.toFixed(1)}★` : '—'} />
            <KpiCard label="Ø Schwierigkeit" value={data.avgDifficulty > 0 ? `${data.avgDifficulty.toFixed(1)}★` : '—'} />
            <KpiCard label="Ø Kundenerlebnis" value={data.avgCustomer > 0 ? `${data.avgCustomer.toFixed(1)}★` : '—'} />
          </div>

          {/* Issue Rates */}
          <div className="rounded-xl border bg-white p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Problem-Häufigkeit
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(data.issueRates).map(([key, rate]) => (
                <div key={key} className="text-center">
                  <div className={cn(
                    'text-xl font-bold',
                    rate > 30 ? 'text-red-600' : rate > 15 ? 'text-amber-600' : 'text-emerald-600'
                  )}>
                    {rate}%
                  </div>
                  <div className="text-xs text-gray-500">{ISSUE_LABELS[key] ?? key}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Ratings breakdown */}
          <div className="rounded-xl border bg-white p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Bewertungs-Kategorien
            </p>
            <div className="space-y-2">
              {[
                { label: 'Schwierigkeit', v: data.avgDifficulty },
                { label: 'Verkehr/Stau', v: data.avgTraffic },
                { label: 'Kundenerlebnis', v: data.avgCustomer },
              ].map(({ label, v }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="w-32 text-sm text-gray-600">{label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className={cn('h-2 rounded-full', v >= 4 ? 'bg-emerald-500' : v >= 3 ? 'bg-amber-500' : 'bg-red-500')}
                      style={{ width: `${Math.min(100, (v / 5) * 100)}%` }}
                    />
                  </div>
                  <StarVal v={v} />
                </div>
              ))}
            </div>
          </div>

          {/* Recent feedbacks */}
          <div className="rounded-xl border bg-white overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <p className="text-sm font-semibold text-gray-700">Neueste Bewertungen</p>
            </div>
            <div className="divide-y">
              {data.recentFeedbacks.slice(0, 20).map((fb) => {
                const isOpen = expandedId === fb.id;
                return (
                  <div key={fb.id}>
                    <button
                      onClick={() => setExpandedId(isOpen ? null : fb.id)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <StarVal v={fb.overall_score ?? 0} />
                        <span className="text-sm font-medium text-gray-800">{fb.driver_name ?? 'Fahrer'}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(fb.submitted_at).toLocaleDateString('de-DE')}
                        </span>
                        {(fb.had_parking_issue || fb.had_customer_issue || fb.had_nav_issue || fb.had_address_issue) && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                            Problem
                          </span>
                        )}
                      </div>
                      {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-3 pt-1 bg-gray-50 text-sm space-y-1 text-gray-600">
                        <div className="flex gap-4 flex-wrap">
                          {fb.difficulty_rating && <span>Schwierigkeit: <StarVal v={fb.difficulty_rating} /></span>}
                          {fb.traffic_rating    && <span>Verkehr: <StarVal v={fb.traffic_rating} /></span>}
                          {fb.customer_rating   && <span>Kunde: <StarVal v={fb.customer_rating} /></span>}
                        </div>
                        {(fb.had_parking_issue || fb.had_customer_issue || fb.had_nav_issue || fb.had_address_issue) && (
                          <div className="flex gap-1.5 flex-wrap mt-1">
                            {fb.had_parking_issue  && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs">Parken</span>}
                            {fb.had_customer_issue && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs">Kunde</span>}
                            {fb.had_nav_issue      && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs">Navigation</span>}
                            {fb.had_address_issue  && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs">Adresse</span>}
                          </div>
                        )}
                        {fb.driver_notes && (
                          <p className="mt-1 italic text-gray-500">&ldquo;{fb.driver_notes}&rdquo;</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
