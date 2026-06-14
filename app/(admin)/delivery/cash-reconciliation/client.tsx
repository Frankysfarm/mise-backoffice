'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, CheckCircle2, AlertTriangle, Clock,
  Euro, Wallet, TrendingDown, TrendingUp, Plus, XCircle,
  Banknote, ArrowDownToLine, ArrowUpFromLine, BarChart3,
} from 'lucide-react';

// ── Typen ─────────────────────────────────────────────────────────────────────

interface Settlement {
  id: string;
  driverId: string;
  driverName: string | null;
  shiftDate: string;
  expectedCashEur: number;
  actualCashEur: number | null;
  discrepancyEur: number | null;
  cashOrderCount: number;
  status: 'open' | 'settled' | 'disputed';
  settledAt: string | null;
  notes: string | null;
}

interface TodaySummary {
  totalSettlements: number;
  openCount: number;
  settledCount: number;
  disputedCount: number;
  totalExpectedEur: number;
  totalActualEur: number;
  totalDiscrepancyEur: number;
  totalCashOrders: number;
}

interface FloatTx {
  id: string;
  transactionType: 'deposit' | 'withdrawal' | 'initial' | 'adjustment';
  amountEur: number;
  description: string | null;
  createdAt: string;
}

interface TrendRow {
  shiftDate: string;
  driverCount: number;
  expectedEur: number;
  actualEur: number;
  discrepancyEur: number;
  disputes: number;
}

interface Dashboard {
  summary: TodaySummary | null;
  settlements: Settlement[];
  trend: TrendRow[];
  floatBalance: number;
  recentFloat: FloatTx[];
}

// ── Formatierung ──────────────────────────────────────────────────────────────

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function statusBadge(s: string) {
  const map: Record<string, { label: string; cls: string }> = {
    open:     { label: 'Offen',      cls: 'bg-amber-100 text-amber-800' },
    settled:  { label: 'Abgerechnet', cls: 'bg-green-100 text-green-800' },
    disputed: { label: 'Strittig',   cls: 'bg-red-100 text-red-800' },
  };
  const { label, cls } = map[s] ?? { label: s, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

function discrepancyColor(disc: number | null) {
  if (disc == null) return 'text-gray-400';
  if (disc > 0) return 'text-green-700';
  if (disc < 0) return 'text-red-700 font-bold';
  return 'text-gray-700';
}

// ── KPI-Karte ─────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, color = 'text-indigo-600', warn = false }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  color?: string; warn?: boolean;
}) {
  return (
    <div className={`bg-white rounded-xl border p-4 flex flex-col gap-1 ${warn ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
      <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
        <span className={color}>{icon}</span>
        {label}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

// ── Settle Modal ──────────────────────────────────────────────────────────────

function SettleModal({
  settlement,
  onClose,
  onDone,
}: {
  settlement: Settlement;
  onClose: () => void;
  onDone: () => void;
}) {
  const [actualCash, setActualCash] = useState(settlement.expectedCashEur.toFixed(2));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSettle() {
    setSaving(true);
    await fetch('/api/delivery/admin/cash-reconciliation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'settle', settlementId: settlement.id, actualCashEur: Number(actualCash), notes }),
    });
    setSaving(false);
    onDone();
  }

  async function handleDispute() {
    setSaving(true);
    await fetch('/api/delivery/admin/cash-reconciliation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dispute', settlementId: settlement.id, notes }),
    });
    setSaving(false);
    onDone();
  }

  const diff = Number(actualCash) - settlement.expectedCashEur;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Bargeld abrechnen</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XCircle size={20} /></button>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
          <div className="font-medium">{settlement.driverName ?? 'Unbekannter Fahrer'}</div>
          <div className="text-gray-500">Schicht: {fmtDate(settlement.shiftDate)}</div>
          <div className="text-gray-500">{settlement.cashOrderCount} Bar-Bestellungen — erwartet: <strong>{fmtEur(settlement.expectedCashEur)}</strong></div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tatsächlich erhalten (€)</label>
          <input
            type="number"
            step="0.01"
            value={actualCash}
            onChange={e => setActualCash(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-lg font-bold"
          />
          {actualCash && (
            <p className={`text-sm mt-1 font-medium ${diff >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              Differenz: {diff >= 0 ? '+' : ''}{fmtEur(diff)}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notiz (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            rows={2}
            placeholder="z.B. Wechselgeld fehlt, gezählt in Beisein von..."
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSettle}
            disabled={saving}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg text-sm disabled:opacity-50"
          >
            {saving ? '...' : 'Abrechnen'}
          </button>
          <button
            onClick={handleDispute}
            disabled={saving}
            className="bg-red-100 hover:bg-red-200 text-red-800 font-bold py-2 px-4 rounded-lg text-sm disabled:opacity-50"
          >
            Strittig
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Float Modal ───────────────────────────────────────────────────────────────

function FloatModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState<'deposit' | 'withdrawal' | 'initial' | 'adjustment'>('deposit');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await fetch('/api/delivery/admin/cash-reconciliation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_float', type, amountEur: Number(amount), description: desc }),
    });
    setSaving(false);
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Kassenbuchung</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XCircle size={20} /></button>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Typ</label>
          <select value={type} onChange={e => setType(e.target.value as typeof type)}
            className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="deposit">Einzahlung</option>
            <option value="withdrawal">Entnahme</option>
            <option value="initial">Startbetrag</option>
            <option value="adjustment">Korrektur</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Betrag (€)</label>
          <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
            className="w-full border rounded-lg px-3 py-2" placeholder="0,00" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
          <input type="text" value={desc} onChange={e => setDesc(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="z.B. Wechselgeld Frühschicht" />
        </div>
        <button onClick={handleSave} disabled={saving || !amount}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg disabled:opacity-50">
          {saving ? '...' : 'Buchen'}
        </button>
      </div>
    </div>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export function CashReconciliationClient({ locationId }: { locationId: string }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'today' | 'trend' | 'float'>('today');
  const [settleTarget, setSettleTarget] = useState<Settlement | null>(null);
  const [showFloat, setShowFloat] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/cash-reconciliation?location_id=${locationId}`);
      if (res.ok) setData(await res.json() as Dashboard);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  async function handleReconcile() {
    setReconciling(true);
    await fetch('/api/delivery/admin/cash-reconciliation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reconcile_today' }),
    });
    setReconciling(false);
    load();
  }

  const s = data?.summary;

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border rounded-lg px-3 py-1.5 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Aktualisieren
        </button>
        <button onClick={handleReconcile} disabled={reconciling}
          className="flex items-center gap-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white border rounded-lg px-3 py-1.5 disabled:opacity-50">
          <Banknote size={14} />
          {reconciling ? 'Läuft...' : 'Alle Fahrer abgleichen'}
        </button>
        <button onClick={() => setShowFloat(true)}
          className="flex items-center gap-1.5 text-sm border rounded-lg px-3 py-1.5 hover:bg-gray-50">
          <Plus size={14} />
          Kassenbuchung
        </button>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<Euro size={16} />}
          label="Erwartet heute"
          value={fmtEur(s?.totalExpectedEur ?? 0)}
          sub={`${s?.totalCashOrders ?? 0} Bar-Bestellungen`}
          color="text-blue-600"
        />
        <KpiCard
          icon={<CheckCircle2 size={16} />}
          label="Abgerechnet"
          value={fmtEur(s?.totalActualEur ?? 0)}
          sub={`${s?.settledCount ?? 0} Fahrer`}
          color="text-green-600"
        />
        <KpiCard
          icon={<Clock size={16} />}
          label="Offen"
          value={String(s?.openCount ?? 0)}
          sub="Abrechnungen ausstehend"
          color="text-amber-600"
          warn={(s?.openCount ?? 0) > 2}
        />
        <KpiCard
          icon={<Wallet size={16} />}
          label="Kassenstand"
          value={fmtEur(data?.floatBalance ?? 0)}
          sub={`${(data?.recentFloat ?? []).length} letzte Buchungen`}
          color="text-indigo-600"
        />
      </div>

      {/* Differenz-Warnung */}
      {s && Math.abs(s.totalDiscrepancyEur) >= 5 && (
        <div className={`flex items-center gap-3 rounded-xl border p-3 text-sm font-medium ${s.totalDiscrepancyEur < 0 ? 'border-red-300 bg-red-50 text-red-800' : 'border-green-300 bg-green-50 text-green-800'}`}>
          {s.totalDiscrepancyEur < 0 ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
          Tages-Differenz: {s.totalDiscrepancyEur >= 0 ? '+' : ''}{fmtEur(s.totalDiscrepancyEur)}
          {s.totalDiscrepancyEur < 0 ? ' — Fahrer haben weniger übergeben als erwartet.' : ' — Fahrer haben mehr übergeben als erwartet.'}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['today', 'trend', 'float'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === tab ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {tab === 'today' ? 'Heute' : tab === 'trend' ? '14-Tage-Trend' : 'Kassenlade'}
          </button>
        ))}
      </div>

      {/* Tab: Heute */}
      {activeTab === 'today' && (
        <div className="space-y-2">
          {(data?.settlements ?? []).length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <Banknote size={32} className="mx-auto mb-2 opacity-40" />
              <p>Keine Abrechnungen für heute.</p>
              <p className="text-sm mt-1">„Alle Fahrer abgleichen" generiert offene Einträge.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="pb-2 pr-4">Fahrer</th>
                    <th className="pb-2 pr-4">Bestellungen</th>
                    <th className="pb-2 pr-4">Erwartet</th>
                    <th className="pb-2 pr-4">Übergeben</th>
                    <th className="pb-2 pr-4">Differenz</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data?.settlements ?? []).map(st => (
                    <tr key={st.id} className="hover:bg-gray-50">
                      <td className="py-3 pr-4 font-medium">{st.driverName ?? '—'}</td>
                      <td className="py-3 pr-4 text-gray-600">{st.cashOrderCount}×</td>
                      <td className="py-3 pr-4">{fmtEur(st.expectedCashEur)}</td>
                      <td className="py-3 pr-4">
                        {st.actualCashEur != null ? fmtEur(st.actualCashEur) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className={`py-3 pr-4 ${discrepancyColor(st.discrepancyEur)}`}>
                        {st.discrepancyEur != null
                          ? `${st.discrepancyEur >= 0 ? '+' : ''}${fmtEur(st.discrepancyEur)}`
                          : '—'}
                      </td>
                      <td className="py-3 pr-4">{statusBadge(st.status)}</td>
                      <td className="py-3">
                        {st.status === 'open' && (
                          <button
                            onClick={() => setSettleTarget(st)}
                            className="text-xs bg-green-100 hover:bg-green-200 text-green-800 px-2 py-1 rounded-lg font-medium"
                          >
                            Abrechnen
                          </button>
                        )}
                        {st.status === 'disputed' && st.notes && (
                          <span className="text-xs text-red-600" title={st.notes}>
                            <AlertTriangle size={14} className="inline" />
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Trend */}
      {activeTab === 'trend' && (
        <div className="space-y-2">
          {(data?.trend ?? []).length === 0 ? (
            <p className="text-center text-gray-400 py-8">Noch keine historischen Daten.</p>
          ) : (
            <>
              {/* Minibarchart */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-1">
                  <BarChart3 size={12} /> 14-Tage Erwartetes Bargeld
                </div>
                <div className="flex items-end gap-1 h-20">
                  {(data?.trend ?? []).slice(0, 14).reverse().map(r => {
                    const max = Math.max(...(data?.trend ?? []).map(t => t.expectedEur), 1);
                    const pct = Math.round((r.expectedEur / max) * 100);
                    return (
                      <div key={r.shiftDate} className="flex-1 flex flex-col items-center gap-0.5" title={`${fmtDate(r.shiftDate)}: ${fmtEur(r.expectedEur)}`}>
                        <div
                          className={`w-full rounded-t ${r.disputes > 0 ? 'bg-red-400' : 'bg-indigo-400'}`}
                          style={{ height: `${pct}%` }}
                        />
                        <span className="text-[8px] text-gray-400 rotate-90 origin-center" style={{ writingMode: 'vertical-rl' }}>
                          {fmtDate(r.shiftDate).slice(0, 5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-1">Rot = Tag mit Streitfall</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-gray-500 uppercase tracking-wide">
                      <th className="pb-2 pr-4">Datum</th>
                      <th className="pb-2 pr-4">Fahrer</th>
                      <th className="pb-2 pr-4">Erwartet</th>
                      <th className="pb-2 pr-4">Übergeben</th>
                      <th className="pb-2 pr-4">Differenz</th>
                      <th className="pb-2">Streitfälle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(data?.trend ?? []).map(r => (
                      <tr key={r.shiftDate} className="hover:bg-gray-50">
                        <td className="py-2 pr-4 font-medium">{fmtDate(r.shiftDate)}</td>
                        <td className="py-2 pr-4 text-gray-600">{r.driverCount}</td>
                        <td className="py-2 pr-4">{fmtEur(r.expectedEur)}</td>
                        <td className="py-2 pr-4">{r.actualEur > 0 ? fmtEur(r.actualEur) : '—'}</td>
                        <td className={`py-2 pr-4 ${r.discrepancyEur < -1 ? 'text-red-700 font-bold' : r.discrepancyEur > 1 ? 'text-green-700' : 'text-gray-600'}`}>
                          {r.actualEur > 0 ? `${r.discrepancyEur >= 0 ? '+' : ''}${fmtEur(r.discrepancyEur)}` : '—'}
                        </td>
                        <td className="py-2">
                          {r.disputes > 0
                            ? <span className="text-red-700 font-bold">{r.disputes}×</span>
                            : <span className="text-gray-400">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab: Kassenlade */}
      {activeTab === 'float' && (
        <div className="space-y-3">
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-indigo-700">Aktueller Kassenstand</div>
              <div className="text-3xl font-bold text-indigo-900">{fmtEur(data?.floatBalance ?? 0)}</div>
            </div>
            <Wallet size={32} className="text-indigo-400" />
          </div>

          {(data?.recentFloat ?? []).length === 0 ? (
            <p className="text-center text-gray-400 py-8">Noch keine Kassenbuchungen.</p>
          ) : (
            <div className="space-y-1">
              {(data?.recentFloat ?? []).map(tx => (
                <div key={tx.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    {tx.transactionType === 'withdrawal'
                      ? <ArrowUpFromLine size={16} className="text-red-500" />
                      : <ArrowDownToLine size={16} className="text-green-500" />}
                    <div>
                      <div className="text-sm font-medium">
                        {tx.transactionType === 'deposit' ? 'Einzahlung'
                          : tx.transactionType === 'withdrawal' ? 'Entnahme'
                            : tx.transactionType === 'initial' ? 'Startbetrag'
                              : 'Korrektur'}
                      </div>
                      {tx.description && (
                        <div className="text-xs text-gray-500">{tx.description}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${tx.transactionType === 'withdrawal' ? 'text-red-700' : 'text-green-700'}`}>
                      {tx.transactionType === 'withdrawal' ? '-' : '+'}{fmtEur(tx.amountEur)}
                    </div>
                    <div className="text-xs text-gray-400">{fmtTime(tx.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {settleTarget && (
        <SettleModal
          settlement={settleTarget}
          onClose={() => setSettleTarget(null)}
          onDone={() => { setSettleTarget(null); load(); }}
        />
      )}
      {showFloat && (
        <FloatModal
          onClose={() => setShowFloat(false)}
          onDone={() => { setShowFloat(false); load(); }}
        />
      )}
    </div>
  );
}
