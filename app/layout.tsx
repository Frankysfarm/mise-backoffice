import './globals.css';
import { MiseDesignProviders } from "./providers";
import type { Metadata } from 'next';

// Keep builds hermetic. Product themes continue to use the same CSS-variable
// contract, backed by native font stacks instead of build-time Google fetches.
const fontVariables = {
  '--font-display': '"Arial Rounded MT Bold", "Avenir Next", Arial, sans-serif',
  '--font-body': '"Avenir Next", "Helvetica Neue", Arial, sans-serif',
  '--font-mono': '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
  '--font-inter': '"Helvetica Neue", Arial, sans-serif',
  '--font-fraunces': 'Georgia, "Times New Roman", serif',
  '--font-manrope': '"Avenir Next", "Helvetica Neue", Arial, sans-serif',
  '--font-space-grotesk': '"Arial Rounded MT Bold", "Avenir Next", Arial, sans-serif',
  '--font-archivo-black': 'Impact, "Arial Black", sans-serif',
  '--font-ibm-sans': '"Helvetica Neue", Arial, sans-serif',
  '--font-ibm-mono': '"SFMono-Regular", Consolas, monospace',
  '--font-source-serif': 'Georgia, "Times New Roman", serif',
  '--font-cormorant': 'Garamond, Georgia, serif',
  '--font-caprasimo': 'Cooper, Georgia, serif',
  '--font-caveat': '"Bradley Hand", "Comic Sans MS", cursive',
} as React.CSSProperties;

export const metadata: Metadata = {
  title: 'Mise — Restaurant Backoffice',
  description: 'Bestellsystem · Kasse · Lieferung — alles in einem',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" style={fontVariables}>
      <body><MiseDesignProviders>{children}</MiseDesignProviders></body>
    </html>
  );
}
