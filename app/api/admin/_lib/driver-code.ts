/**
 * Helper für Driver-Login-Code-Generierung im Backoffice.
 * Liegt unter app/api/admin/_lib/driver-code.ts.
 */
import { createHmac } from 'node:crypto';

function otpSecret(): string {
  const s = process.env.DRIVER_OTP_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV !== 'production') {
      return 'dev-otp-secret-please-set-DRIVER_OTP_SECRET-in-prod';
    }
    throw new Error('DRIVER_OTP_SECRET muss gesetzt sein in production');
  }
  return s;
}

export function hashCode(code: string): string {
  return createHmac('sha256', otpSecret()).update(code).digest('hex');
}

export function generate6DigitCode(): string {
  let n = 0;
  while (n < 100000) n = Math.floor(Math.random() * 1_000_000);
  return n.toString().padStart(6, '0');
}

export function normalizePhone(raw: string): string {
  const t = (raw ?? '').trim();
  const plus = t.startsWith('+') ? '+' : '';
  return plus + t.replace(/\D/g, '');
}
