'use client'

import { useState } from 'react'
import { Order } from '@/lib/lieferdienst/orders'
import { 
  Search, Download, Calendar, CheckCircle, XCircle, 
  Users, Package, Truck, Clock, Filter, ChevronDown, RotateCcw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface HistoryViewProps {
  completedOrders: Order[]
  onRecall: (order: Order) => void
}

export function HistoryView({ completedOrders, onRecall }: HistoryViewProps) {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'done' | 'rejected'>('all')
  const [filterOrderType, setFilterOrderType] = useState<'all' | 'dine_in' | 'takeaway' | 'delivery'>('all')

  const filteredOrders = completedOrders.filter(order => {
    const matchesSearch = search === '' || 
      order.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      order.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      order.items.some(item => item.name.toLowerCase().includes(search.toLowerCase()))
    
    const matchesStatus = filterType === 'all' || order.status === filterType
    const matchesOrderType = filterOrderType === 'all' || order.type === filterOrderType
    
    return matchesSearch && matchesStatus && matchesOrderType
  })

  const exportToCSV = () => {
    const headers = ['Bestellnr', 'Datum', 'Uhrzeit', 'Typ', 'Status', 'Kunde', 'Artikel', 'Zubereitungszeit']
    const rows = filteredOrders.map(order => [
      order.orderNumber,
      order.createdAt.toLocaleDateString('de-DE'),
      order.createdAt.toLocaleTimeString('de-DE'),
      order.type === 'dine_in' ? 'Vor Ort' : order.type === 'takeaway' ? 'Abholung' : 'Lieferung',
      order.status === 'done' ? 'Fertig' : 'Abgelehnt',
      order.customerName || '-',
      order.items.map(i => `${i.quantity}x ${i.name}`).join('; '),
      order.estimatedTime ? `${order.estimatedTime} Min` : '-',
    ])
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bestellungen-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const getTypeIcon = (type: Order['type']) => {
    switch (type) {
      case 'dine_in': return <Users className="w-4 h-4 text-emerald-600" />
      case 'takeaway': return <Package className="w-4 h-4 text-amber-600" />
      case 'delivery': return <Truck className="w-4 h-4 text-violet-600" />
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-char">Bestellhistorie</h1>
          <p className="text-steel">{filteredOrders.length} Bestellungen</p>
        </div>
        <Button onClick={exportToCSV} variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input
            type="text"
            placeholder="Suche nach Bestellung, Kunde oder Artikel..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl border-stone-200"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2 h-11 rounded-xl">
              <Filter className="w-4 h-4" />
              {filterType === 'all' ? 'Alle Status' : filterType === 'done' ? 'Fertig' : 'Abgelehnt'}
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setFilterType('all')}>Alle Status</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilterType('done')}>Fertig</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilterType('rejected')}>Abgelehnt</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2 h-11 rounded-xl">
              {filterOrderType === 'all' ? 'Alle Typen' : 
               filterOrderType === 'dine_in' ? 'Vor Ort' : 
               filterOrderType === 'takeaway' ? 'Abholung' : 'Lieferung'}
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setFilterOrderType('all')}>Alle Typen</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilterOrderType('dine_in')}>Vor Ort</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilterOrderType('takeaway')}>Abholung</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilterOrderType('delivery')}>Lieferung</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left text-xs font-semibold text-steel uppercase tracking-wider px-5 py-4">Bestellung</th>
                <th className="text-left text-xs font-semibold text-steel uppercase tracking-wider px-5 py-4">Zeit</th>
                <th className="text-left text-xs font-semibold text-steel uppercase tracking-wider px-5 py-4">Typ</th>
                <th className="text-left text-xs font-semibold text-steel uppercase tracking-wider px-5 py-4">Kunde</th>
                <th className="text-left text-xs font-semibold text-steel uppercase tracking-wider px-5 py-4">Artikel</th>
                <th className="text-left text-xs font-semibold text-steel uppercase tracking-wider px-5 py-4">Status</th>
                <th className="text-left text-xs font-semibold text-steel uppercase tracking-wider px-5 py-4">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <Calendar className="w-12 h-12 text-stone-300 mb-3" />
                      <p className="text-stone-500 font-medium">Keine Bestellungen gefunden</p>
                      <p className="text-stone-400 text-sm">Passe die Filter an oder suche nach etwas anderem</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                    <td className="px-5 py-4">
                      <span className="font-mono font-bold text-char">{order.orderNumber}</span>
                      {order.table && (
                        <span className="ml-2 text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded">{order.table}</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 text-sm text-stone-600">
                        <Clock className="w-4 h-4 text-stone-400" />
                        <span>{order.createdAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(order.type)}
                        <span className="text-sm text-stone-600">
                          {order.type === 'dine_in' ? 'Vor Ort' : order.type === 'takeaway' ? 'Abholung' : 'Lieferung'}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-stone-600">{order.customerName || '-'}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {order.items.slice(0, 2).map((item, i) => (
                          <span key={i} className="text-xs bg-stone-100 text-stone-600 px-2 py-1 rounded">
                            {item.quantity}x {item.name}
                          </span>
                        ))}
                        {order.items.length > 2 && (
                          <span className="text-xs bg-stone-100 text-stone-600 px-2 py-1 rounded">
                            +{order.items.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {order.status === 'done' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 px-2.5 py-1.5 rounded-lg">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Fertig
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-red-50 text-red-700 px-2.5 py-1.5 rounded-lg">
                          <XCircle className="w-3.5 h-3.5" />
                          Abgelehnt
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {order.status === 'done' && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => onRecall(order)}
                          className="gap-1.5 text-saffron hover:text-saffron-deep hover:bg-saffron/10"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Recall
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
