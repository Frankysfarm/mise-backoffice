'use client'

import { useEffect, useState, useCallback } from 'react'
import { Shield, TrendingUp, TrendingDown, Minus, Award, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

type BadgeLevel = 'bronze' | 'silver' | 'gold' | 'platinum'

interface TransparencySnapshot {
  snapshotDate:     string
  trustScore:       number
  badgeLevel:       BadgeLevel
  components: {
    scoreOntime:   number
    scoreQuality:  number
    scoreAccuracy: number
    scoreSpeed:    number
    scoreCare:     number
  }
  avgDeliveryMin:   number | null
  onTimeRatePct:    number | null
  satisfactionRate: number | null
  totalDeliveries:  number
  ordersLast30d:    number
  trustDelta:       number | null
  previousBadge:    BadgeLevel | null
}

interface DashboardData {
  today:       TransparencySnapshot | null
  yesterday:   TransparencySnapshot | null
  trend:       TransparencySnapshot[]
  weeklyAvg:   number | null
  badgeHistory: { date: string; level: BadgeLevel }[]
}

const BADGE_META: Record<BadgeLevel, { label: string; color: string; bg: string; ring: string }> = {
  platinum: { label: 'Platin',  color: 'text-violet-300', bg: 'bg-violet-900/30', ring: 'ring-violet-500/50' },
  gold:     { label: 'Gold',    color: 'text-yellow-300', bg: 'bg-yellow-900/30', ring: 'ring-yellow-500/50' },
  silver:   { label: 'Silber',  color: 'text-slate-300',  bg: 'bg-slate-700/30',  ring: 'ring-slate-500/50'  },
  bronze:   { label: 'Bronze',  color: 'text-amber-400',  bg: 'bg-amber-900/20',  ring: 'ring-amber-600/40'  },
}

const SCORE_BARS: { key: keyof TransparencySnapshot['components']; label: string }[] = [
  { key: 'scoreOntime',   label: 'Pünktlichkeit'        },
  { key: 'scoreQuality',  label: 'Kundenzufriedenheit'  },
  { key: 'scoreAccuracy', label: 'Liefergeschwindigkeit' },
  { key: 'scoreSpeed',    label: 'SLA-Compliance'        },
  { key: 'scoreCare',     label: 'Storno-Rate'           },
]

function scoreColor(v: number): string {
  if (v >= 80) return 'bg-emerald-500'
  if (v >= 60) return 'bg-amber-500'
  return 'bg-red-500'
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

export function LieferdienstTransparenzDashboard({ locationId }: { locationId: string | null }) {
  const [open, setOpen]       = useState(false)
  const [data, setData]       = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!locationId || !open) return
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/delivery/admin/transparency?location_id=${locationId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as DashboardData & { ok: boolean }
      setData(json)
    } catch {
      setError('Transparenz-Daten konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [locationId, open])

  useEffect(() => { void load() }, [load])

  // 10-Min-Polling wenn offen
  useEffect(() => {
    if (!open || !locationId) return
    const id = setInterval(() => { void load() }, 600_000)
    return () => clearInterval(id)
  }, [open, locationId, load])

  if (!locationId) return null

  const today  = data?.today
  const meta   = today ? BADGE_META[today.badgeLevel] : BADGE_META['bronze']

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Shield className="h-4 w-4 shrink-0 text-violet-400" />
          <span className="text-sm font-semibold text-white">Transparenz-Siegel</span>
          {today && (
            <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${meta.bg} ${meta.color} ${meta.ring}`}>
              {meta.label} · {today.trustScore} Pkt
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-white/50" /> : <ChevronDown className="h-4 w-4 text-white/50" />}
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {loading && !data && (
            <div className="flex items-center gap-2 text-white/50 text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Lade Transparenz-Daten…
            </div>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}

          {!today && !loading && !error && (
            <p className="text-xs text-white/40">
              Noch kein Snapshot vorhanden. Täglich 04:00 UTC automatisch berechnet.
            </p>
          )}

          {today && (
            <>
              {/* Badge-Header */}
              <div className={`flex items-center gap-4 rounded-lg p-3 ring-1 ${meta.bg} ${meta.ring}`}>
                <Award className={`h-8 w-8 shrink-0 ${meta.color}`} />
                <div>
                  <div className={`text-lg font-black ${meta.color}`}>
                    {meta.label}-Qualität
                  </div>
                  <div className="text-xs text-white/60">
                    Vertrauens-Score: {today.trustScore} / 100
                    {today.trustDelta !== null && (
                      <span className={`ml-2 font-bold ${today.trustDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {today.trustDelta >= 0 ? '+' : ''}{today.trustDelta}
                      </span>
                    )}
                  </div>
                </div>
                <div className="ml-auto text-right">
                  {today.trustDelta !== null && today.trustDelta > 0 && (
                    <TrendingUp className="h-5 w-5 text-emerald-400" />
                  )}
                  {today.trustDelta !== null && today.trustDelta < 0 && (
                    <TrendingDown className="h-5 w-5 text-red-400" />
                  )}
                  {(today.trustDelta === null || today.trustDelta === 0) && (
                    <Minus className="h-5 w-5 text-white/30" />
                  )}
                </div>
              </div>

              {/* KPI-Grid */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-white/5 p-2">
                  <div className="text-[10px] text-white/50">Ø Lieferzeit</div>
                  <div className="text-sm font-bold text-white">
                    {today.avgDeliveryMin !== null ? `${Math.round(today.avgDeliveryMin)} Min` : '—'}
                  </div>
                </div>
                <div className="rounded-lg bg-white/5 p-2">
                  <div className="text-[10px] text-white/50">Pünktlichkeit</div>
                  <div className="text-sm font-bold text-white">
                    {today.onTimeRatePct !== null ? `${Math.round(today.onTimeRatePct)} %` : '—'}
                  </div>
                </div>
                <div className="rounded-lg bg-white/5 p-2">
                  <div className="text-[10px] text-white/50">Zufriedenheit</div>
                  <div className="text-sm font-bold text-white">
                    {today.satisfactionRate !== null ? `${Math.round(today.satisfactionRate)} %` : '—'}
                  </div>
                </div>
              </div>

              {/* Teilbereiche */}
              <div className="space-y-2">
                {SCORE_BARS.map(({ key, label }) => {
                  const val = Math.round(today.components[key])
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="w-36 shrink-0 text-[10px] text-white/50">{label}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${scoreColor(val)}`}
                          style={{ width: `${val}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-[10px] text-white/60">{val}</span>
                    </div>
                  )
                })}
              </div>

              {/* Badge-Verlauf */}
              {data.badgeHistory.length > 1 && (
                <div>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                    Badge-Verlauf (14 Tage)
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {data.badgeHistory.map((h) => {
                      const m = BADGE_META[h.level]
                      return (
                        <div key={h.date} className={`flex flex-col items-center gap-0.5 rounded px-1.5 py-1 ${m.bg}`}>
                          <span className={`text-[9px] font-bold ${m.color}`}>{m.label[0]}</span>
                          <span className="text-[8px] text-white/30">{fmtDate(h.date)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="text-[10px] text-white/25 text-right">
                Stand: {fmtDate(today.snapshotDate)} · {today.ordersLast30d} Bestellungen (30 Tage)
              </div>
            </>
          )}

          {data?.weeklyAvg !== null && data?.weeklyAvg !== undefined && (
            <div className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/60">
              Wochen-Ø Vertrauens-Score: <span className="font-bold text-white">{data.weeklyAvg}</span> / 100
            </div>
          )}
        </div>
      )}
    </div>
  )
}
