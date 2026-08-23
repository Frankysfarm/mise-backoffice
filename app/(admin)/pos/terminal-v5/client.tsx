'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { ShiftStarter } from '../terminal/shift-starter';
import './mobile.css';

const MisePOSv5 = dynamic(() => import('@design/pos/MisePOSv5'), { ssr: false });

type Shift = {
  id: string;
  employee_id: string;
  start_at: string;
  status: string;
};

export function MisePOSv5Wrapper({
  tenantId,
  locationId,
  employeeId,
  employeeName,
  registerId,
  initialShift,
}: {
  tenantId: string;
  locationId: string;
  employeeId: string;
  employeeName: string;
  registerId: string | null;
  initialShift: Shift | null;
}) {
  const [shift, setShift] = useState(initialShift);

  if (!registerId) {
    return (
      <div className="min-h-screen bg-[#0F0E0D] text-white grid place-items-center p-6">
        <div className="max-w-md text-center">
          <div className="text-xs uppercase tracking-[0.2em] text-orange-300">Kasse nicht bereit</div>
          <h1 className="mt-3 text-3xl font-black">Keine aktive Kasse eingerichtet</h1>
          <p className="mt-3 text-white/60">Bitte zuerst im Backoffice eine Kasse für diese Filiale aktivieren.</p>
        </div>
      </div>
    );
  }

  if (!shift) {
    return (
      <ShiftStarter
        tenantId={tenantId}
        locationId={locationId}
        employeeId={employeeId}
        employeeName={employeeName}
        registerId={registerId}
        existingShift={null}
        onStarted={(nextShift) => {
          const injected = (globalThis as typeof globalThis & {
            MISE_POS_DATA?: { runtime?: { shiftId?: string | null } };
          }).MISE_POS_DATA;
          if (injected?.runtime) injected.runtime.shiftId = nextShift.id;
          setShift(nextShift);
        }}
      />
    );
  }

  return (
    <div className="pos-root">
      <MisePOSv5 key={shift.id} />
    </div>
  );
}
