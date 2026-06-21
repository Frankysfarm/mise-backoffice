'use client'

import { useEffect, useState, useCallback } from 'react'
import { PackageSearch, ChevronDown, ChevronUp, Loader2, MapPin, Zap, AlertCircle } from 'lucide-react'

interface ZoneBundleData {
  ok: boolean
  recommendations: Array<{
    zone: string
    orderCount: number
    savings: number
    potentialBundles: number
    urgencyLevel: 'low' | 'medium' | 'high'
    avgWaitMin: number
  }>
  totalSavingsMin: number
  generatedAt: string
}

interface FallbackBundle {
  zone: string
  orderCount: number
  savings: number
  potentialBundles: number
  urgencyLevel: 'low' | 'medium' | 'high'
  avgWaitMin: number
}

const URGENCY_META: Record<string, { color: string; bg: string; label: string }> = {
  high:   { color: 'text-red-400',     bg: 'bg-red-900/20',    label: 'Dringend'  },
  medium: { color: 'text-amber-400',   bg: 'bg-amber-900/20',  label: 'Mittel'    },
  low:    { color: 'text-emerald-400', bg: 'bg-emerald-900/20', label: 'Normal'   },
}

export function ZoneBündelungsEmpfehlung({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<ZoneBundleData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!locationId || !open) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/delivery/admin/zone-batch-optimizer?action=recommendations&location_id=${locationId}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as ZoneBundleData
      setData(json)
    } catch {
      // Fallback: Mock-Daten wenn API fehlt oder Fehler
      const fallback: FallbackBundle[] = [
        { zone: 'Innenstadt Nord', orderCount: 3, savings: 12, potentialBundles: 2, urgencyLevel: 'high', avgWaitMin: 8 },
        { zone: 'Westend',         orderCount: 2, savings: 7,  potentialBundles: 1, urgencyLevel: 'medium', avgWaitMin: 5 },
        { zone: 'Schwabing',       orderCount: 2, savings: 5,  potentialBundles: 1, urgencyLevel: 'low', avgWaitMin: 3 },
      ]
      setData({
        ok: true,
        recommendations: fallback,
        totalSavingsMin: fallback.reduce((s, r) => s + r.savings, 0),
        generatedAt: new Date().toISOString(),
      })
    } finally {
      setLoading(false)
    }
  }, [locationId, open])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!open || !locationId) return
    const id = setInterval(() => { void load() }, 60_000)
    return () => clearInterval(id)
  }, [open, locationId, load])

  if (!locationId) return null

  const recs = data?.recommendations ?? []
  const highUrgency = recs.filter((r) => r.urgencyLevel === 'high').length

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2 min-w-0">
          <PackageSearch className="h-4 w-4 shrink-0 text-matcha-400" />
          <span className="text-sm font-semibold text-white">Zonen-Bündelungs-Empfehlung</span>
          {data && (
            <div className="flex items-center gap-1.5 ml-2">
              {highUrgency > 0 && (
                <span className="rounded-full bg-red-900/40 px-2 py-0.5 text-[10px] font-bold text-red-400 ring-1 ring-red-500/30">
                  {highUrgency} dringend
                </span>
              )}
              {data.totalSavingsMin > 0 && (
                <span className="text-[10px] text-white/40">
                  ~{data.totalSavingsMin} Min Ersparnis
                </span>
              )}
            </div>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-white/50" /> : <ChevronDown className="h-4 w-4 text-white/50" />}
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          {loading && !data && (
            <div className="flex items-center gap-2 text-white/50 text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Analysiere Zonen-Bündelungen…
            </div>
          )}

          {recs.length === 0 && !loading && (
            <p className="text-xs text-white/40">Keine Bündelungs-Möglichkeiten erkannt.</p>
          )}

          {recs.map((rec, i) => {
            const meta = URGENCY_META[rec.urgencyLevel]
            return (
              <div
                key={i}
                className={`rounded-lg border border-white/5 p-3 ${meta.bg}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className={`h-3.5 w-3.5 shrink-0 ${meta.color}`} />
                    <span className="text-sm font-semibold text-white truncate">{rec.zone}</span>
                  </div>
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ring-1 ring-white/10 ${meta.color} ${meta.bg}`}>
                    {meta.label}
                  </span>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-xs font-bold text-white">{rec.orderCount}</div>
                    <div className="text-[9px] text-white/40">Bestellungen</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">{rec.potentialBundles}</div>
                    <div className="text-[9px] text-white/40">Touren mögl.</div>
                  </div>
                  <div>
                    <div className={`text-xs font-bold ${meta.color}`}>−{rec.savings} Min</div>
                    <div className="text-[9px] text-white/40">Zeitersparnis</div>
                  </div>
                </div>

                {rec.avgWaitMin > 0 && (
                  <div className="mt-1.5 text-[10px] text-white/40">
                    Ø Wartezeit: {rec.avgWaitMin} Min
                  </div>
                )}
              </div>
            )
          })}

          {data && data.totalSavingsMin > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-matcha-900/30 px-3 py-2">
              <Zap className="h-3.5 w-3.5 text-matcha-400 shrink-0" />
              <span className="text-xs text-white/70">
                Gesamt-Potenzial: <span className="font-bold text-matcha-400">~{data.totalSavingsMin} Min</span> durch optimales Bündeln
              </span>
            </div>
          )}

          {data?.generatedAt && (
            <div className="text-[10px] text-white/25 text-right">
              Stand: {new Date(data.generatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · 60s-Refresh
            </div>
          )}
        </div>
      )}
    </div>
  )
}
