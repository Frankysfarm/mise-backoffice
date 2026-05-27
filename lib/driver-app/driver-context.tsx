'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react'
import { Order, Driver, AppPhase, ExternalPlatform } from './types'
import { mockDriver, simulatedIncomingOrders } from './mock-data'

interface DriverContextType {
  driver: Driver
  setDriver: React.Dispatch<React.SetStateAction<Driver>>
  phase: AppPhase
  incomingOrder: Order | null
  acceptedOrders: Order[]
  collectedOrders: Order[]
  pendingOrders: Order[]
  currentDeliveryIndex: number
  isRinging: boolean
  toggleOnline: () => void
  acceptOrder: () => void
  declineOrder: () => void
  startCollecting: () => void
  checkItem: (orderId: string, itemId: string) => void
  startDeliveries: () => void
  completeDelivery: () => void
  simulateNewOrder: () => void
  resetToWaiting: () => void
  addExternalOrder: (order: {
    customerName: string
    customerAddress: string
    customerPhone: string
    totalAmount: number
    paymentMethod: 'card' | 'cash'
    platform: ExternalPlatform
    receiptImage?: string
  }) => void
}

const DriverContext = createContext<DriverContextType | undefined>(undefined)

export function DriverProvider({ children }: { children: ReactNode }) {
  const [driver, setDriver] = useState<Driver>(mockDriver)
  const [phase, setPhase] = useState<AppPhase>('waiting')
  const [incomingOrder, setIncomingOrder] = useState<Order | null>(null)
  const [collectedOrders, setCollectedOrders] = useState<Order[]>([])
  const [acceptedOrders, setAcceptedOrders] = useState<Order[]>([])
  const [currentDeliveryIndex, setCurrentDeliveryIndex] = useState(0)
  const [isRinging, setIsRinging] = useState(false)
  const [pendingOrders, setPendingOrders] = useState<Order[]>([])
  
  const orderCounterRef = useRef(0)

  // DEV: hardcoded Driver-ID für Frankys (adibn). Später durch echte Auth ersetzen.
  const DEV_DRIVER_ID = 'aa00482a-9567-48df-90aa-2303dc23cc3c';

  // helper: erkennt echte DB-UUIDs (vs Mock-IDs wie 'order-12345-0')
  const isRealOrderId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const callDriverApi = (path: string, body: Record<string, unknown>) =>
    fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ driverId: DEV_DRIVER_ID, ...body }),
    }).then((r) => r.ok ? r.json() : Promise.reject(r.statusText)).catch((e) => {
      console.error('Driver-API failed', path, e);
      return null;
    });


  const toggleOnline = () => {
    const nextOnline = !driver.isOnline;
    setDriver(prev => ({ ...prev, isOnline: nextOnline }))
    // API: persistiere im DB
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fetch('/api/driver-app/me/online', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              driverId: DEV_DRIVER_ID,
              online: nextOnline,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            }),
          }).catch((e) => console.error('Online-API failed', e));
        },
        () => {
          fetch('/api/driver-app/me/online', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ driverId: DEV_DRIVER_ID, online: nextOnline }),
          }).catch((e) => console.error('Online-API failed', e));
        },
        { timeout: 3000 },
      );
    } else {
      fetch('/api/driver-app/me/online', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ driverId: DEV_DRIVER_ID, online: nextOnline }),
      }).catch((e) => console.error('Online-API failed', e));
    }
    if (driver.isOnline) {
      // Going offline - reset everything
      setPhase('waiting')
      setIncomingOrder(null)
      setCollectedOrders([])
      setAcceptedOrders([])
      setIsRinging(false)
      setPendingOrders([])
    }
  }

  const simulateNewOrder = useCallback(() => {
    if (!driver.isOnline) return
    
    // Get a random order from simulated orders
    const randomIndex = Math.floor(Math.random() * simulatedIncomingOrders.length)
    const uniqueId = `${Date.now()}-${orderCounterRef.current++}`
    const newOrder = {
      ...simulatedIncomingOrders[randomIndex],
      id: `order-${uniqueId}`,
      createdAt: new Date(),
      items: simulatedIncomingOrders[randomIndex].items.map((item, idx) => ({
        ...item,
        id: `item-${uniqueId}-${idx}`,
        checked: false,
      })),
    }
    
    setPendingOrders(prev => [...prev, newOrder])
  }, [driver.isOnline])

  // Process pending orders queue - AUCH während Lieferung können neue Bestellungen kommen!
  useEffect(() => {
    if (pendingOrders.length > 0 && incomingOrder === null) {
      const nextOrder = pendingOrders[0]
      setPendingOrders(prev => prev.slice(1))
      setIncomingOrder(nextOrder)
      setPhase('incoming')
      setIsRinging(true)
    }
  }, [pendingOrders, incomingOrder])

  const acceptOrder = () => {
    if (incomingOrder) {
      if (isRealOrderId(incomingOrder.id)) {
        callDriverApi(`/api/driver-app/orders/${incomingOrder.id}/accept`, {});
      }
      // Bestellung wird zu collected hinzugefügt (nicht direkt picking)
      setCollectedOrders(prev => [...prev, { ...incomingOrder, status: 'accepted' as const }])
      setIncomingOrder(null)
      setIsRinging(false) // Klingeln stoppt erst hier!
      
      // Check if there are more pending orders
      if (pendingOrders.length > 0) {
        const [nextOrder, ...rest] = pendingOrders
        setIncomingOrder(nextOrder)
        setPendingOrders(rest)
        setIsRinging(true) // Nächste Bestellung klingelt wieder
      } else {
        // Alle Bestellungen angenommen - zeige gesammelte Bestellungen
        setPhase('collecting')
      }
    }
  }

  const declineOrder = () => {
    if (incomingOrder && isRealOrderId(incomingOrder.id)) {
      callDriverApi(`/api/driver-app/orders/${incomingOrder.id}/decline`, { reason: 'driver_declined' });
    }
    setIncomingOrder(null)
    setIsRinging(false)
    
    if (pendingOrders.length > 0) {
      const [nextOrder, ...rest] = pendingOrders
      setIncomingOrder(nextOrder)
      setPendingOrders(rest)
      setIsRinging(true)
    } else if (collectedOrders.length > 0) {
      setPhase('collecting')
    } else {
      setPhase('waiting')
    }
  }

  // Bestellungen sammeln - Fahrer geht zur Abholung
  const startCollecting = () => {
    if (collectedOrders.length > 0) {
      setAcceptedOrders(collectedOrders)
      setCollectedOrders([])
      setPhase('picking')
    }
  }

  // Check individual item in an order
  const checkItem = (orderId: string, itemId: string) => {
    setAcceptedOrders(prev => 
      prev.map(order => {
        if (order.id !== orderId) return order
        
        const updatedItems = order.items.map(item =>
          item.id === itemId ? { ...item, checked: !item.checked } : item
        )
        
        // Check if all items are checked - then mark order as picked
        const allChecked = updatedItems.every(item => item.checked)
        const wasAlreadyPicked = order.status === 'picked'
        if (allChecked && !wasAlreadyPicked && isRealOrderId(order.id)) {
          callDriverApi(`/api/driver-app/orders/${order.id}/picked-up`, {});
        }
        
        return {
          ...order,
          items: updatedItems,
          status: allChecked ? 'picked' as const : order.status,
        }
      })
    )
  }

  // Calculate optimal route using nearest neighbor algorithm
  const calculateOptimalRoute = (orders: Order[]): Order[] => {
    if (orders.length <= 1) return orders
    
    const optimized: Order[] = []
    const remaining = [...orders]
    
    // Start with first order
    let current = remaining.shift()!
    optimized.push(current)
    
    // Find nearest neighbor repeatedly
    while (remaining.length > 0) {
      let nearestIdx = 0
      let nearestDist = Infinity
      
      for (let i = 0; i < remaining.length; i++) {
        const dist = Math.sqrt(
          Math.pow(current.customerLat - remaining[i].customerLat, 2) +
          Math.pow(current.customerLng - remaining[i].customerLng, 2)
        )
        if (dist < nearestDist) {
          nearestDist = dist
          nearestIdx = i
        }
      }
      
      current = remaining.splice(nearestIdx, 1)[0]
      optimized.push(current)
    }
    
    return optimized
  }

  const startDeliveries = () => {
    const allPicked = acceptedOrders.every(order => order.status === 'picked')
    if (allPicked && acceptedOrders.length > 0) {
      // Calculate optimal route - system berechnet schnellsten Weg!
      const optimizedOrders = calculateOptimalRoute(acceptedOrders)
      
      setAcceptedOrders(optimizedOrders.map(order => ({ ...order, status: 'delivering' as const })))
      setPhase('delivering')
      setCurrentDeliveryIndex(0)
      // Navigation wird über Link in picking-screen gestartet
    }
  }

  const completeDelivery = () => {
    const currentOrder = acceptedOrders[currentDeliveryIndex]
    if (currentOrder) {
      if (isRealOrderId(currentOrder.id)) {
        callDriverApi(`/api/driver-app/orders/${currentOrder.id}/delivered`, {});
      }
      // Mark as delivered
      const updatedOrders = [...acceptedOrders]
      updatedOrders[currentDeliveryIndex] = { ...currentOrder, status: 'delivered' as const }
      setAcceptedOrders(updatedOrders)
      
      // Move to next delivery or complete
      if (currentDeliveryIndex < acceptedOrders.length - 1) {
        setCurrentDeliveryIndex(prev => prev + 1)
      } else {
        // All deliveries complete
        setPhase('completed')
        setAcceptedOrders([])
        setCurrentDeliveryIndex(0)
      }
    }
  }

  const resetToWaiting = useCallback(() => {
    setPhase('waiting')
    setAcceptedOrders([])
    setCurrentDeliveryIndex(0)
  }, [])

  // Externe Bestellung hinzufügen (Uber, Lieferando, etc.)
  const addExternalOrder = useCallback((orderData: {
    customerName: string
    customerAddress: string
    customerPhone: string
    totalAmount: number
    paymentMethod: 'card' | 'cash'
    platform: ExternalPlatform
    receiptImage?: string
  }) => {
    const uniqueId = `external-${Date.now()}-${orderCounterRef.current++}`
    
    const externalOrder: Order = {
      id: uniqueId,
      restaurantName: orderData.platform.toUpperCase(),
      restaurantAddress: '',
      customerName: orderData.customerName,
      customerAddress: orderData.customerAddress,
      customerPhone: orderData.customerPhone,
      customerLat: 52.52 + (Math.random() - 0.5) * 0.05, // Random Berlin location
      customerLng: 13.405 + (Math.random() - 0.5) * 0.05,
      items: [{
        id: `${uniqueId}-item`,
        name: `${orderData.platform.toUpperCase()} Bestellung`,
        quantity: 1,
        price: orderData.totalAmount,
        checked: true, // Externe Bestellungen sind bereits abgeholt
      }],
      distance: '~',
      estimatedTime: '~',
      payout: 0,
      tip: 0,
      totalAmount: orderData.totalAmount,
      paymentMethod: orderData.paymentMethod,
      status: 'accepted',
      createdAt: new Date(),
      isExternal: true,
      externalPlatform: orderData.platform,
      receiptImage: orderData.receiptImage,
    }
    
    setCollectedOrders(prev => [...prev, externalOrder])
    
    // Falls wir in waiting sind, wechsel zu collecting
    if (phase === 'waiting') {
      setPhase('collecting')
    }
  }, [phase])

  return (
    <DriverContext.Provider
      value={{
        driver,
        setDriver,
        phase,
        incomingOrder,
        acceptedOrders,
        collectedOrders,
        pendingOrders,
        currentDeliveryIndex,
        isRinging,
        toggleOnline,
        acceptOrder,
        declineOrder,
        startCollecting,
        checkItem,
        startDeliveries,
        completeDelivery,
        simulateNewOrder,
        resetToWaiting,
        addExternalOrder,
      }}
    >
      {children}
    </DriverContext.Provider>
  )
}

export function useDriver() {
  const context = useContext(DriverContext)
  if (context === undefined) {
    throw new Error('useDriver must be used within a DriverProvider')
  }
  return context
}
