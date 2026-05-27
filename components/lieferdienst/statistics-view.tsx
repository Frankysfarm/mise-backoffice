'use client'

import { Order } from '@/lib/lieferdienst/orders'
import { calculateDailyStats, formatCurrency, formatTime } from '@/lib/lieferdienst/statistics'
import { 
  TrendingUp, Clock, CheckCircle, XCircle, 
  Users, Package, Truck, DollarSign, BarChart3
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

interface StatisticsViewProps {
  orders: Order[]
  completedOrders: Order[]
}

export function StatisticsView({ orders, completedOrders }: StatisticsViewProps) {
  const allOrders = [...orders, ...completedOrders]
  const stats = calculateDailyStats(allOrders)
  
  const completionRate = stats.totalOrders > 0 
    ? Math.round((stats.completedOrders / stats.totalOrders) * 100) 
    : 0

  const hourlyData = stats.ordersByHour
    .map((count, hour) => ({ hour: formatTime(hour), orders: count }))
    .filter((_, i) => i >= 8 && i <= 23) // Only show 8:00 - 23:00

  const typeData = [
    { name: 'Vor Ort', value: stats.ordersByType.dine_in, color: '#10b981' },
    { name: 'Abholung', value: stats.ordersByType.takeaway, color: '#f59e0b' },
    { name: 'Lieferung', value: stats.ordersByType.delivery, color: '#8b5cf6' },
  ].filter(d => d.value > 0)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-char">Tagesstatistiken</h1>
          <p className="text-steel">
            {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-saffron/10 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-saffron" />
            </div>
            <span className="text-sm font-medium text-steel">Bestellungen</span>
          </div>
          <p className="text-3xl font-bold text-char">{stats.totalOrders}</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-sm font-medium text-steel">Abgeschlossen</span>
          </div>
          <p className="text-3xl font-bold text-emerald-600">{stats.completedOrders}</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <span className="text-sm font-medium text-steel">Abgelehnt</span>
          </div>
          <p className="text-3xl font-bold text-red-600">{stats.rejectedOrders}</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-steel">Ø Zubereitungszeit</span>
          </div>
          <p className="text-3xl font-bold text-blue-600">{stats.avgPrepTime} <span className="text-lg">Min</span></p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-violet-600" />
            </div>
            <span className="text-sm font-medium text-steel">Umsatz (ca.)</span>
          </div>
          <p className="text-3xl font-bold text-violet-600">{formatCurrency(stats.revenue)}</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-sm font-medium text-steel">Erfolgsquote</span>
          </div>
          <p className="text-3xl font-bold text-amber-600">{completionRate}%</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hourly Distribution */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
          <h3 className="text-lg font-semibold text-char mb-4">Bestellungen nach Uhrzeit</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis 
                  dataKey="hour" 
                  tick={{ fontSize: 12, fill: '#78716c' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e7e5e4' }}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: '#78716c' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e7e5e4' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e7e5e4',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Bar 
                  dataKey="orders" 
                  fill="#E8A54B" 
                  radius={[6, 6, 0, 0]}
                  name="Bestellungen"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {stats.peakHour > 0 && (
            <p className="text-sm text-steel mt-3">
              Peak-Stunde: <span className="font-semibold text-char">{formatTime(stats.peakHour)}</span>
            </p>
          )}
        </div>

        {/* Order Types */}
        <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
          <h3 className="text-lg font-semibold text-char mb-4">Nach Bestelltyp</h3>
          {typeData.length > 0 ? (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {typeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e7e5e4',
                        borderRadius: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-4">
                {typeData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-sm text-stone-600">{item.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-char">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center">
              <p className="text-stone-400">Keine Daten</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
