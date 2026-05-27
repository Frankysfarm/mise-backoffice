/**
 * Driver-Invite-Email-Template (Mise Brand)
 *
 * Wird vom POST /api/admin/drivers/invite verschickt nachdem Supabase
 * einen Magic-Invite-Link erzeugt hat.
 */

export function renderDriverInviteEmail(args: {
  driverName: string;
  restaurantName: string;
  inviteLink: string;
}) {
  const { driverName, restaurantName, inviteLink } = args;
  const subject = `${driverName}, du wurdest als Fahrer für ${restaurantName} eingeladen`;

  const text = `Hi ${driverName},

${restaurantName} hat dich als Fahrer in der Mise Driver App angelegt.

Klick auf den Link, setze dein Passwort und logge dich danach in der App ein:
${inviteLink}

Der Link ist 7 Tage gültig. Falls er ablaufen sollte, frag dein Restaurant nach einer neuen Einladung.

Bis bald auf der Straße,
Mise.`;

  const html = `<!doctype html>
<html lang="de">
<body style="margin:0;padding:0;font-family:'Geist',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#F5F1E8;color:#141414">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <div style="background:#141414;color:#F5F1E8;padding:36px 32px;border-radius:24px 24px 0 0;text-align:center">
      <div style="font-family:'Fraunces',Georgia,serif;font-style:italic;font-weight:900;font-size:42px;letter-spacing:-2px;line-height:1">
        Mise<span style="color:#E8B105">.</span>
      </div>
      <p style="margin:12px 0 0 0;opacity:0.7;font-size:13px;letter-spacing:1px;text-transform:uppercase">Driver App</p>
    </div>
    <div style="background:#FFFFFF;padding:36px 32px;border-radius:0 0 24px 24px;border:1px solid #ECE5D3;border-top:0">
      <h1 style="margin:0 0 16px 0;font-family:'Fraunces',Georgia,serif;font-style:italic;font-weight:500;font-size:28px;line-height:1.2;color:#141414">
        Hi ${escapeHtml(driverName)} —
      </h1>
      <p style="font-size:16px;line-height:1.55;margin:0 0 20px 0;color:#141414">
        <strong>${escapeHtml(restaurantName)}</strong> hat dich als Fahrer angelegt.
        Setz jetzt dein Passwort und du bist drin.
      </p>
      <a href="${inviteLink}"
         style="display:block;background:#E8B105;color:#141414;text-decoration:none;text-align:center;padding:18px;border-radius:14px;font-weight:700;font-size:16px;margin:20px 0 12px 0;font-family:'Geist',system-ui,sans-serif">
        Passwort setzen →
      </a>
      <p style="margin:18px 0 0 0;font-size:13px;color:#6B6B6B;line-height:1.55">
        Falls der Button nicht klickbar ist, kopier diesen Link:<br>
        <span style="word-break:break-all;color:#141414">${inviteLink}</span>
      </p>
      <hr style="border:none;border-top:1px solid #ECE5D3;margin:28px 0">
      <p style="margin:0 0 8px 0;font-size:13px;color:#6B6B6B;line-height:1.55">
        Der Link ist <strong style="color:#141414">7 Tage gültig</strong>.
        Danach: einfach beim Restaurant nach einer neuen Einladung fragen.
      </p>
      <p style="margin:0;font-size:13px;color:#6B6B6B;line-height:1.55">
        Nach dem Passwort-Setzen: <strong style="color:#141414">Mise Driver</strong>
        aus dem App Store laden und mit deiner Email + Passwort einloggen.
      </p>
    </div>
    <p style="text-align:center;font-size:12px;color:#ADA597;margin-top:20px">
      Mise<span style="color:#E8B105">.</span> · mise-gastro.de
    </p>
  </div>
</body>
</html>`;

  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
