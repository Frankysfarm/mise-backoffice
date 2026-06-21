'use client'

import { useEffect, useState, useCallback } from 'react'
import { Activity, ChevronDown, ChevronUp, Loader2, Truck, Clock, AlertTriangle, TrendingUp } from 'lucide-react'

interface OpsSnapshot {
  queue: { neu: number; zubereitung: number; bereit: number; unterwegs: number }
  drivers: { online: number; idle: number; active: number; offline: number }
  alerts: { critical: number; warning: number; info: number }
  sla: { onTimePct: number | null; sampleSize: number }
  throughput: { perHourRate: number; deliveriesLast30min: number } | null
  delays: { active: number } | null
  generatedAt: string
}

function pulsColor(value: number, thresholds: [number, number]): string {
  if (value >= thresholds[1]) return 'text-emerald-400'
  if (value >= thresholds[0]) return 'text-amber-400'
  return 'text-red-400'
}

function dotColor(value: number, thresholds: [number, number]): string {
  if (value >= thresholds[1]) return 'bg-emerald-400'
  if (value >= thresholds[0]) return 'bg-amber-400'
  return 'bg-red-400'
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function OpsPulsMonitor({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<OpsSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!locationId || !open) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/delivery/admin/ops-snapshot?location_id=${locationId}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as OpsSnapshot & { ok?: boolean }
      setData(json)
      setLastUpdate(json.generatedAt ?? new Date().toISOString())
    } catch {
      setError('Ops-Daten nicht verfügbar.')
    } finally {
      setLoading(false)
    }
  }, [locationId, open])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!open || !locationId) return
    const id = setInterval(() => { void load() }, 30_000)
    return () => clearInterval(id)
  }, [open, locationId, load])

  if (!locationId) return null

  const activeOrders = data
    ? data.queue.neu + data.queue.zubereitung + data.queue.bereit + data.queue.unterwegs
    : 0
  const availableDrivers = data ? data.drivers.idle + data.drivers.active : 0
  const criticalAlerts = data ? data.alerts.critical : 0
  const sla = data?.sla.onTimePct ?? null

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="h-4 w-4 shrink-0 text-matcha-400" />
          <span className="text-sm font-semibold text-white">Ops-Puls Monitor</span>
          {data && (
            <div className="flex items-center gap-1.5 ml-2">
              <span className={`inline-flex h-2 w-2 rounded-full animate-pulse ${criticalAlerts > 0 ? 'bg-red-400' : 'bg-emerald-400'}`} />
              <span className="text-[10px] text-white/50">{activeOrders} aktiv · {availableDrivers} Fahrer</span>
            </div>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-white/50" /> : <ChevronDown className="h-4 w-4 text-white/50" />}
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {loading && !data && (
            <div className="flex items-center gap-2 text-white/50 text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Lade Ops-Snapshot…
            </div>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}

          {data && (
            <>
              {/* Bestellungs-Queue */}
              <div>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                  Bestell-Queue
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Neu', value: data.queue.neu, color: 'bg-blue-500/20 text-blue-300' },
                    { label: 'Küche', value: data.queue.zubereitung, color: 'bg-amber-500/20 text-amber-300' },
                    { label: 'Bereit', value: data.queue.bereit, color: 'bg-emerald-500/20 text-emerald-300' },
                    { label: 'Unterwegs', value: data.queue.unterwegs, color: 'bg-violet-500/20 text-violet-300' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className={`rounded-lg p-2 text-center ${color}`}>
                      <div className="text-lg font-black tabular-nums">{value}</div>
                      <div className="text-[9px] font-semibold opacity-80">{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fahrer-Status */}
              <div>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                  Fahrer-Status
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Online', value: data.drivers.online, dot: 'bg-emerald-400' },
                    { label: 'Frei', value: data.drivers.idle, dot: 'bg-blue-400' },
                    { label: 'Aktiv', value: data.drivers.active, dot: 'bg-amber-400' },
                    { label: 'Offline', value: data.drivers.offline, dot: 'bg-white/20' },
                  ].map(({ label, value, dot }) => (
                    <div key={label} className="flex flex-col items-center rounded-lg bg-white/5 p-2">
                      <span className={`h-2 w-2 rounded-full mb-1 ${dot}`} />
                      <div className="text-sm font-bold text-white tabular-nums">{value}</div>
                      <div className="text-[9px] text-white/40">{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* KPI-Leiste */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-white/5 p-2 text-center">
                  <div className="text-[10px] text-white/40 mb-0.5">SLA On-Time</div>
                  <div className={`text-sm font-bold tabular-nums ${sla !== null ? pulsColor(sla, [75, 90]) : 'text-white/30'}`}>
                    {sla !== null ? `${Math.round(sla)} %` : '—'}
                  </div>
                </div>
                <div className="rounded-lg bg-white/5 p-2 text-center">
                  <div className="text-[10px] text-white/40 mb-0.5">Durchsatz/h</div>
                  <div className={`text-sm font-bold tabular-nums ${data.throughput !== null ? pulsColor(data.throughput.perHourRate, [5, 12]) : 'text-white/30'}`}>
                    {data.throughput !== null ? `${Math.round(data.throughput.perHourRate)}` : '—'}
                  </div>
                </div>
                <div className="rounded-lg bg-white/5 p-2 text-center">
                  <div className="text-[10px] text-white/40 mb-0.5">Verspätungen</div>
                  <div className={`text-sm font-bold tabular-nums ${(data.delays?.active ?? 0) === 0 ? 'text-emerald-400' : (data.delays?.active ?? 0) < 3 ? 'text-amber-400' : 'text-red-400'}`}>
                    {data.delays?.active ?? 0}
                  </div>
                </div>
              </div>

              {/* Alerts */}
              {(data.alerts.critical > 0 || data.alerts.warning > 0) && (
                <div className="flex items-center gap-3 rounded-lg bg-red-900/20 px-3 py-2 border border-red-500/20">
                  <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                  <div className="text-xs text-white/80">
                    {data.alerts.critical > 0 && (
                      <span className="font-bold text-red-400">{data.alerts.critical} kritisch </span>
                    )}
                    {data.alerts.warning > 0 && (
                      <span className="text-amber-400">{data.alerts.warning} Warnung{data.alerts.warning !== 1 ? 'en' : ''}</span>
                    )}
                  </div>
                </div>
              )}

              {lastUpdate && (
                <div className="text-[10px] text-white/25 text-right">
                  Stand: {fmtTime(lastUpdate)} · 30s-Polling aktiv
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
