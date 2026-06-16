'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, AlertTriangle, Banknote, CreditCard, Bell, MapPin, MessageSquare, Camera } from 'lucide-react';
import { cn, euro } from '@/lib/utils';

type StopInfo = {
  kunde_name: string;
  zahlungsart: string | null;
  bezahlt: boolean | null;
  gesamtbetrag: number;
  kunde_notiz?: string | null;
  kunde_lieferhinweis?: string | null;
  stockwerk?: string | null;
};

type ChecklistItem = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  amber?: boolean;
};

function buildItems(stop: StopInfo): ChecklistItem[] {
  const items: ChecklistItem[] = [
    { id: 'adresse', label: 'Adresse geprüft', icon: <MapPin size={16} /> },
    { id: 'klingel', label: 'Klingel gedrückt', icon: <Bell size={16} /> },
    { id: 'uebergabe', label: 'Bestellung übergeben' },
  ];

  if (stop.zahlungsart === 'bar' && !stop.bezahlt) {
    items.push({
      id: 'barzahlung',
      label: `Barzahlung kassieren — ${euro(stop.gesamtbetrag)}`,
      icon: <Banknote size={16} />,
      amber: true,
    });
  }

  if (stop.zahlungsart === 'ec' && !stop.bezahlt) {
    items.push({
      id: 'ec',
      label: `EC-Karte kassieren — ${euro(stop.gesamtbetrag)}`,
      icon: <CreditCard size={16} />,
      amber: true,
    });
  }

  if (stop.kunde_notiz || stop.kunde_lieferhinweis) {
    items.push({
      id: 'notiz',
      label: 'Kundennotiz beachtet',
      icon: <MessageSquare size={16} />,
    });
  }

  return items;
}

export function StopCheckliste({ stop, onComplete }: { stop: StopInfo; onComplete?: () => void }) {
  const items = buildItems(stop);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const checkedCount = Object.values(checked).filter(Boolean).length;
  const total = items.length;
  const allDone = checkedCount === total;

  useEffect(() => {
    if (allDone && onComplete) {
      onComplete();
    }
  }, [allDone, onComplete]);

  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="bg-matcha-900 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-matcha-700">
        <span className="text-matcha-50 font-semibold text-sm tracking-wide">Lieferschritte</span>
        <span className="text-xs font-medium text-matcha-300">
          {checkedCount}/{total} Schritte
        </span>
      </div>

      <ul className="flex flex-col gap-2 p-3">
        {items.map((item) => {
          const isChecked = !!checked[item.id];
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => toggle(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors active:scale-[0.98]',
                  item.amber && !isChecked
                    ? 'bg-amber-900/40 border border-amber-500/40'
                    : 'bg-matcha-800/60 border border-matcha-700/40',
                  isChecked && 'opacity-60'
                )}
              >
                <span className="shrink-0">
                  {isChecked ? (
                    <CheckCircle2 size={20} className="text-[#4ae68a]" />
                  ) : (
                    <Circle
                      size={20}
                      className={item.amber ? 'text-amber-400' : 'text-matcha-400'}
                    />
                  )}
                </span>

                {item.icon && (
                  <span
                    className={cn(
                      'shrink-0',
                      isChecked
                        ? 'text-matcha-400'
                        : item.amber
                        ? 'text-amber-400'
                        : 'text-matcha-300'
                    )}
                  >
                    {item.icon}
                  </span>
                )}

                <span
                  className={cn(
                    'text-sm font-medium flex-1',
                    isChecked
                      ? 'line-through text-matcha-400'
                      : item.amber
                      ? 'text-amber-200'
                      : 'text-matcha-50'
                  )}
                >
                  {item.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {allDone && (
        <div className="mx-3 mb-3 rounded-xl bg-[#4ae68a]/15 border border-[#4ae68a]/40 flex items-center justify-center gap-2 py-3">
          <CheckCircle2 size={18} className="text-[#4ae68a]" />
          <span className="text-[#4ae68a] font-semibold text-sm">Fertig!</span>
        </div>
      )}
    </div>
  );
}
