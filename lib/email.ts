import 'server-only';

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

type SendResult = { sent: boolean; providerId?: string; skipped?: string; error?: string };

/**
 * Versendet eine E-Mail via Resend.
 * - Wenn RESEND_API_KEY nicht gesetzt ist: skipped=true (kein Fehler, Call-Site darf Link anzeigen).
 * - From: MAIL_FROM env oder Fallback "noreply@matcha-kaffee.test".
 */
export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, skipped: 'RESEND_API_KEY nicht konfiguriert' };

  const from = process.env.MAIL_FROM || 'Matcha Kaffee <noreply@matcha-kaffee.test>';

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: args.subject,
        html: args.html,
        text: args.text,
        reply_to: args.replyTo,
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      return { sent: false, error: `Resend ${resp.status}: ${errText.slice(0, 300)}` };
    }
    const data = await resp.json().catch(() => null);
    return { sent: true, providerId: data?.id };
  } catch (e: any) {
    return { sent: false, error: e?.message ?? 'unknown error' };
  }
}

/**
 * Bewerbungs-Einladungs-Mail. Gibt immer HTML + Plain-Text in einem zurück.
 */
export function renderInviteEmail({ vorname, link }: { vorname: string; link: string }) {
  const subject = `${vorname}, deine Bewerbung bei Matcha Kaffee wartet auf dich`;
  const text = `Hi ${vorname},

wir freuen uns über dein Interesse bei Matcha Kaffee! Klick einfach auf den Link und fülle in 5 Minuten dein Profil aus:

${link}

Der Link ist 14 Tage gültig. Danach prüft dein Filialleiter deine Daten und du bekommst eine App-Einladung.

Bis bald,
Matcha Kaffee Team`;

  const html = `<!doctype html>
<html lang="de">
<body style="margin:0;padding:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f2ed;color:#1a3a2a">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <div style="background:#1a3a2a;color:#fff;padding:32px;border-radius:20px 20px 0 0;text-align:center">
      <div style="font-size:48px;line-height:1">🍵</div>
      <h1 style="margin:16px 0 4px 0;font-size:24px;font-weight:700">Hey ${escapeHtml(vorname)}!</h1>
      <p style="margin:0;opacity:0.85">Deine Bewerbung wartet auf dich.</p>
    </div>
    <div style="background:#fff;padding:32px;border-radius:0 0 20px 20px;border:1px solid #e5e0d2;border-top:0">
      <p style="font-size:16px;line-height:1.5;margin:0 0 24px 0">
        Wir freuen uns, dass du dich bei uns bewerben willst. Damit wir dich gut einarbeiten können,
        brauchen wir von dir ein paar Daten — das dauert ca. <strong>5 Minuten</strong>.
      </p>
      <a href="${link}"
         style="display:block;background:#2d6b45;color:#fff;text-decoration:none;text-align:center;padding:16px;border-radius:12px;font-weight:700;font-size:16px">
        Bewerbung ausfüllen →
      </a>
      <p style="margin:20px 0 0 0;font-size:13px;color:#7a7a6e;line-height:1.5">
        Oder kopier diesen Link:<br>
        <span style="word-break:break-all">${link}</span>
      </p>
      <hr style="border:none;border-top:1px solid #e5e0d2;margin:24px 0">
      <p style="margin:0;font-size:13px;color:#7a7a6e;line-height:1.5">
        Der Link ist <strong>14 Tage gültig</strong>. Nach dem Absenden prüft dein Filialleiter
        deine Daten und weist dich einer Abteilung zu. Dann bekommst du die App-Einladung
        mit deinen ersten Schulungen.
      </p>
    </div>
    <p style="text-align:center;font-size:12px;color:#7a7a6e;margin-top:16px">
      Matcha Kaffee · Berlin
    </p>
  </div>
</body>
</html>`;

  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]!));
}
