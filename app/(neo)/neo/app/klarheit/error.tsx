'use client';

import { AlertTriangle } from 'lucide-react';
import styles from './klarheit.module.css';

export default function KlarheitError({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className={styles.statePanel} role="alert">
      <AlertTriangle size={26} aria-hidden="true" />
      <div>
        <h1>Tagesklarheit konnte nicht geladen werden</h1>
        <p>Prüfe die Verbindung und lade die Übersicht erneut.</p>
      </div>
      <button type="button" onClick={reset}>Erneut laden</button>
    </section>
  );
}
