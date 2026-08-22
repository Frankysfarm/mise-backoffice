import { redirect } from 'next/navigation';

// Weiterleitung von alter Driver-App auf neue Smart-Delivery Fahrer-App
// Damit nutzt die native Capacitor-App (lädt /driver per WebView)
// automatisch die neue Version mit Smart-Touren, Live-ETA, GPS-Tracking
export default function DriverRedirect() {
  redirect('/fahrer/app');
}
