'use client'

import { useEffect, useCallback } from 'react'

interface KeyboardShortcutHandlers {
  onAcceptFirst?: () => void
  onMarkFirstDone?: () => void
  onEscape?: () => void
  onToggleSound?: () => void
  onOpenSettings?: () => void
  onNextOrder?: () => void
  onPrevOrder?: () => void
  onRefresh?: () => void
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return
    }

    // F1 - Accept first pending order
    if (event.key === 'F1') {
      event.preventDefault()
      handlers.onAcceptFirst?.()
      return
    }

    // F2 - Mark first accepted order as done
    if (event.key === 'F2') {
      event.preventDefault()
      handlers.onMarkFirstDone?.()
      return
    }

    // F5 - Refresh
    if (event.key === 'F5') {
      event.preventDefault()
      handlers.onRefresh?.()
      return
    }

    // ESC - Close dialogs
    if (event.key === 'Escape') {
      handlers.onEscape?.()
      return
    }

    // M - Toggle sound/mute
    if (event.key === 'm' || event.key === 'M') {
      handlers.onToggleSound?.()
      return
    }

    // S - Open settings
    if (event.key === 's' && !event.ctrlKey && !event.metaKey) {
      handlers.onOpenSettings?.()
      return
    }

    // Arrow keys for navigation
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      handlers.onNextOrder?.()
      return
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      handlers.onPrevOrder?.()
      return
    }
  }, [handlers])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

export const shortcutsList = [
  { key: 'F1', description: 'Erste neue Bestellung annehmen' },
  { key: 'F2', description: 'Erste Bestellung als fertig markieren' },
  { key: 'F5', description: 'Aktualisieren' },
  { key: 'ESC', description: 'Dialog schließen' },
  { key: 'M', description: 'Sound an/aus' },
  { key: 'S', description: 'Einstellungen öffnen' },
  { key: '← →', description: 'Navigation zwischen Bestellungen' },
]
