import type { Metadata } from 'next';
import MenuAnalyticsClient from './client';

export const metadata: Metadata = { title: 'Menü-Analytics | Mise Delivery' };

export default function MenuAnalyticsPage() {
  return <MenuAnalyticsClient />;
}
