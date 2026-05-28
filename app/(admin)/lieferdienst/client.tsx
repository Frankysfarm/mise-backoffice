'use client'

import { useState, useEffect, useCallback } from 'react'
import { Order, OrderStatus, mockOrders, generateRandomOrder } from '@/lib/lieferdienst/orders'
import { OrderCard } from '@/components/lieferdienst/order-card'
import { IncomingOrderDialog } from '@/components/lieferdienst/incoming-order-dialog'
import { SettingsDialog } from '@/components/lieferdienst/settings-dialog'
import { AppSidebar } from '@/components/lieferdienst/app-sidebar'
import { StatisticsView } from '@/components/lieferdienst/statistics-view'
import { HistoryView } from '@/components/lieferdienst/history-view'
import { MenuView } from '@/components/lieferdienst/menu-view'
import { ShiftNotesView } from '@/components/lieferdienst/shift-notes-view'
import { KeyboardHelp } from '@/components/lieferdienst/keyboard-help'
import { DriversView } from '@/components/lieferdienst/drivers-view'
import { ManualOrderForm } from '@/components/lieferdienst/manual-order-form'
import { DriverReturningBanner } from '@/components/lieferdienst/driver-returning-banner'
import { playSound } from '@/lib/lieferdienst/sounds'
import { Settings, defaultSettings } from '@/lib/lieferdienst/settings'
import { StaffMember, ShiftNote, mockShiftNotes, Station, stations } from '@/lib/lieferdienst/staff'
import { MenuItem, mockMenuItems } from '@/lib/lieferdienst/menu'
import { Driver, mockDrivers } from '@/lib/lieferdienst/drivers'
import { Language } from '@/lib/lieferdienst/translations'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { useOfflineStorage } from '@/hooks/use-offline'
import { 
  Clock, Bell, Volume2, VolumeX, ChefHat, Package, Truck, Users, 
  Settings as SettingsIcon, WifiOff, Globe, Phone
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

export function LieferdienstClient() {
  // Auth State - Default staff (no login required)
  const [currentStaff, setCurrentStaff] = useState<StaffMember | null>({
    id: 'default',
    name: 'Küche',
    pin: '0000',
    role: 'admin',
    active: true,
  })
  
  // Core State
  const [orders, setOrders] = useState<Order[]>(mockOrders)
  const [completedOrders, setCompletedOrders] = useState<Order[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [filter, setFilter] = useState<'all' | 'accepted' | 'waiting'>('all')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [incomingOrder, setIncomingOrder] = useState<Order | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  
  // Navigation State
  const [currentView, setCurrentView] = useState<'orders' | 'stats' | 'history' | 'menu' | 'staff' | 'notes' | 'drivers'>('orders')
  const [currentStation, setCurrentStation] = useState<Station>('all')
  const [language, setLanguage] = useState<Language>('de')
  
  // Menu State
  const [menuItems, setMenuItems] = useState<MenuItem[]>(mockMenuItems)
  
  // Driver State
  const [drivers, setDrivers] = useState<Driver[]>(mockDrivers)
  const [driverBannerDismissed, setDriverBannerDismissed] = useState(false)
  
  // Manual Order State
  const [showManualOrder, setShowManualOrder] = useState(false)
  
  // Shift Notes State
  const [shiftNotes, setShiftNotes] = useState<ShiftNote[]>(mockShiftNotes)

  // === REAL DB-DATA INJECTION (patches mock-Defaults nach Mount + Realtime-Poll) ===
  useEffect(() => {
    let cancelled = false;
    const fetchData = () => {
      fetch('/api/lieferdienst/data', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (cancelled || !d) return;
          if (Array.isArray(d.orders))  setOrders(d.orders);
          if (Array.isArray(d.drivers)) setDrivers(d.drivers);
          if (Array.isArray(d.menu))    setMenuItems(d.menu);
        }).catch(() => {});
    };
    fetchData();
    const t = setInterval(fetchData, 8000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  
  // Offline Storage
  const { isOnline, hasUnsyncedData, saveOrders, loadOrders, saveCompletedOrders, loadCompletedOrders } = useOfflineStorage()

  // Load stored data on mount
  useEffect(() => {
    const storedOrders = loadOrders()
    if (storedOrders) {
      setOrders(storedOrders)
    }
    const storedCompleted = loadCompletedOrders()
    if (storedCompleted) {
      setCompletedOrders(storedCompleted)
    }
  }, [loadOrders, loadCompletedOrders])

  // Save orders when they change
  useEffect(() => {
    saveOrders(orders)
  }, [orders, saveOrders])

  useEffect(() => {
    saveCompletedOrders(completedOrders)
  }, [completedOrders, saveCompletedOrders])

  const playNotification = useCallback(() => {
    playSound('newOrder', soundEnabled)
  }, [soundEnabled])

  // Clock
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Auto status transitions
  useEffect(() => {
    const interval = setInterval(() => {
      let shouldPlayAlert = false
      setOrders(prev => prev.map(order => {
        if (order.status === 'waiting_customer' && order.waitingForCustomerSince) {
          const waitingMins = Math.floor((new Date().getTime() - order.waitingForCustomerSince.getTime()) / 60000)
          if (waitingMins >= settings.notifications.callCustomerAfter) {
            shouldPlayAlert = true
            return { ...order, status: 'call_customer' as OrderStatus }
          }
        }
        return order
      }))
      if (shouldPlayAlert) {
        playSound('callCustomer', soundEnabled)
      }
    }, 10000)
    return () => clearInterval(interval)
  }, [soundEnabled, settings.notifications.callCustomerAfter])

  // Simulate incoming orders
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.7 && !incomingOrder && isOnline) {
        const newOrder = generateRandomOrder()
        // Randomly assign allergies to some items
        newOrder.items = newOrder.items.map(item => ({
          ...item,
          allergies: Math.random() > 0.7 ? ['A', 'G'].slice(0, Math.floor(Math.random() * 2) + 1) : undefined
        }))
        // Random VIP/Express
        if (Math.random() > 0.9) {
          newOrder.priority = Math.random() > 0.5 ? 'vip' : 'express'
        }
        setIncomingOrder(newOrder)
        playNotification()
      }
    }, 8000)
    return () => clearInterval(interval)
  }, [playNotification, incomingOrder, isOnline])

  // Handlers
  const handleAcceptIncoming = (estimatedTime: number) => {
    if (incomingOrder) {
      playSound('orderReady', soundEnabled)
      const acceptedOrder: Order = {
        ...incomingOrder,
        status: 'accepted' as OrderStatus,
        estimatedTime,
        acceptedAt: new Date(),
        processedBy: currentStaff?.id
      }
      setOrders(prev => [acceptedOrder, ...prev])
      setIncomingOrder(null)
    }
  }

  const handleRejectIncoming = (reason: string, unavailableItems?: string[]) => {
    if (incomingOrder) {
      playSound('warning', soundEnabled)
      if (unavailableItems && unavailableItems.length > 0) {
        // Send to waiting_customer status
        const waitingOrder: Order = {
          ...incomingOrder,
          status: 'waiting_customer' as OrderStatus,
          rejectionReason: reason,
          unavailableItems,
          waitingForCustomerSince: new Date(),
          items: incomingOrder.items.map(item => ({
            ...item,
            unavailable: unavailableItems.includes(item.name)
          }))
        }
        setOrders(prev => [waitingOrder, ...prev])
      } else {
        // Fully rejected
        setCompletedOrders(prev => [...prev, { ...incomingOrder, status: 'rejected' as OrderStatus, rejectionReason: reason }])
      }
      setIncomingOrder(null)
    }
  }

  const handleAcceptOrder = (orderId: string, estimatedTime: number) => {
    playSound('orderReady', soundEnabled)
    // API: persistiere im DB
    fetch(`/api/lieferdienst/orders/${orderId}/accept`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ etaMinutes: estimatedTime }),
    }).catch((e) => console.error('Accept-API failed', e));
    setOrders(prev => 
      prev.map(order => 
        order.id === orderId 
          ? { 
              ...order, 
              status: 'accepted' as OrderStatus, 
              estimatedTime,
              acceptedAt: new Date(),
              processedBy: currentStaff?.id 
            } 
          : order
      )
    )
  }

  const handleRejectOrder = (orderId: string, reason: string, unavailableItems?: string[]) => {
    playSound('warning', soundEnabled)
    if (unavailableItems && unavailableItems.length > 0) {
      setOrders(prev => 
        prev.map(order => 
          order.id === orderId 
            ? { 
                ...order, 
                status: 'waiting_customer' as OrderStatus, 
                rejectionReason: reason,
                unavailableItems,
                waitingForCustomerSince: new Date(),
                items: order.items.map(item => ({
                  ...item,
                  unavailable: unavailableItems.includes(item.name)
                }))
              } 
            : order
        )
      )
    } else {
      setOrders(prev => {
        const order = prev.find(o => o.id === orderId)
        if (order) {
          setCompletedOrders(completed => [...completed, { ...order, status: 'rejected' as OrderStatus, rejectionReason: reason }])
        }
        return prev.filter(o => o.id !== orderId)
      })
    }
  }

  const handleMarkDone = (orderId: string) => {
    // API: persistiere status='fertig' im DB → triggert Frank-Dispatcher
    fetch(`/api/lieferdienst/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'fertig' }),
    }).catch((e) => console.error('Status-API failed', e));
    playSound('orderReady', soundEnabled)
    setOrders(prev => {
      const order = prev.find(o => o.id === orderId)
      if (order) {
        setCompletedOrders(completed => [...completed, { ...order, status: 'done' as OrderStatus }])
      }
      return prev.filter(o => o.id !== orderId)
    })
  }

  const handleCustomerResponded = (orderId: string) => {
    setOrders(prev => 
      prev.map(order => 
        order.id === orderId 
          ? { 
              ...order, 
              status: 'pending' as OrderStatus,
              waitingForCustomerSince: undefined,
              items: order.items.map(item => ({ ...item, unavailable: false }))
            } 
          : order
      )
    )
  }

  const handleCancelOrder = (orderId: string, reason: string) => {
    playSound('warning', soundEnabled)
    setOrders(prev => {
      const order = prev.find(o => o.id === orderId)
      if (order) {
        setCompletedOrders(completed => [...completed, { ...order, status: 'rejected' as OrderStatus, rejectionReason: reason }])
      }
      return prev.filter(o => o.id !== orderId)
    })
  }

  const handleRecallOrder = (order: Order) => {
    setCompletedOrders(prev => prev.filter(o => o.id !== order.id))
    setOrders(prev => [{ ...order, status: 'accepted' as OrderStatus }, ...prev])
    playSound('newOrder', soundEnabled)
  }

  const handleToggleAvailability = (itemId: string) => {
    setMenuItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, available: !item.available } : item
    ))
  }

  const handleAddShiftNote = (message: string, important: boolean) => {
    if (!currentStaff) return
    const newNote: ShiftNote = {
      id: Date.now().toString(),
      staffId: currentStaff.id,
      staffName: currentStaff.name,
      message,
      createdAt: new Date(),
      important,
    }
    setShiftNotes(prev => [newNote, ...prev])
  }

  const handleDeleteShiftNote = (noteId: string) => {
    setShiftNotes(prev => prev.filter(n => n.id !== noteId))
  }

  const handleManualOrder = (order: Order) => {
    playSound('orderReady', soundEnabled)
    setOrders(prev => [order, ...prev])
    setShowManualOrder(false)
  }

  // Keyboard Shortcuts
  const acceptedOrders = orders.filter(o => o.status === 'accepted')

  useKeyboardShortcuts({
    onAcceptFirst: () => {
      // No longer needed - orders are accepted via dialog
    },
    onMarkFirstDone: () => {
      if (acceptedOrders.length > 0) {
        handleMarkDone(acceptedOrders[0].id)
      }
    },
    onToggleSound: () => setSoundEnabled(prev => !prev),
    onOpenSettings: () => setShowSettings(true),
    onEscape: () => {
      setShowSettings(false)
    },
  })

  // Filter orders by station
  const getStationOrders = (orderList: Order[]) => {
    if (currentStation === 'all') return orderList
    const stationConfig = stations.find(s => s.value === currentStation)
    if (!stationConfig) return orderList
    return orderList.filter(order => 
      order.items.some(item => stationConfig.categories.includes(item.category))
    )
  }

  const activeOrders = getStationOrders(orders.filter(o => !['done', 'rejected', 'pending'].includes(o.status)))
  const waitingOrders = orders.filter(o => o.status === 'waiting_customer' || o.status === 'call_customer')

  const filteredOrders = filter === 'all' 
    ? activeOrders
    : filter === 'accepted'
      ? activeOrders.filter(o => o.status === 'accepted')
      : activeOrders.filter(o => o.status === 'waiting_customer' || o.status === 'call_customer')

  const stats = {
    total: activeOrders.length,
    accepted: acceptedOrders.length,
    waiting: waitingOrders.length,
  }

  return (
    <div className="min-h-screen bg-[#F8F6F3] flex">
      {/* Sidebar */}
      <AppSidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        currentStation={currentStation}
        onStationChange={setCurrentStation}
        currentStaff={currentStaff}
        onLogout={() => setCurrentStaff(null)}
        language={language}
        stats={stats}
        activeDrivers={drivers.filter(d => d.status !== 'offline').length}
      />

      <div className="flex-1 flex flex-col min-h-screen">
        {/* Driver Returning Banner */}
        <DriverReturningBanner
          drivers={drivers}
          dismissed={driverBannerDismissed}
          onDismiss={() => setDriverBannerDismissed(true)}
        />

        {/* Fullscreen New Order Dialog */}
        {incomingOrder && (
          <IncomingOrderDialog
            order={incomingOrder}
            onAccept={handleAcceptIncoming}
            onReject={handleRejectIncoming}
          />
        )}

        {/* Header */}
        <header className="sticky top-0 z-10 bg-white border-b border-stone-200">
          <div className="flex items-center justify-between px-3 md:px-6 h-14 md:h-[72px]">
            {/* Status */}
            <div className="flex items-center gap-4">
              {!isOnline && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-lg border border-amber-200">
                  <WifiOff className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-700">Offline</span>
                </div>
              )}
              {isOnline && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-200">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-sm font-medium text-emerald-700">Online</span>
                </div>
              )}
              {hasUnsyncedData && (
                <span className="text-xs text-amber-600">Nicht synchronisiert</span>
              )}
            </div>

            {/* Stats (only show on orders view) */}
            {currentView === 'orders' && (
              <div className="flex items-center gap-3">
                {/* Manual Order Button */}
                <Button
                  onClick={() => setShowManualOrder(!showManualOrder)}
                  className={`h-10 font-semibold rounded-xl transition-all ${
                    showManualOrder 
                      ? 'bg-saffron text-white shadow-lg shadow-saffron/25' 
                      : 'bg-saffron/10 text-saffron border border-saffron/30 hover:bg-saffron/20'
                  }`}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Telefonbestellung
                </Button>

                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl">
                  <ChefHat className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-700">{stats.accepted} In Arbeit</span>
                </div>
                {stats.waiting > 0 && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl animate-pulse">
                    <span className="text-sm font-semibold text-amber-700">{stats.waiting} Wartend</span>
                  </div>
                )}
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-3">
              <KeyboardHelp />
              
              {/* Language Selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Globe className="w-4 h-4" />
                    <span className="uppercase">{language}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setLanguage('de')}>Deutsch</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLanguage('en')}>English</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLanguage('tr')}>Türkçe</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <button 
                onClick={() => setShowSettings(true)}
                className="p-2.5 rounded-xl transition-all bg-stone-100 text-stone-600 border border-stone-200 hover:bg-stone-200"
              >
                <SettingsIcon className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2.5 rounded-xl transition-all ${
                  soundEnabled 
                    ? 'bg-saffron/10 text-saffron border border-saffron/30' 
                    : 'bg-stone-100 text-stone-400 border border-stone-200'
                }`}
              >
                {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>
              <div className="flex items-center gap-2 bg-stone-100 px-4 py-2.5 rounded-xl border border-stone-200">
                <Clock className="w-4 h-4 text-stone-500" />
                <span className="font-mono text-lg font-semibold text-char tracking-tight">
                  {currentTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>

          {/* Filter Tabs (only on orders view) */}
          {currentView === 'orders' && (
            <div className="flex gap-1 px-6 pb-4 pt-1">
              {[
                { key: 'all', label: 'Alle Bestellungen', count: stats.total, color: 'saffron' },
                { key: 'accepted', label: 'In Arbeit', count: stats.accepted, color: 'emerald' },
                { key: 'waiting', label: 'Kundenanfrage', count: stats.waiting, color: 'amber' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key as typeof filter)}
                  className={`px-5 py-2.5 text-sm font-medium rounded-xl transition-all ${
                    filter === tab.key
                      ? tab.color === 'saffron'
                        ? 'bg-saffron text-white shadow-lg shadow-saffron/25'
                        : tab.color === 'emerald'
                          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                          : 'bg-amber-500 text-white shadow-lg shadow-amber-500/25'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          )}
        </header>

        {/* Main Content */}
        <main className="flex-1">
          {currentView === 'orders' && (
            <div className="flex gap-6 p-6 pb-24">
              {/* Manual Order Form - Left Side */}
              {showManualOrder && (
                <div className="w-[380px] flex-shrink-0">
                  <ManualOrderForm
                    onSubmit={handleManualOrder}
                    onCancel={() => setShowManualOrder(false)}
                  />
                </div>
              )}

              {/* Orders Grid - Right Side */}
              <div className="flex-1">
              {filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[60vh]">
                  <div className="w-20 h-20 rounded-2xl bg-stone-100 flex items-center justify-center mb-5 border border-stone-200">
                    <ChefHat className="w-10 h-10 text-stone-400" />
                  </div>
                  <p className="text-xl font-semibold text-char">Keine offenen Bestellungen</p>
                  <p className="text-stone-500 mt-1">Neue Bestellungen erscheinen automatisch</p>
                </div>
              ) : (
                <div className={`grid gap-4 ${
                  settings.display.gridColumns === 3 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' :
                  settings.display.gridColumns === 4 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' :
                  settings.display.gridColumns === 5 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5' :
                  'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6'
                }`}>
                  {filteredOrders
                    .sort((a, b) => {
                      // Priority sort
                      const priorityOrder = { vip: 0, express: 1, rush: 2, normal: 3 }
                      const aPriority = priorityOrder[a.priority || 'normal']
                      const bPriority = priorityOrder[b.priority || 'normal']
                      if (aPriority !== bPriority) return aPriority - bPriority

                      const statusOrder: Record<OrderStatus, number> = { 
                        call_customer: 0, 
                        waiting_customer: 1, 
                        pending: 2, 
                        accepted: 3,
                        done: 4,
                        rejected: 5
                      }
                      if (statusOrder[a.status] !== statusOrder[b.status]) {
                        return statusOrder[a.status] - statusOrder[b.status]
                      }
                      return b.createdAt.getTime() - a.createdAt.getTime()
                    })
                    .map(order => (
                      <OrderCard 
                        key={order.id} 
                        order={order}
                        currentTime={currentTime}
                        onAccept={handleAcceptOrder}
                        onReject={handleRejectOrder}
                        onMarkDone={handleMarkDone}
                        onCustomerResponded={handleCustomerResponded}
                        onCancel={handleCancelOrder}
                      />
                    ))}
                </div>
              )}
              </div>
            </div>
          )}

          {currentView === 'stats' && (
            <StatisticsView orders={orders} completedOrders={completedOrders} />
          )}

          {currentView === 'history' && (
            <HistoryView completedOrders={completedOrders} onRecall={handleRecallOrder} />
          )}

          {currentView === 'menu' && (
            <MenuView menuItems={menuItems} onToggleAvailability={handleToggleAvailability} />
          )}

          {currentView === 'notes' && (
            <ShiftNotesView 
              notes={shiftNotes}
              currentStaff={currentStaff}
              onAddNote={handleAddShiftNote}
              onDeleteNote={handleDeleteShiftNote}
            />
          )}

          {currentView === 'drivers' && (
            <DriversView drivers={drivers} />
          )}
        </main>

        {/* Settings Dialog */}
        <SettingsDialog
          open={showSettings}
          onOpenChange={setShowSettings}
          settings={settings}
          onSave={setSettings}
        />

        {/* Mobile Bottom-Nav (nur <md sichtbar) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-stone-200 grid grid-cols-5 h-[64px] safe-bottom">
          {[
            { key: 'orders' as const, icon: '📋', label: 'Orders', badge: stats.total },
            { key: 'drivers' as const, icon: '🚗', label: 'Fahrer', badge: drivers.filter(d => d.status !== 'offline').length },
            { key: 'stats' as const, icon: '📊', label: 'Stats' },
            { key: 'history' as const, icon: '🕐', label: 'Historie' },
            { key: 'menu' as const, icon: '🍽️', label: 'Artikel' },
          ].map((n) => {
            const active = currentView === n.key;
            return (
              <button
                key={n.key}
                onClick={() => setCurrentView(n.key as any)}
                className={`flex flex-col items-center justify-center gap-0.5 transition relative ${active ? 'text-saffron' : 'text-stone-500'}`}
              >
                <span className="text-lg">{n.icon}</span>
                <span className="text-[10px] font-bold leading-none">{n.label}</span>
                {n.badge ? (
                  <span className="absolute top-1 right-2 min-w-[18px] h-[18px] grid place-items-center text-[10px] font-bold rounded-full bg-saffron text-white px-1">
                    {n.badge}
                  </span>
                ) : null}
                {active && <span className="absolute top-0 inset-x-4 h-0.5 bg-saffron rounded-full" />}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  )
}