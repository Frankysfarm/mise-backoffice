'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis } from 'recharts'
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
  Settings as SettingsIcon, WifiOff, Globe, Phone, TrendingUp,
  BarChart3, Euro, AlertTriangle, CheckCircle2, XCircle, Route,
  Award, Target, Star, MapPin, ArrowRight, Activity, Zap,
  Calendar, ChevronUp, ChevronDown, Loader2,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { OpsSnapshotPanel } from './ops-snapshot-panel'
import { LiveMetricsStrip } from './live-metrics-strip'
import { FahrerRangliste } from './fahrer-rangliste'
import { OpsStatusWidget } from './ops-status-widget'
import { SchichtUmsatzChart } from './schicht-umsatz-chart'
import { ShiftKPIStrip } from '@/components/lieferdienst/shift-kpi-strip'
import { ReviewFlagsPanel } from './review-flags-panel'
import { TagesabschlussModal } from './tagesabschluss'
import { RealtimeFlowChart } from '@/components/lieferdienst/realtime-flow-chart'
import { SchichtPrognosePanel } from './schicht-prognose'
import { DeliveryLiveKpiPanel } from './delivery-live-kpi'
import { TourPerformancePanel } from './tour-performance-panel'
import { ZonePerformanceKpi } from './zone-performance-kpi'
import { LiveOpsHeader } from './live-ops-header'
import { DeliveryStatsRealtime } from './delivery-stats-realtime'
import { SchichtZielePanel } from './schicht-ziele-panel'
import { SchichtVergleich } from './schicht-vergleich'
import { StundenUmsatzMatrix } from './stunden-umsatz-matrix'
import { TagesVerlaufVergleich } from './tages-verlauf-vergleich'
import { SchichtAnalyticsPanel } from './schicht-analytics-panel'
import { EchtzeitCockpit } from './echtzeit-cockpit'
import { EchtzeitPerformance } from './echtzeit-performance'
import { SchichtKpiGrid } from './schicht-kpi-grid'
import { CreditCard } from 'lucide-react'
import { PushAnalyticsMiniCard } from './push-analytics-mini-card'
import { ProfitKpiStrip } from './profit-kpi-strip'
import { WochenUmsatzPanel } from './wochen-umsatz-panel'
import { TagesZielPanel } from './tages-ziel-panel'
import { ZoneErtragPanel } from './zone-ertrag-panel'
import { SchichtSchnellBar } from './schicht-schnell-bar'
import { ZoneAmpel } from './zone-ampel'
import { SchichtEchtzeitKPI } from './schicht-echtzeit-kpi'
import { NachfragePrognoseMini } from './nachfrage-prognose-mini'
import { StundenUmsatzTicker } from './stunden-umsatz-ticker'
import { LieferdienstStatsDashboard } from './lieferdienst-stats-dashboard'
import { SchichtPunktlichkeitsRing } from './schicht-punktlichkeits-ring'
import { RentabilitaetsTrend } from './rentabilitaets-trend'
import { TrinkgeldUebersicht } from './trinkgeld-uebersicht'
import { LieferzonenHeatmap } from './lieferzonen-heatmap'
import { TagesauswertungsBanner } from './tagesauswertungs-banner'
import { KundenFeedbackUebersicht } from './kunden-feedback-uebersicht'
import { WetterKpiKarte } from './wetter-kpi-karte'
import { FahrerPerformanceScore } from './fahrer-performance-score'
import { ZonenVergleichPanel } from './zonen-vergleich-panel'
import { SchichtProfitKarte } from './schicht-profit-karte'
import { KapazitaetsWochenKpi } from './kapazitaets-wochen-kpi'
import { AktivFahrerKacheln } from './aktiv-fahrer-kacheln'
import { SchichtAutoDraftStrip } from './schicht-auto-draft-strip'
import { SchichtEchtzeitBilanz } from './schicht-echtzeit-bilanz'
import { IncentiveTagesUebersicht } from './incentive-tages-uebersicht'
import { LiveOpsStats } from './live-ops-stats'
import { SchichtEchtzeitRangliste } from './schicht-echtzeit-rangliste'
import { SchichtKpiTopBar } from './schicht-kpi-topbar'
import { SchichtVerlaufsKurve } from './schicht-verlaufs-kurve'
import { SchichtAbschlussPrognose } from './schicht-abschluss-prognose'
import { LiveErloesPrognose } from './live-erloes-prognose'
import { SchichtKurzauswertung } from './schicht-kurzauswertung'
import { SchichtLiveKpiPanel } from './schicht-live-kpi-panel'
import { WochenBilanzKarte } from './wochen-bilanz-karte'
import { FahrerAuslastungsMatrix } from './fahrer-auslastungs-matrix'
import { SchichtEchtzeitAmpel } from './schicht-echtzeit-ampel'
import { ZonenAktivitaetsStrip } from './zonen-aktivitaets-strip'
import { NachwuchsFahrerPanel } from './nachwuchs-fahrer-panel'
import { LiveKpiAmpel } from './live-kpi-ampel'
import { DeliveryHeatKalender } from './delivery-heat-kalender'
import { SchichtProfilKarte } from './schicht-profil-karte'
import { StundenHochrechnung } from './stunden-hochrechnung'
import { StornoquotePanel } from './stornoquote-panel'
import { SchichtKostenErtragBilanz } from './schicht-kosten-ertrag-bilanz'
import { SchichtZielErreichtPanel } from './schicht-ziel-erreicht-panel'
import { LieferdienstItemNachfrageWidget } from './item-nachfrage-widget'
import { SchichtEchtzeitGewinn } from './schicht-echtzeit-gewinn'
import { SchichtBestelltrendKarte } from './schicht-bestelltrend'
import { RueckkehrPrognoseKacheln } from './rueckkehr-prognose-kacheln'
import { FahrerPraesenzTracker } from './fahrer-praesenz-tracker'
import { SchichtRentabilitaetsAmpel } from './schicht-rentabilitaets-ampel'
import { SurgeAnalysePanel } from './surge-analyse-panel'
import { SchichtKennzahlenCockpit } from './schicht-kennzahlen-cockpit'
import { TagesZielCockpit } from './tages-ziel-cockpit'
import { SchichtzielKonfigPanel } from './schichtziel-konfig-panel'
import { PersonalPlanungMatrix } from './personal-planung-matrix'

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
  const [currentView, setCurrentView] = useState<'orders' | 'stats' | 'history' | 'menu' | 'staff' | 'notes' | 'drivers' | 'reviews'>('orders')
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

  // Streak — aufeinanderfolgende pünktliche Abschlüsse
  const [prepStreak, setPrepStreak] = useState(0)
  const [streakFlash, setStreakFlash] = useState(false)

  // Tagesabschluss modal
  const [showTagesabschluss, setShowTagesabschluss] = useState(false)
  const locationId = 'bb01ae0a-da47-48b1-b986-3a1201aacc4b'
  const [queueSignal, setQueueSignal] = useState<{ signal: string; etaExtension: number } | null>(null)

  useEffect(() => {
    const poll = () => {
      fetch(`/api/delivery/eta/live?location_id=${locationId}`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.queue_signal) setQueueSignal({ signal: d.queue_signal, etaExtension: d.eta_extension_min ?? 0 }); })
        .catch(() => {});
    };
    poll();
    const iv = setInterval(poll, 60_000);
    return () => clearInterval(iv);
  }, []);

  // === REAL DB-DATA INJECTION (Supabase Realtime + 30s Fallback-Poll) ===
  const fetchDataRef = useRef<(() => void) | null>(null);
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
    fetchDataRef.current = fetchData;
    fetchData();

    // Realtime: trigger re-fetch on any order change
    const supabase = createClient();
    const channel = supabase
      .channel('lieferdienst-orders-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_batches' }, () => {
        fetchData();
      })
      .subscribe();

    // 30s fallback poll (instead of 8s) — realtime handles the fast path
    const t = setInterval(fetchData, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
      supabase.removeChannel(channel);
    };
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

  // Schichtstart: merke ersten Mount
  const schichtStart = useState<Date>(() => new Date())[0]
  const schichtMinutes = Math.floor((currentTime.getTime() - schichtStart.getTime()) / 60_000)
  const schichtHours = Math.floor(schichtMinutes / 60)
  const schichtRestMin = schichtMinutes % 60

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
        // Streak: pünktlich wenn acceptedAt vorhanden und Abschluss ≤ estimatedTime + 5 Min
        const withinTime = (() => {
          if (!order.acceptedAt || !order.estimatedTime) return true;
          const elapsedMin = (Date.now() - new Date(order.acceptedAt).getTime()) / 60_000;
          return elapsedMin <= (order.estimatedTime + 5);
        })();
        setPrepStreak(s => {
          const next = withinTime ? s + 1 : 0;
          if (next > 0 && next % 3 === 0) {
            setStreakFlash(true);
            setTimeout(() => setStreakFlash(false), 2500);
          }
          return next;
        });
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
    setPrepStreak(0)
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

        {/* Tagesabschluss Modal */}
        {showTagesabschluss && (
          <TagesabschlussModal
            locationId={locationId}
            onClose={() => setShowTagesabschluss(false)}
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
                {schichtMinutes >= 10 && completedOrders.length > 0 && (
                  <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 px-4 py-2 rounded-xl" title="Bestellungen pro Stunde diese Schicht">
                    <TrendingUp className="w-4 h-4 text-violet-600" />
                    <span className="text-sm font-semibold text-violet-700">
                      {Math.round((completedOrders.length / schichtMinutes) * 60)}/h
                    </span>
                  </div>
                )}
                {completedOrders.length > 0 && (
                  <div className="flex items-center gap-2 bg-matcha-50 border border-matcha-200 px-4 py-2 rounded-xl" title="Heute abgeschlossene Bestellungen">
                    <Package className="w-4 h-4 text-matcha-600" />
                    <span className="text-sm font-semibold text-matcha-700">{completedOrders.length} heute fertig</span>
                  </div>
                )}
                {(() => {
                  const timed = completedOrders.filter(o => o.acceptedAt && o.doneAt)
                  if (timed.length < 2) return null
                  const avgMin = timed.reduce((s, o) => s + (new Date(o.doneAt!).getTime() - new Date(o.acceptedAt!).getTime()) / 60_000, 0) / timed.length
                  const color = avgMin <= 20 ? 'text-matcha-700 bg-matcha-50 border-matcha-200' : avgMin <= 30 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200'
                  return (
                    <div className={`flex items-center gap-2 border px-4 py-2 rounded-xl ${color}`} title="Durchschnittliche Bearbeitungszeit heute">
                      <Clock className="w-4 h-4 shrink-0" />
                      <span className="text-sm font-semibold tabular-nums">⌀ {Math.round(avgMin)} Min</span>
                    </div>
                  )
                })()}
                {prepStreak >= 3 && (
                  <div className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all ${
                    streakFlash
                      ? 'bg-orange-400 border border-orange-500 scale-110 shadow-lg shadow-orange-400/40'
                      : 'bg-orange-50 border border-orange-200'
                  }`} title="Aufeinanderfolgende pünktliche Abschlüsse">
                    <span className="text-base">🔥</span>
                    <span className={`text-sm font-black tabular-nums ${streakFlash ? 'text-white' : 'text-orange-700'}`}>
                      {prepStreak}x Streak
                    </span>
                  </div>
                )}
                {queueSignal?.signal === 'surge' && (
                  <div className="flex items-center gap-1.5 bg-red-50 border border-red-300 px-3 py-2 rounded-xl animate-pulse" title={`ETA +${queueSignal.etaExtension} Min durch Surge`}>
                    <Zap className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="text-sm font-bold text-red-700">Surge +{queueSignal.etaExtension} Min</span>
                  </div>
                )}
                {queueSignal?.signal === 'paused' && (
                  <div className="flex items-center gap-1.5 bg-red-600 border border-red-700 px-3 py-2 rounded-xl" title="Bestellannahme pausiert">
                    <span className="text-sm font-bold text-white">⏸ Pausiert</span>
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
                onClick={() => setShowTagesabschluss(true)}
                className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-sm font-bold"
                title="Tagesabschluss anzeigen"
              >
                <TrendingUp className="w-4 h-4" />
                Abschluss
              </button>

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
                {schichtMinutes > 0 && (
                  <span className="text-xs text-stone-400 font-medium border-l border-stone-300 pl-2">
                    Schicht {schichtHours > 0 ? `${schichtHours}h ` : ''}{schichtRestMin}m
                  </span>
                )}
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
          {/* Live-Metriken: kompakte KPI-Leiste (immer sichtbar im Bestellbereich) */}
          {currentView === 'orders' && (
            <LiveMetricsStrip locationId="bb01ae0a-da47-48b1-b986-3a1201aacc4b" />
          )}
          {/* Live-Ops-Header: Auslastung, Fahrer, ETA — kompakter Status-Chip */}
          {currentView === 'orders' && (
            <div className="px-6 pt-3">
              <LiveOpsHeader locationId="bb01ae0a-da47-48b1-b986-3a1201aacc4b" />
            </div>
          )}
          {/* Phase 220: Live-Ops-Stats — 2×3 Grid mit Echtzeit-Betriebskennzahlen */}
          {currentView === 'orders' && (
            <div className="px-6 pt-3">
              <LiveOpsStats orders={orders} drivers={drivers} />
            </div>
          )}
          {/* Phase 249: Zonen-Aktivitäts-Strip — Echtzeit-Ampel je Lieferzone */}
          {currentView === 'orders' && (
            <div className="px-6 pt-2">
              <ZonenAktivitaetsStrip />
            </div>
          )}
          {/* Schicht-KPI-TopBar: kompakter Live-Streifen mit Umsatz, Lieferungen, Ø Zeit, Pünktlichkeit, Fahrer */}
          {currentView === 'orders' && (
            <div className="px-6 pt-2">
              <SchichtKpiTopBar />
            </div>
          )}
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
              {/* Live-KPI-Strip */}
              {(() => {
                const allToday = [...orders, ...completedOrders]
                const rejected = completedOrders.filter(o => o.status === 'rejected')
                const done = completedOrders.filter(o => o.status === 'done')
                const revenue = done.reduce((s, o) => s + ((o as any).total ?? (o as any).gesamtbetrag ?? 0), 0)
                const rejRate = allToday.length > 0 ? Math.round((rejected.length / allToday.length) * 100) : 0
                const prepTimes = done
                  .filter(o => o.acceptedAt && o.doneAt)
                  .map(o => (new Date(o.doneAt!).getTime() - new Date(o.acceptedAt!).getTime()) / 60_000)
                const avgPrep = prepTimes.length > 0 ? Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length) : null
                const ordersPerHour = schichtMinutes >= 5 ? Math.round((allToday.length / schichtMinutes) * 60 * 10) / 10 : null
                if (allToday.length === 0) return null
                return (
                  <div className="mb-4 grid grid-cols-2 md:grid-cols-5 gap-2">
                    <div className="rounded-xl bg-white border border-stone-200 px-3 py-2.5">
                      <div className="text-[9px] font-black uppercase tracking-wider text-stone-400 mb-0.5">Heute gesamt</div>
                      <div className="text-xl font-black text-char tabular-nums">{allToday.length}</div>
                      <div className="text-[10px] text-stone-400 mt-0.5">{done.length} fertig</div>
                    </div>
                    {revenue > 0 && (
                      <div className="rounded-xl bg-white border border-stone-200 px-3 py-2.5">
                        <div className="text-[9px] font-black uppercase tracking-wider text-stone-400 mb-0.5">Umsatz</div>
                        <div className="text-xl font-black text-emerald-700 tabular-nums">
                          {revenue.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                        </div>
                        <div className="text-[10px] text-stone-400 mt-0.5">fertige Bestellungen</div>
                      </div>
                    )}
                    {avgPrep !== null && (
                      <div className="rounded-xl bg-white border border-stone-200 px-3 py-2.5">
                        <div className="text-[9px] font-black uppercase tracking-wider text-stone-400 mb-0.5">Ø Zubereitungszeit</div>
                        <div className={`text-xl font-black tabular-nums ${avgPrep > 25 ? 'text-red-600' : avgPrep > 18 ? 'text-amber-600' : 'text-emerald-700'}`}>
                          {avgPrep} Min
                        </div>
                        <div className="text-[10px] text-stone-400 mt-0.5">{prepTimes.length} Messwerte</div>
                      </div>
                    )}
                    <div className={`rounded-xl border px-3 py-2.5 ${rejRate >= 10 ? 'bg-red-50 border-red-200 animate-pulse' : 'bg-white border-stone-200'}`}>
                      <div className="text-[9px] font-black uppercase tracking-wider text-stone-400 mb-0.5">Ablehnungsrate</div>
                      <div className={`text-xl font-black tabular-nums ${rejRate >= 10 ? 'text-red-700' : rejRate > 5 ? 'text-amber-600' : 'text-emerald-700'}`}>
                        {rejRate}%
                      </div>
                      <div className="text-[10px] text-stone-400 mt-0.5">{rejected.length} abgelehnt</div>
                    </div>
                    {ordersPerHour !== null && (
                      <div className={`rounded-xl border px-3 py-2.5 ${ordersPerHour >= 10 ? 'bg-emerald-50 border-emerald-200' : ordersPerHour >= 5 ? 'bg-white border-stone-200' : 'bg-amber-50 border-amber-200'}`}>
                        <div className="text-[9px] font-black uppercase tracking-wider text-stone-400 mb-0.5">Schicht-Tempo</div>
                        <div className={`text-xl font-black tabular-nums ${ordersPerHour >= 10 ? 'text-emerald-700' : ordersPerHour >= 5 ? 'text-char' : 'text-amber-700'}`}>
                          {ordersPerHour}/h
                        </div>
                        <div className="text-[10px] text-stone-400 mt-0.5">Bestellungen/Std</div>
                      </div>
                    )}
                  </div>
                )
              })()}
              {/* Stunden-Sparkline: Bestellvolumen der letzten Schichtstunden */}
              {(() => {
                const allToday = [...orders, ...completedOrders]
                if (allToday.length < 3) return null
                const nowH = new Date().getHours()
                // Zeige bis zu 8 Stunden rückwärts
                const hours: { h: number; count: number }[] = []
                for (let i = 7; i >= 0; i--) {
                  const h = (nowH - i + 24) % 24
                  const count = allToday.filter(o => {
                    const t = (o as any).createdAt ?? (o as any).bestellt_am
                    if (!t) return false
                    return new Date(t).getHours() === h
                  }).length
                  hours.push({ h, count })
                }
                const maxCount = Math.max(...hours.map(x => x.count), 1)
                if (hours.every(x => x.count === 0)) return null
                return (
                  <div className="mb-4 rounded-xl bg-white border border-stone-200 px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] font-black uppercase tracking-wider text-stone-400">Bestellungen je Stunde</span>
                      <span className="text-[9px] text-stone-400 tabular-nums">letzte 8h</span>
                    </div>
                    <div className="flex items-end gap-1 h-10">
                      {hours.map(({ h, count }) => {
                        const isNow = h === nowH
                        const pct = Math.max(4, Math.round((count / maxCount) * 100))
                        return (
                          <div key={h} className="flex-1 flex flex-col items-center gap-0.5">
                            <div
                              className={`w-full rounded-t-sm transition-all ${isNow ? 'bg-amber-400' : count > 0 ? 'bg-stone-300' : 'bg-stone-100'}`}
                              style={{ height: `${pct}%` }}
                              title={`${h}:00 – ${count} Bestellungen`}
                            />
                            <span className={`text-[8px] tabular-nums font-bold ${isNow ? 'text-amber-600' : 'text-stone-400'}`}>{h}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
              {/* Schicht-Ziellinie: Fortschritt gegenüber geschätztem Schichtziel */}
              {(() => {
                const allToday = [...orders, ...completedOrders]
                if (allToday.length < 2 || schichtMinutes < 10) return null
                // Projektion: aktuelles Tempo × verbleibende Zeit bis Schichtende (8h)
                const schichtDauerMin = 8 * 60
                const zielBestellungen = Math.round((allToday.length / schichtMinutes) * schichtDauerMin)
                const fortschrittPct = Math.min(100, Math.round((schichtMinutes / schichtDauerMin) * 100))
                const done = completedOrders.filter(o => o.status === 'done')
                const onTime = done.filter(o => {
                  if (!o.acceptedAt || !o.doneAt) return false
                  const min = (new Date(o.doneAt).getTime() - new Date(o.acceptedAt).getTime()) / 60_000
                  return min <= 20
                }).length
                const onTimePct = done.length > 0 ? Math.round((onTime / done.length) * 100) : null
                return (
                  <div className="mb-4 rounded-xl bg-white border border-stone-200 px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] font-black uppercase tracking-wider text-stone-400">Schichtfortschritt</span>
                      <span className="text-[9px] text-stone-400 tabular-nums">
                        {schichtHours > 0 ? `${schichtHours}h ` : ''}{schichtRestMin}m / 8h
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-stone-100 overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full transition-all ${fortschrittPct >= 75 ? 'bg-emerald-500' : fortschrittPct >= 40 ? 'bg-amber-400' : 'bg-stone-300'}`}
                        style={{ width: `${fortschrittPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-stone-500">
                        Projektion: <span className="font-black text-char">{zielBestellungen}</span> Bestellungen heute
                      </span>
                      {onTimePct !== null && (
                        <span className={`font-black ${onTimePct >= 80 ? 'text-emerald-700' : onTimePct >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                          {onTimePct}% pünktlich
                        </span>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* Live-Lieferungs-Statusbar */}
              {(() => {
                const activeDrivers = drivers.filter(d => d.status !== 'offline')
                const delOrders = orders.filter(o => (o as any).typ === 'lieferung' || (o as any).type === 'delivery')
                const unterwegs = orders.filter(o => ['delivering', 'on_the_way', 'unterwegs'].includes((o as any).status ?? ''))
                if (activeDrivers.length === 0 && unterwegs.length === 0) return null
                return (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {activeDrivers.length > 0 && (
                      <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700">
                        <Truck className="w-3.5 h-3.5" />
                        {activeDrivers.length} Fahrer aktiv
                        {activeDrivers.filter(d => d.status === 'delivering').length > 0 && (
                          <span className="ml-1 rounded-full bg-emerald-200 px-1.5 py-0.5 text-[10px] font-bold">
                            {activeDrivers.filter(d => d.status === 'delivering').length} unterwegs
                          </span>
                        )}
                      </div>
                    )}
                    {delOrders.length > 0 && (
                      <div className="flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700">
                        <Package className="w-3.5 h-3.5" />
                        {delOrders.length} Lieferbestellung{delOrders.length !== 1 ? 'en' : ''}
                      </div>
                    )}
                    {unterwegs.length > 0 && (
                      <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700 animate-pulse">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        {unterwegs.length} gerade unterwegs
                      </div>
                    )}
                    <a
                      href="/dispatch"
                      className="flex items-center gap-1.5 rounded-xl bg-stone-100 border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-200 transition"
                    >
                      Dispatch-Board →
                    </a>
                  </div>
                )
              })()}
              {/* Fahrer-Rangliste heute */}
              <FahrerRangliste locationId="bb01ae0a-da47-48b1-b986-3a1201aacc4b" />

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
                      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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
            <div className="p-6 space-y-6">
              {/* Phase 305: Surge-Analyse-Panel — Nachfragespitzen-Analyse mit Z-Score + Trend (Phase 304 Backend) */}
              <SurgeAnalysePanel locationId={locationId} />
              {/* Phase 301: Schicht-Rentabilitäts-Ampel — Traffic-Light für aktuelle Schicht-Profitabilität */}
              <SchichtRentabilitaetsAmpel locationId={locationId} />
              {/* Echtzeit-Gewinn-Rechner: Revenue − Fahrerkosten − Plattformgebühren = Nettogewinn live */}
              <SchichtEchtzeitGewinn />
              {/* Phase 275: Fahrer-Rückkehr-Prognose — KI-basierte Return-to-Base Vorhersage mit Konfidenz */}
              <RueckkehrPrognoseKacheln locationId={locationId} />
              {/* Bestelltrend-Karte: Stündliches Bestellvolumen dieser Schicht vs. Vorwoche mit Pace-Indikator */}
              <SchichtBestelltrendKarte locationId={locationId} />
              {/* Phase 260: Schicht-Profil-Karte — Stündliche Verteilung + KPI-Summary der aktuellen Schicht */}
              <SchichtProfilKarte locationId={locationId} />
              {/* Phase 222: Incentive-Tages-Übersicht — Fahrer-Bonus-Pool, genehmigt/ausstehend, Top-Verdiener */}
              <IncentiveTagesUebersicht locationId={locationId} />
              {/* Schicht-Verlaufs-Kurve: Dual-Axis Lieferverlauf + Health-Score */}
              <SchichtVerlaufsKurve locationId={locationId} />
              {/* Phase 213: Schicht-Echtzeit-Bilanz — Umsatz, Bestellungen, Pünktlichkeitsrate, Fahrer live */}
              <SchichtEchtzeitBilanz locationId={locationId} />
              {/* Phase 207: Kapazitäts-Wochen-KPI — 7-Tage Besetzungsübersicht + Lücken */}
              <KapazitaetsWochenKpi locationId={locationId} />
              {/* Phase 206: Schicht-Profit-Karte — Liefergebühren-Umsatz/Kosten/Marge heute */}
              <SchichtProfitKarte locationId={locationId} />
              {/* Phase 205: Fahrer-Performance-Score — Composite 0-100 Score (Pünktlichkeit + Bewertung + Effizienz) */}
              <FahrerPerformanceScore locationId={locationId} />
              {/* Phase 205: Zonen-Vergleich-Panel — Lieferungen/Zeit/Pünktlichkeit/Umsatz je Zone */}
              <ZonenVergleichPanel />
              {/* Phase 204: Wetter-KPI-Karte — aktueller Wetter-Einfluss auf Lieferzeiten + Nachfrage */}
              <WetterKpiKarte locationId={locationId} />
              {/* Phase 201: Tagesauswertungs-Banner — erscheint ab 20:00 mit Schicht-Zusammenfassung */}
              <TagesauswertungsBanner locationId={locationId} />
              {/* Phase 201: Zonen-Heatmap — Liefervolumen nach Zone A/B/C/D */}
              <LieferzonenHeatmap locationId={locationId} />
              {/* Phase 201: Kunden-Feedback-Übersicht — Ø Bewertung, positiv-Rate, letzte Kommentare */}
              <KundenFeedbackUebersicht locationId={locationId} />
              {/* Phase 210: Schicht-Auto-Draft-Strip — ausstehende Schicht-Entwürfe vom Auto-Shift-Generator */}
              <SchichtAutoDraftStrip locationId={locationId} />
              {/* Phase 233: Schicht-Kurzauswertung — Echtzeit-Vergleich KPIs vs. Ziele */}
              <SchichtKurzauswertung locationId={locationId} />
              {/* Phase 236: Wochenbilanz-Karte — Umsatz/Bestellungen/Pünktlichkeit nach Wochentag */}
              <WochenBilanzKarte locationId={locationId} />
              {/* Phase 238: Fahrer-Auslastungs-Matrix — Auslastung je Fahrer in der aktuellen Schicht */}
              <FahrerAuslastungsMatrix locationId={locationId ?? ''} />
              {/* Schicht-Live-KPI-Panel: Echtzeit-KPIs für die aktuelle Schicht */}
              <SchichtLiveKpiPanel />
              {/* Live-KPI-Ampel: 4-Metrik Echtzeit-Ampel — ETA, Auslastung, Fahrer, Lieferzeit */}
              <LiveKpiAmpel locationId={locationId ?? undefined} />
              {/* Schicht-Echtzeit-Ampel: 3-Farb Systemstatus-Anzeige + Lastkennzahlen */}
              <SchichtEchtzeitAmpel locationId={locationId ?? ''} />
              {/* Phase 251: Nachwuchs-Fahrer-Panel — Ramp-Up-Overview neuer Fahrer */}
              <NachwuchsFahrerPanel locationId={locationId ?? undefined} />
              {/* Phase 255: Bestellungs-Heatmap — 7 Tage × 24h GitHub-Style Heatmap der Bestelldichte */}
              <DeliveryHeatKalender locationId={locationId} />
              {/* Stunden-Hochrechnung: Schicht-Prognose basierend auf aktuellem Tempo — Ziel vs. Prognose Gauge */}
              <StundenHochrechnung />
              {/* Phase 263: Stornoquote-Panel — Tagesverlauf der Stornos mit Gründen + Umsatz-Verlust */}
              <StornoquotePanel locationId={locationId} />
              {/* Phase 265: Schicht-Bilanz — Umsatz vs. Fahrerkosten + Deckungsbeitrag-Gauge */}
              <SchichtKostenErtragBilanz locationId={locationId} />
              {/* Phase 267: Schicht-Ziel-Erreicht-Panel — Live-Zieltracking mit 4 KPIs (Bestellungen, Umsatz, Pünktlichkeit, Lieferzeit) */}
              <SchichtZielErreichtPanel />
              {/* Phase 271: Artikel-Nachfrage-Widget — Lagerampel + Top-Bedarfs-Artikel aus Item-Demand-Prediction */}
              <LieferdienstItemNachfrageWidget locationId={locationId} />
              {/* Schicht-Kennzahlen-Cockpit: Detaillierte Live-KPIs mit Stunden-Chart + Bestellungstypen */}
              <SchichtKennzahlenCockpit locationId={locationId} />
              {/* Tagesziel-Cockpit: Live-Gauge für Bestellungen, Umsatz und Schichtzeit mit Prognose */}
              <TagesZielCockpit locationId={locationId} />
              {/* Phase 308: Schichtziel-Konfigurator — Ziele je Standort setzen (Bestellungen, Umsatz, Schichtdauer) */}
              <SchichtzielKonfigPanel locationId={locationId} />
              {/* Phase 309: Personal-Planungs-Matrix — stündliche Nachfrage vs. Fahreranzahl nächste 8h */}
              <PersonalPlanungMatrix locationId={locationId} />
              {/* Phase 195: Lieferdienst-Statistiken-Dashboard — Schicht-KPIs, Stündliches Volumen, Pünktlichkeit */}
              <LieferdienstStatsDashboard />
              {/* Phase 269: Pünktlichkeits-Ring — Donut-Chart Pünktlichkeitsrate aktueller Schicht + Trend */}
              <SchichtPunktlichkeitsRing locationId={locationId} />
              {/* Live-Erlösprognose: aktueller Umsatz + Hochrechnung bis Schichtende auf Basis Bestellrate */}
              <LiveErloesPrognose locationId={locationId} />
              {/* Schicht-Abschluss-Prognose: Hochrechnung von Umsatz, Lieferungen und SLA bis Schichtende */}
              <SchichtAbschlussPrognose />
              {/* Phase 200: 30-Tage Rentabilitätstrend — Umsatz/Kosten/Marge Zeitreihe */}
              <RentabilitaetsTrend locationId={locationId} />
              {/* Phase 200: Trinkgeld-Übersicht — heute gesammelte Tips + Fahrer-Ranking */}
              <TrinkgeldUebersicht locationId={locationId} />
              {/* Phase 193: Stunden-Umsatz-Ticker — Live-Umsatz der aktuellen Stunde vs. gestern */}
              <StundenUmsatzTicker locationId={locationId} />
              {/* Schicht-Echtzeit-KPI: Sofort-Überblick aktiver Bestellungen, Lieferungen vs. Abholung, Dringlichkeit */}
              <SchichtEchtzeitKPI orders={orders as any} />
              {/* Phase 185: Schicht-Schnell-Bar — kompakte Echtzeit-KPI-Leiste */}
              <SchichtSchnellBar />
              {/* Tagesziele: Bestellungen / Umsatz / Lieferungen / Ø Lieferzeit vs. Schicht-Ziele */}
              <TagesZielPanel orders={orders as any} completedOrders={completedOrders as any} />
              {/* 7-Tage Umsatz & Lieferperformance */}
              <WochenUmsatzPanel />
              {/* Profitabilität KPI-Streifen: Umsatz, Lieferkosten, Marge, Gewinn heute */}
              <ProfitKpiStrip locationId={locationId} />
              {/* Schicht-KPI-Grid: Kompakte Kacheln mit allen wichtigen Schicht-Kennzahlen */}
              <SchichtKpiGrid />
              {/* Push-Analytics: 7-Tage Kanal-Leistung (Phase 175 — VAPID/WhatsApp/Fahrer) */}
              <PushAnalyticsMiniCard />
              {/* Liefer-Abonnements Übersicht: MRR, aktive Abos, Ersparnisse */}
              <LieferdienstAboOverview locationId={locationId} />
              {/* Phase 162: Echtzeit-Cockpit — kompakte 6-KPI-Übersicht mit Animations-Countern */}
              <EchtzeitCockpit locationId={locationId} />
              {/* Echtzeit-Performance: aktuelle Stunde vs. letzte Stunde — Bestellungen, Fahrer, Ø-Zubereitung, Pünktlichkeit */}
              <EchtzeitPerformance />
              {/* Schicht-Ziele: Tagesfortschritt, Lieferquote, SLA-Status */}
              <SchichtZielePanel locationId={locationId} targetOrders={40} />
              {/* Live-Lieferungs-KPIs: Echte Daten aus dem Delivery-System — Heute geliefert, SLA, Ø Zeit, Zonen */}
              <DeliveryLiveKpiPanel />
              {/* Tour-Performance-Analyse: 30-Tage-Trend, Zonen-Effizienz, KI-Empfehlung */}
              <TourPerformancePanel />
              {/* Phase 191: Nachfrage-Prognose Mini — zeigt erwartete Bestellungen nächste 4h */}
              <NachfragePrognoseMini locationId={locationId} />
              {/* Zonen-Echtzeit-Ampel: ruhig/normal/viel/überlastet je Zone */}
              <ZoneAmpel locationId={locationId} />
              {/* Zonen-Performance-KPIs: SLA, Ø Lieferzeit, Abweichung je Zone A–D */}
              <ZonePerformanceKpi locationId={locationId} />
              {/* Schicht-KPI-Leiste: Schnellübersicht der wichtigsten Kennzahlen */}
              <ShiftKPIStrip
                orders={[...orders, ...completedOrders].map(o => ({
                  id: o.id,
                  status: o.status,
                  acceptedAt: o.acceptedAt ? new Date(o.acceptedAt) : null,
                  completedAt: (o as any).doneAt ? new Date((o as any).doneAt) : null,
                  deliveredAt: (o as any).doneAt ? new Date((o as any).doneAt) : null,
                  typ: o.type,
                }))}
                driversOnline={drivers.filter(d => d.status === 'available' || d.status === 'picking_up').length}
                schichtStart={schichtStart}
              />
              {/* Live Ops-Status: Stimmungsmeter für den aktuellen Betrieb */}
              <OpsStatusWidget locationId="bb01ae0a-da47-48b1-b986-3a1201aacc4b" />
              {/* Echtzeit-Bestellpipeline: Live-Funnel aller Auftragsphasen */}
              <LiveOrderFunnelPanel />
              {/* Live Ops-Cockpit: Queue-Status, Revenue, SLA, Fahrer, At-Risk */}
              <OpsSnapshotPanel locationId="bb01ae0a-da47-48b1-b986-3a1201aacc4b" />
              {/* Echtzeit-Liefer-Performance: Heute geliefert, Touren, Ø-ETA, Pünktlichkeit, Score */}
              <DeliveryStatsRealtime />
              {/* Schicht-Analyse: Stündliche Verteilung, Fahrer-Rangliste, Zone-Umsatz */}
              <SchichtAnalyticsPanel />
              {/* Stunden-Umsatz-Matrix: Heatmap der Bestellungen und Umsätze nach Uhrzeit */}
              <StundenUmsatzMatrix />
              {/* Tages-Verlauf: heute vs. gestern, stündlicher Vergleich */}
              <TagesVerlaufVergleich locationId={locationId} />
              {/* Schicht-Vergleich: Diese Woche vs. gleicher Wochentag letzte Woche (Supabase-Live-Daten) */}
              <SchichtVergleich locationId="bb01ae0a-da47-48b1-b986-3a1201aacc4b" />
              {/* Schicht-Umsatz-Chart: Stündlicher Umsatz heute + Vergleich gestern */}
              <SchichtUmsatzChart locationId="bb01ae0a-da47-48b1-b986-3a1201aacc4b" />
              {/* Schicht-Gesamtscore: gewichteter KPI-Score (neu) */}
              <LieferdienstGesamtScore orders={orders} completedOrders={completedOrders} schichtMinutes={schichtMinutes} />
              {/* 7-Tage Wochenübersicht */}
              <LieferdienstWochenvergleich />
              {/* Monatsvergleich: aktueller Monat vs. Vormonat */}
              <LieferdienstMonatsvergleich />
              {/* Stunden-Umsatz-Chart: Bestellungen + Umsatz je Stunde heute */}
              <LieferdienstStundenChart />
              {/* Tagesvergleich: heute vs. gestern */}
              <LieferdienstTagesvergleich orders={orders} completedOrders={completedOrders} schichtMinutes={schichtMinutes} />
              {/* Ablehnungsrate + Kategorien */}
              <LieferdienstRejektionsrate orders={orders} completedOrders={completedOrders} />
              {/* Fahrer-Einsatz Dashboard */}
              <LieferdienstFahrerEinsatz drivers={drivers} />
              {/* Echtzeit-Bestellfluss: Bestellungen pro Stunde (heute) — Live aus lokalem State */}
              <RealtimeFlowChart orders={orders} completedOrders={completedOrders} />
              {/* Liefer-SLA & Durchsatz-KPIs */}
              <LieferdienstDeliveryKpis />
              {/* Fahrer Tages-Ziele */}
              <FahrerTagesZielPanel />
              {/* Zone-Umsatz: Bestellungen + Umsatz nach Lieferzone */}
              <LieferdienstZonenumsatz />
              {/* Phase 184: Zonen-Ertrag Heute — Live-Umsatz + Ø-Lieferzeit je Lieferzone aus Supabase */}
              <ZoneErtragPanel />
              {/* Phase 89: Stündlicher Durchsatz-Sparkline */}
              <LieferdienstDurchsatzPanel />
              {/* Schicht-Prognose mit Tagesziel-Vergleich: visuell + KPI-Grid */}
              <SchichtPrognosePanel />
              {/* Schicht-Prognose: projizierter Tagesabschluss basierend auf aktuellem Tempo */}
              <LieferdienstSchichtPrognose />
              {/* Top-Artikel: meistbestellte Artikel heute */}
              <LieferdienstTopArtikel completedOrders={completedOrders} />
              {/* Lieferpünktlichkeit: Verteilung pünktlich / leicht spät / sehr spät */}
              <LieferdienstZuverlassigkeitsPanel />
              {/* Kundenzufriedenheit: Ø-Rating, positive/negative Rate, Top-Fahrer, Kommentare */}
              <CustomerSatisfactionPanel locationId={locationId} />
              {/* Besetzungsplan: 7-Tage Forecast vs. geplante Schichten */}
              <SchichtPlanPanel locationId={locationId} />
              {/* Liefer-Zonen-Verteilung: wo landen die Bestellungen? */}
              <LieferZonenPanel locationId={locationId} />
              <>
                <LiveDeliveryStatusBar />
                <StatisticsView orders={orders} completedOrders={completedOrders} />
              </>
            </div>
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
            <div className="p-6 space-y-6">
              {/* Schicht-Echtzeit-Rangliste: Live-Leaderboard der aktiven Fahrer nach Lieferungen */}
              <SchichtEchtzeitRangliste />
              {/* Aktive Fahrer: Live-Kacheln mit GPS-Status, aktueller Tour und verbleibenden Stops */}
              <AktivFahrerKacheln locationId={locationId} />
              {/* Phase 300: Fahrer-Präsenz-Tracker — Live online/offline/unterwegs Status + Kapazitäts-Ampel */}
              <FahrerPraesenzTracker locationId={locationId} />
              <DriversView drivers={drivers} />
            </div>
          )}

          {currentView === 'reviews' && (
            <ReviewFlagsPanel locationId="bb01ae0a-da47-48b1-b986-3a1201aacc4b" />
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
/* ---- LieferdienstWochenvergleich ---- */
function LieferdienstWochenvergleich() {
  const supabase = createClient();
  const [data, setData] = useState<{ tag: string; bestellungen: number; umsatz: number; isToday: boolean }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const today = new Date(); today.setHours(23, 59, 59, 999);
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 6); weekAgo.setHours(0, 0, 0, 0);

      const { data: rows } = await supabase
        .from('customer_orders')
        .select('bestellt_am, gesamtbetrag, status')
        .gte('bestellt_am', weekAgo.toISOString())
        .lte('bestellt_am', today.toISOString());

      if (!rows) { setLoading(false); return; }

      const buckets: { tag: string; bestellungen: number; umsatz: number; isToday: boolean }[] = [];
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
        const next = new Date(d); next.setDate(next.getDate() + 1);
        const dayRows = (rows as { bestellt_am: string; gesamtbetrag: number; status: string }[]).filter(r => {
          if (!r.bestellt_am) return false;
          const t = new Date(r.bestellt_am);
          return t >= d && t < next && r.status !== 'storniert';
        });
        buckets.push({
          tag: d.toLocaleDateString('de-DE', { weekday: 'short' }),
          bestellungen: dayRows.length,
          umsatz: dayRows.reduce((s, r) => s + Number(r.gesamtbetrag ?? 0), 0),
          isToday: d.toDateString() === now.toDateString(),
        });
      }
      setData(buckets);
      setLoading(false);
    };
    load().catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return null;
  if (data.every(d => d.bestellungen === 0)) return null;

  const maxOrders = Math.max(...data.map(d => d.bestellungen), 1);
  const totalOrders = data.reduce((s, d) => s + d.bestellungen, 0);
  const totalRevenue = data.reduce((s, d) => s + d.umsatz, 0);
  const avgOrders = Math.round(totalOrders / data.filter(d => d.bestellungen > 0).length) || 0;

  return (
    <div className="rounded-xl bg-white border border-stone-200 px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">7-Tage Übersicht</span>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs font-bold text-char">{totalOrders} Bestellungen</span>
            {totalRevenue > 0 && (
              <span className="text-xs font-bold text-emerald-700">
                {totalRevenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] text-stone-400">∅ pro Tag</div>
          <div className="text-sm font-black text-char tabular-nums">{avgOrders}</div>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="flex items-end gap-1.5 h-20">
        {data.map(({ tag, bestellungen, umsatz, isToday }) => {
          const pct = bestellungen > 0 ? Math.max(10, Math.round((bestellungen / maxOrders) * 100)) : 4;
          const aboveAvg = bestellungen > avgOrders;
          return (
            <div key={tag} className="flex-1 flex flex-col items-center gap-0.5">
              {bestellungen > 0 && (
                <span className={`text-[8px] font-bold tabular-nums ${isToday ? 'text-saffron' : aboveAvg ? 'text-emerald-600' : 'text-stone-400'}`}>
                  {bestellungen}
                </span>
              )}
              <div
                className={`w-full rounded-t-sm transition-all ${
                  isToday ? 'bg-saffron' : aboveAvg ? 'bg-emerald-400' : bestellungen > 0 ? 'bg-stone-300' : 'bg-stone-100'
                }`}
                style={{ height: `${pct}%` }}
                title={`${tag}: ${bestellungen} Bestellungen${umsatz > 0 ? `, ${umsatz.toFixed(0)} €` : ''}`}
              />
              <span className={`text-[8px] font-bold ${isToday ? 'text-saffron' : 'text-stone-400'}`}>{tag}</span>
            </div>
          );
        })}
      </div>

      {/* Legende */}
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-stone-100 text-[9px]">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-saffron inline-block" /> Heute
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" /> Überdurchschnittlich
        </span>
        <span className="flex items-center gap-1 ml-auto text-stone-400">
          Ø {avgOrders} / Tag
        </span>
      </div>
    </div>
  );
}

/* ---- LieferdienstTagesvergleich ---- */
function LieferdienstTagesvergleich({
  orders,
  completedOrders,
  schichtMinutes,
}: {
  orders: Order[];
  completedOrders: Order[];
  schichtMinutes: number;
}) {
  const supabase = createClient();
  const [dbStats, setDbStats] = useState<{
    today: { total: number; revenue: number; avgPrepMin: number | null };
    yesterday: { total: number; revenue: number; avgPrepMin: number | null };
  } | null>(null);

  useEffect(() => {
    // Lade historische Daten direkt aus Supabase (heutige + gestrige abgeschlossene Bestellungen)
    const load = async () => {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);

      const [{ data: todayRows }, { data: yesterdayRows }] = await Promise.all([
        supabase
          .from('customer_orders')
          .select('gesamtbetrag, bestellt_am, bestaetigt_am, fertig_am, status')
          .gte('bestellt_am', todayStart.toISOString())
          .in('status', ['geliefert', 'abgeholt', 'fertig', 'unterwegs', 'storniert']),
        supabase
          .from('customer_orders')
          .select('gesamtbetrag, bestellt_am, bestaetigt_am, fertig_am, status')
          .gte('bestellt_am', yesterdayStart.toISOString())
          .lt('bestellt_am', todayStart.toISOString())
          .in('status', ['geliefert', 'abgeholt', 'fertig', 'storniert']),
      ]);

      const calcStats = (rows: { gesamtbetrag: number; bestaetigt_am: string | null; fertig_am: string | null; status: string }[]) => {
        const done = (rows ?? []).filter(r => !['storniert'].includes(r.status));
        const revenue = done.reduce((s, r) => s + Number(r.gesamtbetrag ?? 0), 0);
        const prepTimes = done
          .filter(r => r.bestaetigt_am && r.fertig_am)
          .map(r => (new Date(r.fertig_am!).getTime() - new Date(r.bestaetigt_am!).getTime()) / 60_000)
          .filter(t => t > 0 && t < 120);
        return {
          total: (rows ?? []).length,
          revenue,
          avgPrepMin: prepTimes.length > 0 ? Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length) : null,
        };
      };

      setDbStats({
        today: calcStats((todayRows ?? []) as any),
        yesterday: calcStats((yesterdayRows ?? []) as any),
      });
    };
    load().catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lokale Daten als Fallback
  const allToday = [...orders, ...completedOrders];
  const done = completedOrders.filter(o => o.status === 'done');
  const revenue = done.reduce((s, o) => s + ((o as any).total ?? (o as any).gesamtbetrag ?? 0), 0);

  const today = dbStats?.today ?? {
    total: allToday.length,
    revenue,
    avgPrepMin: null,
  };
  const yesterday = dbStats?.yesterday ?? null;

  const metrics: { label: string; today: string | number; yesterday: string | number | null; higherIsBetter: boolean }[] = [
    {
      label: 'Bestellungen',
      today: today.total,
      yesterday: yesterday?.total ?? null,
      higherIsBetter: true,
    },
    {
      label: 'Umsatz',
      today: today.revenue > 0 ? `${today.revenue.toFixed(0)} €` : '—',
      yesterday: yesterday?.revenue != null && yesterday.revenue > 0 ? `${yesterday.revenue.toFixed(0)} €` : null,
      higherIsBetter: true,
    },
    {
      label: 'Ø Zubereitung',
      today: today.avgPrepMin != null ? `${today.avgPrepMin} Min` : '—',
      yesterday: yesterday?.avgPrepMin != null ? `${yesterday.avgPrepMin} Min` : null,
      higherIsBetter: false,
    },
  ];

  return (
    <div className="rounded-xl bg-white border border-stone-200 px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">Tagesvergleich</span>
        <div className="flex items-center gap-3 text-[9px] text-stone-400">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-saffron inline-block" /> Heute</span>
          {yesterday && <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-stone-300 inline-block" /> Gestern</span>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {metrics.map(({ label, today: todayVal, yesterday: yestVal, higherIsBetter }) => {
          const todayNum = typeof todayVal === 'number' ? todayVal : parseFloat(String(todayVal));
          const yestNum = yestVal != null ? parseFloat(String(yestVal)) : null;
          const diff = yestNum != null && !isNaN(todayNum) && !isNaN(yestNum) ? todayNum - yestNum : null;
          const isImproved = diff != null ? (higherIsBetter ? diff > 0 : diff < 0) : null;
          return (
            <div key={label} className="text-center">
              <div className="text-[9px] font-black uppercase tracking-wider text-stone-400 mb-1">{label}</div>
              <div className="text-xl font-black text-char tabular-nums">{todayVal}</div>
              {yestVal != null && (
                <div className="text-[9px] text-stone-400 mt-0.5">
                  Gestern: {yestVal}
                  {diff != null && (
                    <span className={`ml-1 font-bold ${isImproved ? 'text-emerald-600' : diff !== 0 ? 'text-red-500' : 'text-stone-400'}`}>
                      {diff > 0 ? `+${diff.toFixed(0)}` : diff < 0 ? `${diff.toFixed(0)}` : '='}
                    </span>
                  )}
                </div>
              )}
              {yestVal == null && yesterday === null && (
                <div className="text-[9px] text-stone-300 mt-0.5">kein Vgl.</div>
              )}
            </div>
          );
        })}
      </div>
      {schichtMinutes > 30 && (
        <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between text-[9px] text-stone-400">
          <span>Schicht läuft seit {Math.floor(schichtMinutes / 60) > 0 ? `${Math.floor(schichtMinutes / 60)}h ` : ''}{schichtMinutes % 60}m</span>
          {today.total > 0 && schichtMinutes > 0 && (
            <span className="font-bold text-stone-600">
              ∅ {(today.total / (schichtMinutes / 60)).toFixed(1)} Bestellungen/h
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ---- LiveDeliveryStatusBar ---- */
function LiveDeliveryStatusBar() {
  const supabase = createClient();
  const [stats, setStats] = useState<{
    driversOnline: number;
    activeTours: number;
    cookingNow: number;
    waitingDispatch: number;
    deliveredToday: number;
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const [
          { count: driversOnline },
          { count: activeTours },
          { count: cookingNow },
          { count: waitingDispatch },
          { count: deliveredToday },
        ] = await Promise.all([
          supabase.from('driver_status').select('*', { count: 'exact', head: true }).eq('ist_online', true),
          supabase.from('delivery_batches').select('*', { count: 'exact', head: true }).in('status', ['unterwegs', 'pickup', 'aktiv']),
          supabase.from('customer_orders').select('*', { count: 'exact', head: true }).eq('status', 'in_zubereitung'),
          supabase.from('customer_orders').select('*', { count: 'exact', head: true }).eq('status', 'fertig').eq('typ', 'lieferung'),
          supabase.from('customer_orders').select('*', { count: 'exact', head: true }).in('status', ['geliefert', 'abgeholt', 'abgeschlossen']).gte('bestellt_am', today.toISOString()),
        ]);
        setStats({
          driversOnline: driversOnline ?? 0,
          activeTours: activeTours ?? 0,
          cookingNow: cookingNow ?? 0,
          waitingDispatch: waitingDispatch ?? 0,
          deliveredToday: deliveredToday ?? 0,
        });
      } catch {}
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!stats) return null;

  const items = [
    { icon: '🟢', label: 'Fahrer online', value: stats.driversOnline, urgent: stats.driversOnline === 0 },
    { icon: '🛵', label: 'Aktive Touren', value: stats.activeTours, urgent: false },
    { icon: '🍳', label: 'In Zubereitung', value: stats.cookingNow, urgent: stats.cookingNow >= 6 },
    { icon: '📦', label: 'Wartet auf Fahrer', value: stats.waitingDispatch, urgent: stats.waitingDispatch >= 3 },
    { icon: '✅', label: 'Heute geliefert', value: stats.deliveredToday, urgent: false },
  ];

  return (
    <div className="grid grid-cols-5 gap-2 mb-4">
      {items.map((item) => (
        <div key={item.label} className={`rounded-xl border px-3 py-2.5 text-center ${item.urgent ? 'border-red-300 bg-red-50' : 'border-stone-200 bg-white'}`}>
          <div className="text-lg mb-0.5">{item.icon}</div>
          <div className={`font-display text-2xl font-black tabular-nums leading-none ${item.urgent ? 'text-red-700' : 'text-char'}`}>
            {item.value}
          </div>
          <div className="text-[9px] font-bold uppercase tracking-wide text-stone-400 mt-0.5 leading-tight">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ---- LieferdienstStundenChart ---- */
function LieferdienstStundenChart() {
  const supabase = createClient();
  type HourBucket = { h: number; label: string; orders: number; revenue: number; isNow: boolean };
  const [data, setData] = useState<HourBucket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const { data: rows } = await supabase
          .from('customer_orders')
          .select('bestellt_am, gesamtbetrag, status')
          .gte('bestellt_am', today.toISOString())
          .not('bestellt_am', 'is', null);

        const nowH = new Date().getHours();
        const buckets: Record<number, { orders: number; revenue: number }> = {};
        for (const r of (rows ?? []) as { bestellt_am: string; gesamtbetrag: number; status: string }[]) {
          const h = new Date(r.bestellt_am).getHours();
          if (!buckets[h]) buckets[h] = { orders: 0, revenue: 0 };
          buckets[h].orders += 1;
          if (!['storniert', 'rejected'].includes(r.status)) {
            buckets[h].revenue += Number(r.gesamtbetrag ?? 0);
          }
        }

        const startH = Math.min(10, nowH);
        const endH = Math.max(nowH, 22);
        const result: HourBucket[] = [];
        for (let h = startH; h <= endH; h++) {
          result.push({
            h, label: `${h}`,
            orders: buckets[h]?.orders ?? 0,
            revenue: Math.round(buckets[h]?.revenue ?? 0),
            isNow: h === nowH,
          });
        }
        setData(result);
      } catch {} finally { setLoading(false); }
    };
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalOrders = data.reduce((s, d) => s + d.orders, 0);
  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const peakHour = data.reduce((best, d) => d.orders > (best?.orders ?? 0) ? d : best, data[0]);

  if (loading) {
    return (
      <div className="rounded-xl bg-white border border-stone-200 px-4 py-4 animate-pulse">
        <div className="h-4 w-40 bg-stone-100 rounded mb-3" />
        <div className="h-24 bg-stone-50 rounded" />
      </div>
    );
  }
  if (data.every(d => d.orders === 0)) return null;

  return (
    <div className="rounded-xl bg-white border border-stone-200 px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-amber-500" />
          <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">Stunden-Performance heute</span>
        </div>
        <div className="flex items-center gap-3 text-[9px] text-stone-400">
          {peakHour && peakHour.orders > 0 && (
            <span className="font-bold text-amber-600">Peak: {peakHour.h}:00 Uhr ({peakHour.orders})</span>
          )}
          <span>{totalOrders} Best. · {totalRevenue.toFixed(0)} €</span>
        </div>
      </div>

      {/* KPI Chips */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { icon: <Package className="h-3.5 w-3.5" />, label: 'Bestellungen', value: totalOrders, color: 'text-amber-600' },
          { icon: <Euro className="h-3.5 w-3.5" />, label: 'Umsatz', value: `${totalRevenue.toFixed(0)} €`, color: 'text-emerald-600' },
          { icon: <TrendingUp className="h-3.5 w-3.5" />, label: 'Ø / Stunde', value: (totalOrders / Math.max(1, data.filter(d => d.orders > 0).length)).toFixed(1), color: 'text-blue-600' },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-lg bg-stone-50 border border-stone-100 px-2.5 py-2 flex items-center gap-2">
            <span className={kpi.color}>{kpi.icon}</span>
            <div>
              <div className={`font-black text-sm tabular-nums ${kpi.color}`}>{kpi.value}</div>
              <div className="text-[8px] font-bold uppercase tracking-wide text-stone-400">{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Dual-Bar Chart: Bestellungen (links) + Umsatz-Linie (rechts) */}
      <ResponsiveContainer width="100%" height={110}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={12}>
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#78716c' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 8, fill: '#a8a29e' }} axisLine={false} tickLine={false} width={28} />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e7e5e4', padding: '6px 10px' }}
            formatter={(val: unknown, name: unknown) =>
              name === 'orders' ? [`${val as number} Bestellungen`, ''] : [`${val as number} €`, 'Umsatz']
            }
            labelFormatter={(h: unknown) => `${h as string}:00 Uhr`}
          />
          <Bar dataKey="orders" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.h}
                fill={entry.isNow ? '#f59e0b' : entry.orders > 0 ? '#d4b896' : '#f5f5f4'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Umsatz Sparkline */}
      <div className="mt-1">
        <div className="flex items-center gap-1 mb-1">
          <span className="h-1 w-4 rounded-full bg-emerald-400 inline-block" />
          <span className="text-[8px] text-stone-400 font-bold uppercase tracking-wide">Umsatz (€)</span>
        </div>
        <ResponsiveContainer width="100%" height={40}>
          <LineChart data={data} margin={{ top: 2, right: 4, left: -20, bottom: 0 }}>
            <YAxis hide domain={['auto', 'auto']} />
            <Line
              type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2}
              dot={false} strokeDasharray="0"
            />
            <Tooltip
              contentStyle={{ fontSize: 10, borderRadius: 6, padding: '4px 8px' }}
              formatter={(v: unknown) => [`${v as number} €`, 'Umsatz']}
              labelFormatter={(h: unknown) => `${h as string}:00 Uhr`}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ---- LieferdienstRejektionsrate ---- */
function LieferdienstRejektionsrate({ orders, completedOrders }: { orders: Order[]; completedOrders: Order[] }) {
  const supabase = createClient();
  type WeekDay = { label: string; total: number; rejected: number; rate: number };
  const [weekData, setWeekData] = useState<WeekDay[]>([]);
  const [topReason, setTopReason] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const days: WeekDay[] = [];
        const today = new Date(); today.setHours(0, 0, 0, 0);
        for (let i = 6; i >= 0; i--) {
          const start = new Date(today); start.setDate(start.getDate() - i);
          const end   = new Date(start); end.setDate(end.getDate() + 1);
          const { data: rows } = await supabase
            .from('customer_orders')
            .select('status')
            .gte('bestellt_am', start.toISOString())
            .lt('bestellt_am', end.toISOString());
          const total = (rows ?? []).length;
          const rejected = (rows ?? []).filter((r: { status: string }) => r.status === 'storniert').length;
          days.push({
            label: i === 0 ? 'Heute' : start.toLocaleDateString('de-DE', { weekday: 'short' }),
            total, rejected, rate: total > 0 ? Math.round((rejected / total) * 100) : 0,
          });
        }
        setWeekData(days);
      } catch {}
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const all = [...orders, ...completedOrders];
  const rejected = completedOrders.filter(o => o.status === 'rejected');
  const total = all.length;
  const rate = total > 0 ? Math.round((rejected.length / total) * 100) : 0;

  const reasons: Record<string, number> = {};
  for (const o of rejected) {
    const r = (o as any).rejectionReason ?? 'Sonstiges';
    reasons[r] = (reasons[r] ?? 0) + 1;
  }
  const topReasonLocal = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const rateColor = rate >= 15 ? 'text-red-600' : rate >= 5 ? 'text-amber-600' : 'text-emerald-600';
  const rateBg   = rate >= 15 ? 'bg-red-50 border-red-200' : rate >= 5 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200';

  return (
    <div className="rounded-xl bg-white border border-stone-200 px-4 py-4">
      <div className="flex items-center gap-2 mb-3">
        <XCircle className="h-4 w-4 text-red-400" />
        <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">Ablehnungsrate</span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className={`rounded-lg border px-3 py-2.5 text-center ${rateBg}`}>
          <div className={`font-black text-2xl tabular-nums leading-none ${rateColor}`}>{rate}%</div>
          <div className="text-[8px] font-bold uppercase tracking-wide text-stone-400 mt-1">Heute</div>
        </div>
        <div className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-2.5 text-center">
          <div className="font-black text-2xl tabular-nums leading-none text-char">{rejected.length}</div>
          <div className="text-[8px] font-bold uppercase tracking-wide text-stone-400 mt-1">Abgelehnt</div>
        </div>
        <div className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-2.5 text-center">
          <div className="font-black text-2xl tabular-nums leading-none text-char">{total}</div>
          <div className="text-[8px] font-bold uppercase tracking-wide text-stone-400 mt-1">Gesamt</div>
        </div>
      </div>

      {/* 7-Tage Rate Balken */}
      {weekData.length > 0 && (
        <>
          <div className="text-[9px] font-bold uppercase tracking-wide text-stone-400 mb-2">7-Tage-Verlauf</div>
          <div className="flex items-end gap-1 h-12">
            {weekData.map((d) => {
              const h = Math.max(4, d.rate);
              const isToday = d.label === 'Heute';
              const color = d.rate >= 15 ? '#ef4444' : d.rate >= 5 ? '#f59e0b' : '#10b981';
              return (
                <div key={d.label} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className="w-full rounded-t-sm transition-all"
                    style={{ height: `${h}%`, backgroundColor: isToday ? color : '#e7e5e4', minHeight: 4 }}
                    title={`${d.label}: ${d.rate}% (${d.rejected}/${d.total})`}
                  />
                  <span className={`text-[8px] tabular-nums font-bold ${isToday ? 'text-stone-700' : 'text-stone-400'}`}>
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2 mt-2 text-[8px] text-stone-400">
            <span className="flex items-center gap-0.5"><span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" /> &lt;5% gut</span>
            <span className="flex items-center gap-0.5"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" /> 5-15% ok</span>
            <span className="flex items-center gap-0.5"><span className="h-2 w-2 rounded-full bg-red-400 inline-block" /> &gt;15% kritisch</span>
          </div>
        </>
      )}

      {(topReasonLocal) && (
        <div className="mt-3 pt-3 border-t border-stone-100 flex items-center gap-2 text-[10px]">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span className="text-stone-500">Häufigster Grund: <span className="font-bold text-stone-700">{topReasonLocal}</span></span>
        </div>
      )}
    </div>
  );
}

/* ---- LieferdienstFahrerEinsatz ---- */
function LieferdienstFahrerEinsatz({ drivers }: { drivers: Driver[] }) {
  const supabase = createClient();
  type DriverRow = {
    id: string; name: string; status: string; vehicle: string;
    deliveries: number; online_seit: string | null;
  };
  const [liveDrivers, setLiveDrivers] = useState<DriverRow[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const { data: statuses } = await supabase
          .from('driver_status')
          .select('employee_id, ist_online, fahrzeug, online_seit, employee:employees(vorname, nachname)')
          .eq('ist_online', true);

        if (!statuses?.length) { setLiveDrivers([]); return; }

        const employeeIds = (statuses as any[]).map((s: any) => s.employee_id);

        // employee_id → mise_drivers.id mapping (driver_id used in batches)
        const { data: miseDrivers } = await supabase
          .from('mise_drivers')
          .select('id, employee_id')
          .in('employee_id', employeeIds);

        const empToDriverId = new Map<string, string>();
        for (const d of (miseDrivers ?? []) as any[]) {
          if (d.employee_id) empToDriverId.set(d.employee_id as string, d.id as string);
        }
        const driverIds = Array.from(empToDriverId.values());

        const { data: batchRows } = await supabase
          .from('mise_delivery_batch_stops')
          .select('batch_id, batch:mise_delivery_batches(driver_id)')
          .not('geliefert_am', 'is', null)
          .gte('geliefert_am', today.toISOString());

        // count by driver_id (mise_drivers.id)
        const deliveryCount: Record<string, number> = {};
        for (const row of (batchRows ?? []) as any[]) {
          const fid = row.batch?.driver_id;
          if (fid && driverIds.includes(fid)) {
            deliveryCount[fid] = (deliveryCount[fid] ?? 0) + 1;
          }
        }

        setLiveDrivers((statuses as any[]).map((s: any) => {
          const driverId = empToDriverId.get(s.employee_id as string);
          return {
            id: s.employee_id,
            name: s.employee ? `${s.employee.vorname} ${s.employee.nachname}` : 'Unbekannt',
            status: 'online',
            vehicle: s.fahrzeug ?? 'auto',
            deliveries: driverId ? (deliveryCount[driverId] ?? 0) : 0,
            online_seit: s.online_seit,
          };
        }));
      } catch {}
    };

    // Also include mock drivers if we have them
    const mockRows: DriverRow[] = drivers
      .filter(d => d.status !== 'offline')
      .map(d => ({
        id: d.id, name: d.name, status: d.status, vehicle: d.vehicleType ?? 'auto',
        deliveries: 0, online_seit: null,
      }));
    setLiveDrivers(mockRows);

    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drivers.length]);

  const vehicleEmoji: Record<string, string> = { bike: '🚲', scooter: '🛵', car: '🚗', auto: '🚗', fahrrad: '🚲', motorrad: '🛵' };

  if (liveDrivers.length === 0) return null;

  return (
    <div className="rounded-xl bg-white border border-stone-200 px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-500" />
          <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">Fahrer im Einsatz</span>
        </div>
        <span className="text-[10px] font-bold text-emerald-600">{liveDrivers.length} online</span>
      </div>

      <div className="space-y-2">
        {liveDrivers.map((d) => {
          const onlineSeit = d.online_seit ? Math.floor((Date.now() - new Date(d.online_seit).getTime()) / 60_000) : null;
          const statusColor = d.status === 'delivering' || d.status === 'unterwegs'
            ? 'bg-amber-100 text-amber-700'
            : d.status === 'available' || d.status === 'online'
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-stone-100 text-stone-500';
          const statusLabel = d.status === 'delivering' ? 'Unterwegs'
            : d.status === 'returning' ? 'Rückfahrt'
            : d.status === 'picking_up' ? 'Abholung'
            : 'Bereit';

          return (
            <div key={d.id} className="flex items-center gap-3 rounded-lg bg-stone-50 border border-stone-100 px-3 py-2">
              <div className="h-8 w-8 rounded-lg bg-stone-200 flex items-center justify-center text-base shrink-0">
                {vehicleEmoji[d.vehicle] ?? '🚗'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-char truncate">{d.name}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${statusColor}`}>{statusLabel}</span>
                  {onlineSeit !== null && (
                    <span className="text-[8px] text-stone-400 tabular-nums">
                      {Math.floor(onlineSeit / 60) > 0 ? `${Math.floor(onlineSeit / 60)}h ` : ''}{onlineSeit % 60}m online
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-black text-base tabular-nums text-char">{d.deliveries}</div>
                <div className="text-[8px] text-stone-400 font-bold uppercase">Lieferungen</div>
              </div>
            </div>
          );
        })}
      </div>

      {liveDrivers.length > 0 && (
        <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between text-[9px] text-stone-400">
          <span>Gesamt heute:</span>
          <span className="font-black text-stone-600 tabular-nums">
            {liveDrivers.reduce((s, d) => s + d.deliveries, 0)} Lieferungen
          </span>
        </div>
      )}
      <DriverLeaderboardMini liveDrivers={liveDrivers} />
    </div>
  );
}

/* ---- DriverLeaderboardMini ---- */
function DriverLeaderboardMini({ liveDrivers }: { liveDrivers: { id: string; name: string; vehicle: string; deliveries: number }[] }) {
  const vehicleEmoji: Record<string, string> = { bike: '🚲', scooter: '🛵', car: '🚗', auto: '🚗', fahrrad: '🚲', motorrad: '🛵' };
  if (liveDrivers.length < 2) return null;

  const sorted = [...liveDrivers].sort((a, b) => b.deliveries - a.deliveries);

  return (
    <div className="rounded-xl bg-white border border-stone-200 px-4 py-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">🏆</span>
        <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">Schicht-Rangliste</span>
      </div>
      <div className="space-y-2">
        {sorted.slice(0, 5).map((d, i) => {
          const maxDel = sorted[0].deliveries || 1;
          const pct = Math.round((d.deliveries / maxDel) * 100);
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
          return (
            <div key={d.id} className="flex items-center gap-2">
              <span className="text-sm w-6 text-center shrink-0">{medal}</span>
              <span className="text-sm shrink-0">{vehicleEmoji[d.vehicle] ?? '🚗'}</span>
              <span className="text-xs font-bold text-char truncate flex-1">{d.name}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="w-16 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                  <div className="h-full rounded-full bg-matcha-400 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[10px] font-black text-stone-600 tabular-nums w-5 text-right">{d.deliveries}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---- LieferdienstDeliveryKpis ---- */
// Liefer-spezifische KPIs: SLA-Pünktlichkeit, Ø-Lieferzeit, ETA-Genauigkeit
function LieferdienstDeliveryKpis() {
  const [sla, setSla] = useState<{
    onTimePct: number;
    avgDeliveryMin: number;
    totalStops: number;
  } | null>(null);
  const [etaAccuracy, setEtaAccuracy] = useState<{
    onTimeRate: number;
    avgErrorMin: number;
    completedDeliveries: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [slaRes, etaRes] = await Promise.all([
          fetch('/api/delivery/admin/sla?days=1').then(r => r.ok ? r.json() : null),
          fetch('/api/delivery/admin/eta-accuracy').then(r => r.ok ? r.json() : null),
        ]);
        if (slaRes?.summary) setSla({
          onTimePct: Math.round(slaRes.summary.onTimePct ?? 0),
          avgDeliveryMin: Math.round(slaRes.summary.avgDeliveryMin ?? 0),
          totalStops: slaRes.summary.totalStops ?? 0,
        });
        if (etaRes?.overall) setEtaAccuracy({
          onTimeRate: Math.round((etaRes.overall.onTimeRate ?? 0) * 100),
          avgErrorMin: Math.round(etaRes.overall.avgErrorMin ?? 0),
          completedDeliveries: etaRes.overall.completedDeliveries ?? 0,
        });
      } catch {} finally { setLoading(false); }
    };
    load();
    const iv = setInterval(load, 120_000);
    return () => clearInterval(iv);
  }, []);

  if (loading) return null;
  if (!sla && !etaAccuracy) return null;

  const kpis = [
    sla && {
      label: 'SLA Pünktlichkeit',
      value: `${sla.onTimePct}%`,
      sub: `${sla.totalStops} Lieferungen`,
      color: sla.onTimePct >= 90 ? 'text-emerald-700' : sla.onTimePct >= 75 ? 'text-amber-700' : 'text-red-700',
      bg: sla.onTimePct >= 90 ? 'bg-emerald-50 border-emerald-200' : sla.onTimePct >= 75 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200',
      bar: sla.onTimePct,
      barColor: sla.onTimePct >= 90 ? 'bg-emerald-400' : sla.onTimePct >= 75 ? 'bg-amber-400' : 'bg-red-400',
    },
    sla && {
      label: 'Ø Lieferzeit',
      value: sla.avgDeliveryMin > 0 ? `${sla.avgDeliveryMin} Min` : '–',
      sub: 'Ziel: ≤35 Min',
      color: sla.avgDeliveryMin <= 35 ? 'text-emerald-700' : sla.avgDeliveryMin <= 45 ? 'text-amber-700' : 'text-red-700',
      bg: sla.avgDeliveryMin <= 35 ? 'bg-emerald-50 border-emerald-200' : sla.avgDeliveryMin <= 45 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200',
      bar: sla.avgDeliveryMin > 0 ? Math.min(100, Math.round((35 / sla.avgDeliveryMin) * 100)) : 0,
      barColor: sla.avgDeliveryMin <= 35 ? 'bg-emerald-400' : sla.avgDeliveryMin <= 45 ? 'bg-amber-400' : 'bg-red-400',
    },
    etaAccuracy && {
      label: 'ETA-Genauigkeit',
      value: `${etaAccuracy.onTimeRate}%`,
      sub: `${etaAccuracy.completedDeliveries} Messungen`,
      color: etaAccuracy.onTimeRate >= 85 ? 'text-emerald-700' : etaAccuracy.onTimeRate >= 70 ? 'text-amber-700' : 'text-red-700',
      bg: etaAccuracy.onTimeRate >= 85 ? 'bg-emerald-50 border-emerald-200' : etaAccuracy.onTimeRate >= 70 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200',
      bar: etaAccuracy.onTimeRate,
      barColor: etaAccuracy.onTimeRate >= 85 ? 'bg-emerald-400' : etaAccuracy.onTimeRate >= 70 ? 'bg-amber-400' : 'bg-red-400',
    },
    etaAccuracy && {
      label: 'Ø ETA-Abweichung',
      value: etaAccuracy.avgErrorMin !== 0 ? `${etaAccuracy.avgErrorMin > 0 ? '+' : ''}${etaAccuracy.avgErrorMin} Min` : '0 Min',
      sub: 'Abweichung heute',
      color: Math.abs(etaAccuracy.avgErrorMin) <= 3 ? 'text-emerald-700' : Math.abs(etaAccuracy.avgErrorMin) <= 8 ? 'text-amber-700' : 'text-red-700',
      bg: Math.abs(etaAccuracy.avgErrorMin) <= 3 ? 'bg-emerald-50 border-emerald-200' : Math.abs(etaAccuracy.avgErrorMin) <= 8 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200',
      bar: Math.max(0, 100 - Math.abs(etaAccuracy.avgErrorMin) * 10),
      barColor: Math.abs(etaAccuracy.avgErrorMin) <= 3 ? 'bg-emerald-400' : Math.abs(etaAccuracy.avgErrorMin) <= 8 ? 'bg-amber-400' : 'bg-red-400',
    },
  ].filter(Boolean) as { label: string; value: string; sub: string; color: string; bg: string; bar: number; barColor: string }[];

  return (
    <div className="rounded-xl bg-white border border-stone-200 px-4 py-4">
      <div className="flex items-center gap-2 mb-4">
        <Route className="h-4 w-4 text-matcha-600" />
        <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">Liefer-KPIs heute</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`rounded-xl border px-3 py-3 ${kpi.bg}`}>
            <div className="text-[9px] font-black uppercase tracking-wider text-stone-500 mb-1">{kpi.label}</div>
            <div className={`text-2xl font-black tabular-nums leading-none ${kpi.color}`}>{kpi.value}</div>
            <div className="text-[9px] text-stone-400 mt-1">{kpi.sub}</div>
            {/* Progress bar */}
            <div className="mt-2 h-1.5 rounded-full bg-stone-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${kpi.barColor}`}
                style={{ width: `${Math.min(100, Math.max(0, kpi.bar))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- FahrerTagesZielPanel ---- */
// Tages-Leistung aller Fahrer mit Fortschrittsbalken gegen ein 20-Stops-Tagesziel
function FahrerTagesZielPanel() {
  const DAILY_TARGET = 20;

  interface LeaderEntry {
    rank: number;
    driverId: string;
    driverName: string | null;
    initials: string;
    stopsCompleted: number;
    onTimeRate: number | null;
    avgRating: number | null;
    earningsEur: number;
  }

  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/delivery/admin/driver-leaderboard?period=today&limit=8');
        if (!res.ok) return;
        const data = await res.json();
        setEntries((data.entries ?? []) as LeaderEntry[]);
      } catch {} finally { setLoading(false); }
    };
    load();
    const iv = setInterval(load, 90_000);
    return () => clearInterval(iv);
  }, []);

  if (loading || entries.length === 0) return null;

  const topStops = entries[0]?.stopsCompleted ?? 0;

  return (
    <div className="rounded-xl bg-white border border-stone-200 px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-matcha-600" />
          <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">
            Fahrer Tages-Ziele
          </span>
        </div>
        <span className="text-[9px] text-stone-400">Ziel: {DAILY_TARGET} Stopps</span>
      </div>

      <div className="space-y-2.5">
        {entries.map((e, i) => {
          const pct = Math.min(100, Math.round((e.stopsCompleted / DAILY_TARGET) * 100));
          const reachedGoal = e.stopsCompleted >= DAILY_TARGET;
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
          const barColor = reachedGoal
            ? 'bg-matcha-500'
            : pct >= 60
            ? 'bg-amber-400'
            : 'bg-stone-300';
          const onTimePct = e.onTimeRate != null ? Math.round(e.onTimeRate * 100) : null;
          const name = e.driverName ?? e.initials;

          return (
            <div key={e.driverId} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm w-5 text-center shrink-0 tabular-nums">
                  {medal ?? <span className="text-[10px] font-bold text-stone-400">{e.rank}.</span>}
                </span>
                <span className="text-xs font-bold text-char flex-1 truncate">{name}</span>
                <div className="flex items-center gap-2 shrink-0 text-[10px] tabular-nums">
                  {onTimePct !== null && (
                    <span className={onTimePct >= 90 ? 'text-emerald-600 font-bold' : onTimePct >= 75 ? 'text-amber-600 font-bold' : 'text-red-500 font-bold'}>
                      {onTimePct}%
                    </span>
                  )}
                  {e.avgRating != null && (
                    <span className="flex items-center gap-0.5 text-amber-500 font-bold">
                      <Star className="h-2.5 w-2.5 fill-amber-400 stroke-amber-400" />
                      {e.avgRating.toFixed(1)}
                    </span>
                  )}
                  <span className="font-black text-stone-700">
                    {e.stopsCompleted}
                    <span className="font-normal text-stone-400">/{DAILY_TARGET}</span>
                  </span>
                  {reachedGoal && (
                    <Award className="h-3.5 w-3.5 text-matcha-500 shrink-0" />
                  )}
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden ml-7">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {topStops >= DAILY_TARGET && (
        <div className="mt-3 pt-3 border-t border-stone-100 flex items-center gap-1.5 text-[10px] text-matcha-600 font-bold">
          <Award className="h-3.5 w-3.5" />
          <span>{entries.filter((e) => e.stopsCompleted >= DAILY_TARGET).length} Fahrer haben das Tagesziel erreicht</span>
        </div>
      )}
    </div>
  );
}

/* ---- LieferdienstZonenumsatz ---- */
function LieferdienstZonenumsatz() {
  const supabase = createClient();
  const [data, setData] = useState<{ zone: string; orders: number; revenue: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const { data: rows } = await supabase
          .from('customer_orders')
          .select('delivery_zone, gesamtbetrag')
          .eq('typ', 'lieferung')
          .gte('bestellt_am', today.toISOString())
          .not('delivery_zone', 'is', null);
        if (!rows) return;
        const map = new Map<string, { orders: number; revenue: number }>();
        for (const r of rows as { delivery_zone: string; gesamtbetrag: number }[]) {
          const z = r.delivery_zone ?? 'Unbekannt';
          const cur = map.get(z) ?? { orders: 0, revenue: 0 };
          map.set(z, { orders: cur.orders + 1, revenue: cur.revenue + (r.gesamtbetrag ?? 0) });
        }
        const sorted = Array.from(map.entries())
          .map(([zone, d]) => ({ zone, ...d }))
          .sort((a, b) => b.orders - a.orders);
        setData(sorted);
      } catch {} finally { setLoading(false); }
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || data.length === 0) return null;
  const maxOrders = Math.max(...data.map(d => d.orders), 1);

  return (
    <div className="rounded-xl bg-white border border-stone-200 px-4 py-4">
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="h-4 w-4 text-matcha-600" />
        <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">Bestellungen nach Zone · heute</span>
      </div>
      <div className="space-y-2.5">
        {data.map((row, i) => {
          const pct = Math.round((row.orders / maxOrders) * 100);
          const barColor = i === 0 ? 'bg-matcha-500' : i === 1 ? 'bg-blue-400' : i === 2 ? 'bg-amber-400' : 'bg-stone-300';
          return (
            <div key={row.zone}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-stone-700">Zone {row.zone}</span>
                <div className="flex items-center gap-2 text-[10px] text-stone-400">
                  <span className="font-bold text-stone-600">{row.orders} Best.</span>
                  <span>{row.revenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</span>
                </div>
              </div>
              <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---- Phase 89: LieferdienstDurchsatzPanel ---- */
/* Zeigt den stündlichen Bestelldurchsatz heute als Mini-Sparkline mit
   Trend-Indikator und aktuellem Stunden-Wert. */
function LieferdienstDurchsatzPanel() {
  const supabase = createClient();
  type HourBucket = { h: number; label: string; orders: number };
  const [buckets, setBuckets] = useState<HourBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const { data: rows } = await supabase
          .from('customer_orders')
          .select('bestellt_am')
          .gte('bestellt_am', today.toISOString())
          .not('bestellt_am', 'is', null);
        if (!rows) return;
        const counts: Record<number, number> = {};
        for (const r of rows as { bestellt_am: string }[]) {
          const h = new Date(r.bestellt_am).getHours();
          counts[h] = (counts[h] ?? 0) + 1;
        }
        const nowH = new Date().getHours();
        const result: HourBucket[] = [];
        for (let h = Math.max(0, nowH - 7); h <= nowH; h++) {
          result.push({ h, label: `${h}:00`, orders: counts[h] ?? 0 });
        }
        setBuckets(result);
      } catch {} finally { setLoading(false); }
    };
    load();
    const iv = setInterval(load, 5 * 60_000);
    const tick = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => { clearInterval(iv); clearInterval(tick); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || buckets.length < 2) return null;

  const maxOrders = Math.max(...buckets.map(b => b.orders), 1);
  const nowH = new Date().getHours();
  const currentHour = buckets.find(b => b.h === nowH);
  const prevHour = buckets.find(b => b.h === nowH - 1);
  const trend = currentHour && prevHour
    ? currentHour.orders > prevHour.orders ? 'up' : currentHour.orders < prevHour.orders ? 'down' : 'flat'
    : 'flat';
  const totalToday = buckets.reduce((s, b) => s + b.orders, 0);

  return (
    <div className="rounded-xl bg-white border border-stone-200 px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-matcha-600" />
          <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">Durchsatz heute</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold ${trend === 'up' ? 'text-matcha-600' : trend === 'down' ? 'text-red-500' : 'text-stone-400'}`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {currentHour?.orders ?? 0}/h jetzt
          </span>
          <span className="text-[10px] text-stone-400 font-bold">Σ {totalToday}</span>
        </div>
      </div>
      {/* Mini Sparkline */}
      <div className="flex items-end gap-1 h-10">
        {buckets.map((b) => {
          const h = Math.max(2, Math.round((b.orders / maxOrders) * 100));
          const isCurrent = b.h === nowH;
          return (
            <div key={b.h} className="flex-1 flex flex-col items-center gap-0.5">
              <div
                className={`w-full rounded-t-sm transition-all ${isCurrent ? 'bg-matcha-500' : 'bg-stone-200'}`}
                style={{ height: `${h}%`, minHeight: 2 }}
                title={`${b.label}: ${b.orders} Best.`}
              />
              {isCurrent && (
                <span className="text-[7px] font-bold text-matcha-600 tabular-nums">{b.h}h</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[9px] text-stone-400">
        <span className="flex items-center gap-0.5">
          <span className="h-2 w-2 rounded-sm bg-matcha-500 inline-block" />aktuelle Stunde
        </span>
        <span className="flex items-center gap-0.5">
          <span className="h-2 w-2 rounded-sm bg-stone-200 inline-block" />vergangene Stunden
        </span>
      </div>
    </div>
  );
}

/* ---- LieferdienstSchichtPrognose: projizierter Schichtabschluss ---- */
function LieferdienstSchichtPrognose() {
  const supabase = createClient();
  type HourRow = { h: number; orders: number; revenue: number };
  const [hourlyData, setHourlyData] = useState<HourRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const { data: rows } = await supabase
          .from('customer_orders')
          .select('bestellt_am, gesamtbetrag')
          .gte('bestellt_am', today.toISOString())
          .not('bestellt_am', 'is', null);
        if (!rows) return;
        const map: Record<number, { orders: number; revenue: number }> = {};
        for (const r of rows as { bestellt_am: string; gesamtbetrag: number }[]) {
          const h = new Date(r.bestellt_am).getHours();
          if (!map[h]) map[h] = { orders: 0, revenue: 0 };
          map[h].orders += 1;
          map[h].revenue += r.gesamtbetrag ?? 0;
        }
        const nowH = new Date().getHours();
        const result: HourRow[] = [];
        for (let h = Math.max(0, nowH - 5); h <= nowH; h++) {
          result.push({ h, orders: map[h]?.orders ?? 0, revenue: map[h]?.revenue ?? 0 });
        }
        setHourlyData(result);
      } catch {} finally { setLoading(false); }
    };
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || hourlyData.length < 2) return null;

  const nowH = new Date().getHours();
  // Ø der letzten 3 Stunden als Prognose-Basis
  const recent = hourlyData.slice(-3);
  const avgOrders = recent.reduce((s, r) => s + r.orders, 0) / recent.length;
  const avgRevenue = recent.reduce((s, r) => s + r.revenue, 0) / recent.length;

  // Schichtende: entweder 22 Uhr oder 8h ab jetzt (min)
  const shiftEndH = Math.min(22, nowH + 8);
  const hoursLeft = Math.max(0, shiftEndH - nowH);
  const projOrders = Math.round(avgOrders * hoursLeft);
  const projRevenue = avgRevenue * hoursLeft;

  const todayOrders = hourlyData.reduce((s, r) => s + r.orders, 0);
  const todayRevenue = hourlyData.reduce((s, r) => s + r.revenue, 0);

  const isGood = avgOrders >= 5;
  const isBusy = avgOrders >= 10;

  return (
    <div className={`rounded-xl border px-4 py-4 ${isBusy ? 'border-amber-200 bg-amber-50' : 'bg-white border-stone-200'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className={`h-4 w-4 ${isBusy ? 'text-amber-600' : 'text-matcha-600'}`} />
          <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">Schicht-Prognose</span>
          <span className={`text-[9px] font-bold rounded-full px-2 py-0.5 ${isBusy ? 'bg-amber-200 text-amber-800' : isGood ? 'bg-matcha-100 text-matcha-700' : 'bg-stone-100 text-stone-600'}`}>
            Ø {avgOrders.toFixed(1)} Best./h
          </span>
        </div>
        <span className="text-[9px] text-stone-400 tabular-nums">bis {shiftEndH}:00 Uhr</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-stone-50 border border-stone-100 px-3 py-2">
          <div className="text-[9px] font-bold uppercase tracking-wider text-stone-400 mb-1">Heute bisher</div>
          <div className="text-lg font-black tabular-nums text-stone-800">{todayOrders}</div>
          <div className="text-[9px] text-stone-500 tabular-nums">
            {todayRevenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className={`rounded-lg border px-3 py-2 ${isBusy ? 'bg-amber-50 border-amber-200' : 'bg-matcha-50 border-matcha-100'}`}>
          <div className="text-[9px] font-bold uppercase tracking-wider text-stone-400 mb-1">Prognose gesamt</div>
          <div className={`text-lg font-black tabular-nums ${isBusy ? 'text-amber-800' : 'text-matcha-800'}`}>
            ~{todayOrders + projOrders}
          </div>
          <div className="text-[9px] text-stone-500 tabular-nums">
            ~{(todayRevenue + projRevenue).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>
      {hoursLeft > 0 && (
        <div className="mt-2 text-[9px] text-stone-400">
          Bei aktuellem Tempo: +{projOrders} Bestellungen in {hoursLeft}h
        </div>
      )}
    </div>
  );
}

/* ---- LieferdienstTopArtikel: meistbestellte Artikel heute ---- */
function LieferdienstTopArtikel({ completedOrders }: { completedOrders: Order[] }) {
  type ArticleEntry = { name: string; count: number; revenue: number };

  const done = completedOrders.filter(o => o.status === 'done');
  if (done.length === 0) return null;

  // Aggregiere Artikel aus den abgeschlossenen Bestellungen
  const articleMap = new Map<string, ArticleEntry>();
  for (const order of done) {
    for (const item of order.items) {
      const key = item.name;
      const existing = articleMap.get(key);
      const qty = (item as any).quantity ?? (item as any).qty ?? (item as any).menge ?? 1;
      const preis = (item as any).preis ?? (item as any).einzelpreis ?? (item as any).price ?? 0;
      if (existing) {
        existing.count += qty;
        existing.revenue += qty * preis;
      } else {
        articleMap.set(key, { name: key, count: qty, revenue: qty * preis });
      }
    }
  }

  const top = [...articleMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  if (top.length === 0) return null;

  const maxCount = top[0].count;

  return (
    <div className="rounded-xl bg-white border border-stone-200 px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ChefHat className="h-4 w-4 text-saffron" />
          <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">Top-Artikel heute</span>
        </div>
        <span className="text-[9px] text-stone-400">{done.length} Bestellungen · {top.reduce((s, a) => s + a.count, 0)} Pos.</span>
      </div>
      <div className="space-y-2">
        {top.map((article, i) => {
          const pct = Math.max(6, Math.round((article.count / maxCount) * 100));
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
          return (
            <div key={article.name} className="flex items-center gap-2">
              <span className="text-sm w-5 text-center shrink-0">{medal ?? <span className="text-[10px] font-bold text-stone-400">{i + 1}.</span>}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-bold text-char truncate max-w-[70%]">{article.name}</span>
                  <div className="flex items-center gap-2 shrink-0 text-[10px] tabular-nums">
                    {article.revenue > 0 && (
                      <span className="text-stone-400">
                        {article.revenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                      </span>
                    )}
                    <span className="font-black text-char">{article.count}×</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${i === 0 ? 'bg-saffron' : i <= 2 ? 'bg-amber-400' : 'bg-stone-300'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---- LieferdienstZuverlassigkeitsPanel: Lieferpünktlichkeitsverteilung ---- */
function LieferdienstZuverlassigkeitsPanel() {
  type Bucket = { label: string; count: number; color: string };
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [avgDelayMin, setAvgDelayMin] = useState<number | null>(null);
  const [totalDelivered, setTotalDelivered] = useState(0);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      try {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const { data: rows } = await supabase
          .from('customer_orders')
          .select('eta_latest, geliefert_am')
          .not('geliefert_am', 'is', null)
          .gte('geliefert_am', today.toISOString());
        if (!rows || rows.length === 0) return;

        let onTime = 0, slightlyLate = 0, veryLate = 0, noEta = 0;
        let totalDelayMs = 0; let delayCount = 0;

        for (const r of rows as { eta_latest: string | null; geliefert_am: string }[]) {
          if (!r.eta_latest) { noEta++; continue; }
          const delayMs = new Date(r.geliefert_am).getTime() - new Date(r.eta_latest).getTime();
          const delayMin = delayMs / 60_000;
          if (delayMin <= 0) onTime++;
          else if (delayMin <= 10) { slightlyLate++; totalDelayMs += delayMs; delayCount++; }
          else { veryLate++; totalDelayMs += delayMs; delayCount++; }
        }

        setTotalDelivered(rows.length);
        setAvgDelayMin(delayCount > 0 ? Math.round(totalDelayMs / delayCount / 60_000) : null);
        setBuckets([
          { label: 'Pünktlich', count: onTime, color: '#16a34a' },
          { label: '+1–10 Min', count: slightlyLate, color: '#d97706' },
          { label: '>10 Min', count: veryLate, color: '#dc2626' },
          ...(noEta > 0 ? [{ label: 'Kein ETA', count: noEta, color: '#94a3b8' }] : []),
        ]);
      } catch {} finally { setLoading(false); }
    };
    load();
    const iv = setInterval(load, 3 * 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || totalDelivered === 0) return null;

  const noEtaCount = buckets.find(b => b.label === 'Kein ETA')?.count ?? 0;
  const withEta = totalDelivered - noEtaCount;
  const onTimePct = withEta > 0 ? Math.round((buckets[0]?.count ?? 0) / withEta * 100) : 0;
  const isGood = onTimePct >= 85;
  const isBad = onTimePct < 65;

  return (
    <div className={`rounded-xl border px-4 py-4 ${isGood ? 'bg-emerald-50 border-emerald-200' : isBad ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className={`h-4 w-4 ${isGood ? 'text-emerald-600' : isBad ? 'text-red-600' : 'text-amber-600'}`} />
          <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">Lieferpünktlichkeit</span>
          <span className={`text-[9px] font-bold rounded-full px-2 py-0.5 ${isGood ? 'bg-emerald-200 text-emerald-800' : isBad ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'}`}>
            {onTimePct}% pünktlich
          </span>
        </div>
        <span className="text-[9px] text-stone-400 tabular-nums">{totalDelivered} geliefert heute</span>
      </div>
      <div className="flex h-5 rounded-full overflow-hidden gap-px mb-3">
        {buckets.filter(b => b.count > 0).map((b) => (
          <div
            key={b.label}
            style={{ width: `${(b.count / totalDelivered) * 100}%`, backgroundColor: b.color }}
            title={`${b.label}: ${b.count}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {buckets.filter(b => b.count > 0).map((b) => (
          <div key={b.label} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full inline-block shrink-0" style={{ backgroundColor: b.color }} />
            <span className="text-[9px] text-stone-600 font-bold">{b.label}</span>
            <span className="text-[9px] text-stone-400 tabular-nums">{b.count}</span>
          </div>
        ))}
        {avgDelayMin !== null && avgDelayMin > 0 && (
          <div className="ml-auto text-[9px] text-stone-400 tabular-nums">Ø Verspätung: {avgDelayMin} Min</div>
        )}
      </div>
    </div>
  );
}

/* ---- LieferdienstGesamtScore ---- */
// Composite Schicht-Score (0-100): SLA 40% + ETA 25% + Durchsatz 20% + Ablehnungsrate 15%
function LieferdienstGesamtScore({ orders, completedOrders, schichtMinutes }: {
  orders: { status: string }[];
  completedOrders: { status: string; acceptedAt?: Date | string | null; doneAt?: Date | string | null }[];
  schichtMinutes: number;
}) {
  const [sla, setSla] = useState<{ onTimePct: number; totalStops: number } | null>(null);
  const [eta, setEta] = useState<{ onTimeRate: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [slaRes, etaRes] = await Promise.all([
          fetch('/api/delivery/admin/sla?days=1').then(r => r.ok ? r.json() : null),
          fetch('/api/delivery/admin/eta-accuracy').then(r => r.ok ? r.json() : null),
        ]);
        if (slaRes?.summary) setSla({ onTimePct: slaRes.summary.onTimePct ?? 0, totalStops: slaRes.summary.totalStops ?? 0 });
        if (etaRes?.overall) setEta({ onTimeRate: (etaRes.overall.onTimeRate ?? 0) * 100 });
      } catch {} finally { setLoading(false); }
    };
    load();
    const iv = setInterval(load, 120_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return null;

  const allOrders = [...orders, ...completedOrders];
  const total = allOrders.length;
  const rejected = allOrders.filter(o => ['storniert', 'rejected'].includes(o.status)).length;
  const rejRate = total > 0 ? Math.round((rejected / total) * 100) : 0;

  // Durchsatz: Bestellungen/Stunde vs Ziel 8/h
  const TARGET_PER_HOUR = 8;
  const actualPerHour = schichtMinutes > 5 ? (total / schichtMinutes) * 60 : 0;
  const throughputScore = Math.min(100, Math.round((actualPerHour / TARGET_PER_HOUR) * 100));

  // Component scores (0-100 each)
  const slaScore = sla ? Math.round(sla.onTimePct) : 75;
  const etaScore = eta ? Math.round(eta.onTimeRate) : 75;
  const rejScore = Math.max(0, 100 - rejRate * 5);
  const thruScore = throughputScore;

  // Weighted composite
  const composite = Math.round(slaScore * 0.40 + etaScore * 0.25 + thruScore * 0.20 + rejScore * 0.15);

  const grade = composite >= 90 ? 'A+' : composite >= 80 ? 'A' : composite >= 70 ? 'B' : composite >= 60 ? 'C' : 'D';
  const color = composite >= 80 ? '#16a34a' : composite >= 60 ? '#d97706' : '#dc2626';
  const bgCls = composite >= 80 ? 'bg-emerald-50 border-emerald-200' : composite >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
  const scoreLabel = composite >= 80 ? 'Ausgezeichnet' : composite >= 60 ? 'Gut' : 'Verbesserungsbedarf';

  const components = [
    { label: 'Pünktlichkeit', weight: '40%', score: slaScore, detail: sla ? `${sla.onTimePct.toFixed(0)}%` : '–' },
    { label: 'ETA-Genauigkeit', weight: '25%', score: etaScore, detail: eta ? `${eta.onTimeRate.toFixed(0)}%` : '–' },
    { label: 'Durchsatz', weight: '20%', score: thruScore, detail: `${actualPerHour.toFixed(1)}/h` },
    { label: 'Ablehnungsrate', weight: '15%', score: rejScore, detail: `${rejRate}% rej.` },
  ];

  const R = 44;
  const circ = 2 * Math.PI * R;
  const dash = (composite / 100) * circ;

  return (
    <div className={`rounded-xl border ${bgCls} px-4 py-4 mb-2`}>
      <div className="flex items-center gap-2 mb-3">
        <Target className="h-4 w-4" style={{ color }} />
        <span className="text-[10px] font-black uppercase tracking-wider text-stone-500">Schicht-Gesamtscore</span>
        <span className="ml-auto text-[9px] text-stone-400">gewichteter KPI-Schnitt</span>
      </div>
      <div className="flex items-center gap-4">
        {/* Arc gauge */}
        <div className="relative shrink-0 flex items-center justify-center" style={{ width: 96, height: 96 }}>
          <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
            <circle cx="48" cy="48" r={R} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="7" />
            <circle
              cx="48" cy="48" r={R} fill="none"
              stroke={color} strokeWidth="7" strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ - dash}
              style={{ transition: 'stroke-dashoffset 1s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black leading-none tabular-nums" style={{ color }}>{composite}</span>
            <span className="text-[10px] font-black" style={{ color }}>{grade}</span>
          </div>
        </div>
        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="font-display text-base font-black mb-1" style={{ color }}>{scoreLabel}</div>
          <div className="space-y-1.5">
            {components.map(c => (
              <div key={c.label} className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-stone-500 w-[90px] shrink-0">{c.label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-stone-200 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, c.score))}%`,
                      backgroundColor: c.score >= 80 ? '#16a34a' : c.score >= 60 ? '#d97706' : '#dc2626',
                    }}
                  />
                </div>
                <span className="text-[9px] font-black tabular-nums text-stone-600 w-10 text-right shrink-0">{c.detail}</span>
                <span className="text-[8px] text-stone-400 shrink-0">{c.weight}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   LiveOrderFunnelPanel
   Echtzeit-Bestellpipeline: zeigt Anzahl offener Bestellungen
   je Statusphase als visuellen Trichter mit Pfeilen.
────────────────────────────────────────────────────────── */
function LiveOrderFunnelPanel() {
  const supabase = createClient();
  type Stage = { status: string; label: string; icon: React.ElementType; color: string; bg: string; dot: string };
  const STAGES: Stage[] = [
    { status: 'neu',            label: 'Eingegangen', icon: Bell,          color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',    dot: 'bg-amber-500' },
    { status: 'bestätigt',      label: 'Angenommen',  icon: CheckCircle2,  color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200',      dot: 'bg-blue-500' },
    { status: 'in_zubereitung', label: 'Kochend',     icon: ChefHat,       color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200',  dot: 'bg-orange-500' },
    { status: 'fertig',         label: 'Fertig',      icon: Package,       color: 'text-purple-700',  bg: 'bg-purple-50 border-purple-200',  dot: 'bg-purple-500' },
    { status: 'unterwegs',      label: 'Unterwegs',   icon: Truck,         color: 'text-matcha-700',  bg: 'bg-matcha-50 border-matcha-200',  dot: 'bg-matcha-500' },
  ];

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [prevCounts, setPrevCounts] = useState<Record<string, number>>({});
  const [deliveredToday, setDeliveredToday] = useState<number>(0);

  useEffect(() => {
    const load = async () => {
      try {
        const results = await Promise.all(
          STAGES.map(s =>
            supabase.from('customer_orders')
              .select('id', { count: 'exact', head: true })
              .eq('status', s.status)
              .then(({ count }: { count: number | null }) => ({ status: s.status, count: count ?? 0 }))
          )
        );
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const { count: delivered } = await supabase
          .from('customer_orders')
          .select('id', { count: 'exact', head: true })
          .in('status', ['geliefert', 'abgeholt', 'abgeschlossen'])
          .gte('bestellt_am', today.toISOString());
        const map: Record<string, number> = {};
        for (const r of results) map[r.status] = r.count;
        setCounts(prev => { setPrevCounts(prev); return map; });
        setDeliveredToday(delivered ?? 0);
      } catch {}
    };
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = STAGES.reduce((s, st) => s + (counts[st.status] ?? 0), 0);

  return (
    <div className="rounded-xl bg-white border border-stone-200 px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-matcha-600 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">Live-Bestellpipeline</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-stone-400">
          <span className="font-bold text-stone-600">{total} aktiv</span>
          {deliveredToday > 0 && <span>· {deliveredToday} heute geliefert</span>}
        </div>
      </div>

      {/* Funnel row */}
      <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
        {STAGES.map((stage, i) => {
          const count = counts[stage.status] ?? 0;
          const prev = prevCounts[stage.status];
          const trend = prev == null ? null : count > prev ? 'up' : count < prev ? 'down' : null;
          const Icon = stage.icon;
          const isBottleneck = count >= 5;
          return (
            <React.Fragment key={stage.status}>
              <div className={`flex-1 min-w-[72px] rounded-xl border ${stage.bg} p-2.5 flex flex-col items-center gap-1.5 transition-all ${isBottleneck ? 'ring-2 ring-red-300 animate-pulse' : ''}`}>
                <div className="flex items-center gap-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${count > 0 ? stage.dot : 'bg-stone-200'} shrink-0`} />
                  <Icon className={`h-3 w-3 ${stage.color} shrink-0`} />
                </div>
                <div className="flex items-end gap-0.5">
                  <div className={`text-2xl font-black tabular-nums leading-none ${stage.color} ${count === 0 ? 'opacity-30' : ''}`}>
                    {count}
                  </div>
                  {trend && (
                    <span className={`text-[10px] font-black leading-tight mb-0.5 ${trend === 'up' ? 'text-red-500' : 'text-matcha-600'}`}>
                      {trend === 'up' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
                <div className={`text-[8px] font-bold text-center leading-tight ${stage.color} opacity-80`}>
                  {stage.label}
                </div>
                {isBottleneck && (
                  <div className="text-[7px] font-black text-red-600 bg-red-50 rounded-full px-1 py-0.5 leading-none">
                    Rückstau!
                  </div>
                )}
              </div>
              {i < STAGES.length - 1 && (
                <div className="flex items-center self-center">
                  <ArrowRight className="h-3 w-3 text-stone-300 shrink-0" />
                </div>
              )}
            </React.Fragment>
          );
        })}
        {/* Delivered today badge */}
        <div className="flex items-center self-center">
          <ArrowRight className="h-3 w-3 text-stone-300 shrink-0" />
        </div>
        <div className="flex-1 min-w-[72px] rounded-xl border bg-matcha-50 border-matcha-200 p-2.5 flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-matcha-500 shrink-0" />
            <CheckCircle2 className="h-3 w-3 text-matcha-600 shrink-0" />
          </div>
          <div className="text-2xl font-black tabular-nums leading-none text-matcha-700">
            {deliveredToday}
          </div>
          <div className="text-[8px] font-bold text-center leading-tight text-matcha-600 opacity-80">
            Geliefert heute
          </div>
        </div>
      </div>

      {/* Bottleneck-Hinweis */}
      {(() => {
        const bottleneck = STAGES.find(s => (counts[s.status] ?? 0) >= 5);
        if (!bottleneck) return null;
        const Icon = bottleneck.icon;
        return (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[10px]">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
            <span className="font-bold text-red-700">
              Rückstau bei <span className="font-black">{bottleneck.label}</span>: {counts[bottleneck.status]} Bestellungen warten
            </span>
          </div>
        );
      })()}
    </div>
  );
}

/* ------------------------------ CustomerSatisfactionPanel ------------------------------ */

type SatisfactionData = {
  totalRatings: number;
  avgRating: number;
  positiveRate: number;
  negativeRate: number;
  withComment: number;
  byDriver: Array<{ driverName: string | null; avgRating: number; count: number }>;
  recentComments: Array<{ rating: number; comment: string; createdAt: string }>;
};

function CustomerSatisfactionPanel({ locationId }: { locationId: string }) {
  const [data, setData] = useState<SatisfactionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/delivery/admin/satisfaction?location_id=${locationId}&days=14`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && !d._fallback) setData(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, locationId]);

  const stars = (rating: number) => {
    const full = Math.round(rating);
    return '★'.repeat(full) + '☆'.repeat(Math.max(0, 5 - full));
  };

  return (
    <div className="rounded-xl bg-white border border-stone-200 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-stone-50 transition"
      >
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-500" />
          <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">Kundenzufriedenheit (14 Tage)</span>
          {data && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              ⌀ {data.avgRating.toFixed(1)} · {data.totalRatings} Ratings
            </span>
          )}
        </div>
        <span className="text-stone-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t px-5 py-4 space-y-4">
          {loading && (
            <div className="text-sm text-stone-400 flex items-center gap-2">
              <Activity className="h-4 w-4 animate-pulse" />
              Lade Zufriedenheitsdaten…
            </div>
          )}

          {!loading && !data && (
            <div className="text-sm text-stone-400">Noch keine Bewertungen (14 Tage).</div>
          )}

          {!loading && data && (
            <>
              {/* KPI-Row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-3 text-center">
                  <div className="text-2xl font-black text-amber-600">{data.avgRating.toFixed(1)}</div>
                  <div className="text-[9px] text-amber-500 mt-0.5 font-bold uppercase tracking-wider">Ø Rating</div>
                  <div className="text-amber-500 text-sm mt-0.5">{stars(data.avgRating)}</div>
                </div>
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-3 text-center">
                  <div className="text-2xl font-black text-emerald-600">{Math.round(data.positiveRate * 100)}%</div>
                  <div className="text-[9px] text-emerald-500 mt-0.5 font-bold uppercase tracking-wider">Positiv</div>
                  <div className="text-[10px] text-emerald-500 mt-0.5">{data.totalRatings} Gesamt</div>
                </div>
                <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-3 text-center">
                  <div className="text-2xl font-black text-red-500">{Math.round(data.negativeRate * 100)}%</div>
                  <div className="text-[9px] text-red-400 mt-0.5 font-bold uppercase tracking-wider">Negativ</div>
                  <div className="text-[10px] text-red-400 mt-0.5">{data.withComment} mit Kommentar</div>
                </div>
              </div>

              {/* Top Fahrer */}
              {data.byDriver.length > 0 && (
                <div>
                  <div className="text-[9px] font-black uppercase tracking-wider text-stone-400 mb-2">Top-Fahrer nach Rating</div>
                  <div className="space-y-1.5">
                    {data.byDriver.slice(0, 5).map((d, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-5 shrink-0 text-center text-[11px]">
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                        </span>
                        <span className="flex-1 text-[12px] font-semibold text-stone-700 truncate">
                          {d.driverName ?? 'Unbekannt'}
                        </span>
                        <span className="text-amber-500 text-[11px] shrink-0">{stars(d.avgRating)}</span>
                        <span className="w-8 text-right text-[11px] font-bold text-stone-500 tabular-nums">{d.avgRating.toFixed(1)}</span>
                        <span className="w-8 text-right text-[10px] text-stone-400 tabular-nums">n={d.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Neueste Kommentare */}
              {data.recentComments.length > 0 && (
                <div>
                  <div className="text-[9px] font-black uppercase tracking-wider text-stone-400 mb-2">Neueste Kommentare</div>
                  <div className="space-y-2">
                    {data.recentComments.slice(0, 3).map((c, i) => (
                      <div key={i} className="rounded-lg bg-stone-50 border border-stone-200 px-3 py-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-amber-500 text-[11px]">{stars(c.rating)}</span>
                          <span className="text-[9px] text-stone-400">
                            {new Date(c.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-600 leading-snug italic">"{c.comment}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ SchichtPlanPanel ------------------------------ */

type CoverageStatus = 'ok' | 'low' | 'gap' | 'over' | 'off';

type StaffingSlot = {
  hourLocal: string;
  dayLabel: string;
  expectedOrders: number;
  recommendedMin: number;
  recommendedTarget: number;
  scheduledDrivers: number;
  status: CoverageStatus;
};

type StaffingDay = {
  date: string;
  dayLabel: string;
  slots: StaffingSlot[];
  gapCount: number;
  lowCount: number;
  okCount: number;
  coveragePct: number;
};

type StaffingPlan = {
  days: StaffingDay[];
  summary: {
    totalGaps: number;
    totalLow: number;
    totalOk: number;
    avgCoveragePct: number;
    peakDriverNeed: number;
  };
};

const STATUS_COLOR: Record<CoverageStatus, string> = {
  ok:   'bg-matcha-400',
  over: 'bg-matcha-600',
  low:  'bg-amber-400',
  gap:  'bg-red-400',
  off:  'bg-stone-200',
};

function SchichtPlanPanel({ locationId }: { locationId: string }) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<StaffingPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);

  useEffect(() => {
    if (!open || plan) return;
    setLoading(true);
    fetch(`/api/delivery/admin/shift-planner?location_id=${locationId}&days=7`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.days) setPlan(d as StaffingPlan); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, locationId, plan]);

  const day = plan?.days[selectedDay];
  const peakHour = day?.slots.reduce<StaffingSlot | null>((best, s) => {
    if (s.status === 'off') return best;
    if (!best || s.expectedOrders > best.expectedOrders) return s;
    return best;
  }, null);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2.5">
          <Calendar className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-sm font-bold text-stone-800">7-Tage Besetzungsplan</span>
          {plan && (
            <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${
              plan.summary.totalGaps > 0 ? 'bg-red-100 text-red-700' :
              plan.summary.totalLow > 0 ? 'bg-amber-100 text-amber-700' :
              'bg-matcha-50 text-matcha-700'
            }`}>
              {plan.summary.totalGaps > 0 ? `${plan.summary.totalGaps} Lücken` :
               plan.summary.totalLow > 0 ? `${plan.summary.totalLow} knapp` :
               `${Math.round(plan.summary.avgCoveragePct)}% Abdeckung`}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>

      {open && (
        <div className="border-t border-stone-100 px-5 pb-5 pt-4">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-stone-400 py-4">
              <Loader2 className="h-4 w-4 animate-spin" />Lade Besetzungsplan…
            </div>
          )}

          {!loading && plan && (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[
                  { label: 'Lücken', value: plan.summary.totalGaps, color: plan.summary.totalGaps > 0 ? 'text-red-600' : 'text-matcha-600' },
                  { label: 'Knapp', value: plan.summary.totalLow, color: plan.summary.totalLow > 0 ? 'text-amber-600' : 'text-matcha-600' },
                  { label: 'Abdeckung', value: `${Math.round(plan.summary.avgCoveragePct)}%`, color: 'text-matcha-700' },
                  { label: 'Spitzen-Bedarf', value: `${plan.summary.peakDriverNeed} Fhr.`, color: 'text-stone-700' },
                ].map((k) => (
                  <div key={k.label} className="rounded-xl bg-stone-50 border border-stone-100 px-3 py-2.5 text-center">
                    <div className={`font-display font-black text-lg leading-none ${k.color}`}>{k.value}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mt-0.5">{k.label}</div>
                  </div>
                ))}
              </div>

              {/* Day selector */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 -mx-1 px-1">
                {plan.days.map((d, i) => (
                  <button
                    key={d.date}
                    onClick={() => setSelectedDay(i)}
                    className={`shrink-0 rounded-xl px-3 py-1.5 text-center transition ${
                      selectedDay === i ? 'bg-matcha-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    <div className="text-[10px] font-bold leading-none">{d.dayLabel.split(' ')[0]}</div>
                    <div className={`text-[11px] font-black leading-none mt-0.5 ${
                      d.gapCount > 0 ? 'text-red-300' : d.lowCount > 0 ? 'text-amber-300' : ''
                    }`}>
                      {d.gapCount > 0 ? '⚠' : d.lowCount > 0 ? '~' : '✓'}
                    </div>
                  </button>
                ))}
              </div>

              {/* Hourly heatmap for selected day */}
              {day && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2">
                    {day.dayLabel} — Stündliche Besetzung
                    {peakHour && (
                      <span className="ml-2 font-normal text-stone-500">
                        Peak {peakHour.hourLocal} ({peakHour.expectedOrders} Bestellungen erwartet)
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-[auto_1fr_auto] gap-x-2 gap-y-1 text-[10px]">
                    {day.slots.filter(s => s.status !== 'off').map((s, i) => (
                      <React.Fragment key={i}>
                        <span className="text-stone-400 tabular-nums font-mono">{s.hourLocal}</span>
                        <div className="flex items-center gap-1.5">
                          <div
                            className={`h-4 rounded-sm ${STATUS_COLOR[s.status]} transition-all`}
                            style={{ width: `${Math.min(100, (s.scheduledDrivers / Math.max(1, s.recommendedTarget)) * 100)}%`, minWidth: 4 }}
                            title={`${s.scheduledDrivers} geplant / ${s.recommendedTarget} benötigt`}
                          />
                          {s.status === 'gap' && <span className="text-red-500 font-bold">Lücke</span>}
                          {s.status === 'low' && <span className="text-amber-500 font-bold">Knapp</span>}
                        </div>
                        <span className="text-stone-500 tabular-nums">{s.scheduledDrivers}/{s.recommendedTarget}</span>
                      </React.Fragment>
                    ))}
                  </div>

                  {/* Legend */}
                  <div className="mt-3 flex flex-wrap gap-3 text-[9px] text-stone-500">
                    {([['ok', 'OK'], ['over', 'Überschuss'], ['low', 'Knapp'], ['gap', 'Lücke']] as const).map(([s, label]) => (
                      <div key={s} className="flex items-center gap-1">
                        <div className={`h-2.5 w-5 rounded-sm ${STATUS_COLOR[s]}`} />
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {!loading && !plan && (
            <div className="text-sm text-stone-400 text-center py-4">Keine Plan-Daten verfügbar</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ LieferZonenPanel ------------------------------ */

type HeatmapPoint = { lat: number; lng: number; weight: number; zone: string };

type ZoneEntry = { zone: string; orders: number; pct: number };

function LieferZonenPanel({ locationId }: { locationId: string }) {
  const [open, setOpen] = useState(false);
  const [zones, setZones] = useState<ZoneEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<'7' | '30'>('30');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const from = new Date(Date.now() - Number(period) * 86_400_000).toISOString();
    fetch(`/api/delivery/admin/heatmap?location_id=${locationId}&from=${from}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d?.points) return;
        const pts = d.points as HeatmapPoint[];
        setTotal(d.total ?? 0);
        const zoneMap = new Map<string, number>();
        for (const p of pts) {
          const z = p.zone === 'unknown' ? 'Unbekannt' : p.zone;
          zoneMap.set(z, (zoneMap.get(z) ?? 0) + p.weight);
        }
        const sum = Array.from(zoneMap.values()).reduce((a, b) => a + b, 0);
        const sorted: ZoneEntry[] = Array.from(zoneMap.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([zone, orders]) => ({ zone, orders, pct: sum > 0 ? Math.round((orders / sum) * 100) : 0 }));
        setZones(sorted);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, locationId, period]);

  const ZONE_COLORS = ['bg-matcha-500', 'bg-matcha-400', 'bg-matcha-300', 'bg-amber-400', 'bg-amber-300', 'bg-red-400'];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2.5">
          <MapPin className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-sm font-bold text-stone-800">Liefer-Zonen Verteilung</span>
          {total > 0 && (
            <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-matcha-50 text-matcha-700">
              {total} Bestellungen
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>

      {open && (
        <div className="border-t border-stone-100 px-5 pb-5 pt-4">
          {/* Period toggle */}
          <div className="flex gap-2 mb-4">
            {(['7', '30'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setPeriod(d)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                  period === d ? 'bg-matcha-600 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                }`}
              >
                {d} Tage
              </button>
            ))}
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-stone-400 py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Lade Zonen-Daten…
            </div>
          )}

          {!loading && zones.length > 0 && (
            <div className="space-y-2">
              {zones.slice(0, 8).map((z, i) => (
                <div key={z.zone} className="flex items-center gap-3">
                  <div className="w-24 text-[11px] font-bold text-stone-600 truncate">{z.zone}</div>
                  <div className="flex-1 relative h-5 rounded-md bg-stone-50 border border-stone-100 overflow-hidden">
                    <div
                      className={`h-full rounded-md ${ZONE_COLORS[Math.min(i, ZONE_COLORS.length - 1)]} transition-all`}
                      style={{ width: `${z.pct}%` }}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-stone-700">
                      {z.orders}
                    </span>
                  </div>
                  <div className="w-8 text-[10px] font-bold text-stone-400 text-right">{z.pct}%</div>
                </div>
              ))}
            </div>
          )}

          {!loading && zones.length === 0 && (
            <div className="text-sm text-stone-400 text-center py-4">Keine Koordinaten-Daten im Zeitraum</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---- LieferdienstMonatsvergleich — Phase 168 ---- */
function LieferdienstMonatsvergleich() {
  const supabase = createClient();
  type MonthData = { orders: number; revenue: number; label: string };
  const [data, setData] = useState<{ current: MonthData; prev: MonthData } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const now   = new Date();
      const y     = now.getFullYear();
      const m     = now.getMonth(); // 0-indexed

      const startCurrent = new Date(y, m, 1).toISOString();
      const startPrev    = new Date(y, m - 1, 1).toISOString();
      const endPrev      = new Date(y, m, 0, 23, 59, 59).toISOString();

      const [{ data: curr }, { data: prev }] = await Promise.all([
        supabase
          .from('customer_orders')
          .select('gesamtbetrag')
          .gte('bestellt_am', startCurrent)
          .in('status', ['fertig', 'geliefert', 'abgeholt']),
        supabase
          .from('customer_orders')
          .select('gesamtbetrag')
          .gte('bestellt_am', startPrev)
          .lte('bestellt_am', endPrev)
          .in('status', ['fertig', 'geliefert', 'abgeholt']),
      ]);

      const fmtMonth = (date: Date) =>
        date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

      const sum = (rows: { gesamtbetrag: number | null }[] | null) =>
        (rows ?? []).reduce((s, r) => s + (r.gesamtbetrag ?? 0), 0);

      setData({
        current: { orders: curr?.length ?? 0, revenue: sum(curr), label: fmtMonth(new Date(y, m, 1)) },
        prev:    { orders: prev?.length ?? 0, revenue: sum(prev), label: fmtMonth(new Date(y, m - 1, 1)) },
      });
      setLoading(false);
    };
    load().catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="h-4 w-32 bg-stone-100 rounded animate-pulse mb-3" />
        <div className="space-y-2">
          <div className="h-5 bg-stone-100 rounded animate-pulse" />
          <div className="h-5 bg-stone-100 rounded animate-pulse w-3/4" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const maxO = Math.max(data.current.orders, data.prev.orders, 1);
  const maxR = Math.max(data.current.revenue, data.prev.revenue, 1);

  const ordersGrowth = data.prev.orders > 0
    ? Math.round(((data.current.orders - data.prev.orders) / data.prev.orders) * 100)
    : null;

  const fmtEur = (v: number) =>
    v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';

  return (
    <div className="rounded-2xl border border-stone-200 bg-white">
      <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-char">Monatsvergleich</div>
          <div className="text-xs text-stone-400">{data.prev.label} → {data.current.label}</div>
        </div>
        {ordersGrowth !== null && (
          <span
            className={`text-sm font-black px-3 py-1 rounded-full ${
              ordersGrowth >= 0
                ? 'bg-matcha-50 text-matcha-700'
                : 'bg-red-50 text-red-600'
            }`}
          >
            {ordersGrowth >= 0 ? '+' : ''}{ordersGrowth}%
          </span>
        )}
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* Bestellungen */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-2">
            Bestellungen (abgeschlossen)
          </div>
          {[
            { label: data.current.label, val: data.current.orders, max: maxO, color: 'bg-matcha-500', fmt: String },
            { label: data.prev.label,    val: data.prev.orders,    max: maxO, color: 'bg-stone-300',  fmt: String },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-3 mb-1.5">
              <div className="w-20 text-[11px] font-bold text-stone-600 truncate leading-tight">
                {row.label}
              </div>
              <div className="flex-1 h-5 rounded-full bg-stone-50 border border-stone-100 overflow-hidden relative">
                <div
                  className={`h-full rounded-full ${row.color} transition-all`}
                  style={{ width: `${(row.val / row.max) * 100}%` }}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-stone-700">
                  {row.fmt(row.val)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Umsatz */}
        {data.current.revenue > 0 && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-2">
              Umsatz
            </div>
            {[
              { label: data.current.label, val: data.current.revenue, max: maxR, color: 'bg-emerald-500' },
              { label: data.prev.label,    val: data.prev.revenue,    max: maxR, color: 'bg-stone-300'  },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-3 mb-1.5">
                <div className="w-20 text-[11px] font-bold text-stone-600 truncate leading-tight">
                  {row.label}
                </div>
                <div className="flex-1 h-5 rounded-full bg-stone-50 border border-stone-100 overflow-hidden relative">
                  <div
                    className={`h-full rounded-full ${row.color} transition-all`}
                    style={{ width: `${(row.val / row.max) * 100}%` }}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-stone-700">
                    {fmtEur(row.val)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Liefer-Abonnement Übersicht ────────────────────────────────────────────
   Zeigt MRR, aktive Abos, bald ablaufende Abos aus dem Subscription-Dashboard.
   Nutzt GET /api/delivery/admin/subscriptions?action=dashboard
   ─────────────────────────────────────────────────────────────────────────── */
type SubDashboard = {
  activeCount: number;
  cancelledCount: number;
  expiredCount: number;
  mrrEur: number;
  totalRevenueEur: number;
  totalSavingsEur: number;
  totalDeliveries: number;
  planCount: number;
};

function LieferdienstAboOverview({ locationId }: { locationId: string }) {
  const [data, setData] = useState<SubDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/subscriptions?action=dashboard&location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.overview) {
          setData({
            activeCount: d.overview.activeCount ?? 0,
            cancelledCount: d.overview.cancelledCount ?? 0,
            expiredCount: d.overview.expiredCount ?? 0,
            mrrEur: d.overview.mrrEur ?? 0,
            totalRevenueEur: d.overview.totalRevenueEur ?? 0,
            totalSavingsEur: d.overview.totalSavingsEur ?? 0,
            totalDeliveries: d.overview.totalDeliveries ?? 0,
            planCount: d.overview.planCount ?? 0,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="h-4 w-40 bg-stone-100 rounded animate-pulse mb-3" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-stone-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || (data.activeCount === 0 && data.planCount === 0)) return null;

  const fmtEur = (v: number) =>
    v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  const kpis = [
    { label: 'Aktive Abos', value: data.activeCount.toString(), color: 'text-matcha-700', bg: 'bg-matcha-50' },
    { label: 'MRR', value: fmtEur(data.mrrEur), color: 'text-emerald-700', bg: 'bg-emerald-50' },
    { label: 'Kunden-Ersparnisse', value: fmtEur(data.totalSavingsEur), color: 'text-amber-700', bg: 'bg-amber-50' },
    { label: 'Gratis-Lieferungen', value: data.totalDeliveries.toString(), color: 'text-blue-700', bg: 'bg-blue-50' },
  ];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-700">
          <CreditCard className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-bold text-char">Liefer-Abonnements</div>
          <div className="text-xs text-stone-400">{data.planCount} aktiver Plan{data.planCount !== 1 ? 'e' : ''}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`rounded-xl ${kpi.bg} p-3`}>
            <div className={`text-lg font-black tabular-nums ${kpi.color}`}>{kpi.value}</div>
            <div className="text-[10px] font-semibold text-stone-500 mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>
      {data.cancelledCount > 0 && (
        <div className="px-5 pb-4">
          <span className="text-[11px] text-stone-400">
            {data.cancelledCount} Abo{data.cancelledCount !== 1 ? 's' : ''} gekündigt
            {data.expiredCount > 0 ? ` · ${data.expiredCount} abgelaufen` : ''}
          </span>
        </div>
      )}
    </div>
  );
}
