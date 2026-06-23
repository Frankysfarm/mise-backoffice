'use client';

/**
 * DispatchBatchReassignDialog — Phase 484
 * Modal zum Neubesetzen einer Tour (Batch).
 * Zeigt verfügbare Fahrer mit Score/Status, ermöglicht Auswahl + Bestätigung.
 * Nutzt POST /api/delivery/admin/batch-reassign.
 */

import { useEffect, useState } from 'react';
import { Loader2, UserCheck, UserX, ArrowRightLeft, Star, Bike, Car } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AvailableDriver {
  id: string;
  name: string;
  vehicle: string | null;
  state: string | null;
  hasActiveBatch: boolean;
  activeBatchId: string | null;
  rating: number | null;
  totalDeliveries: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  batchId: string | null;
  currentDriverId: string | null;
  currentDriverName?: string;
  locationId: string | null;
  onReassigned?: (newDriverId: string, newDriverName: string) => void;
}

export function DispatchBatchReassignDialog({
  open,
  onClose,
  batchId,
  currentDriverId,
  currentDriverName,
  locationId,
  onReassigned,
}: Props) {
  const [drivers, setDrivers] = useState<AvailableDriver[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [reassigning, setReassigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open || !locationId) return;
    setLoading(true);
    setSelected(null);
    setError(null);
    setDone(false);

    fetch(`/api/delivery/admin/batch-reassign?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json() as Promise<{ drivers: AvailableDriver[] }>)
      .then((d) => setDrivers(d.drivers ?? []))
      .catch(() => setError('Fahrer konnten nicht geladen werden'))
      .finally(() => setLoading(false));
  }, [open, locationId]);

  async function handleReassign() {
    if (!selected || !batchId || reassigning) return;
    setReassigning(true);
    setError(null);

    try {
      const res = await fetch('/api/delivery/admin/batch-reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id:      batchId,
          new_driver_id: selected,
          location_id:   locationId,
        }),
      });

      const data = await res.json() as {
        ok?: boolean;
        error?: string;
        newDriverId?: string;
        newDriverName?: string;
      };

      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Fehler beim Neubesetzen');
        setReassigning(false);
        return;
      }

      setDone(true);
      onReassigned?.(data.newDriverId!, data.newDriverName!);
      setTimeout(() => { onClose(); setDone(false); }, 1500);
    } catch {
      setError('Verbindungsfehler – bitte erneut versuchen.');
      setReassigning(false);
    }
  }

  const selectedDriver = drivers.find((d) => d.id === selected);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <ArrowRightLeft className="h-4 w-4 text-matcha-600" />
            Tour neu besetzen
          </DialogTitle>
        </DialogHeader>

        {currentDriverName && (
          <div className="text-xs text-muted-foreground mb-1">
            Aktueller Fahrer: <span className="font-semibold text-foreground">{currentDriverName}</span>
          </div>
        )}

        {done && (
          <div className="rounded-xl border border-matcha-300 bg-matcha-50 px-4 py-3 text-sm font-semibold text-matcha-800 text-center animate-in fade-in">
            ✅ Tour erfolgreich neu zugewiesen!
          </div>
        )}

        {!done && (
          <>
            {loading && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!loading && drivers.length === 0 && !error && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Keine aktiven Fahrer verfügbar.
              </div>
            )}

            {!loading && drivers.length > 0 && (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {drivers
                  .filter((d) => d.id !== currentDriverId)
                  .map((d) => {
                    const VehicleIcon = d.vehicle === 'bike' ? Bike : Car;
                    const isSel = selected === d.id;

                    return (
                      <button
                        key={d.id}
                        onClick={() => setSelected(d.id)}
                        className={cn(
                          'w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all',
                          isSel
                            ? 'border-matcha-400 bg-matcha-50 ring-1 ring-matcha-300'
                            : 'border-border hover:border-matcha-200 hover:bg-muted/30',
                        )}
                      >
                        <div className={cn(
                          'h-8 w-8 rounded-full flex items-center justify-center shrink-0',
                          isSel ? 'bg-matcha-500 text-white' : 'bg-muted',
                        )}>
                          {isSel ? (
                            <UserCheck className="h-4 w-4" />
                          ) : (
                            <VehicleIcon className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold truncate">{d.name}</span>
                            {d.hasActiveBatch && (
                              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 bg-amber-100 text-amber-800">
                                Aktive Tour
                              </Badge>
                            )}
                            {!d.hasActiveBatch && (
                              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 bg-matcha-100 text-matcha-800">
                                Frei
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {d.rating !== null && (
                              <span className="flex items-center gap-0.5 text-[10px] text-amber-600 font-medium">
                                <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                                {d.rating.toFixed(1)}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {d.totalDeliveries} Lieferungen
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}

            {error && (
              <p className="text-xs text-destructive text-center">{error}</p>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={onClose} className="flex-1" disabled={reassigning}>
                Abbrechen
              </Button>
              <Button
                onClick={handleReassign}
                disabled={!selected || reassigning}
                className="flex-1 bg-matcha-500 hover:bg-matcha-600 text-white"
              >
                {reassigning ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <ArrowRightLeft className="h-4 w-4 mr-1" />
                )}
                {reassigning
                  ? 'Zuweisen…'
                  : selectedDriver
                    ? `An ${selectedDriver.name}`
                    : 'Fahrer wählen'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
