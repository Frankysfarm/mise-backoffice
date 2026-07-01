'use client';

import { useEffect, useState } from 'react';
import { Trophy, ChevronDown, ChevronUp, Loader2, Star, Clock, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

type QualityLabel = 'excellent' | 'good' | 'average' | 'poor';

interface ZoneQualityScore {
  zone: string;
  deliveryCount: number;
  avgDeliveryMinutes: number | null;
  slaCompliancePct: number | null;
  avgCustomerRating: number | null;
  timingScore: number;
  ratingScore: number;
  slaScore: number;
  qualityScore: number;
  qualityLabel: QualityLabel;
}

interface ZoneQualitySummary {
  topZone: string | null;
  bottomZone: string | null;
  avgQualityScore: number;
  totalDeliveries: number;
}

interface ApiResponse {
  ok: boolean;
  zones: ZoneQualityScore[];
  summary: ZoneQualitySummary;
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const qualityStyle: Record<QualityLabel, { badge: string; bar: string; label: string; row: string }> = {
  excellent: { badge: 'bg-matcha-100 text-matcha-700', bar: 'bg-matcha-500',  label: 'Exzellent', row: 'border-matcha-200 bg-matcha-50/40' },
  good:      { badge: 'bg-blue-100 text-blue-700',     bar: 'bg-blue-500',    label: 'Gut',        row: 'border-blue-100 bg-blue-50/30' },
  average:   { badge: 'bg-amber-100 text-amber-700',   bar: 'bg-amber-400',   label: 'Mittel',     row: 'border-amber-100 bg-amber-50/30' },
  poor:      { badge: 'bg-red-100 text-red-700',       bar: 'bg-red-400',     label: 'Schwach',    row: 'border-red-100 bg-red-50/30' },
};

const medalColors = ['text-yellow-500', 'text-slate-400', 'text-amber-700'];
const medalLabels = ['🥇', '🥈', '🥉'];

export function LieferdienstZoneQualityScoreKarte({ locationId }: Props) {
  const [zones, setZones] = useState<ZoneQualityScore[]>([]);
  const [summary, setSummary] = useState<ZoneQualitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const load = () => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/zone-quality-score?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => {
        setZones(d.zones ?? []);
        setSummary(d.summary ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 90_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;

  const hasData = zones.length > 0;
  const topZoneLabel = summary?.topZone ?? null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Trophy className={cn('h-4 w-4', hasData ? 'text-yellow-500' : 'text-muted-foreground')} />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Zonen-Qualitäts-Score
          </span>
          {topZoneLabel && (
            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-700">
              Beste: Zone {topZoneLabel}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-5 py-4 space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lade Zonen-Scores…
            </div>
          )}

          {!loading && summary && hasData && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-yellow-50 border border-yellow-100 px-3 py-2 text-center">
                <div className="text-xl font-black tabular-nums text-yellow-700">
                  {summary.avgQualityScore}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-yellow-500 mt-0.5">Ø Score</div>
              </div>
              <div className="rounded-lg bg-matcha-50 border border-matcha-100 px-3 py-2 text-center">
                <div className="text-xl font-black tabular-nums text-matcha-700">
                  {summary.topZone ? `Zone ${summary.topZone}` : '—'}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-matcha-500 mt-0.5">Beste Zone</div>
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-center">
                <div className="text-xl font-black tabular-nums text-slate-700">
                  {summary.totalDeliveries}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mt-0.5">Lieferungen heute</div>
              </div>
            </div>
          )}

          {!loading && !hasData && (
            <div className="text-sm text-muted-foreground py-2">
              Noch keine abgeschlossenen Lieferungen heute.
            </div>
          )}

          {!loading && hasData && (
            <div className="space-y-2">
              {zones.map((zone, idx) => {
                const qs = qualityStyle[zone.qualityLabel];
                const medal = idx < 3 ? medalLabels[idx] : null;

                return (
                  <div
                    key={zone.zone}
                    className={cn('rounded-lg border px-3 py-2.5 space-y-2', qs.row)}
                  >
                    <div className="flex items-center gap-2 justify-between">
                      <div className="flex items-center gap-2">
                        {medal && <span className="text-sm">{medal}</span>}
                        <span className="font-bold text-sm">Zone {zone.zone}</span>
                        <span className={cn('text-[9px] rounded-full px-1.5 py-0.5 font-bold', qs.badge)}>
                          {qs.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{zone.deliveryCount} Lief.</span>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-black tabular-nums">{zone.qualityScore}</span>
                        <span className="text-[9px] text-muted-foreground ml-0.5">/ 100</span>
                      </div>
                    </div>

                    {/* Score bar */}
                    <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', qs.bar)}
                        style={{ width: `${zone.qualityScore}%` }}
                      />
                    </div>

                    {/* Sub-scores */}
                    <div className="flex items-center gap-4 text-[10px] text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {zone.avgDeliveryMinutes !== null ? `${zone.avgDeliveryMinutes} Min` : '—'}
                        <span className="text-[8px]">(Timing {zone.timingScore}/40)</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        {zone.avgCustomerRating !== null ? zone.avgCustomerRating.toFixed(1) : '—'}
                        <span className="text-[8px]">(Bewert. {zone.ratingScore}/35)</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        {zone.slaCompliancePct !== null ? `${zone.slaCompliancePct}%` : '—'}
                        <span className="text-[8px]">(SLA {zone.slaScore}/25)</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!locationId && (
            <div className="text-sm text-muted-foreground">Bitte Filiale auswählen.</div>
          )}
        </div>
      )}
    </div>
  );
}
