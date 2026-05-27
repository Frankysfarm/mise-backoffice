/**
 * Einmalig ausführen:  pnpm tsx scripts/generate-vapid.ts
 * Danach die ausgegebenen Keys in .env.local eintragen.
 */
import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();

console.log('\n=== VAPID Keys generiert ===\n');
console.log('Trage das folgende in deine .env.local:\n');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_CONTACT=mailto:ops@mise.app`);
console.log('\nDanach pnpm dev neu starten.\n');
