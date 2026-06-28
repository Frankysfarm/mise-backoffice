'use client';

import { useState, useCallback } from 'react';
import { TimeWindow } from '@/lib/loyalty/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus } from 'lucide-react';

interface TimeWindowEditorProps {
  timeWindows: TimeWindow[];
  onTimeWindowsChange: (windows: TimeWindow[]) => void;
}

const DAYS = [
  { key: 'mo', label: 'Mo' },
  { key: 'tu', label: 'Di' },
  { key: 'we', label: 'Mi' },
  { key: 'th', label: 'Do' },
  { key: 'fr', label: 'Fr' },
  { key: 'sa', label: 'Sa' },
  { key: 'su', label: 'So' },
] as const;

type DayKey = typeof DAYS[number]['key'];

export function TimeWindowEditor({
  timeWindows,
  onTimeWindowsChange,
}: TimeWindowEditorProps) {
  const [expandedWindow, setExpandedWindow] = useState<number | null>(null);

  const handleAddWindow = useCallback(() => {
    const newWindow: TimeWindow = {
      day: 'mo',
      start: '09:00',
      end: '17:00',
    };
    const updated = [...timeWindows, newWindow];
    onTimeWindowsChange(updated);
    setExpandedWindow(updated.length - 1);
  }, [timeWindows, onTimeWindowsChange]);

  const handleDeleteWindow = useCallback(
    (index: number) => {
      const updated = timeWindows.filter((_, i) => i !== index);
      onTimeWindowsChange(updated);
      if (expandedWindow === index) {
        setExpandedWindow(null);
      }
    },
    [timeWindows, expandedWindow, onTimeWindowsChange]
  );

  const handleDayChange = useCallback(
    (index: number, day: DayKey) => {
      const updated = [...timeWindows];
      updated[index] = { ...updated[index], day };
      onTimeWindowsChange(updated);
    },
    [timeWindows, onTimeWindowsChange]
  );

  const handleTimeChange = useCallback(
    (index: number, field: 'start' | 'end', value: string) => {
      const updated = [...timeWindows];
      updated[index] = { ...updated[index], [field]: value };
      onTimeWindowsChange(updated);
    },
    [timeWindows, onTimeWindowsChange]
  );

  const getDayLabel = (day: string) => {
    return DAYS.find((d) => d.key === day)?.label || day.toUpperCase();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Verfügbarkeitsfenster</h3>
        <Button
          onClick={handleAddWindow}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Fenster hinzufügen
        </Button>
      </div>

      {timeWindows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-gray-500">
          Keine Verfügbarkeitsfenster. Klicken Sie auf "Fenster hinzufügen", um zu starten.
        </div>
      ) : (
        <div className="space-y-3">
          {timeWindows.map((window, index) => (
            <div
              key={index}
              className="rounded-lg border p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="font-medium text-sm text-gray-600">
                  {getDayLabel(window.day)} {window.start} - {window.end}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteWindow(index)}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {expandedWindow === index && (
                <div className="space-y-3 border-t pt-3">
                  {/* Day Selector Grid */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Wochentag
                    </label>
                    <div className="grid grid-cols-7 gap-2">
                      {DAYS.map((day) => (
                        <Button
                          key={day.key}
                          variant={window.day === day.key ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1"
                          onClick={() =>
                            handleDayChange(index, day.key as DayKey)
                          }
                        >
                          {day.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Time Inputs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Startzeit
                      </label>
                      <Input
                        type="time"
                        value={window.start}
                        onChange={(e) =>
                          handleTimeChange(index, 'start', e.target.value)
                        }
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Endzeit
                      </label>
                      <Input
                        type="time"
                        value={window.end}
                        onChange={(e) =>
                          handleTimeChange(index, 'end', e.target.value)
                        }
                        className="w-full"
                      />
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedWindow(null)}
                    className="w-full text-gray-600 hover:text-gray-900"
                  >
                    Einklappen
                  </Button>
                </div>
              )}

              {expandedWindow !== index && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedWindow(index)}
                  className="w-full text-gray-600 hover:text-gray-900"
                >
                  Bearbeiten
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
