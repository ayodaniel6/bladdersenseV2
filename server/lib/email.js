// Transactional email through Resend's HTTP API. Without RESEND_API_KEY
// (local development) messages are printed to the console instead.
//
// Emails never contain diary data: email is not a private channel, and the
// subject line shows on lock screens and shared family computers.

const APP_URL = () => process.env.APP_URL || 'http://localhost:5173'
const FROM = () => process.env.EMAIL_FROM || 'BladderSense <hello@bladdersense.com>'

export async function send({ to, subject, text, html }) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`\n--- email to ${to} ---\nSubject: ${subject}\n\n${text}\n--- end email ---\n`)
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM(), to, subject, text, html }),
  })
  if (!res.ok) throw new Error(`Email send failed (${res.status}): ${await res.text()}`)
}

const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

function layout(body) {
  return `<!doctype html><html><body style="margin:0;background:#F6F5F1;font-family:Helvetica,Arial,sans-serif;color:#172033">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #DAD7CE;border-radius:12px">
<tr><td style="padding:32px;font-size:18px;line-height:1.6">
<p style="margin:0 0 24px;font-family:Georgia,serif;font-size:20px;color:#0F6E6A">BladderSense</p>
${body}
</td></tr></table>
<p style="font-size:14px;color:#4B5565;margin:16px 0 0">You can change email settings in BladderSense under Settings.</p>
</td></tr></table></body></html>`
}

const button = (href, label) =>
  `<p style="margin:24px 0"><a href="${escape(href)}" style="display:inline-block;background:#0F6E6A;color:#FFFFFF;text-decoration:none;font-weight:bold;padding:16px 28px;border-radius:10px;font-size:18px">${escape(label)}</a></p>`

export function sendSignIn({ to, code, linkToken }) {
  const link = `${APP_URL()}/auth/link?t=${encodeURIComponent(linkToken)}`
  return send({
    to,
    subject: `Your sign-in code: ${code}`,
    text: `Your BladderSense sign-in code is ${code}\n\nType it on the screen where you asked for it, or open this link to sign in on this device:\n${link}\n\nThe code and link work for 20 minutes and only once. If you did not ask for this, ignore this email.`,
    html: layout(`
<p style="margin:0 0 8px">Your sign-in code is</p>
<p style="margin:0 0 24px;font-size:40px;letter-spacing:8px;font-weight:bold">${code}</p>
<p style="margin:0">Type it on the screen where you asked for it. Or sign in on this device:</p>
${button(link, 'Sign in to BladderSense')}
<p style="margin:0;font-size:16px;color:#4B5565">The code and button work for 20 minutes and only once. If you did not ask for this, you can ignore this email.</p>`),
  })
}

export function sendReminder({ to, firstName }) {
  const url = `${APP_URL()}/today`
  const hello = firstName ? `Good morning, ${escape(firstName)}.` : 'Good morning.'
  return send({
    to,
    subject: 'Your morning check-in',
    text: `${hello}\n\nYour check-in for today takes under a minute:\n${url}\n\nTo stop these, turn off reminders in Settings.`,
    html: layout(`<p style="margin:0">${hello}</p><p>Your check-in for today takes under a minute.</p>${button(url, 'Log today')}`),
  })
}

export function sendWeekly({ to, firstName, daysLogged }) {
  const url = `${APP_URL()}/patterns`
  const hello = firstName ? `Hello ${escape(firstName)},` : 'Hello,'
  const line = `You logged ${daysLogged} of the last 7 days.`
  return send({
    to,
    subject: 'Your week in BladderSense',
    text: `${hello}\n\n${line} Your patterns are ready to look at:\n${url}`,
    html: layout(`<p style="margin:0">${hello}</p><p>${line} Your patterns are ready to look at.</p>${button(url, 'See your patterns')}`),
  })
}
