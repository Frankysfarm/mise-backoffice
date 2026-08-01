import type { UiStep } from './click-actor'

export const customerStorefrontFlow: readonly UiStep[] = [
  { id: 'storefront-ready', action: 'assertVisible', selector: { by: 'testId', testId: 'storefront-root' }, serverCheckpoint: 'storefront-ready' },
  { id: 'open-product', action: 'click', selector: { by: 'testId', testId: 'storefront-product-primary' }, serverCheckpoint: 'product-opened' },
  { id: 'add-product', action: 'click', selector: { by: 'role', role: 'button', name: 'In den Warenkorb' }, serverCheckpoint: 'cart-updated' },
  { id: 'open-cart', action: 'click', selector: { by: 'role', role: 'button', name: 'Warenkorb öffnen' }, serverCheckpoint: 'cart-opened' },
  { id: 'checkout', action: 'click', selector: { by: 'role', role: 'button', name: 'Zur Kasse' }, serverCheckpoint: 'checkout-opened' },
]

export const kitchenDisplayFlow: readonly UiStep[] = [
  { id: 'kitchen-order-once', action: 'assertExactlyOne', selector: { by: 'testId', testId: 'kitchen-order-active' }, serverCheckpoint: 'kitchen-order-visible' },
  { id: 'start-preparation', action: 'click', selector: { by: 'role', role: 'button', name: 'Zubereitung starten' }, serverCheckpoint: 'kitchen-preparing' },
  { id: 'mark-ready', action: 'click', selector: { by: 'role', role: 'button', name: 'Bestellung fertig' }, serverCheckpoint: 'kitchen-ready' },
]

export const driverPickupAndDeliveryFlow: readonly UiStep[] = [
  { id: 'delivery-view-once', action: 'assertExactlyOne', selector: { by: 'testId', testId: 'driver-delivery-view' }, serverCheckpoint: 'driver-assignment-visible' },
  { id: 'accept-assignment', action: 'click', selector: { by: 'role', role: 'button', name: 'Auftrag annehmen' }, serverCheckpoint: 'assignment-accepted' },
  { id: 'pick-required-item', action: 'click', selector: { by: 'testId', testId: 'driver-required-item-0' }, serverCheckpoint: 'item-picked' },
  { id: 'navigation-cta-once', action: 'assertExactlyOne', selector: { by: 'testId', testId: 'driver-navigation-cta' }, serverCheckpoint: 'route-persisted' },
  { id: 'depart', action: 'click', selector: { by: 'testId', testId: 'driver-navigation-cta' }, serverCheckpoint: 'departed' },
  { id: 'arrival-cta-once', action: 'assertExactlyOne', selector: { by: 'testId', testId: 'driver-arrival-cta' }, serverCheckpoint: 'next-stop' },
  { id: 'arrive', action: 'click', selector: { by: 'testId', testId: 'driver-arrival-cta' }, serverCheckpoint: 'arrived' },
  { id: 'complete-cta-once', action: 'assertExactlyOne', selector: { by: 'testId', testId: 'driver-complete-cta' }, serverCheckpoint: 'delivery-ready' },
  { id: 'complete-delivery', action: 'click', selector: { by: 'testId', testId: 'driver-complete-cta' }, serverCheckpoint: 'delivered' },
]

export const dispatcherObservationFlow: readonly UiStep[] = [
  { id: 'dispatcher-live', action: 'assertVisible', selector: { by: 'testId', testId: 'dispatcher-live-overview' }, serverCheckpoint: 'dispatcher-live' },
  { id: 'unresolved-orders', action: 'click', selector: { by: 'role', role: 'button', name: 'Ungeklärte Bestellungen' }, serverCheckpoint: 'unresolved-orders' },
  { id: 'dispatch-audit', action: 'click', selector: { by: 'role', role: 'button', name: 'Dispatch-Audit öffnen' }, serverCheckpoint: 'dispatch-audit' },
  { id: 'watchdog-alerts', action: 'click', selector: { by: 'role', role: 'button', name: 'Watchdog-Alarme' }, serverCheckpoint: 'watchdog-alerts' },
]

