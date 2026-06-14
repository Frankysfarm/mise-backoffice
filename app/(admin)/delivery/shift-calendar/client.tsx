'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ChevronLeft, ChevronRight, RefreshCw, Plus, Calendar,
  Users, AlertTriangle, CheckCircle2, Clock, Bike,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

// ─── Typen (spiegeln lib/delivery/shift-calendar.ts) ─────────────────────────

type ShiftStatus = 'scheduled' | 'active' | 'completed' | 'missed' | 'cancelled'
type Coverage   = 'ok' | 'low' | 'gap' | 'over' | 'off'

interface CalendarShift {
  id: string
  driverId: string
  driverName: string
  driverVehicle: string
  plannedStart: string
  plannedEnd: string
  actualStart: string | null
  actualEnd: string | null
  status: ShiftStatus
  notes: string | null
  startHour: number
  endHour: number
  durationH: number
}

interface CalendarHour {
  hour: number
  scheduledCount: number
  minRequired: number
  targetRequired: number
  coverage: Coverage
}

interface CalendarDay {
  date: string
  dayLabel: string
  dateLabel: string
  shifts: CalendarShift[]
  hours: CalendarHour[]
  totalShifts: number
  gapCount: number
  peakDriverNeed: number
}

interface WeekCalendar {
  locationId: string
  weekStart: string
  weekEnd: string
  generatedAt: string
  days: CalendarDay[]
  summary: {
    totalShifts: number
    totalGaps: number
    uniqueDrivers: number
    peakDriverNeed: number
    avgCoveragePct: number
  }
  drivers: { id: string; name: string; vehicle: string }[]
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function formatHour(h: number): string {
  return `${h.toString().padStart(2, '0')}:00`
}

function coverageBg(c: Coverage): string {
  switch (c) {
    case 'ok':   return 'bg-emerald-500/20 border-emerald-600/40'
    case 'over': return 'bg-blue-400/20 border-blue-500/40'
    case 'low':  return 'bg-amber-400/20 border-amber-500/40'
    case 'gap':  return 'bg-red-500/30 border-red-600/60'
    case 'off':  return 'bg-zinc-800/30 border-zinc-700/20'
  }
}

function coverageDot(c: Coverage): string {
  switch (c) {
    case 'ok':   return 'bg-emerald-500'
    case 'over': return 'bg-blue-400'
    case 'low':  return 'bg-amber-400'
    case 'gap':  return 'bg-red-500 animate-pulse'
    case 'off':  return 'bg-zinc-600'
  }
}

function coverageLabel(c: Coverage): string {
  switch (c) {
    case 'ok':   return 'Gut besetzt'
    case 'over': return 'Überbesetzt'
    case 'low':  return 'Unterbesetzt'
    case 'gap':  return 'Lücke!'
    case 'off':  return 'Kein Betrieb'
  }
}

function shiftStatusColor(s: ShiftStatus): string {
  switch (s) {
    case 'scheduled':  return 'bg-blue-500/80 border-blue-400'
    case 'active':     return 'bg-emerald-500/80 border-emerald-400'
    case 'completed':  return 'bg-zinc-500/60 border-zinc-500'
    case 'missed':     return 'bg-red-500/60 border-red-400'
    case 'cancelled':  return 'bg-zinc-700/40 border-zinc-600 opacity-40'
  }
}

function shiftStatusLabel(s: ShiftStatus): string {
  switch (s) {
    case 'scheduled': return 'Geplant'
    case 'active':    return 'Aktiv'
    case 'completed': return 'Abgeschlossen'
    case 'missed':    return 'Verpasst'
    case 'cancelled': return 'Storniert'
  }
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().slice(0, 10)
}

// Findet den Montag der aktuellen Woche
function currentMonday(): string {
  const d = new Date()
  const dow = d.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

// ─── Neue-Schicht-Formular ────────────────────────────────────────────────────

interface NewShiftForm {
  driverId: string
  date: string
  startHour: number
  endHour: number
  notes: string
}

function NewShiftModal({
  drivers,
  locationId,
  defaultDate,
  onClose,
  onCreated,
}: {
  drivers: { id: string; name: string; vehicle: string }[]
  locationId: string
  defaultDate: string
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState<NewShiftForm>({
    driverId: drivers[0]?.id ?? '',
    date: defaultDate,
    startHour: 11,
    endHour: 18,
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  async function submit() {
    if (!form.driverId) { setError('Fahrer auswählen'); return }
    if (form.endHour <= form.startHour) { setError('Endzeit muss nach Startzeit liegen'); return }

    setSaving(true)
    setError(null)

    const plannedStart = `${form.date}T${form.startHour.toString().padStart(2, '0')}:00:00`
    const plannedEnd   = `${form.date}T${form.endHour.toString().padStart(2, '0')}:00:00`

    try {
      const res = await fetch('/api/delivery/admin/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: form.driverId,
          location_id: locationId,
          planned_start: plannedStart,
          planned_end: plannedEnd,
          notes: form.notes || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Fehler beim Erstellen')
      onCreated()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
    } finally {
      setSaving(false)
    }
  }

  const hours = Array.from({ length: 17 }, (_, i) => i + 6) // 6–22 Uhr

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">Neue Schicht erstellen</h2>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Fahrer</label>
            <select
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-100"
              value={form.driverId}
              onChange={(e) => setForm({ ...form, driverId: e.target.value })}
            >
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.vehicle})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-zinc-400 block mb-1">Datum</label>
            <input
              type="date"
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-100"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Beginn</label>
              <select
                className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-100"
                value={form.startHour}
                onChange={(e) => setForm({ ...form, startHour: Number(e.target.value) })}
              >
                {hours.map((h) => (
                  <option key={h} value={h}>{formatHour(h)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Ende</label>
              <select
                className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-100"
                value={form.endHour}
                onChange={(e) => setForm({ ...form, endHour: Number(e.target.value) })}
              >
                {hours.filter((h) => h > form.startHour).map((h) => (
                  <option key={h} value={h}>{formatHour(h)}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-400 block mb-1">Notiz (optional)</label>
            <input
              type="text"
              placeholder="z. B. Abend-Rush"
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 text-xs text-red-400">{error}</p>
        )}

        <div className="mt-5 flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Abbrechen
          </Button>
          <Button size="sm" onClick={submit} disabled={saving}>
            {saving ? 'Speichern…' : 'Schicht erstellen'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Tages-Detailansicht ──────────────────────────────────────────────────────

function DayDetail({ day }: { day: CalendarDay }) {
  const operatingHours = day.hours.filter((h) => h.hour >= 8 && h.hour <= 22)

  return (
    <div className="space-y-3">
      {/* Stunden-Coverage-Grid */}
      <div className="grid grid-cols-8 gap-0.5">
        {operatingHours.map((h) => (
          <div
            key={h.hour}
            title={`${formatHour(h.hour)} — ${h.scheduledCount} Fahrer · ${coverageLabel(h.coverage)}`}
            className={`h-8 rounded border flex items-center justify-center cursor-default transition-all ${coverageBg(h.coverage)}`}
          >
            <span className="text-[10px] text-zinc-300 font-mono">{h.scheduledCount}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-3 text-[10px] text-zinc-500">
        {operatingHours.slice(0, 8).map((h) => (
          <span key={h.hour} className="flex-1 text-center">{h.hour}h</span>
        ))}
      </div>

      {/* Schichten */}
      {day.shifts.length === 0 ? (
        <p className="text-xs text-zinc-500 py-2">Keine Schichten geplant</p>
      ) : (
        <div className="space-y-1">
          {day.shifts.map((s) => (
            <div
              key={s.id}
              className={`rounded border px-2 py-1.5 text-xs flex items-center gap-2 ${shiftStatusColor(s.status)}`}
            >
              <Bike size={11} className="shrink-0 text-zinc-300" />
              <span className="font-medium text-zinc-100 truncate flex-1">{s.driverName}</span>
              <span className="text-zinc-300 font-mono shrink-0">
                {formatHour(s.startHour)}–{formatHour(s.endHour)}
              </span>
              <Badge variant="outline" className="text-[9px] shrink-0">
                {shiftStatusLabel(s.status)}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Haupt-Kalender-Grid ──────────────────────────────────────────────────────

function CalendarGrid({
  calendar,
  onDayClick,
  selectedDay,
}: {
  calendar: WeekCalendar
  onDayClick: (day: CalendarDay) => void
  selectedDay: string | null
}) {
  const operatingHours = Array.from({ length: 15 }, (_, i) => i + 8) // 8–22

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Kopfzeile */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-px mb-0.5">
          <div /> {/* Zeit-Spalte */}
          {calendar.days.map((day) => (
            <button
              key={day.date}
              onClick={() => onDayClick(day)}
              className={`px-2 py-2 rounded-t-lg text-center transition-colors ${
                isToday(day.date)
                  ? 'bg-blue-600/30 border border-blue-500/50'
                  : selectedDay === day.date
                  ? 'bg-zinc-700/60 border border-zinc-500/50'
                  : 'bg-zinc-800/40 border border-zinc-700/30 hover:bg-zinc-700/40'
              }`}
            >
              <div className="text-xs font-semibold text-zinc-200">{day.dayLabel}</div>
              <div className="text-[11px] text-zinc-400">{day.dateLabel}</div>
              {day.gapCount > 0 && (
                <div className="mt-0.5">
                  <span className="inline-flex items-center gap-0.5 text-[9px] text-red-400">
                    <AlertTriangle size={8} /> {day.gapCount}
                  </span>
                </div>
              )}
              {day.totalShifts > 0 && day.gapCount === 0 && (
                <div className="mt-0.5">
                  <span className="inline-flex items-center gap-0.5 text-[9px] text-emerald-400">
                    <CheckCircle2 size={8} /> {day.totalShifts}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Stunden-Zeilen */}
        {operatingHours.map((hour) => (
          <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] gap-px">
            {/* Zeit-Label */}
            <div className="flex items-center justify-end pr-2 py-0.5">
              <span className="text-[11px] text-zinc-500 font-mono">{formatHour(hour)}</span>
            </div>

            {/* Tag-Zellen */}
            {calendar.days.map((day) => {
              const hourData = day.hours[hour]
              const shiftsThisHour = day.shifts.filter(
                (s) => s.startHour <= hour && s.endHour > hour && s.status !== 'cancelled',
              )

              return (
                <div
                  key={day.date}
                  onClick={() => onDayClick(day)}
                  title={hourData ? `${coverageLabel(hourData.coverage)} · ${hourData.scheduledCount} Fahrer` : ''}
                  className={`min-h-[28px] border cursor-pointer transition-colors relative ${
                    selectedDay === day.date ? 'opacity-100' : 'opacity-90 hover:opacity-100'
                  } ${hourData ? coverageBg(hourData.coverage) : 'bg-zinc-800/30 border-zinc-700/20'}`}
                >
                  {/* Schicht-Blöcke */}
                  {shiftsThisHour.map((s, idx) => (
                    <div
                      key={s.id}
                      title={`${s.driverName} · ${shiftStatusLabel(s.status)}`}
                      className={`absolute inset-x-0 mx-0.5 rounded-sm text-[9px] text-white font-medium truncate px-0.5 leading-5 ${shiftStatusColor(s.status)}`}
                      style={{ top: `${idx * 14}px`, zIndex: idx + 1 }}
                    >
                      {s.driverName.split(' ')[0]}
                    </div>
                  ))}

                  {/* Coverage-Dot bei keinen Schichten aber Anforderung */}
                  {shiftsThisHour.length === 0 && hourData && hourData.coverage !== 'off' && (
                    <div className="absolute top-1 right-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${coverageDot(hourData.coverage)}`} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

export function ShiftCalendarClient({ locationId }: { locationId: string }) {
  const [calendar, setCalendar]       = useState<WeekCalendar | null>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [weekStart, setWeekStart]     = useState<string>(currentMonday())
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null)
  const [showModal, setShowModal]     = useState(false)
  const [modalDate, setModalDate]     = useState<string>(new Date().toISOString().slice(0, 10))

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ location_id: locationId, week_start: weekStart })
      const res  = await fetch(`/api/delivery/admin/shift-calendar?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Fehler beim Laden')
      setCalendar(json.calendar)
      // Automatisch heutigen Tag auswählen
      const today = new Date().toISOString().slice(0, 10)
      const todayDay = json.calendar.days.find((d: CalendarDay) => d.date === today)
      if (todayDay) setSelectedDay(todayDay)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setLoading(false)
    }
  }, [locationId, weekStart])

  useEffect(() => { load() }, [load])

  function prevWeek() { setWeekStart((w) => addDays(w, -7)); setSelectedDay(null) }
  function nextWeek() { setWeekStart((w) => addDays(w, 7));  setSelectedDay(null) }
  function goToday()  { setWeekStart(currentMonday()); setSelectedDay(null) }

  function openNewShift(day?: CalendarDay) {
    setModalDate(day?.date ?? new Date().toISOString().slice(0, 10))
    setShowModal(true)
  }

  if (loading && !calendar) {
    return (
      <div className="flex items-center gap-2 text-zinc-400 py-12">
        <RefreshCw size={16} className="animate-spin" />
        <span className="text-sm">Kalender wird geladen…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-red-400 text-sm py-8">{error}</div>
    )
  }

  if (!calendar) return null

  const { summary } = calendar

  return (
    <div className="space-y-6">
      {/* KPI-Streifen */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-zinc-800/50 border-zinc-700 p-3">
          <div className="text-[11px] text-zinc-400 mb-1">Schichten diese Woche</div>
          <div className="text-2xl font-bold text-zinc-100">{summary.totalShifts}</div>
        </Card>
        <Card className="bg-zinc-800/50 border-zinc-700 p-3">
          <div className="text-[11px] text-zinc-400 mb-1">Aktive Fahrer</div>
          <div className="text-2xl font-bold text-zinc-100">{summary.uniqueDrivers}</div>
        </Card>
        <Card className={`border p-3 ${summary.totalGaps > 0 ? 'bg-red-900/20 border-red-700/50' : 'bg-zinc-800/50 border-zinc-700'}`}>
          <div className="text-[11px] text-zinc-400 mb-1">Coverage-Lücken</div>
          <div className={`text-2xl font-bold ${summary.totalGaps > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {summary.totalGaps}
          </div>
        </Card>
        <Card className="bg-zinc-800/50 border-zinc-700 p-3">
          <div className="text-[11px] text-zinc-400 mb-1">Ø Coverage</div>
          <div className={`text-2xl font-bold ${summary.avgCoveragePct >= 80 ? 'text-emerald-400' : summary.avgCoveragePct >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
            {summary.avgCoveragePct}%
          </div>
        </Card>
        <Card className="bg-zinc-800/50 border-zinc-700 p-3">
          <div className="text-[11px] text-zinc-400 mb-1">Peak-Fahrerbedarf</div>
          <div className="text-2xl font-bold text-zinc-100">{summary.peakDriverNeed}</div>
        </Card>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={prevWeek}>
            <ChevronLeft size={16} />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday} className="px-3">
            Heute
          </Button>
          <Button variant="outline" size="icon" onClick={nextWeek}>
            <ChevronRight size={16} />
          </Button>
        </div>

        <div className="flex items-center gap-2 text-sm text-zinc-300">
          <Calendar size={14} className="text-zinc-500" />
          <span>
            {calendar.days[0]?.dateLabel} – {calendar.days[6]?.dateLabel}
          </span>
        </div>

        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button size="sm" onClick={() => openNewShift(selectedDay ?? undefined)}>
            <Plus size={14} className="mr-1" />
            Schicht erstellen
          </Button>
        </div>
      </div>

      {/* Legende */}
      <div className="flex gap-4 flex-wrap text-[11px] text-zinc-400">
        {(['ok', 'low', 'gap', 'over', 'off'] as Coverage[]).map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${coverageDot(c)}`} />
            {coverageLabel(c)}
          </span>
        ))}
      </div>

      {/* Kalender-Grid */}
      <Card className="bg-zinc-900/40 border-zinc-800 p-4">
        <CalendarGrid
          calendar={calendar}
          onDayClick={(day) => setSelectedDay((prev) => prev?.date === day.date ? null : day)}
          selectedDay={selectedDay?.date ?? null}
        />
      </Card>

      {/* Tages-Detail-Panel */}
      {selectedDay && (
        <Card className="bg-zinc-800/40 border-zinc-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                {selectedDay.dayLabel}, {selectedDay.dateLabel}
              </h3>
              <p className="text-xs text-zinc-400">
                {selectedDay.totalShifts} Schicht{selectedDay.totalShifts !== 1 ? 'en' : ''} · {selectedDay.gapCount} Lücke{selectedDay.gapCount !== 1 ? 'n' : ''}
              </p>
            </div>
            <div className="flex gap-2">
              {selectedDay.gapCount > 0 && (
                <Badge variant="outline" className="text-[10px] border-red-500/50 text-red-400">
                  <AlertTriangle size={9} className="mr-1" /> {selectedDay.gapCount} Lücken
                </Badge>
              )}
              <Button size="sm" variant="outline" onClick={() => openNewShift(selectedDay)}>
                <Plus size={12} className="mr-1" />
                Schicht
              </Button>
            </div>
          </div>
          <DayDetail day={selectedDay} />
        </Card>
      )}

      {/* Fahrer-Übersicht */}
      {calendar.drivers.length > 0 && (
        <Card className="bg-zinc-800/40 border-zinc-700 p-4">
          <h3 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
            <Users size={14} className="text-zinc-400" />
            Alle Fahrer ({calendar.drivers.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {calendar.drivers.map((d) => {
              const shiftsThisWeek = calendar.days
                .flatMap((day) => day.shifts)
                .filter((s) => s.driverId === d.id && s.status !== 'cancelled').length
              return (
                <div key={d.id} className="flex items-center gap-2 bg-zinc-700/30 rounded-lg px-2 py-1.5">
                  <Bike size={12} className="text-zinc-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-zinc-200 truncate">{d.name}</div>
                    <div className="text-[10px] text-zinc-500">{d.vehicle} · {shiftsThisWeek} Sch.</div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Modal */}
      {showModal && (
        <NewShiftModal
          drivers={calendar.drivers}
          locationId={locationId}
          defaultDate={modalDate}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}
