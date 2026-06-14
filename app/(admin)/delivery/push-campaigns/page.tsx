import { Metadata } from 'next';
import { PushCampaignsClient } from './client';

export const metadata: Metadata = {
  title: 'Push-Kampagnen | Mise Delivery',
};

export default function PushCampaignsPage() {
  return <PushCampaignsClient />;
}
