'use client';

import * as React from 'react';
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport, ToastIcon } from './toast';

type ToastKind = 'default' | 'success' | 'error';
type ToastItem = { id: number; title?: string; description?: string; variant?: ToastKind };

type Ctx = { push: (t: Omit<ToastItem, 'id'>) => void };
const ToastCtx = React.createContext<Ctx | null>(null);

let counter = 0;
const listeners = new Set<(t: ToastItem) => void>();

export function toast(t: Omit<ToastItem, 'id'>) {
  const item: ToastItem = { id: ++counter, ...t };
  listeners.forEach(l => l(item));
}

export const toastSuccess = (title: string, description?: string) => toast({ title, description, variant: 'success' });
export const toastError   = (title: string, description?: string) => toast({ title, description, variant: 'error' });
export const toastInfo    = (title: string, description?: string) => toast({ title, description, variant: 'default' });

export function Toaster() {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  React.useEffect(() => {
    const handler = (t: ToastItem) => setItems(prev => [...prev, t]);
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  return (
    <ToastProvider>
      {items.map(t => (
        <Toast
          key={t.id}
          variant={t.variant}
          onOpenChange={open => { if (!open) setItems(prev => prev.filter(i => i.id !== t.id)); }}
        >
          <ToastIcon variant={t.variant} />
          <div className="flex-1">
            {t.title && <ToastTitle>{t.title}</ToastTitle>}
            {t.description && <ToastDescription>{t.description}</ToastDescription>}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
