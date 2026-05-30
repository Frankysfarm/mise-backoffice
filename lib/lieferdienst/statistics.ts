import { Order } from './orders'

export interface DailyStats {
  date: string
  totalOrders: number
  completedOrders: number
  rejectedOrders: number
  avgPrepTime: number
  revenue: number
  peakHour: number
  ordersByType: {
    dine_in: number
    takeaway: number
    delivery: number
  }
  ordersByHour: number[]
}

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v)
}

export function calculateDailyStats(orders: Order[]): DailyStats {
  const today = new Date().toISOString().split('T')[0]
  const todayOrders = orders.filter(o => toDate(o.createdAt).toISOString().split('T')[0] === today)

  const completed = todayOrders.filter(o => o.status === 'done')
  const rejected = todayOrders.filter(o => o.status === 'rejected')

  // Calculate average prep time (from accepted orders with estimatedTime)
  const ordersWithTime = todayOrders.filter(o => o.estimatedTime)
  const avgPrepTime = ordersWithTime.length > 0
    ? Math.round(ordersWithTime.reduce((sum, o) => sum + (o.estimatedTime || 0), 0) / ordersWithTime.length)
    : 0

  // Orders by type
  const ordersByType = {
    dine_in: todayOrders.filter(o => o.type === 'dine_in').length,
    takeaway: todayOrders.filter(o => o.type === 'takeaway').length,
    delivery: todayOrders.filter(o => o.type === 'delivery').length,
  }

  // Orders by hour (0-23)
  const ordersByHour = Array(24).fill(0)
  todayOrders.forEach(o => {
    const hour = toDate(o.createdAt).getHours()
    ordersByHour[hour]++
  })
  
  // Peak hour
  const peakHour = ordersByHour.indexOf(Math.max(...ordersByHour))
  
  // Estimated revenue (mock: avg 25 EUR per order)
  const revenue = completed.length * 25
  
  return {
    date: today,
    totalOrders: todayOrders.length,
    completedOrders: completed.length,
    rejectedOrders: rejected.length,
    avgPrepTime,
    revenue,
    peakHour,
    ordersByType,
    ordersByHour,
  }
}

export function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(amount)
}

export function formatTime(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`
}
