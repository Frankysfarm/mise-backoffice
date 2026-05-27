import { Metadata } from 'next';
import { DeliveryProgressDashboard } from './client';

export const metadata: Metadata = {
  title: 'Smart Delivery System — Fortschritt',
};

export default function Page() {
  return <DeliveryProgressDashboard />;
}
