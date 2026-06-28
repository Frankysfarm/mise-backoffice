'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LoyaltyProgram } from '@/lib/loyalty/types';

export function ProgramForm({ program }: { program?: LoyaltyProgram }) {
  const [name, setName] = useState(program?.name || '');
  const [description, setDescription] = useState(program?.description || '');
  const [isActive, setIsActive] = useState(program?.is_active || false);
  const [maxRedemptions, setMaxRedemptions] = useState(
    program?.max_redemptions_per_customer_per_month || 1
  );

  async function handleSave() {
    if (!program?.id) return;
    
    const res = await fetch(`/api/loyalty/programs/${program.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name,
        description,
        is_active: isActive,
        max_redemptions_per_customer_per_month: maxRedemptions,
      }),
    });

    if (res.ok) {
      alert('Programm gespeichert');
    } else {
      alert('Fehler beim Speichern');
    }
  }

  return (
    <div className=border p-6 rounded>
      <h2 className=text-xl font-semibold mb-4>Grundeinstellungen</h2>
      <div className=space-y-4>
        <div>
          <label className=block text-sm font-medium>Programmname</label>
          <Input value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className=block text-sm font-medium>Beschreibung</label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <div className=flex items-center>
          <input
            type=checkbox
            checked={isActive}
            onChange={e => setIsActive(e.target.checked)}
            className=mr-2
          />
          <label>Programm aktivieren</label>
        </div>
        <div>
          <label className=block text-sm font-medium>Max. Boni pro Kunde/Monat</label>
          <Input
            type=number
            value={maxRedemptions}
            onChange={e => setMaxRedemptions(parseInt(e.target.value))}
          />
        </div>
        <Button onClick={handleSave}>Speichern</Button>
      </div>
    </div>
  );
}
