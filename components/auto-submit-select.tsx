'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Select, das das umschließende Form auto-submittet on change.
 * Client-Component, damit onChange in Server-Seiten einsetzbar ist.
 */
export function AutoSubmitSelect({
  name, defaultValue, options, className,
}: {
  name: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ''}
      className={cn('h-9 rounded-md border bg-background px-2 text-sm', className)}
      onChange={e => e.currentTarget.form!.requestSubmit()}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
