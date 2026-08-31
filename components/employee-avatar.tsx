'use client';

import { useState } from 'react';
import { UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';

type EmployeeLike = {
  vorname?: string | null;
  nachname?: string | null;
  avatar_url?: string | null;
} | null | undefined;

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASSES: Record<Size, string> = {
  xs: 'h-6 w-6 text-[9px]',
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-10 w-10 text-xs',
  lg: 'h-14 w-14 text-sm',
  xl: 'h-20 w-20 text-base',
};

function initials(employee: EmployeeLike) {
  if (!employee) return '';
  const first = employee.vorname?.trim()?.[0] ?? '';
  const last = employee.nachname?.trim()?.[0] ?? '';
  return `${first}${last}`.toUpperCase();
}

export function EmployeeAvatar({
  employee,
  size = 'md',
  className,
  alt,
}: {
  employee: EmployeeLike;
  size?: Size;
  className?: string;
  alt?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = employee?.avatar_url;
  const label = initials(employee);

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt ?? `Profilbild ${label}`}
        className={cn(
          'inline-block shrink-0 rounded-full object-cover ring-1 ring-slate-200',
          SIZE_CLASSES[size],
          className,
        )}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-500 font-bold text-white ring-1 ring-white/20',
        SIZE_CLASSES[size],
        className,
      )}
      aria-label={alt ?? `Avatar ${label}`}
    >
      {label ? <span>{label}</span> : <UserRound size={size === 'xl' ? 24 : size === 'lg' ? 18 : 14} />}
    </span>
  );
}
