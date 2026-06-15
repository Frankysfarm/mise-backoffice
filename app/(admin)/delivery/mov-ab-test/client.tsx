'use client';

import { useState, useEffect, useCallback } from 'react';
import type { MovAbDashboard, MovAbTest, MovAbMetrics } from '@/lib/delivery/mov-ab-test';
import { MovAbMetricsChart } from './metrics-chart';

interface Props { locationId: string; }

type Tab = 'overview' | 'tests' | 'create';

const ZONE_LABELS: Record<string, string> = { A: 'Zone A (< 3 km)', B: 'Zone B (3–6 km)', C: 'Zone C (6–10 km)', D: 'Zone D (> 10 km)' };

export function MovAbTestClient({ locationId }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [dashboard, setDashboard] = useState<MovAbDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Create form
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formHourFrom, setFormHourFrom] = useState('');
  const [formHourTo, setFormHourTo] = useState('');
  const [formZones, setFormZones] = useState<string[]>([]);
  const [formVariants, setFormVariants] = useState([
    { name: 'Kontrolle', isControl: true,  movA: '', movB: '15', movC: '20', movD: '30', alloc: 50 },
    { name: 'Variante A', isControl: false, movA: '', movB: '12', movC: '17', movD: '25', alloc: 50 },
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/mov-ab-test?action=dashboard`);
      if (res.ok) setDashboard(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleStatusChange(testId: string, status: string) {
    await fetch('/api/delivery/admin/mov-ab-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'status', testId, status }),
    });
    load();
  }

  async function handleDelete(testId: string) {
    if (!confirm('Entwurf löschen?')) return;
    await fetch('/api/delivery/admin/mov-ab-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', testId }),
    });
    load();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const totalAlloc = formVariants.reduce((s, v) => s + v.alloc, 0);
      if (totalAlloc !== 100) { alert('Allokation muss 100% ergeben'); return; }
      const body = {
        action: 'create',
        name: formName,
        description: formDesc || undefined,
        zoneFilter: formZones.length ? formZones : undefined,
        hourFrom: formHourFrom ? Number(formHourFrom) : undefined,
        hourTo:   formHourTo   ? Number(formHourTo)   : undefined,
        variants: formVariants.map((v) => ({
          name: v.name,
          isControl: v.isControl,
          movZoneAEur: v.movA ? Number(v.movA) : undefined,
          movZoneBEur: v.movB ? Number(v.movB) : undefined,
          movZoneCEur: v.movC ? Number(v.movC) : undefined,
          movZoneDEur: v.movD ? Number(v.movD) : undefined,
          allocationPct: v.alloc,
        })),
      };
      const res = await fetch('/api/delivery/admin/mov-ab-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) { setTab('tests'); load(); }
      else alert(await res.text());
    } finally { setCreating(false); }
  }

  const statusBadge = (s: string) => {
    const cls: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-600',
      active: 'bg-green-100 text-green-700',
      paused: 'bg-yellow-100 text-yellow-700',
      completed: 'bg-blue-100 text-blue-600',
    };
    const label: Record<string, string> = { draft: 'Entwurf', active: 'Aktiv', paused: 'Pausiert', completed: 'Abgeschlossen' };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls[s] ?? ''}`}>{label[s] ?? s}</span>;
  };

  function getMetricsForTest(testId: string): MovAbMetrics[] {
    return (dashboard?.metrics ?? []).filter((m) => m.testId === testId);
  }

  return (
    <div className="p-4 space-y-4">
      {/* KPI Cards */}
      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Aktive Tests', value: dashboard.activeTests, color: 'text-green-600' },
            { label: 'Tests gesamt', value: dashboard.totalTests, color: 'text-blue-600' },
            { label: 'Events gesamt', value: dashboard.totalEvents.toLocaleString('de'), color: 'text-purple-600' },
            { label: 'Umsatz (Tests)', value: `€${dashboard.totalRevenue.toFixed(2)}`, color: 'text-orange-600' },
          ].map((k) => (
            <div key={k.label} className="bg-white rounded-xl p-4 shadow-sm border">
              <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {(['overview', 'tests', 'create'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {{ overview: 'Übersicht', tests: 'Tests', create: '+ Neuer Test' }[t]}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && <div className="text-center py-10 text-gray-400">Lädt …</div>}

      {/* Overview Tab */}
      {!loading && tab === 'overview' && (
        <div className="space-y-4">
          {(!dashboard?.tests?.length) ? (
            <div className="bg-white rounded-xl p-8 text-center text-gray-400 shadow-sm border">
              Noch keine A/B-Tests angelegt. Klicke auf &quot;+ Neuer Test&quot;.
            </div>
          ) : dashboard.tests.filter((t) => t.status === 'active').map((test) => (
            <div key={test.id} className="space-y-3">
              <MetricsCard test={test} metrics={getMetricsForTest(test.id)} onStatusChange={handleStatusChange} />
              <MovAbMetricsChart testName={test.name} metrics={getMetricsForTest(test.id)} />
            </div>
          ))}
        </div>
      )}

      {/* Tests Tab */}
      {!loading && tab === 'tests' && (
        <div className="space-y-3">
          {(!dashboard?.tests?.length) ? (
            <div className="bg-white rounded-xl p-8 text-center text-gray-400 shadow-sm border">Noch keine Tests vorhanden.</div>
          ) : dashboard.tests.map((test) => (
            <div key={test.id} className="bg-white rounded-xl p-4 shadow-sm border">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-semibold text-gray-800">{test.name}</span>
                  <span className="ml-2">{statusBadge(test.status)}</span>
                </div>
                <div className="flex gap-2">
                  {test.status === 'draft' && (
                    <>
                      <button onClick={() => handleStatusChange(test.id, 'active')} className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">Aktivieren</button>
                      <button onClick={() => handleDelete(test.id)} className="text-xs bg-red-100 text-red-600 px-3 py-1 rounded hover:bg-red-200">Löschen</button>
                    </>
                  )}
                  {test.status === 'active' && (
                    <>
                      <button onClick={() => handleStatusChange(test.id, 'paused')} className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded hover:bg-yellow-200">Pausieren</button>
                      <button onClick={() => handleStatusChange(test.id, 'completed')} className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200">Abschließen</button>
                    </>
                  )}
                  {test.status === 'paused' && (
                    <button onClick={() => handleStatusChange(test.id, 'active')} className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200">Fortsetzen</button>
                  )}
                </div>
              </div>
              {test.description && <p className="text-sm text-gray-500 mb-2">{test.description}</p>}
              <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                {test.zoneFilter && <span className="bg-gray-100 px-2 py-0.5 rounded">Zonen: {test.zoneFilter.join(', ')}</span>}
                {test.hourFrom != null && <span className="bg-gray-100 px-2 py-0.5 rounded">Uhrzeit: {test.hourFrom}–{test.hourTo} Uhr</span>}
                <span className="bg-gray-100 px-2 py-0.5 rounded">{test.variants.length} Varianten</span>
              </div>
              <MetricsCard test={test} metrics={getMetricsForTest(test.id)} onStatusChange={handleStatusChange} mini />
            </div>
          ))}
        </div>
      )}

      {/* Create Tab */}
      {tab === 'create' && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl p-5 shadow-sm border space-y-4">
          <h3 className="font-semibold text-gray-800">Neuen A/B-Test anlegen</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600">Name *</label>
              <input required value={formName} onChange={(e) => setFormName(e.target.value)}
                className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" placeholder="z.B. Zone B MOV Test" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Beschreibung</label>
              <input value={formDesc} onChange={(e) => setFormDesc(e.target.value)}
                className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" placeholder="Optional" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">Zonen-Filter (leer = alle)</label>
            <div className="flex gap-3 mt-1">
              {['A', 'B', 'C', 'D'].map((z) => (
                <label key={z} className="flex items-center gap-1 text-sm cursor-pointer">
                  <input type="checkbox" checked={formZones.includes(z)}
                    onChange={(e) => setFormZones(e.target.checked ? [...formZones, z] : formZones.filter((x) => x !== z))} />
                  {ZONE_LABELS[z]}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600">Uhrzeit ab (0–23, leer = ganztags)</label>
              <input type="number" min={0} max={23} value={formHourFrom} onChange={(e) => setFormHourFrom(e.target.value)}
                className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" placeholder="z.B. 11" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Uhrzeit bis</label>
              <input type="number" min={0} max={23} value={formHourTo} onChange={(e) => setFormHourTo(e.target.value)}
                className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" placeholder="z.B. 14" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-600">Varianten (Allokation muss 100% ergeben)</label>
              <button type="button" onClick={() => setFormVariants([...formVariants, { name: `Variante ${formVariants.length}`, isControl: false, movA: '', movB: '', movC: '', movD: '', alloc: 0 }])}
                className="text-xs text-blue-600 hover:underline">+ Variante</button>
            </div>
            <div className="space-y-2">
              {formVariants.map((v, i) => (
                <div key={i} className="border rounded-lg p-3 grid grid-cols-2 md:grid-cols-7 gap-2 text-sm">
                  <input value={v.name} onChange={(e) => { const upd = [...formVariants]; upd[i] = { ...upd[i], name: e.target.value }; setFormVariants(upd); }}
                    className="border rounded px-2 py-1 col-span-2" placeholder="Name" />
                  {['movA', 'movB', 'movC', 'movD'].map((f) => (
                    <input key={f} type="number" step="0.01" min={0}
                      value={(v as Record<string, string | number | boolean>)[f] as string}
                      onChange={(e) => { const upd = [...formVariants]; (upd[i] as Record<string, string | number | boolean>)[f] = e.target.value; setFormVariants(upd); }}
                      className="border rounded px-2 py-1" placeholder={`MOV ${f.slice(-1)} €`} />
                  ))}
                  <input type="number" min={0} max={100} value={v.alloc}
                    onChange={(e) => { const upd = [...formVariants]; upd[i] = { ...upd[i], alloc: Number(e.target.value) }; setFormVariants(upd); }}
                    className="border rounded px-2 py-1" placeholder="% Allok." />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={creating}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {creating ? 'Wird erstellt …' : 'Test anlegen'}
            </button>
            <span className="text-xs text-gray-400">Test wird als Entwurf angelegt und muss manuell aktiviert werden.</span>
          </div>
        </form>
      )}
    </div>
  );
}

function MetricsCard({
  test,
  metrics,
  onStatusChange,
  mini = false,
}: {
  test: MovAbTest;
  metrics: MovAbMetrics[];
  onStatusChange: (id: string, s: string) => void;
  mini?: boolean;
}) {
  if (!metrics.length) return null;

  const control = metrics.find((m) => m.isControl);

  return (
    <div className={mini ? 'mt-3 border-t pt-3' : 'bg-white rounded-xl p-4 shadow-sm border'}>
      {!mini && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">{test.name}</h3>
          <div className="flex gap-2">
            {test.status === 'active' && (
              <button onClick={() => onStatusChange(test.id, 'completed')} className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded">Abschließen</button>
            )}
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b">
              <th className="text-left pb-2">Variante</th>
              <th className="text-right pb-2">Zuweis.</th>
              <th className="text-right pb-2">Events</th>
              <th className="text-right pb-2">Konv.-Rate</th>
              <th className="text-right pb-2">Lift</th>
              <th className="text-right pb-2">Ø Bestellwert</th>
              <th className="text-right pb-2">Umsatz</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => {
              const isWinner = !m.isControl && control && m.conversionRatePct > control.conversionRatePct;
              return (
                <tr key={m.variantId} className={`border-b last:border-0 ${isWinner ? 'bg-green-50' : ''}`}>
                  <td className="py-2">
                    <span className="font-medium">{m.variantName}</span>
                    {m.isControl && <span className="ml-1 text-xs text-gray-400">(Kontrolle)</span>}
                    {isWinner && <span className="ml-1 text-xs text-green-600 font-medium">▲ Gewinner</span>}
                  </td>
                  <td className="text-right text-gray-600">{m.assignedCustomers}</td>
                  <td className="text-right text-gray-600">{m.totalEvents}</td>
                  <td className="text-right font-medium">{m.conversionRatePct}%</td>
                  <td className="text-right">
                    {m.liftVsControl != null ? (
                      <span className={m.liftVsControl > 0 ? 'text-green-600' : 'text-red-500'}>
                        {m.liftVsControl > 0 ? '+' : ''}{m.liftVsControl}%
                      </span>
                    ) : '—'}
                  </td>
                  <td className="text-right text-gray-600">€{m.avgOrderValueEur.toFixed(2)}</td>
                  <td className="text-right text-gray-600">€{m.revenueEur.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
