'use client'

import { useState, useEffect, useCallback } from 'react'
import { Package, Euro, TrendingUp, Gift, AlertCircle, ChevronDown, ChevronUp, RefreshCw, Check } from 'lucide-react'

interface ZoneFee {
  zone: 'A' | 'B' | 'C' | 'D'
  zone_label: string
  zone_color: string
  min_km: number
  max_km: number
  surcharge_eur: number
  min_order_eur: number
  free_delivery_above_eur: number | null
  eta_min: number
}

interface DeliveryFeePanelProps {
  locationId: string
}

const ZONE_ICONS: Record<string, string> = { A: '🟢', B: '🔵', C: '🟡', D: '🔴' }

export function DeliveryFeePanel({ locationId }: DeliveryFeePanelProps) {
  const [zones, setZones] = useState<ZoneFee[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [edits, setEdits] = useState<Record<string, Partial<ZoneFee>>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/delivery/admin/fee-config?location_id=${locationId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Fehler')
      setZones(json.zones ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [locationId])

  useEffect(() => { load() }, [load])

  function setEdit(zone: string, field: keyof ZoneFee, value: string) {
    setEdits((prev) => ({
      ...prev,
      [zone]: { ...prev[zone], [field]: value === '' ? null : Number(value) },
    }))
  }

  async function saveZone(zone: ZoneFee) {
    const patch = edits[zone.zone]
    if (!patch || Object.keys(patch).length === 0) return
    setSaving(zone.zone)
    setError(null)
    try {
      const res = await fetch('/api/delivery/admin/fee-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: locationId,
          zone: zone.zone,
          ...patch,
          free_delivery_above_eur: 'free_delivery_above_eur' in patch
            ? (patch.free_delivery_above_eur ?? null)
            : zone.free_delivery_above_eur,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Fehler')
      setEdits((prev) => { const next = { ...prev }; delete next[zone.zone]; return next })
      setSaved(zone.zone)
      setTimeout(() => setSaved(null), 2000)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(null)
    }
  }

  function getVal(zone: ZoneFee, field: keyof ZoneFee): string {
    const edit = edits[zone.zone]
    if (edit && field in edit) {
      const v = edit[field as keyof typeof edit]
      return v == null ? '' : String(v)
    }
    const v = zone[field]
    return v == null ? '' : String(v)
  }

  const totalFreeDeliveryZones = zones.filter((z) => z.free_delivery_above_eur != null).length
  const avgFee = zones.length > 0
    ? (zones.reduce((s, z) => s + z.surcharge_eur, 0) / zones.length).toFixed(2)
    : '–'

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-lg">
            <Euro className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900">Liefergebühren</p>
            <p className="text-xs text-gray-500">
              {loading ? 'Lade…' : `${zones.length} Zonen · Ø ${avgFee} € · ${totalFreeDeliveryZones} mit Kostenlos-Schwelle`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); load() }}
            className="p-1 text-gray-400 hover:text-gray-700 rounded"
            title="Neu laden"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          {expanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
        </div>
      </button>

      {!expanded && (
        /* Collapsed: mini zone badges */
        <div className="px-5 pb-4 flex gap-2 flex-wrap">
          {zones.map((z) => (
            <span
              key={z.zone}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
              style={{ backgroundColor: z.zone_color + '22', color: z.zone_color }}
            >
              {ZONE_ICONS[z.zone]} Zone {z.zone} · {z.surcharge_eur === 0 ? 'Gratis' : `${z.surcharge_eur.toFixed(2)} €`}
              {z.free_delivery_above_eur != null && (
                <span className="text-gray-400">(ab {z.free_delivery_above_eur} €)</span>
              )}
            </span>
          ))}
        </div>
      )}

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-sm text-gray-500 py-4 text-center">Lade Zonen…</div>
          ) : zones.length === 0 ? (
            <div className="text-sm text-gray-500 py-4 text-center">
              Keine Zonen konfiguriert. Bitte Zonen unter &quot;Liefergebiet&quot; einrichten.
            </div>
          ) : (
            <div className="space-y-3">
              {/* Column headers */}
              <div className="grid grid-cols-5 gap-2 text-xs font-medium text-gray-500 px-1">
                <span>Zone</span>
                <span>Liefergebühr (€)</span>
                <span>Mindestbestellung (€)</span>
                <span>Kostenlos ab (€)</span>
                <span></span>
              </div>

              {zones.map((zone) => {
                const isDirty = !!edits[zone.zone] && Object.keys(edits[zone.zone]).length > 0
                const isSaving = saving === zone.zone
                const isSaved = saved === zone.zone

                return (
                  <div
                    key={zone.zone}
                    className="grid grid-cols-5 gap-2 items-center p-3 rounded-lg border border-gray-100 bg-gray-50"
                  >
                    {/* Zone badge */}
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: zone.zone_color }}
                      >
                        {zone.zone}
                      </span>
                      <div>
                        <p className="text-xs font-medium text-gray-800">{zone.zone_label}</p>
                        <p className="text-xs text-gray-400">{zone.min_km}–{zone.max_km === 999 ? '∞' : zone.max_km} km</p>
                      </div>
                    </div>

                    {/* surcharge_eur */}
                    <div>
                      <input
                        type="number"
                        min="0"
                        step="0.50"
                        value={getVal(zone, 'surcharge_eur')}
                        onChange={(e) => setEdit(zone.zone, 'surcharge_eur', e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-emerald-500"
                        placeholder="0.00"
                      />
                    </div>

                    {/* min_order_eur */}
                    <div>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={getVal(zone, 'min_order_eur')}
                        onChange={(e) => setEdit(zone.zone, 'min_order_eur', e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-emerald-500"
                        placeholder="0"
                      />
                    </div>

                    {/* free_delivery_above_eur */}
                    <div>
                      <input
                        type="number"
                        min="0"
                        step="5"
                        value={getVal(zone, 'free_delivery_above_eur')}
                        onChange={(e) => setEdit(zone.zone, 'free_delivery_above_eur', e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-emerald-500"
                        placeholder="—"
                      />
                    </div>

                    {/* Speichern */}
                    <div className="flex justify-end">
                      {isSaved ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-600">
                          <Check className="h-4 w-4" /> Gespeichert
                        </span>
                      ) : (
                        <button
                          onClick={() => saveZone(zone)}
                          disabled={!isDirty || isSaving}
                          className="px-3 py-1 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {isSaving ? '…' : 'Speichern'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Hinweis */}
              <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                <Gift className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  <strong>Kostenlos ab:</strong> Wenn der Bestellwert diese Schwelle erreicht, entfällt die Liefergebühr automatisch.
                  Leer lassen = kein kostenloses Liefern für diese Zone.
                  Surge-Preise werden bei Stoßzeiten zusätzlich aufgeschlagen.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
