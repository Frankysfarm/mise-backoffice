'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import type { MovAbMetrics } from '@/lib/delivery/mov-ab-test';

interface Props {
  metrics: MovAbMetrics[];
  testName: string;
}

const COLORS = ['#6366f1', '#f97316', '#10b981', '#f59e0b', '#3b82f6'];

export function MovAbMetricsChart({ metrics, testName }: Props) {
  if (!metrics.length) return null;

  const cvData = metrics.map((m, i) => ({
    name: m.variantName,
    'Conversion %': Number(m.conversionRatePct.toFixed(1)),
    fill: m.isControl ? '#6b7280' : COLORS[i % COLORS.length],
    isControl: m.isControl,
    lift: m.liftVsControl,
  }));

  const revData = metrics.map((m, i) => ({
    name: m.variantName,
    'Ø Bestellwert €': Number(m.avgOrderValueEur.toFixed(2)),
    'Umsatz €': Number(m.revenueEur.toFixed(2)),
    fill: m.isControl ? '#6b7280' : COLORS[i % COLORS.length],
  }));

  const controlCvr = metrics.find((m) => m.isControl)?.conversionRatePct ?? null;

  return (
    <div className="space-y-4 rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">{testName} — Metriken-Vergleich</h3>
        <span className="text-xs text-gray-400">{metrics.length} Varianten</span>
      </div>

      {/* Conversion Rate Chart */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">Conversion-Rate (%)</p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={cvData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip
              formatter={(v: number, _name: string, props: any) => [
                `${v}%${props.payload.lift != null ? ` (Lift: ${props.payload.lift > 0 ? '+' : ''}${props.payload.lift.toFixed(1)}%)` : ''}`,
                'Conversion',
              ]}
            />
            {controlCvr != null && (
              <ReferenceLine y={controlCvr} stroke="#6b7280" strokeDasharray="4 2" label={{ value: 'Kontrolle', position: 'insideTopLeft', fontSize: 10, fill: '#6b7280' }} />
            )}
            <Bar dataKey="Conversion %" radius={[4, 4, 0, 0]}>
              {cvData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Revenue Chart */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">Ø Bestellwert & Umsatz</p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={revData} margin={{ top: 4, right: 4, left: -4, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="€" />
            <Tooltip formatter={(v: number) => `€${v.toFixed(2)}`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Ø Bestellwert €" radius={[4, 4, 0, 0]} fill="#6366f1" opacity={0.85} />
            <Bar dataKey="Umsatz €" radius={[4, 4, 0, 0]} fill="#10b981" opacity={0.85} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Lift Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 border-b">
              <th className="text-left py-1 font-medium">Variante</th>
              <th className="text-right py-1 font-medium">Kunden</th>
              <th className="text-right py-1 font-medium">Conv.</th>
              <th className="text-right py-1 font-medium">Lift</th>
              <th className="text-right py-1 font-medium">Umsatz</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.variantId} className="border-b last:border-0 hover:bg-gray-50">
                <td className="py-1.5 font-medium text-gray-700 flex items-center gap-1">
                  {m.isControl && <span className="text-[10px] bg-gray-100 text-gray-500 px-1 rounded">Ctrl</span>}
                  {m.variantName}
                </td>
                <td className="text-right text-gray-600">{m.assignedCustomers.toLocaleString('de')}</td>
                <td className="text-right text-gray-600">{m.conversionRatePct.toFixed(1)}%</td>
                <td className="text-right">
                  {m.liftVsControl != null ? (
                    <span className={m.liftVsControl > 0 ? 'text-green-600 font-semibold' : m.liftVsControl < 0 ? 'text-red-500 font-semibold' : 'text-gray-400'}>
                      {m.liftVsControl > 0 ? '+' : ''}{m.liftVsControl.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="text-right text-gray-600">€{m.revenueEur.toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
