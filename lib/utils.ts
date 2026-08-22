import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function euro(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export function dateDE(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function timeDE(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function dateTimeDE(d: string | Date | null | undefined): string {
  if (!d) return '—';
  return `${dateDE(d)} ${timeDE(d)}`;
}
