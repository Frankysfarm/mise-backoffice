import Shell from './shell';
const FONTS = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';
export default function NeoAppLayout({ children }: { children: React.ReactNode }) {
  return (<><link href={FONTS} rel="stylesheet" /><Shell>{children}</Shell></>);
}
