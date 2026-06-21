'use client'

import { useEffect, useState, useCallback } from 'react'
import { CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronUp, Loader2, ShieldCheck } from 'lucide-react'

interface OpsSnapshot {
  drivers: { online: number; total: number; active: number }
  queue: { neu: number; zubereitung: number; bereit: number; unterwegs: number }
  sla: { onTimePct: number | null }
  throughput: { perHourRate: number | null } | null
  alerts: { critical: number; high: number; medium: number; low: number }
}

interface Check {
  label: string
  ok: boolean
  detail: string
  warn: boolean
}

function buildChecks(snap: OpsSnapshot): Check[] {
  const driversOk = snap.drivers.online > 0
  const queueOk   = snap.queue.neu < 10
  const queueWarn = snap.queue.neu >= 5 && snap.queue.neu < 10
  const slaOk     = snap.sla.onTimePct === null || snap.sla.onTimePct >= 80
  const slaWarn   = snap.sla.onTimePct !== null && snap.sla.onTimePct >= 60 && snap.sla.onTimePct < 80
  const tphr      = snap.throughput?.perHourRate ?? null
  const tpOk      = tphr === null || tphr >= 2
  const alertsOk  = snap.alerts.critical === 0
  const alertsWarn = snap.alerts.high > 0

  return [
    {
      label: 'Fahrer online',
      ok: driversOk,
      warn: false,
      detail: `${snap.drivers.online}/${snap.drivers.total} online, ${snap.drivers.active} aktiv`,
    },
    {
      label: 'Warteschlange',
      ok: queueOk,
      warn: queueWarn,
      detail: `${snap.queue.neu} neu · ${snap.queue.zubereitung} in Zubereitung`,
    },
    {
      label: 'SLA-Rate',
      ok: slaOk,
      warn: slaWarn,
      detail: snap.sla.onTimePct !== null ? `${snap.sla.onTimePct}% pünktlich` : 'Keine Daten',
    },
    {
      label: 'Durchsatz',
      ok: tpOk,
      warn: !tpOk && tphr !== null,
      detail: tphr !== null ? `${tphr.toFixed(1)} Liefg./Std.` : 'Wird berechnet',
    },
    {
      label: 'Kritische Alarme',
      ok: alertsOk,
      warn: alertsWarn,
      detail: `${snap.alerts.critical} kritisch · ${snap.alerts.high} hoch`,
    },
  ]
}

function CheckRow({ check }: { check: Check }) {
  const Icon = check.ok
    ? CheckCircle2
    : check.warn
    ? AlertCircle
    : XCircle

  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <Icon
        className={`h-4 w-4 shrink-0 ${
          check.ok ? 'text-emerald-500' : check.warn ? 'text-amber-500' : 'text-red-500'
        }`}
      />
      <span className="text-xs font-semibold text-gray-700 flex-1">{check.label}</span>
      <span className="text-[10px] text-gray-400">{check.detail}</span>
    </div>
  )
}

export function OpsSchnellCheck({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(false)
  const [snap, setSnap] = useState<OpsSnapshot | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!locationId) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/delivery/admin/ops-snapshot?location_id=${locationId}`,
        { cache: 'no-store' },
      )
      if (!res.ok) throw new Error('failed')
      const json = await res.json() as OpsSnapshot
      setSnap(json)
    } catch {
      setSnap(null)
    } finally {
      setLoading(false)
    }
  }, [locationId])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!locationId) return
    const id = setInterval(() => { void load() }, 30_000)
    return () => clearInterval(id)
  }, [locationId, load])

  if (!locationId) return null

  const checks = snap ? buildChecks(snap) : []
  const allOk  = checks.length > 0 && checks.every((c) => c.ok)
  const hasCrit = checks.some((c) => !c.ok && !c.warn)

  return (
    <div className={`rounded-xl border shadow-sm overflow-hidden ${hasCrit ? 'border-red-200' : 'border-gray-200'} bg-white`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 hover:bg-gray-50 transition"
      >
        <ShieldCheck
          className={`h-4 w-4 shrink-0 ${
            hasCrit ? 'text-red-500' : allOk ? 'text-emerald-500' : 'text-amber-500'
          }`}
        />
        <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
          Ops-Schnellcheck
        </span>
        <span className={`ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
          hasCrit ? 'bg-red-100 text-red-700'
          : allOk  ? 'bg-emerald-100 text-emerald-700'
          : 'bg-amber-100 text-amber-700'
        }`}>
          {hasCrit ? 'Kritisch' : allOk ? 'Alles OK' : 'Warnung'}
        </span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400 ml-auto mr-1" />}
        {open
          ? <ChevronUp className="h-4 w-4 text-gray-400 ml-auto" />
          : <ChevronDown className="h-4 w-4 text-gray-400 ml-auto" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {checks.length === 0 && !loading && (
            <p className="px-4 py-3 text-xs text-gray-400">Keine Daten verfügbar.</p>
          )}
          {checks.map((c) => <CheckRow key={c.label} check={c} />)}
        </div>
      )}
    </div>
  )
}
