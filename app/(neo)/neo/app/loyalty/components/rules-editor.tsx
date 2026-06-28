'use client';

import { useState } from 'react';
import { LoyaltyProgramRule } from '@/lib/loyalty/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trash2, Plus } from 'lucide-react';

interface RulesEditorProps {
  rules: LoyaltyProgramRule[];
  onAddRule: () => void;
  onDeleteRule: (ruleId: string) => void;
}

export function RulesEditor({ rules, onAddRule, onDeleteRule }: RulesEditorProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);

  const handleDeleteClick = (ruleId: string) => {
    setSelectedRuleId(ruleId);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedRuleId) {
      onDeleteRule(selectedRuleId);
      setDeleteConfirmOpen(false);
      setSelectedRuleId(null);
    }
  };

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return '-';
    return `€${value.toFixed(2)}`;
  };

  const getOrderTypeLabel = (type: string | undefined) => {
    const labels: Record<string, string> = {
      lieferung: 'Lieferung',
      abholung: 'Abholung',
      vor_ort: 'Vor Ort',
    };
    return labels[type || ''] || '-';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Regeln</h3>
        <Button onClick={onAddRule} variant="outline" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Regel hinzufügen
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-gray-500">
          Keine Regeln vorhanden. Klicken Sie auf "Regel hinzufügen", um zu starten.
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex-1">
                <h4 className="font-medium">{rule.name}</h4>
                <div className="mt-1 flex gap-4 text-sm text-gray-600">
                  {rule.min_order_value !== undefined && (
                    <span>Mindestbestellung: {formatCurrency(rule.min_order_value)}</span>
                  )}
                  {rule.order_type && (
                    <span>Bestelltyp: {getOrderTypeLabel(rule.order_type)}</span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteClick(rule.id)}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regel löschen</DialogTitle>
            <DialogDescription>
              Sind Sie sicher, dass Sie diese Regel löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
