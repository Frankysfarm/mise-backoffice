'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Mail } from 'lucide-react';
import { toastError, toastSuccess } from '@/components/ui/toaster';

export function InviteButton({ employeeId, email, alreadyLinked }: { employeeId: string; email: string | null; alreadyLinked: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (alreadyLinked) {
    return <Button variant="ghost" size="sm" disabled className="text-muted-foreground">✓ Login aktiv</Button>;
  }
  if (!email) {
    return <Button variant="ghost" size="sm" disabled className="text-muted-foreground">E-Mail fehlt</Button>;
  }

  function invite() {
    if (!confirm(`Einladung an ${email} senden?`)) return;
    start(async () => {
      const res = await fetch('/api/employees/invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return toastError('Einladung fehlgeschlagen', data?.error ?? `${res.status}`);
      toastSuccess('Einladung versendet', `Link geht an ${email}.`);
      router.refresh();
    });
  }

  return (
    <Button size="sm" variant="secondary" onClick={invite} disabled={pending}>
      <Mail className="h-3.5 w-3.5" /> {pending ? 'Sende...' : 'Einladen'}
    </Button>
  );
}
