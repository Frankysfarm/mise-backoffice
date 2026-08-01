"use client"

import { useEffect, useMemo, useState } from "react"

type Scenario = { id: string; suite: string; risk: string; title: string }

export function TestLabDashboard() {
  const [catalog, setCatalog] = useState<Scenario[]>([])
  const [suite, setSuite] = useState("all")
  const [seed, setSeed] = useState("1")
  const [headed, setHeaded] = useState(false)
  const [message, setMessage] = useState("Kein Lauf gestartet")
  useEffect(() => { fetch("/api/test-lab/scenarios").then((response) => response.ok ? response.json() : Promise.reject()).then((data) => setCatalog(data.scenarios ?? [])).catch(() => setMessage("Testlabor ist nicht verfügbar")) }, [])
  const visible = useMemo(() => suite === "all" ? catalog : catalog.filter((item) => item.suite === suite), [catalog, suite])
  const suites = [...new Set(catalog.map((item) => item.suite))]
  return <main className="min-h-screen bg-slate-950 p-8 text-slate-100">
    <div className="mx-auto max-w-6xl space-y-6">
      <header><p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400">Isolierte Umgebung</p><h1 className="text-3xl font-semibold">Driver System Testlabor</h1><p className="text-slate-400">Produktion kann hier nicht ausgewählt werden.</p></header>
      <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 md:grid-cols-4">
        <label>Suite<select data-testid="lab-suite" className="mt-2 w-full rounded bg-slate-800 p-2" value={suite} onChange={(event) => setSuite(event.target.value)}><option value="all">Alle</option>{suites.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Seed<input data-testid="lab-seed" className="mt-2 w-full rounded bg-slate-800 p-2" inputMode="numeric" value={seed} onChange={(event) => setSeed(event.target.value)} /></label>
        <label className="flex items-center gap-2 pt-7"><input data-testid="lab-headed" type="checkbox" checked={headed} onChange={(event) => setHeaded(event.target.checked)} /> Sichtbarer Browser</label>
        <button data-testid="lab-preview" className="rounded bg-emerald-500 px-4 py-2 font-semibold text-slate-950" onClick={() => setMessage(`${visible.length} Szenarien, Seed ${seed}, ${headed ? "headed" : "headless"}. Start erfolgt sicher über dieselbe CLI.`)}>Vorschau</button>
      </section>
      <section aria-live="polite" className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h2 className="font-semibold">Laufstatus</h2><p className="text-slate-300">{message}</p></section>
      <section className="grid gap-3 md:grid-cols-2">{visible.map((item) => <article key={item.id} className="rounded-xl border border-slate-800 p-4"><div className="flex justify-between"><strong>{item.title}</strong><span className="text-amber-300">{item.risk}</span></div><code className="text-xs text-slate-400">{item.id}</code></article>)}</section>
    </div>
  </main>
}
