import { CalendarClock } from 'lucide-react';
import styles from './klarheit.module.css';

export default function KlarheitLoading() {
  return (
    <section className={styles.statePanel} aria-live="polite" aria-busy="true">
      <CalendarClock size={26} aria-hidden="true" />
      <div>
        <h1>Tagesklarheit wird geladen</h1>
        <p>Schichten, Aufgaben und Abdeckung werden zusammengestellt.</p>
      </div>
    </section>
  );
}
