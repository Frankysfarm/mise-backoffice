'use client'

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DropAlert {
  id: string
  driverName: string | null
  alertDate: string
  alertType: string
  scoreToday: number
  scoreBaseline: number
  dropMagnitude: number
  gradeToday: string
  gradeBaseline: string
}

const ALERT_LABEL: Record<string, string> = {
  significant_drop:    'Starker Einbruch',
  grade_regression:    'Notenrückschritt',
  consecutive_decline: '3 Tage Abwärtstrend',
}

const ALERT_STYLE: Record<string, string> = {
  significant_drop:    'border-red-200 bg-red-50',
  grade_regression:    'border-amber-200 bg-amber-50',
  consecutive_decline: 'border-orange-200 bg-orange-50',
}

export function DispatchScoreDropAlertFeed({
  locationId,
}: {
  locationId: string | null
}) {
  const [alerts, setAlerts] = useState<DropAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [ackingId, setAckingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!locationId) return
    try {
      const res = await fetch(
        `/api/delivery/admin/driver-score-daily?action=alerts&location_id=${locationId}`,
      )
      if (!res.ok) return
      const json = (await res.json()) as { alerts?: DropAlert[] }
      setAlerts(json.alerts ?? [])
    } catch {
      // graceful
    } finally {
      setLoading(false)
    }
  }, [locationId])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const id = setInterval(() => { void load() }, 30_000)
    return () => clearInterval(id)
  }, [load])

  const acknowledge = async (alertId: string) => {
    setAckingId(alertId)
    try {
      await fetch('/api/delivery/admin/driver-score-daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'acknowledge', alert_id: alertId }),
      })
      setAlerts((prev) => prev.filter((a) => a.id !== alertId))
    } catch {
      // graceful
    } finally {
      setAckingId(null)
    }
  }

  if (!locationId || loading || alerts.length === 0) return null

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100 text-red-600">
          <TrendingDown className="h-3.5 w-3.5" />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
          Performance-Alerts
        </span>
        <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700">
          {alerts.length}
        </span>
      </div>

      <div className="space-y-2">
        {alerts.map((a) => (
          <div
            key={a.id}
            className={cn(
              'flex items-center gap-3 rounded-xl border px-3 py-2.5',
              ALERT_STYLE[a.alertType] ?? 'border-stone-200 bg-stone-50',
            )}
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs font-bold">{a.driverName ?? '—'}</span>
                <span className="rounded bg-white/70 px-1 py-0.5 text-[9px] font-bold">
                  {a.gradeBaseline}→{a.gradeToday}
                </span>
              </div>
              <div className="mt-0.5 text-[10px] text-stone-500">
                {ALERT_LABEL[a.alertType] ?? a.alertType} · −{a.dropMagnitude.toFixed(1)} Pkt
              </div>
            </div>
            <button
              onClick={() => { void acknowledge(a.id) }}
              disabled={ackingId === a.id}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/80 text-matcha-600 transition hover:bg-matcha-50 disabled:opacity-50"
              title="Alert quittieren"
            >
              {ackingId === a.id
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <CheckCircle2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
