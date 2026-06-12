'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users, AlertTriangle, CheckCircle2, TrendingUp, Calendar,
  Clock, RefreshCw, ChevronDown, ChevronUp, Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// ─── Typen (spiegeln lib/delivery/shift-planner.ts) ─────────────────────────

type CoverageStatus = 'ok' | 'low' | 'gap' | 'over' | 'off'

interface StaffingSlot {
  hourUtc: string
  hourLocal: string
  dayLabel: string
  weekday: number
  hourOfDay: number
  expectedOrders: number
  recommendedMin: number
  recommendedTarget: number
  scheduledDrivers: number
  status: CoverageStatus
}

interface StaffingDay {
  date: string
  dayLabel: string
  slots: StaffingSlot[]
  gapCount: number
  lowCount: number
  okCount: number
  coveragePct: number
}

interface StaffingPlan {
  locationId: string
  generatedAt: string
  days: StaffingDay[]
  summary: {
    totalGaps: number
    totalLow: number
    totalOk: number
    totalOver: number
    peakDriverNeed: number
    avgCoveragePct: number
  }
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function statusColor(status: CoverageStatus): string {
  switch (status) {
    case 'ok':  return 'bg-emerald-500'
    case 'over': return 'bg-blue-400'
    case 'low': return 'bg-amber-400'
    case 'gap': return 'bg-red-500'
    case 'off': return 'bg-zinc-800'
  }
}

function statusBorder(status: CoverageStatus): string {
  switch (status) {
    case 'ok':  return 'border-emerald-600'
    case 'over': return 'border-blue-500'
    case 'low': return 'border-amber-500'
    case 'gap': return 'border-red-600'
    case 'off': return 'border-zinc-700'
  }
}

function statusLabel(status: CoverageStatus): string {
  switch (status) {
    case 'ok':  return 'Gut besetzt'
    case 'over': return 'Überbesetzt'
    case 'low': return 'Unterbesetzt'
    case 'gap': return 'Lücke'
    case 'off': return 'Kein Betrieb'
  }
}

// Nur Betriebsstunden 06–24 anzeigen
const BUSINESS_HOURS = Array.from({ length: 18 }, (_, i) => i + 6)

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

export function StaffingCockpitClient({ locationId }: { locationId: string }) {
  const [plan, setPlan] = useState<StaffingPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [selected, setSelected] = useState<StaffingSlot | null>(null)
  const [expandedDay, setExpandedDay] = useState<string | null>(null)

  const fetchPlan = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/delivery/admin/shift-planner?location_id=${locationId}&days=7`,
        { cache: 'no-store' },
      )
      if (!res.ok) throw new Error(await res.text())
      const data: StaffingPlan = await res.json()
      setPlan(data)
      setLastUpdate(new Date())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [locationId])

  useEffect(() => {
    fetchPlan()
    const timer = setInterval(fetchPlan, 5 * 60_000)
    return () => clearInterval(timer)
  }, [fetchPlan])

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-zinc-400">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span>Besetzungsplan wird geladen…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-950 p-4 text-red-300">
        <AlertTriangle className="mb-1 inline h-4 w-4" /> {error}
      </div>
    )
  }

  if (!plan) return null

  const { summary, days } = plan

  return (
    <div className="space-y-6">

      {/* ── KPI-Karten ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4 text-red-400" />}
          label="Offene Lücken"
          value={summary.totalGaps}
          sub="Stunden ohne Fahrer"
          accent="red"
        />
        <KpiCard
          icon={<Clock className="h-4 w-4 text-amber-400" />}
          label="Unterbesetzt"
          value={summary.totalLow}
          sub="Unter Zielbesetzung"
          accent="amber"
        />
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
          label="Gut besetzt"
          value={summary.totalOk}
          sub="Stunden ≥ Ziel"
          accent="emerald"
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4 text-blue-400" />}
          label="Ø Abdeckung"
          value={`${summary.avgCoveragePct}%`}
          sub={`Max. ${summary.peakDriverNeed} Fahrer gleichzeitig`}
          accent="blue"
        />
      </div>

      {/* ── Heatmap-Grid ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <Calendar className="h-4 w-4 text-zinc-400" />
            7-Tage-Besetzungs-Übersicht
          </h2>
          <div className="flex items-center gap-3">
            <Legend />
            <button
              onClick={() => { setLoading(true); fetchPlan() }}
              className="rounded p-1 text-zinc-500 hover:text-zinc-300"
              title="Aktualisieren"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="w-12 py-1 pr-2 text-right font-normal text-zinc-500">Uhr</th>
                {days.map((day) => (
                  <th key={day.date} className="min-w-[72px] px-0.5 pb-1 text-center">
                    <div className="font-semibold text-zinc-200">{day.dayLabel.split(' ')[0]}</div>
                    <div className="text-zinc-500">{day.dayLabel.split(' ')[1]}</div>
                    <DayCoverageBar pct={day.coveragePct} gaps={day.gapCount} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BUSINESS_HOURS.map((hour) => (
                <tr key={hour} className="group">
                  <td className="py-0.5 pr-2 text-right font-mono text-[10px] text-zinc-600">
                    {String(hour).padStart(2, '0')}:00
                  </td>
                  {days.map((day) => {
                    const slot = day.slots.find((s) => s.hourOfDay === hour)
                    if (!slot) {
                      return (
                        <td key={day.date} className="px-0.5 py-0.5">
                          <div className="h-7 rounded bg-zinc-900" />
                        </td>
                      )
                    }
                    const isSelected = selected?.hourUtc === slot.hourUtc
                    return (
                      <td key={day.date} className="px-0.5 py-0.5">
                        <button
                          onClick={() => setSelected(isSelected ? null : slot)}
                          className={`
                            relative h-7 w-full rounded border text-[10px] font-semibold
                            transition-all hover:scale-105 hover:z-10
                            ${statusColor(slot.status)} ${statusBorder(slot.status)}
                            ${isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-zinc-950' : ''}
                          `}
                          title={`${slot.hourLocal} ${slot.dayLabel} — ${statusLabel(slot.status)}`}
                        >
                          {slot.status !== 'off' && (
                            <span className="text-white/90 drop-shadow">
                              {slot.scheduledDrivers}/{slot.recommendedTarget}
                            </span>
                          )}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Slot-Detail-Panel */}
        {selected && (
          <SlotDetail slot={selected} onClose={() => setSelected(null)} locationId={locationId} />
        )}
      </div>

      {/* ── Tages-Aufschlüsselung ──────────────────────────────────────── */}
      <div className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <Users className="h-4 w-4 text-zinc-400" />
          Tages-Aufschlüsselung
        </h2>
        {days.map((day) => (
          <DayRow
            key={day.date}
            day={day}
            expanded={expandedDay === day.date}
            onToggle={() => setExpandedDay(expandedDay === day.date ? null : day.date)}
            onSelectSlot={setSelected}
          />
        ))}
      </div>

      {/* Footer */}
      <p className="text-center text-[10px] text-zinc-600">
        Zuletzt aktualisiert:{' '}
        {lastUpdate?.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        {' '}· Automatisch alle 5 Minuten
      </p>
    </div>
  )
}

// ─── Unterkomponenten ─────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, sub, accent,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub: string
  accent: 'red' | 'amber' | 'emerald' | 'blue'
}) {
  const borderMap = {
    red: 'border-red-900',
    amber: 'border-amber-900',
    emerald: 'border-emerald-900',
    blue: 'border-blue-900',
  }
  return (
    <div className={`rounded-xl border ${borderMap[accent]} bg-zinc-950 p-4`}>
      <div className="mb-1 flex items-center gap-1.5 text-xs text-zinc-500">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold text-zinc-100">{value}</div>
      <div className="mt-0.5 text-[10px] text-zinc-500">{sub}</div>
    </div>
  )
}

function Legend() {
  return (
    <div className="flex items-center gap-2 text-[10px] text-zinc-400">
      {(['ok', 'low', 'gap', 'over', 'off'] as CoverageStatus[]).map((s) => (
        <span key={s} className="flex items-center gap-1">
          <span className={`inline-block h-2.5 w-2.5 rounded-sm ${statusColor(s)}`} />
          {statusLabel(s)}
        </span>
      ))}
    </div>
  )
}

function DayCoverageBar({ pct, gaps }: { pct: number; gaps: number }) {
  const color = gaps > 3 ? 'bg-red-500' : gaps > 0 ? 'bg-amber-400' : 'bg-emerald-500'
  return (
    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function SlotDetail({
  slot, onClose, locationId,
}: {
  slot: StaffingSlot
  onClose: () => void
  locationId: string
}) {
  return (
    <div className="mt-4 rounded-lg border border-zinc-700 bg-zinc-900 p-4">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${statusColor(slot.status)}`} />
            <span className="font-semibold text-zinc-100">
              {slot.dayLabel} · {slot.hourLocal} Uhr
            </span>
            <Badge variant="outline" className="text-[10px]">
              {statusLabel(slot.status)}
            </Badge>
          </div>
        </div>
        <button onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-300">
          ✕ Schließen
        </button>
      </div>
      <div className="grid grid-cols-3 gap-4 text-xs">
        <div>
          <div className="text-zinc-500">Erwartete Bestellungen</div>
          <div className="text-lg font-bold text-zinc-100">{slot.expectedOrders}</div>
        </div>
        <div>
          <div className="text-zinc-500">Geplante Fahrer</div>
          <div className="text-lg font-bold text-zinc-100">{slot.scheduledDrivers}</div>
        </div>
        <div>
          <div className="text-zinc-500">Empfehlung (Min/Ziel)</div>
          <div className="text-lg font-bold text-zinc-100">
            {slot.recommendedMin} / {slot.recommendedTarget}
          </div>
        </div>
      </div>
      {(slot.status === 'gap' || slot.status === 'low') && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-950 p-3 text-xs text-amber-200">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <strong>Handlungsempfehlung:</strong> Für diese Stunde werden{' '}
            {slot.recommendedTarget} Fahrer empfohlen, aber nur {slot.scheduledDrivers}{' '}
            {slot.scheduledDrivers === 1 ? 'ist' : 'sind'} eingeplant.
            {slot.scheduledDrivers < slot.recommendedMin && (
              <span> Die Mindestbesetzung von {slot.recommendedMin}{' '}
              {slot.recommendedMin === 1 ? 'Fahrer' : 'Fahrern'} wird unterschritten.</span>
            )}
            {' '}Schicht-Buchungen können unter{' '}
            <strong>Fahrer → Schichten</strong> angelegt werden.
          </div>
        </div>
      )}
    </div>
  )
}

function DayRow({
  day, expanded, onToggle, onSelectSlot,
}: {
  day: StaffingDay
  expanded: boolean
  onToggle: () => void
  onSelectSlot: (slot: StaffingSlot) => void
}) {
  const activeSlots = day.slots.filter((s) => s.status !== 'off')

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-3 text-left hover:bg-zinc-900"
      >
        <span className="w-20 font-semibold text-zinc-200 text-sm">{day.dayLabel}</span>

        {/* Mini-Streifen der Betriebsstunden */}
        <div className="flex flex-1 gap-0.5">
          {BUSINESS_HOURS.map((h) => {
            const slot = day.slots.find((s) => s.hourOfDay === h)
            return (
              <div
                key={h}
                className={`h-4 flex-1 rounded-sm ${slot ? statusColor(slot.status) : 'bg-zinc-900'}`}
              />
            )
          })}
        </div>

        <div className="flex items-center gap-3 text-xs">
          {day.gapCount > 0 && (
            <span className="text-red-400">{day.gapCount} Lücke{day.gapCount !== 1 ? 'n' : ''}</span>
          )}
          {day.lowCount > 0 && (
            <span className="text-amber-400">{day.lowCount} unterbes.</span>
          )}
          <span className="text-zinc-400">{day.coveragePct}% Abdeckung</span>
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-zinc-500" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-zinc-800 p-3">
          <div className="grid grid-cols-6 gap-1 sm:grid-cols-9 md:grid-cols-12 lg:grid-cols-18">
            {activeSlots.map((slot) => (
              <button
                key={slot.hourUtc}
                onClick={() => onSelectSlot(slot)}
                className={`
                  rounded border p-1.5 text-center text-[10px] transition-all hover:scale-105
                  ${statusColor(slot.status)} ${statusBorder(slot.status)}
                `}
                title={`${slot.hourLocal} — ${statusLabel(slot.status)}: ${slot.scheduledDrivers}/${slot.recommendedTarget} Fahrer`}
              >
                <div className="font-mono text-white/80">{slot.hourLocal}</div>
                <div className="font-bold text-white">
                  {slot.scheduledDrivers}/{slot.recommendedTarget}
                </div>
              </button>
            ))}
          </div>
          {activeSlots.length === 0 && (
            <p className="text-center text-xs text-zinc-600">Kein Betrieb erwartet</p>
          )}
        </div>
      )}
    </div>
  )
}
