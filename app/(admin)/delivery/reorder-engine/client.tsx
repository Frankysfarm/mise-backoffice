'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, RotateCcw, Users, ShoppingBag, TrendingUp, Euro, Clock, Star } from 'lucide-react';

interface ReorderItem {
  name: string;
  count: number;
  revenue_eur: number;
}

interface TopItem {
  itemName: string;
  totalReorderCount: number;
  totalReorderRevenue: number;
  distinctCustomers: number;
}

interface LoyalCustomer {
  customerId: string;
  customerPhone: string;
  customerName: string | null;
  totalOrders: number;
  totalSpentEur: number;
  lastOrderAt: string | null;
  avgDaysBetweenOrders: number | null;
  preferredHour: number | null;
  topItems: ReorderItem[];
}

interface LocationStats {
  totalProfiledCustomers: number;
  repeatCustomers: number;
  repeatRatePct: number;
  avgOrdersPerRepeat: number;
  totalRevenueTracked: number;
  avgLifetimeValue: number;
  lastComputedAt: string | null;
}

interface DashboardData {
  stats: LocationStats;
  topItems: TopItem[];
  loyalCustomers: LoyalCustomer[];
}

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function fmtHour(h: number | null) {
  if (h === null) return '—';
  return `${String(h).padStart(2, '0')}:00 Uhr`;
}

function maskPhone(phone: string) {
  return phone.length > 6 ? phone.slice(0, 3) + '***' + phone.slice(-3) : '***';
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}

function KpiCard({ icon, label, value, sub, color = 'text-indigo-600' }: KpiCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-1">
      <div className={`flex items-center gap-2 text-sm font-medium text-gray-500`}>
        <span className={color}>{icon}</span>
        {label}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export function ReorderEngineClient({ locationId }: { locationId: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [activeTab, setActiveTab] = useState<'items' | 'customers'>('items');
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/reorder-engine?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  async function rebuild() {
    setRebuilding(true);
    try {
      await fetch('/api/delivery/admin/reorder-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rebuild', location_id: locationId }),
      });
      await load();
    } finally {
      setRebuilding(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <RefreshCw className="animate-spin mr-2" size={18} />
        Lade Wiederbestellungs-Daten…
      </div>
    );
  }

  const s = data?.stats;

  return (
    <div className="space-y-6 p-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {s?.lastComputedAt
            ? `Zuletzt berechnet: ${fmtDate(s.lastComputedAt)}`
            : 'Noch nicht berechnet — Profile aufbauen'}
        </p>
        <button
          onClick={rebuild}
          disabled={rebuilding}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          <RotateCcw size={14} className={rebuilding ? 'animate-spin' : ''} />
          {rebuilding ? 'Berechne…' : 'Profile neu aufbauen'}
        </button>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          icon={<Users size={16} />}
          label="Kunden gesamt"
          value={String(s?.totalProfiledCustomers ?? 0)}
          sub="in Profildatenbank"
          color="text-blue-600"
        />
        <KpiCard
          icon={<TrendingUp size={16} />}
          label="Stammkunden"
          value={String(s?.repeatCustomers ?? 0)}
          sub="≥ 2 Bestellungen"
          color="text-green-600"
        />
        <KpiCard
          icon={<Star size={16} />}
          label="Wiederbestellrate"
          value={`${s?.repeatRatePct ?? 0} %`}
          sub="Anteil Stammkunden"
          color="text-amber-500"
        />
        <KpiCard
          icon={<ShoppingBag size={16} />}
          label="Ø Bestellungen"
          value={String(s?.avgOrdersPerRepeat ?? 0)}
          sub="pro Stammkunde"
          color="text-purple-600"
        />
        <KpiCard
          icon={<Euro size={16} />}
          label="Tracked Revenue"
          value={fmtEur(s?.totalRevenueTracked ?? 0)}
          sub="gesamter Umsatz"
          color="text-emerald-600"
        />
        <KpiCard
          icon={<Clock size={16} />}
          label="Ø Kundenwert"
          value={fmtEur(s?.avgLifetimeValue ?? 0)}
          sub="lifetime value"
          color="text-rose-600"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4">
          {(['items', 'customers'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'items' ? '🍽 Top-Wiederbestellartikel' : '👥 Treueste Kunden'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Top-Artikel */}
      {activeTab === 'items' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">Meist wiederbestellte Artikel (Stammkunden ≥ 2 Bestellungen)</h3>
          </div>
          {!data?.topItems.length ? (
            <p className="text-center text-gray-400 py-8 text-sm">Noch keine Daten — Profile aufbauen um Artikel zu sehen</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">#</th>
                  <th className="px-4 py-2 text-left">Artikel</th>
                  <th className="px-4 py-2 text-right">Wiederbestellungen</th>
                  <th className="px-4 py-2 text-right">Kunden</th>
                  <th className="px-4 py-2 text-right">Umsatz</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.topItems.map((item, i) => {
                  const maxCount = data.topItems[0]?.totalReorderCount ?? 1;
                  const barPct = Math.round((item.totalReorderCount / maxCount) * 100);
                  return (
                    <tr key={item.itemName} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400 font-mono">#{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{item.itemName}</div>
                        <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden w-40">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">
                        {item.totalReorderCount.toLocaleString('de-DE')}×
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {item.distinctCustomers}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-700 font-medium">
                        {fmtEur(item.totalReorderRevenue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: Treueste Kunden */}
      {activeTab === 'customers' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">Stammkunden nach Bestellhäufigkeit</h3>
          </div>
          {!data?.loyalCustomers.length ? (
            <p className="text-center text-gray-400 py-8 text-sm">Noch keine Stammkunden-Daten</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {data.loyalCustomers.map((c, i) => {
                const isOpen = expandedCustomer === c.customerId;
                return (
                  <div key={c.customerId}>
                    <button
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 text-left"
                      onClick={() => setExpandedCustomer(isOpen ? null : c.customerId)}
                    >
                      <span className="text-sm text-gray-400 font-mono w-6">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {c.customerName ?? maskPhone(c.customerPhone)}
                          </span>
                          {i < 3 && (
                            <span>{['🥇', '🥈', '🥉'][i]}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400">
                          {maskPhone(c.customerPhone)} · Zuletzt: {fmtDate(c.lastOrderAt)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-semibold text-indigo-700">{c.totalOrders}× bestellt</div>
                        <div className="text-xs text-emerald-700">{fmtEur(c.totalSpentEur)}</div>
                      </div>
                      <span className="text-gray-300 text-xs">{isOpen ? '▲' : '▼'}</span>
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 bg-gray-50 space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                          <div className="bg-white rounded-lg p-2 border border-gray-200">
                            <div className="text-gray-400">Ø Tage zwischen Bestellungen</div>
                            <div className="font-semibold text-gray-800 text-sm">
                              {c.avgDaysBetweenOrders != null ? `${c.avgDaysBetweenOrders} Tage` : '—'}
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-2 border border-gray-200">
                            <div className="text-gray-400">Bevorzugte Bestellzeit</div>
                            <div className="font-semibold text-gray-800 text-sm">{fmtHour(c.preferredHour)}</div>
                          </div>
                        </div>
                        {c.topItems.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1 font-medium">Lieblings-Artikel:</p>
                            <div className="flex flex-wrap gap-1">
                              {c.topItems.slice(0, 5).map((item) => (
                                <span
                                  key={item.name}
                                  className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full border border-indigo-100"
                                >
                                  {item.name} <span className="opacity-60">({item.count}×)</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Info-Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">💡 Wie funktioniert die Wiederbestellungs-Engine?</p>
        <ul className="space-y-1 text-blue-700 list-disc list-inside">
          <li>Profile werden täglich um 03:30 UTC automatisch neu berechnet</li>
          <li>Kunden werden anonym über ihre Telefonnummer identifiziert</li>
          <li>Nur abgeschlossene Lieferbestellungen fließen in die Analyse ein</li>
          <li>Die Storefront kann via <code className="bg-blue-100 px-1 rounded">/api/delivery/reorder?token=…</code> individuelle Vorschläge abrufen</li>
          <li>Profile ohne Bestellaktivität &gt; 180 Tage werden automatisch bereinigt</li>
        </ul>
      </div>
    </div>
  );
}
