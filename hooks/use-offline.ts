'use client'

import { useState, useEffect, useCallback } from 'react'
import { Order } from '@/lib/lieferdienst/orders'

export function useOfflineStorage(scope: string) {
  const ordersStorageKey = `mise_kds_orders:${scope}`
  const completedOrdersKey = `mise_kds_completed:${scope}`
  const [isOnline, setIsOnline] = useState(true)
  const [hasUnsyncedData, setHasUnsyncedData] = useState(false)

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    setIsOnline(navigator.onLine)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Save orders to localStorage
  const saveOrders = useCallback((orders: Order[]) => {
    try {
      const serialized = JSON.stringify(orders.map(o => ({
        ...o,
        createdAt: new Date(o.createdAt).toISOString(),
        acceptedAt: o.acceptedAt ? new Date(o.acceptedAt).toISOString() : undefined,
        waitingForCustomerSince: o.waitingForCustomerSince?.toISOString(),
      })))
      localStorage.setItem(ordersStorageKey, serialized)
      if (!isOnline) {
        setHasUnsyncedData(true)
      }
    } catch (e) {
      console.error('[v0] Failed to save orders to localStorage:', e)
    }
  }, [isOnline, ordersStorageKey])

  // Load orders from localStorage
  const loadOrders = useCallback((): Order[] | null => {
    try {
      const stored = localStorage.getItem(ordersStorageKey)
      if (!stored) return null
      
      const parsed = JSON.parse(stored)
      return parsed.map((o: any) => ({
        ...o,
        createdAt: new Date(o.createdAt),
        acceptedAt: o.acceptedAt ? new Date(o.acceptedAt) : undefined,
        waitingForCustomerSince: o.waitingForCustomerSince ? new Date(o.waitingForCustomerSince) : undefined,
      }))
    } catch (e) {
      console.error('[v0] Failed to load orders from localStorage:', e)
      return null
    }
  }, [ordersStorageKey])

  // Save completed orders
  const saveCompletedOrders = useCallback((orders: Order[]) => {
    try {
      const serialized = JSON.stringify(orders.map(o => ({
        ...o,
        createdAt: new Date(o.createdAt).toISOString(),
        acceptedAt: o.acceptedAt ? new Date(o.acceptedAt).toISOString() : undefined,
        waitingForCustomerSince: o.waitingForCustomerSince?.toISOString(),
      })))
      localStorage.setItem(completedOrdersKey, serialized)
    } catch (e) {
      console.error('[v0] Failed to save completed orders:', e)
    }
  }, [completedOrdersKey])

  // Load completed orders
  const loadCompletedOrders = useCallback((): Order[] | null => {
    try {
      const stored = localStorage.getItem(completedOrdersKey)
      if (!stored) return null
      
      const parsed = JSON.parse(stored)
      return parsed.map((o: any) => ({
        ...o,
        createdAt: new Date(o.createdAt),
        acceptedAt: o.acceptedAt ? new Date(o.acceptedAt) : undefined,
        waitingForCustomerSince: o.waitingForCustomerSince ? new Date(o.waitingForCustomerSince) : undefined,
      }))
    } catch (e) {
      console.error('[v0] Failed to load completed orders:', e)
      return null
    }
  }, [completedOrdersKey])

  // Clear unsynced flag
  const markAsSynced = useCallback(() => {
    setHasUnsyncedData(false)
  }, [])

  return {
    isOnline,
    hasUnsyncedData,
    saveOrders,
    loadOrders,
    saveCompletedOrders,
    loadCompletedOrders,
    markAsSynced,
  }
}
