import { type Metadata } from 'next';
import DelayAlertPushClient from './client';

export const metadata: Metadata = {
  title: 'Delay Alert Push | Mise Admin',
};

export default function DelayAlertPushPage() {
  return <DelayAlertPushClient />;
}
