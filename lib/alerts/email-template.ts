/** Shared, self-contained HTML for transactional alert emails. */
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]!)

/**
 * The site's palette, spelled out: email clients get no CSS variables. Gold is
 * the one primary action, as on the site's Compare button; green is the brand.
 * The header band is the site's hero gradient (.hero-gradient in
 * app/globals.css) up to its 60% stop. The site's band runs on to #0ab688, but
 * white text there falls below 3:1, and an email headline can run the full
 * width; #14936f keeps every headline at 3.86:1 or better.
 */
const C = {
  canvas: '#f3f6f4',
  surface: '#ffffff',
  mist: '#f3f6f4',
  line: '#dce4df',
  hairline: '#edf2ef',
  ink: '#14201b',
  body: '#42564c',
  muted: '#5c6b63',
  brand: '#037252',
  brandMid: '#14936f',
  tint: '#e3f6ef',
  gold: '#e0a513',
  white: '#ffffff',
}

const FONT = "Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

export function renderAlertEmail(input: {
  homeUrl: string
  preview: string
  label: string
  title: string
  body: string
  facts?: { label: string; value: string }[]
  action: { label: string; url: string }
  note?: string
  manageUrl?: string
  unsubscribeUrl: string
}) {
  const home = escapeHtml(input.homeUrl)

  // The rows sit in a grey box, like the transfer-time box on the site's result cards.
  const facts = input.facts?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="${C.mist}" style="width:100%;margin:0 0 28px;background:${C.mist};border-radius:12px">
${input.facts
  .map(
    ({ label, value }, index) => `<tr>
<td style="padding:14px 18px;${index ? `border-top:1px solid ${C.line};` : ''}color:${C.muted};font-size:14px;line-height:20px">${escapeHtml(label)}</td>
<td align="right" style="padding:14px 18px;${index ? `border-top:1px solid ${C.line};` : ''}color:${C.ink};font-size:15px;line-height:20px;font-weight:700;white-space:nowrap">${escapeHtml(value)}</td>
</tr>`,
  )
  .join('\n')}
</table>`
    : ''

  const footerLinks = [
    input.manageUrl
      ? `<a href="${escapeHtml(input.manageUrl)}" style="color:${C.brand};text-decoration:underline">Manage alert</a>`
      : '',
    `<a href="${home}" style="color:${C.brand};text-decoration:underline">Visit PakRemits</a>`,
  ]
    .filter(Boolean)
    .join(' &nbsp;&middot;&nbsp; ')

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>PakRemits</title></head>
<body style="margin:0;padding:0;background:${C.canvas};font-family:${FONT};color:${C.ink};-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(input.preview)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="${C.canvas}" style="width:100%;background:${C.canvas}"><tr><td align="center" style="padding:32px 14px">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="${C.surface}" style="width:100%;max-width:560px;background:${C.surface};border-radius:18px;overflow:hidden">
<tr><td style="padding:22px 32px">
<a href="${home}" style="display:inline-block;text-decoration:none"><img src="${home}/pakrimits-email-logo.png" width="160" height="32" alt="PakRemits" style="display:block;width:160px;height:32px;border:0;outline:none;text-decoration:none"></a>
</td></tr>
<tr><td bgcolor="${C.brand}" style="padding:28px 32px 30px;background-color:${C.brand};background-image:linear-gradient(61deg,${C.brand} 0%,${C.brandMid} 100%)">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px"><tr><td bgcolor="${C.tint}" style="background:${C.tint};border-radius:999px;padding:5px 12px;color:${C.brand};font-size:13px;line-height:18px;font-weight:700">${escapeHtml(input.label)}</td></tr></table>
<h1 style="margin:0;color:${C.white};font-size:27px;line-height:34px;font-weight:700;letter-spacing:-0.5px">${escapeHtml(input.title)}</h1>
</td></tr>
<tr><td style="padding:28px 32px 32px">
<p style="margin:0 0 28px;color:${C.body};font-size:16px;line-height:26px">${escapeHtml(input.body)}</p>
${facts}
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="${C.gold}" style="background:${C.gold};border-radius:10px">
<a href="${escapeHtml(input.action.url)}" style="display:inline-block;padding:15px 26px;color:${C.ink};font-size:16px;line-height:20px;font-weight:700;text-decoration:none">${escapeHtml(input.action.label)}</a>
</td></tr></table>
${input.note ? `<p style="margin:22px 0 0;color:${C.muted};font-size:13px;line-height:21px">${escapeHtml(input.note)}</p>` : ''}
</td></tr>
<tr><td style="padding:22px 32px 28px;border-top:1px solid ${C.hairline}">
<p style="margin:0 0 12px;color:${C.body};font-size:14px;line-height:21px">No longer want this alert?</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="${C.surface}" style="background:${C.surface};border:1.5px solid ${C.line};border-radius:10px">
<a href="${escapeHtml(input.unsubscribeUrl)}" style="display:inline-block;padding:11px 18px;color:${C.ink};font-size:14px;line-height:18px;font-weight:700;text-decoration:none">Unsubscribe from this alert</a>
</td></tr></table>
</td></tr></table>
<div style="max-width:560px;padding:22px 8px 4px;text-align:center;color:${C.muted};font-size:12px;line-height:20px">PakRemits &middot; Compare money transfer rates to Pakistan<br>${footerLinks}</div>
</td></tr></table></body></html>`
}

/** Gmail and other inboxes recognize these one-click unsubscribe headers. */
export function unsubscribeHeaders(url: string) {
  return { 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
}
