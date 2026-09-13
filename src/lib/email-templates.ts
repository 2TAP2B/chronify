import "server-only";

export type EmailLocale = "de" | "en";

export type EmailTemplateVars = {
  locale: EmailLocale;
  appName: string;
  recipientName: string;
};

type EmailContent = {
  subject: string;
  html: string;
  text: string;
};

const t = (locale: EmailLocale, de: string, en: string): string => (locale === "de" ? de : en);

function baseLayout(opts: { appName: string; locale: EmailLocale; content: string }): string {
  const { appName, locale, content } = opts;
  const greeting = t(locale, "E-Mail von", "Email from");
  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName}</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; color: #18181b; }
    .container { max-width: 600px; margin: 0 auto; padding: 24px; }
    .card { background: #fff; border-radius: 12px; padding: 32px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 24px; font-size: 20px; font-weight: 700; color: #6366f1; }
    .body { font-size: 15px; line-height: 1.6; color: #3f3f46; }
    .body p { margin: 0 0 16px; }
    .btn { display: inline-block; background: #6366f1; color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 8px 0 24px; }
    .footer { text-align: center; margin-top: 32px; font-size: 12px; color: #a1a1aa; }
    .footer a { color: #a1a1aa; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">${appName}</div>
      <div class="body">
        ${content}
      </div>
      <div class="footer">
        ${greeting} ${appName}
      </div>
    </div>
  </div>
</body>
</html>`;
}

function wrap(opts: {
  appName: string;
  locale: EmailLocale;
  subject: string;
  bodyHtml: string;
  bodyText: string;
}): EmailContent {
  return {
    subject: opts.subject,
    html: baseLayout({ appName: opts.appName, locale: opts.locale, content: opts.bodyHtml }),
    text: opts.bodyText,
  };
}

export function passwordResetEmail(opts: {
  locale: EmailLocale;
  appName: string;
  recipientName: string;
  resetLink: string;
}): EmailContent {
  const { locale, appName, recipientName, resetLink } = opts;
  const greeting = t(locale, "Hallo", "Hello");
  const intro = t(
    locale,
    "Sie haben die Zurücksetzung Ihres Passworts angefordert. Klicken Sie auf den untenstehenden Link, um ein neues Passwort festzulegen:",
    "You requested a password reset. Click the link below to set a new password:"
  );
  const btnText = t(locale, "Passwort zurücksetzen", "Reset password");
  const expiry = t(
    locale,
    "Dieser Link ist 1 Stunde gültig. Falls Sie diese E-Mail nicht angefordert haben, können Sie diese Nachricht ignorieren.",
    "This link is valid for 1 hour. If you did not request this email, you can safely ignore it."
  );
  const subject = t(locale, "Passwort zurücksetzen", "Reset your password");

  const bodyHtml = `
    <p>${greeting} ${recipientName},</p>
    <p>${intro}</p>
    <a href="${resetLink}" class="btn">${btnText}</a>
    <p>${expiry}</p>
  `;
  const bodyText = `${greeting} ${recipientName},\n\n${intro}\n\n${resetLink}\n\n${expiry}`;

  return wrap({ appName, locale, subject, bodyHtml, bodyText });
}

export function vacationApprovedEmail(opts: {
  locale: EmailLocale;
  appName: string;
  recipientName: string;
  fromDate: string;
  toDate: string;
  days: number;
  vacationUrl: string;
}): EmailContent {
  const { locale, appName, recipientName, fromDate, toDate, days, vacationUrl } = opts;
  const greeting = t(locale, "Hallo", "Hello");
  const intro = t(
    locale,
    "Ihr Urlaubsantrag wurde genehmigt.",
    "Your vacation request has been approved."
  );
  const detailDays = t(locale, "Tage", "days");
  const detailFrom = t(locale, "Von", "From");
  const detailTo = t(locale, "Bis", "To");
  const linkText = t(locale, "Urlaub ansehen", "View vacation");
  const subject = t(locale, "Urlaub genehmigt", "Vacation approved");

  const bodyHtml = `
    <p>${greeting} ${recipientName},</p>
    <p>${intro}</p>
    <p><strong>${detailFrom}:</strong> ${fromDate}<br><strong>${detailTo}:</strong> ${toDate}<br><strong>${detailDays}:</strong> ${days}</p>
    <a href="${vacationUrl}" class="btn">${linkText}</a>
  `;
  const bodyText = `${greeting} ${recipientName},\n\n${intro}\n\n${detailFrom}: ${fromDate}\n${detailTo}: ${toDate}\n${detailDays}: ${days}\n\n${vacationUrl}`;

  return wrap({ appName, locale, subject, bodyHtml, bodyText });
}

export function vacationRejectedEmail(opts: {
  locale: EmailLocale;
  appName: string;
  recipientName: string;
  fromDate: string;
  toDate: string;
  reason?: string | null;
  vacationUrl: string;
}): EmailContent {
  const { locale, appName, recipientName, fromDate, toDate, reason, vacationUrl } = opts;
  const greeting = t(locale, "Hallo", "Hello");
  const intro = t(
    locale,
    "Ihr Urlaubsantrag wurde leider abgelehnt.",
    "Unfortunately, your vacation request has been rejected."
  );
  const detailFrom = t(locale, "Von", "From");
  const detailTo = t(locale, "Bis", "To");
  const reasonLabel = t(locale, "Grund", "Reason");
  const linkText = t(locale, "Urlaub ansehen", "View vacation");
  const subject = t(locale, "Urlaub abgelehnt", "Vacation rejected");

  const reasonHtml = reason ? `<p><strong>${reasonLabel}:</strong> ${reason}</p>` : "";
  const reasonText = reason ? `\n${reasonLabel}: ${reason}` : "";

  const bodyHtml = `
    <p>${greeting} ${recipientName},</p>
    <p>${intro}</p>
    <p><strong>${detailFrom}:</strong> ${fromDate}<br><strong>${detailTo}:</strong> ${toDate}</p>
    ${reasonHtml}
    <a href="${vacationUrl}" class="btn">${linkText}</a>
  `;
  const bodyText = `${greeting} ${recipientName},\n\n${intro}\n\n${detailFrom}: ${fromDate}\n${detailTo}: ${toDate}${reasonText}\n\n${vacationUrl}`;

  return wrap({ appName, locale, subject, bodyHtml, bodyText });
}

export function vacationRequestedAdminEmail(opts: {
  locale: EmailLocale;
  appName: string;
  adminName: string;
  requesterName: string;
  fromDate: string;
  toDate: string;
  days: number;
  approvalUrl: string;
}): EmailContent {
  const { locale, appName, adminName, requesterName, fromDate, toDate, days, approvalUrl } = opts;
  const greeting = t(locale, "Hallo", "Hello");
  const intro = t(
    locale,
    "Ein neuer Urlaubsantrag liegt zur Genehmigung vor.",
    "A new vacation request is pending approval."
  );
  const detailDays = t(locale, "Tage", "days");
  const detailFrom = t(locale, "Von", "From");
  const detailTo = t(locale, "Bis", "To");
  const detailRequester = t(locale, "Mitarbeiter", "Employee");
  const linkText = t(locale, "Antrag prüfen", "Review request");
  const subject = t(locale, "Neuer Urlaubsantrag", "New vacation request");

  const bodyHtml = `
    <p>${greeting} ${adminName},</p>
    <p>${intro}</p>
    <p><strong>${detailRequester}:</strong> ${requesterName}<br><strong>${detailFrom}:</strong> ${fromDate}<br><strong>${detailTo}:</strong> ${toDate}<br><strong>${detailDays}:</strong> ${days}</p>
    <a href="${approvalUrl}" class="btn">${linkText}</a>
  `;
  const bodyText = `${greeting} ${adminName},\n\n${intro}\n\n${detailRequester}: ${requesterName}\n${detailFrom}: ${fromDate}\n${detailTo}: ${toDate}\n${detailDays}: ${days}\n\n${approvalUrl}`;

  return wrap({ appName, locale, subject, bodyHtml, bodyText });
}

export function sickNoteReminderEmail(opts: {
  locale: EmailLocale;
  appName: string;
  recipientName: string;
  sickFrom: string;
  sicknessUrl: string;
}): EmailContent {
  const { locale, appName, recipientName, sickFrom, sicknessUrl } = opts;
  const greeting = t(locale, "Hallo", "Hello");
  const intro = t(
    locale,
    "Sie sind seit dem {date} krankgemeldet. Bitte laden Sie ggf. eine Arbeitsunfähigkeitsbescheinigung (AU) hoch, falls die Krankheit länger als 3 Tage dauert.".replace(
      "{date}",
      sickFrom
    ),
    "You have been on sick leave since {date}. Please upload a sick certificate (AU) if your illness lasts longer than 3 days.".replace(
      "{date}",
      sickFrom
    )
  );
  const linkText = t(locale, "Krankmeldung ansehen", "View sick note");
  const subject = t(
    locale,
    "Erinnerung: AU-Bescheinigung hochladen",
    "Reminder: Upload sick certificate"
  );

  const bodyHtml = `
    <p>${greeting} ${recipientName},</p>
    <p>${intro}</p>
    <a href="${sicknessUrl}" class="btn">${linkText}</a>
  `;
  const bodyText = `${greeting} ${recipientName},\n\n${intro}\n\n${sicknessUrl}`;

  return wrap({ appName, locale, subject, bodyHtml, bodyText });
}

export function welcomeEmail(opts: {
  locale: EmailLocale;
  appName: string;
  recipientName: string;
  email: string;
  tempPassword: string;
  loginUrl: string;
}): EmailContent {
  const { locale, appName, recipientName, email, tempPassword, loginUrl } = opts;
  const greeting = t(locale, "Hallo", "Hello");
  const intro = t(
    locale,
    "Ein Konto wurde für Sie erstellt. Hier sind Ihre Zugangsdaten:",
    "An account has been created for you. Here are your credentials:"
  );
  const emailLabel = t(locale, "E-Mail", "Email");
  const passwordLabel = t(locale, "Passwort", "Password");
  const securityNote = t(
    locale,
    "Bitte ändern Sie Ihr Passwort bei der ersten Anmeldung.",
    "Please change your password on first login."
  );
  const btnText = t(locale, "Anmelden", "Sign in");
  const subject = t(locale, "Willkommen bei", "Welcome to") + " " + appName;

  const bodyHtml = `
    <p>${greeting} ${recipientName},</p>
    <p>${intro}</p>
    <p><strong>${emailLabel}:</strong> ${email}<br><strong>${passwordLabel}:</strong> ${tempPassword}</p>
    <p>${securityNote}</p>
    <a href="${loginUrl}" class="btn">${btnText}</a>
  `;
  const bodyText = `${greeting} ${recipientName},\n\n${intro}\n\n${emailLabel}: ${email}\n${passwordLabel}: ${tempPassword}\n\n${securityNote}\n\n${loginUrl}`;

  return wrap({ appName, locale, subject, bodyHtml, bodyText });
}
