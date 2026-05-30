'use client'

import { useState, useEffect, useCallback } from 'react'
import { Order } from '@/lib/lieferdienst/orders'

const ORDERS_STORAGE_KEY = 'mise_kds_orders'
const COMPLETED_ORDERS_KEY = 'mise_kds_completed'
const SETTINGS_STORAGE_KEY = 'mise_kds_settings'

export function useOfflineStorage() {
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
      localStorage.setItem(ORDERS_STORAGE_KEY, serialized)
      if (!isOnline) {
        setHasUnsyncedData(true)
      }
    } catch (e) {
      console.error('[v0] Failed to save orders to localStorage:', e)
    }
  }, [isOnline])

  // Load orders from localStorage
  const loadOrders = useCallback((): Order[] | null => {
    try {
      const stored = localStorage.getItem(ORDERS_STORAGE_KEY)
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
  }, [])

  // Save completed orders
  const saveCompletedOrders = useCallback((orders: Order[]) => {
    try {
      const serialized = JSON.stringify(orders.map(o => ({
        ...o,
        createdAt: new Date(o.createdAt).toISOString(),
        acceptedAt: o.acceptedAt ? new Date(o.acceptedAt).toISOString() : undefined,
        waitingForCustomerSince: o.waitingForCustomerSince?.toISOString(),
      })))
      localStorage.setItem(COMPLETED_ORDERS_KEY, serialized)
    } catch (e) {
      console.error('[v0] Failed to save completed orders:', e)
    }
  }, [])

  // Load completed orders
  const loadCompletedOrders = useCallback((): Order[] | null => {
    try {
      const stored = localStorage.getItem(COMPLETED_ORDERS_KEY)
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
  }, [])

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
