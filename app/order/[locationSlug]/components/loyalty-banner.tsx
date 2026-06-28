'use client';

import { EligibilityCheckResponse } from '@/lib/loyalty/types';
import { AlertCircle } from 'lucide-react';

export function LoyaltyBanner({
  eligibility,
  onSelectBonus,
}: {
  eligibility: EligibilityCheckResponse;
  onSelectBonus: () => void;
}) {
  if (!eligibility.eligible) return null;

  return (
    <div className=bg-green-50 border border-green-200 rounded-lg p-4 mb-4>
      <div className=flex items-start>
        <AlertCircle className=text-green-600 mr-3 mt-0.5 flex-shrink-0 />
        <div className=flex-1>
          <p className=font-semibold text-green-900>{eligibility.message}</p>
          <p className=text-sm text-green-700 mt-1>
            Wählen Sie aus {eligibility.available_items?.length || 0} verfügbaren Optionen.
          </p>
        </div>
        <button
          onClick={onSelectBonus}
          className=ml-4 px-4 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700
        >
          Wählen
        </button>
      </div>
    </div>
  );
}
