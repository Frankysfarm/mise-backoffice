import './globals.css';
import { MiseDesignProviders } from "./providers";
import type { Metadata } from 'next';
import {
  Space_Grotesk, DM_Sans, JetBrains_Mono, Caprasimo, Caveat, Source_Serif_4,
  Inter, Fraunces, Manrope, Archivo_Black, IBM_Plex_Sans, IBM_Plex_Mono,
  Cormorant_Garamond,
} from 'next/font/google';

const display = Space_Grotesk({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-display' });
const body = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-body' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-inter', display: 'swap' });
const fraunces = Fraunces({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-fraunces', display: 'swap' });

// Bento + Liquid
const manrope = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-manrope', display: 'swap' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-space-grotesk', display: 'swap' });

// Konkret
const archivoBlack = Archivo_Black({ subsets: ['latin'], weight: ['400'], variable: '--font-archivo-black', display: 'swap' });
const ibmPlexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-ibm-sans', display: 'swap' });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-ibm-mono', display: 'swap' });

// Gazette
const sourceSerif = Source_Serif_4({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-source-serif', display: 'swap' });

// Noir
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['300', '400', '500', '600'], style: ['normal', 'italic'], variable: '--font-cormorant', display: 'swap' });

// Farmhouse legacy
const caprasimo = Caprasimo({ subsets: ['latin'], weight: ['400'], variable: '--font-caprasimo', display: 'swap' });
const caveat = Caveat({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-caveat', display: 'swap' });

export const metadata: Metadata = {
  title: 'Mise — Restaurant Backoffice',
  description: 'Bestellsystem · Kasse · Lieferung — alles in einem',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${display.variable} ${body.variable} ${mono.variable} ${inter.variable} ${fraunces.variable} ${manrope.variable} ${spaceGrotesk.variable} ${archivoBlack.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable} ${sourceSerif.variable} ${cormorant.variable} ${caprasimo.variable} ${caveat.variable}`}>
      <body><MiseDesignProviders>{children}</MiseDesignProviders></body>
    </html>
  );
}
