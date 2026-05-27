'use client';

import { useState } from 'react';
import { DriverProvider, useDriver } from '@/lib/driver-app/driver-context';
import { Header } from '@/components/driver/header';
import { WaitingScreen } from '@/components/driver/waiting-screen';
import { IncomingOrder } from '@/components/driver/incoming-order';
import { CollectingScreen } from '@/components/driver/collecting-screen';
import { PickingScreen } from '@/components/driver/picking-screen';
import { DeliveryScreen } from '@/components/driver/delivery-screen';
import { CompletedScreen } from '@/components/driver/completed-screen';

function DriverShell() {
  const { phase } = useDriver();
  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-white">
      <Header />
      <main className="flex-1 overflow-hidden">
        {phase === 'waiting' && <WaitingScreen />}
        {phase === 'incoming' && <IncomingOrder />}
        {phase === 'collecting' && <CollectingScreen />}
        {phase === 'picking' && <PickingScreen />}
        {phase === 'delivering' && <DeliveryScreen />}
        {phase === 'completed' && <CompletedScreen />}
      </main>
    </div>
  );
}

export default function DriverAppPage() {
  return (
    <DriverProvider>
      <DriverShell />
    </DriverProvider>
  );
}
