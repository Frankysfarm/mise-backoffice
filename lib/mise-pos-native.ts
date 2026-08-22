/**
 * Web-side shim that talks to the Capacitor wrapper (`window.MisePOSNative`)
 * when the POS runs inside the Mise POS native app.
 *
 * On the plain web (no wrapper), every method becomes a no-op or returns
 * `{ ok: false, fallback: 'web' }` so the UI can show the email/QR-bon flow.
 */

export interface NativeReceiptItem {
  qty: number;
  name: string;
  unitPrice: number;
  total: number;
}

export interface NativeReceiptInput {
  restaurantName: string;
  restaurantAddress?: string;
  restaurantTaxId?: string;
  orderNumber: string;
  tableNumber?: string | null;
  bestelltAm: Date;
  items: NativeReceiptItem[];
  subtotal: number;
  tip?: number;
  deliveryFee?: number;
  total: number;
  paymentMethod: 'bar' | 'karte' | 'online' | 'paypal' | 'rechnung';
  paymentRef?: string;
  bonToken?: string;
  qrUrl?: string;
  paperWidthMm?: 58 | 80;
  openCashDrawer?: boolean;
}

interface NativeBridge {
  version: string;
  platform: 'ios' | 'android' | 'web';
  isNative: boolean;
  listPrinters(timeoutMs?: number): Promise<{ deviceId: string; name: string | null; rssi?: number }[]>;
  pairPrinter(deviceId: string): Promise<{ deviceId: string; name: string | null }>;
  getPairedPrinter(): Promise<{ deviceId: string; name: string | null } | null>;
  forgetPrinter(): Promise<void>;
  printReceipt(input: NativeReceiptInput): Promise<{ ok: true; bytesSent: number } | { ok: false; error: string }>;
  openCashDrawer(): Promise<{ ok: true } | { ok: false; error: string }>;
  haptic(style?: 'light' | 'medium' | 'heavy'): Promise<void>;
}

declare global {
  interface Window {
    MisePOSNative?: NativeBridge;
  }
}

export function isNativePOS(): boolean {
  return typeof window !== 'undefined' && Boolean(window.MisePOSNative?.isNative);
}

export function nativeBridge(): NativeBridge | null {
  if (typeof window === 'undefined') return null;
  return window.MisePOSNative ?? null;
}

export async function printReceiptIfNative(
  input: NativeReceiptInput,
): Promise<{ ok: true; bytesSent: number } | { ok: false; error: string } | { ok: false; error: 'web-only' }> {
  const b = nativeBridge();
  if (!b || !b.isNative) return { ok: false, error: 'web-only' };
  return b.printReceipt(input);
}

export async function openDrawerIfNative(): Promise<
  { ok: true } | { ok: false; error: string } | { ok: false; error: 'web-only' }
> {
  const b = nativeBridge();
  if (!b || !b.isNative) return { ok: false, error: 'web-only' };
  return b.openCashDrawer();
}

export function waitForNativeReady(timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    if (isNativePOS()) return resolve(true);
    const t = setTimeout(() => resolve(isNativePOS()), timeoutMs);
    window.addEventListener('mise-pos-native-ready', () => {
      clearTimeout(t);
      resolve(true);
    }, { once: true });
  });
}
