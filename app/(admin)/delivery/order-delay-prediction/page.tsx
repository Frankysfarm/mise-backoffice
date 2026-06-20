import { Metadata } from 'next';
import OrderDelayPredictionClient from './client';

export const metadata: Metadata = {
  title: 'Order Delay Prediction | Mise Delivery',
};

export default function OrderDelayPredictionPage() {
  return <OrderDelayPredictionClient />;
}
