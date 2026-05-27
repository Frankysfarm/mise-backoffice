/**
 * Mise Animation-Keyframes
 *
 * Als CSS-String exportiert für Inline-Einsatz in Komponenten:
 *   <style>{miseAnimations}</style>
 *
 * Oder global in App-Root injizieren:
 *   const style = document.createElement('style');
 *   style.textContent = miseAnimations;
 *   document.head.appendChild(style);
 */

export const miseAnimations = `
  @keyframes misePulse {
    0%, 100% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(230, 138, 44, 0.5);
    }
    50% {
      transform: scale(1.02);
      box-shadow: 0 0 0 8px rgba(230, 138, 44, 0);
    }
  }

  @keyframes misePulseDot {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.15); }
  }

  @keyframes miseSpin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes miseSuccessPop {
    0% { transform: scale(0); }
    60% { transform: scale(1.15); }
    100% { transform: scale(1); }
  }

  @keyframes miseShakeIn {
    0% { transform: scale(0); }
    60% { transform: scale(1.15) rotate(-3deg); }
    80% { transform: scale(1) rotate(3deg); }
    100% { transform: scale(1) rotate(0); }
  }

  @keyframes miseScanLine {
    0% { top: 0; }
    50% { top: 100%; }
    100% { top: 0; }
  }

  @keyframes miseFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes miseSlideUp {
    from { transform: translateY(8px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;

/**
 * Verwendung:
 *   import { useMiseAnimations } from './tokens/animations';
 *   function App() { useMiseAnimations(); return <YourApp /> }
 */
export function useMiseAnimations() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('mise-animations')) return;
  const style = document.createElement('style');
  style.id = 'mise-animations';
  style.textContent = miseAnimations;
  document.head.appendChild(style);
}
