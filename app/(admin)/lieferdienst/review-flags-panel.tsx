'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Flag, AlertTriangle, CheckCircle2, XCircle, Clock, Star, User, ChevronDown, ChevronUp, Plus } from 'lucide-react'

interface ReviewFlagWithDriver {
  id: string
  locationId: string
  driverId: string
  flagReason: 'low_avg_14d' | 'one_star_burst_7d' | 'manual'
  badRatingCount: number
  avgRatingWindow: number | null
  windowDays: number
  reviewStatus: 'open' | 'in_review' | 'resolved' | 'dismissed'
  adminNotes: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
  driverName: string
  driverVehicle: string
  driverState: string
  daysOpen: number
}

interface FlagStats {
  locationId: string
  openCount: number
  inReviewCount: number
  resolved30d: number
  dismissed30d: number
  new7d: number
  avgFlaggedRating: number | null
}

interface ReviewData {
  flags: ReviewFlagWithDriver[]
  stats: FlagStats
}

interface Driver {
  id: string
  employee_id: string
  vehicle: string
}

const REASON_LABEL: Record<string, string> = {
  low_avg_14d: 'Ø < 3★ (14 Tage)',
  one_star_burst_7d: '≥ 2× 1★ (7 Tage)',
  manual: 'Manuell',
}

const REASON_COLOR: Record<string, string> = {
  low_avg_14d: 'bg-amber-100 text-amber-800',
  one_star_burst_7d: 'bg-red-100 text-red-800',
  manual: 'bg-blue-100 text-blue-800',
}

const STATUS_COLOR: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  in_review: 'bg-amber-100 text-amber-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  dismissed: 'bg-stone-100 text-stone-600',
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Offen',
  in_review: 'In Prüfung',
  resolved: 'Gelöst',
  dismissed: 'Verworfen',
}

function StatCard({ label, value, sub, urgent }: {
  label: string
  value: number | string
  sub?: string
  urgent?: boolean
}) {
  return (
    <div className={`rounded-xl border p-4 ${urgent ? 'border-red-200 bg-red-50' : 'border-stone-200 bg-white'}`}>
      <p className="text-xs font-medium text-stone-500 mb-1">{label}</p>
      <p className={`text-2xl font-black tabular-nums ${urgent ? 'text-red-700' : 'text-stone-900'}`}>{value}</p>
      {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function FlagRow({
  flag,
  onUpdate,
  locationId,
}: {
  flag: ReviewFlagWithDriver
  onUpdate: () => void
  locationId: string
}) {
  const [expanded, setExpanded] = useState(false)
  const [notes, setNotes] = useState(flag.adminNotes ?? '')
  const [saving, setSaving] = useState(false)

  const updateStatus = async (status: string) => {
    setSaving(true)
    try {
      await fetch(`/api/delivery/reviews/${flag.id}?location_id=${locationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_notes: notes || undefined }),
      })
      onUpdate()
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-stone-200 rounded-xl overflow-hidden bg-white">
      <button
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-stone-50 transition"
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Driver info */}
        <div className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-stone-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-stone-900 truncate">{flag.driverName || flag.driverId.slice(0, 8)}</p>
          <p className="text-xs text-stone-500">{flag.driverVehicle || '—'}</p>
        </div>

        {/* Reason badge */}
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${REASON_COLOR[flag.flagReason]}`}>
          {REASON_LABEL[flag.flagReason]}
        </span>

        {/* Status badge */}
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLOR[flag.reviewStatus]}`}>
          {STATUS_LABEL[flag.reviewStatus]}
        </span>

        {/* Days open */}
        <div className="flex items-center gap-1 text-xs text-stone-500 flex-shrink-0 min-w-[54px] justify-end">
          <Clock className="w-3 h-3" />
          <span>{flag.daysOpen}d</span>
        </div>

        {/* Avg rating */}
        {flag.avgRatingWindow !== null && (
          <div className="flex items-center gap-0.5 text-xs font-bold flex-shrink-0 text-amber-600 min-w-[36px] justify-end">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            {flag.avgRatingWindow.toFixed(1)}
          </div>
        )}

        {expanded ? <ChevronUp className="w-4 h-4 text-stone-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-stone-400 flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-stone-100 p-4 space-y-4 bg-stone-50">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-stone-400">Schlechte Ratings</p>
              <p className="font-bold text-stone-800">{flag.badRatingCount}</p>
            </div>
            <div>
              <p className="text-xs text-stone-400">Zeitfenster</p>
              <p className="font-bold text-stone-800">{flag.windowDays} Tage</p>
            </div>
            <div>
              <p className="text-xs text-stone-400">Fahrer-Status</p>
              <p className="font-bold text-stone-800">{flag.driverState || '—'}</p>
            </div>
          </div>

          <div>
            <label className="text-xs text-stone-500 mb-1 block">Admin-Notiz</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Kommentar hinzufügen…"
              className="w-full text-sm border border-stone-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-saffron/40 bg-white"
              rows={2}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {flag.reviewStatus !== 'in_review' && (
              <button
                onClick={() => updateStatus('in_review')}
                disabled={saving}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 disabled:opacity-50 transition"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                In Prüfung nehmen
              </button>
            )}
            {flag.reviewStatus !== 'resolved' && (
              <button
                onClick={() => updateStatus('resolved')}
                disabled={saving}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200 disabled:opacity-50 transition"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Als gelöst markieren
              </button>
            )}
            {flag.reviewStatus !== 'dismissed' && (
              <button
                onClick={() => updateStatus('dismissed')}
                disabled={saving}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-200 disabled:opacity-50 transition"
              >
                <XCircle className="w-3.5 h-3.5" />
                Verwerfen
              </button>
            )}
          </div>

          <p className="text-[10px] text-stone-400">Erstellt: {new Date(flag.createdAt).toLocaleString('de')}</p>
        </div>
      )}
    </div>
  )
}

function ManualFlagForm({ locationId, onCreated }: { locationId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [driverId, setDriverId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    fetch(`/api/delivery/admin/drivers?location_id=${locationId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.drivers) setDrivers(d.drivers as Driver[]) })
      .catch(() => {})
  }, [open, locationId])

  const submit = async () => {
    if (!driverId) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/delivery/reviews?location_id=${locationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId, admin_notes: notes || undefined }),
      })
      if (res.status === 409) {
        setError('Fahrer hat bereits einen offenen Review-Flag.')
      } else if (!res.ok) {
        const d = await res.json()
        setError((d as { error?: string }).error ?? 'Fehler')
      } else {
        setOpen(false)
        setDriverId('')
        setNotes('')
        onCreated()
      }
    } catch {
      setError('Netzwerkfehler')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl bg-saffron text-white hover:bg-saffron/90 transition"
        >
          <Plus className="w-4 h-4" />
          Manuell flaggen
        </button>
      ) : (
        <div className="border border-stone-200 rounded-xl p-4 bg-white space-y-3">
          <p className="text-sm font-semibold text-stone-800">Manuellen Review-Flag anlegen</p>

          <select
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            className="w-full text-sm border border-stone-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-saffron/40"
          >
            <option value="">Fahrer auswählen…</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.employee_id} — {d.vehicle}</option>
            ))}
          </select>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Grund / Notiz…"
            className="w-full text-sm border border-stone-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-saffron/40"
            rows={2}
          />

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={saving || !driverId}
              className="flex-1 text-sm font-semibold py-2 rounded-lg bg-saffron text-white hover:bg-saffron/90 disabled:opacity-50 transition"
            >
              {saving ? 'Speichern…' : 'Flag anlegen'}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-4 text-sm font-semibold py-2 rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-200 transition"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function ReviewFlagsPanel({ locationId }: { locationId: string }) {
  const [data, setData] = useState<ReviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [reasonFilter, setReasonFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('open_inreview')

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/delivery/reviews?location_id=${locationId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setData(d as ReviewData) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [locationId])

  useEffect(() => { load() }, [load])

  const stats = data?.stats
  const allFlags = data?.flags ?? []

  const filteredFlags = allFlags.filter((f) => {
    const reasonOk = reasonFilter === 'all' || f.flagReason === reasonFilter
    const statusOk =
      statusFilter === 'all' ||
      (statusFilter === 'open_inreview' && (f.reviewStatus === 'open' || f.reviewStatus === 'in_review')) ||
      f.reviewStatus === statusFilter
    return reasonOk && statusOk
  })

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
            <Flag className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-stone-900">Fahrer-Reviews</h2>
            <p className="text-xs text-stone-500">Automatische & manuelle Review-Flags</p>
          </div>
        </div>
        <ManualFlagForm locationId={locationId} onCreated={load} />
      </div>

      {/* KPI Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            label="Offen"
            value={stats.openCount}
            urgent={stats.openCount > 0}
          />
          <StatCard
            label="In Prüfung"
            value={stats.inReviewCount}
            urgent={stats.inReviewCount > 0}
          />
          <StatCard
            label="Neu (7 Tage)"
            value={stats.new7d}
          />
          <StatCard
            label="Gelöst (30 Tage)"
            value={stats.resolved30d}
          />
          <StatCard
            label="Verworfen (30d)"
            value={stats.dismissed30d}
          />
          <StatCard
            label="⌀ Rating (geflaggt)"
            value={stats.avgFlaggedRating !== null ? stats.avgFlaggedRating.toFixed(1) + '★' : '—'}
            urgent={stats.avgFlaggedRating !== null && stats.avgFlaggedRating < 2.5}
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-1">
          {(['open_inreview', 'open', 'in_review', 'resolved', 'dismissed', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs font-semibold px-2.5 py-1 rounded-md transition ${statusFilter === s ? 'bg-white shadow text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
            >
              {s === 'open_inreview' ? 'Offen + Prüfung' : STATUS_LABEL[s] ?? 'Alle'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-1">
          {(['all', 'low_avg_14d', 'one_star_burst_7d', 'manual'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setReasonFilter(r)}
              className={`text-xs font-semibold px-2.5 py-1 rounded-md transition ${reasonFilter === r ? 'bg-white shadow text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
            >
              {r === 'all' ? 'Alle Gründe' : REASON_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Flags list */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-stone-400 text-sm">Lade…</div>
      ) : filteredFlags.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-stone-400">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          <p className="text-sm">Keine Flags gefunden</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-stone-400">{filteredFlags.length} Flag{filteredFlags.length !== 1 ? 's' : ''}</p>
          {filteredFlags.map((flag) => (
            <FlagRow
              key={flag.id}
              flag={flag}
              locationId={locationId}
              onUpdate={load}
            />
          ))}
        </div>
      )}
    </div>
  )
}
