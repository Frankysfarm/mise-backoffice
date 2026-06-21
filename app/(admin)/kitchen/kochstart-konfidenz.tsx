'use client'

import { useEffect, useState, useCallback } from 'react'
import { Zap, ChevronDown, ChevronUp, Loader2, Truck, Clock } from 'lucide-react'

interface OpsData {
  queue: { bereit: number; zubereitung: number; neu: number }
  drivers: { idle: number; active: number; online: number }
  throughput: { perHourRate: number } | null
  delays: { active: number } | null
}

type KonfidenzLevel = 'jetzt_kochen' | 'kurz_warten' | 'nicht_kochen'

function computeKonfidenz(data: OpsData): {
  level: KonfidenzLevel
  score: number
  reasoning: string[]
} {
  const idleDrivers = data.drivers.idle
  const activeDrivers = data.drivers.active
  const waitingReady = data.queue.bereit
  const inPrep = data.queue.zubereitung
  const reasons: string[] = []
  let score = 100

  // Fahrer-Verfügbarkeit ist wichtigster Faktor
  if (idleDrivers === 0 && activeDrivers === 0) {
    score -= 60
    reasons.push('Kein freier Fahrer verfügbar')
  } else if (idleDrivers === 0) {
    score -= 25
    reasons.push('Fahrer alle im Einsatz')
  } else {
    reasons.push(`${idleDrivers} Fahrer bereit`)
  }

  // Bereits fertige Bestellungen warten?
  if (waitingReady >= 3) {
    score -= 20
    reasons.push(`${waitingReady} Bestellungen warten auf Abholung`)
  } else if (waitingReady >= 1) {
    score -= 8
    reasons.push(`${waitingReady} Bestellung warten`)
  }

  // Viele in Zubereitung = Küche ausgelastet
  if (inPrep >= 5) {
    score -= 15
    reasons.push('Küche stark ausgelastet')
  } else if (inPrep >= 3) {
    score -= 5
    reasons.push(`${inPrep} Bestellungen in Zubereitung`)
  }

  const level: KonfidenzLevel =
    score >= 75 ? 'jetzt_kochen' : score >= 45 ? 'kurz_warten' : 'nicht_kochen'

  return { level, score: Math.max(0, Math.min(100, score)), reasoning: reasons }
}

const LEVEL_META: Record<KonfidenzLevel, {
  label: string; sub: string; bg: string; ring: string; text: string; barColor: string
}> = {
  jetzt_kochen: {
    label: 'Jetzt kochen',
    sub: 'Fahrer verfügbar – sofort starten',
    bg: 'bg-emerald-50',
    ring: 'ring-emerald-300',
    text: 'text-emerald-700',
    barColor: 'bg-emerald-500',
  },
  kurz_warten: {
    label: 'Kurz warten',
    sub: 'Kapazität begrenzt – Timing prüfen',
    bg: 'bg-amber-50',
    ring: 'ring-amber-300',
    text: 'text-amber-700',
    barColor: 'bg-amber-500',
  },
  nicht_kochen: {
    label: 'Nicht kochen',
    sub: 'Fahrer nicht verfügbar – Warmhalte-Risiko',
    bg: 'bg-red-50',
    ring: 'ring-red-300',
    text: 'text-red-700',
    barColor: 'bg-red-500',
  },
}

export function KochstartKonfidenzAnzeige({ locationId }: { locationId: string | null | undefined }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<OpsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!locationId || !open) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/delivery/admin/ops-snapshot?location_id=${locationId}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as OpsData & { ok?: boolean }
      setData(json)
    } catch {
      setError('Konfidenz-Daten nicht verfügbar.')
    } finally {
      setLoading(false)
    }
  }, [locationId, open])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!open || !locationId) return
    const id = setInterval(() => { void load() }, 45_000)
    return () => clearInterval(id)
  }, [open, locationId, load])

  if (!locationId) return null

  const result = data ? computeKonfidenz(data) : null
  const meta = result ? LEVEL_META[result.level] : null

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Zap className={`h-4 w-4 ${result ? meta!.text : 'text-muted-foreground'}`} />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Kochstart-Konfidenz</span>
          {result && meta && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${meta.bg} ${meta.text} ${meta.ring}`}>
              {meta.label} · {result.score}%
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-5 py-4 space-y-4">
          {loading && !data && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lade Fahrer-Status…
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}

          {result && meta && data && (
            <>
              {/* Haupt-Anzeige */}
              <div className={`flex items-center gap-4 rounded-xl p-4 ring-1 ${meta.bg} ${meta.ring}`}>
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl font-black text-2xl ${meta.text}`}>
                  {result.score}
                </div>
                <div>
                  <div className={`text-base font-bold ${meta.text}`}>{meta.label}</div>
                  <div className="text-xs text-muted-foreground">{meta.sub}</div>
                </div>
              </div>

              {/* Konfidenz-Balken */}
              <div>
                <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>Konfidenz-Score</span>
                  <span className="font-bold">{result.score} / 100</span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${meta.barColor}`}
                    style={{ width: `${result.score}%` }}
                  />
                </div>
              </div>

              {/* Faktoren */}
              <div className="space-y-1.5">
                {result.reasoning.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${meta.barColor}`} />
                    {r}
                  </div>
                ))}
              </div>

              {/* Fahrer-Quick-View */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-muted/50 p-2 text-center">
                  <div className="text-[10px] text-muted-foreground">Frei</div>
                  <div className="text-lg font-black text-emerald-600">{data.drivers.idle}</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-2 text-center">
                  <div className="text-[10px] text-muted-foreground">Aktiv</div>
                  <div className="text-lg font-black text-amber-600">{data.drivers.active}</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-2 text-center">
                  <div className="text-[10px] text-muted-foreground">Fertig/Warten</div>
                  <div className="text-lg font-black text-blue-600">{data.queue.bereit}</div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
