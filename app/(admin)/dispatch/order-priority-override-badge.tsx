'use client';

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Flag, ChevronDown, X, Check, Loader2 } from 'lucide-react';

type Priority = 'hoch' | 'mittel' | 'niedrig';

interface Props {
  orderId: string;
  locationId: string | null;
  currentPriority?: string | null;
  className?: string;
}

interface OverrideData {
  priority: Priority;
  note: string | null;
}

interface GetOverrideResponse {
  override: OverrideData | null;
}

interface PostOverrideResponse {
  ok: boolean;
  override: {
    id: string;
    order_id: string;
    priority: string;
    note: string | null;
    created_at: string;
  };
}

const PRIORITY_STYLES: Record<Priority, string> = {
  hoch:    'bg-red-100 text-red-700 border-red-200',
  mittel:  'bg-amber-100 text-amber-700 border-amber-200',
  niedrig: 'bg-blue-100 text-blue-700 border-blue-200',
};

const PRIORITY_LABELS: Record<Priority, string> = {
  hoch:    'Hoch',
  mittel:  'Mittel',
  niedrig: 'Niedrig',
};

const PRIORITIES: Priority[] = ['hoch', 'mittel', 'niedrig'];

export function DispatchOrderPriorityOverrideBadge({ orderId, locationId, currentPriority, className }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Priority | ''>('');
  const [note, setNote] = useState('');
  const [activeOverride, setActiveOverride] = useState<OverrideData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const displayPriority = activeOverride?.priority ?? (currentPriority as Priority | null | undefined) ?? null;

  useEffect(() => {
    async function fetchOverride() {
      try {
        const res = await fetch(`/api/delivery/admin/order-priority-override?order_id=${orderId}`);
        if (res.ok) {
          const data = (await res.json()) as GetOverrideResponse;
          setActiveOverride(data.override);
        }
      } catch {
        // silently ignore
      }
    }
    void fetchOverride();
  }, [orderId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  async function handleSetPriority() {
    if (!selected || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/order-priority-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          priority: selected,
          note: note || undefined,
          location_id: locationId,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as PostOverrideResponse;
        setActiveOverride({ priority: data.override.priority as Priority, note: data.override.note });
        setOpen(false);
        setSelected('');
        setNote('');
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleClear() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/order-priority-override?order_id=${orderId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setActiveOverride(null);
        setOpen(false);
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }

  const badgeStyle = displayPriority && PRIORITIES.includes(displayPriority as Priority)
    ? PRIORITY_STYLES[displayPriority as Priority]
    : 'bg-muted/50 text-muted-foreground border-border';

  const badgeLabel = displayPriority && PRIORITIES.includes(displayPriority as Priority)
    ? PRIORITY_LABELS[displayPriority as Priority]
    : 'Normal';

  return (
    <div ref={containerRef} className={cn('relative inline-flex', className)}>
      <button
        type="button"
        onClick={() => setOpen((v: boolean) => !v)}
        className={cn(
          'flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80',
          badgeStyle,
        )}
      >
        <Flag className="size-3 shrink-0" />
        <span>{badgeLabel}</span>
        <ChevronDown className="size-3 shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-background shadow-lg">
          <div className="p-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Priorität setzen</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-0.5 hover:bg-muted"
              >
                <X className="size-3.5 text-muted-foreground" />
              </button>
            </div>

            <div className="mb-2 flex flex-col gap-1">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSelected(p)}
                  className={cn(
                    'flex items-center justify-between rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                    PRIORITY_STYLES[p],
                    selected === p ? 'ring-2 ring-offset-1 ring-current' : 'hover:opacity-80',
                  )}
                >
                  <span>{PRIORITY_LABELS[p]}</span>
                  {selected === p && <Check className="size-3.5 shrink-0" />}
                </button>
              ))}
            </div>

            <textarea
              value={note}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value.slice(0, 120))}
              placeholder="Notiz (optional, max. 120 Zeichen)"
              rows={2}
              className="mb-2 w-full resize-none rounded border border-border bg-background px-2 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void handleSetPriority()}
                disabled={!selected || loading}
                className="flex flex-1 items-center justify-center gap-1 rounded-md bg-foreground px-3 py-1 text-xs font-medium text-background transition-opacity disabled:opacity-40 hover:opacity-80"
              >
                {loading ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                Setzen
              </button>
              {activeOverride && (
                <button
                  type="button"
                  onClick={() => void handleClear()}
                  disabled={loading}
                  className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
                >
                  Zurücksetzen
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
