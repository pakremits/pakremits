/** Shared, self-contained HTML for transactional alert emails. */
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]!)

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
  const facts = input.facts?.map(({ label, value }) => `
    <tr><td style="padding:12px 0;border-bottom:1px solid #dce4df;color:#5c6b63;font-size:14px;line-height:20px">${escapeHtml(label)}</td>
    <td style="padding:12px 0;border-bottom:1px solid #dce4df;text-align:right;color:#14201b;font-size:14px;font-weight:700;line-height:20px">${escapeHtml(value)}</td></tr>`).join('') ?? ''
  const footerLinks = [
    input.manageUrl ? `<a href="${escapeHtml(input.manageUrl)}" style="color:#2f520b;text-decoration:underline">Manage alert</a>` : '',
    `<a href="${escapeHtml(input.homeUrl)}" style="color:#2f520b;text-decoration:underline">Visit PakRemits</a>`,
  ].filter(Boolean).join(' &nbsp;&middot;&nbsp; ')

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>PakRemits</title></head>
<body style="margin:0;padding:0;background:#f3f6f4;font-family:Arial,Helvetica,sans-serif;color:#14201b;-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(input.preview)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="#f3f6f4" style="width:100%;background:#f3f6f4"><tr><td align="center" style="padding:32px 14px">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="#ffffff" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #dce4df;border-radius:18px;overflow:hidden">
<tr><td style="padding:22px 30px;background:#ffffff">
<a href="${escapeHtml(input.homeUrl)}" style="display:inline-block;text-decoration:none"><img src="${escapeHtml(input.homeUrl)}/pakrimits-email-logo.png" width="182" height="50" alt="PakRemits" style="display:block;width:182px;height:50px;border:0;outline:none;text-decoration:none"></a>
</td></tr>
<tr><td bgcolor="#537a0e" style="padding:32px 30px;background-color:#537a0e;background-image:linear-gradient(61deg,#2f520b 0%,#537a0e 53%,#85a61c 100%)">
<p style="margin:0 0 12px;color:#f2f2f0;font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase">${escapeHtml(input.label)}</p>
<h1 style="margin:0 0 14px;color:#ffffff;font-size:28px;line-height:35px;letter-spacing:-0.5px">${escapeHtml(input.title)}</h1>
<p style="margin:0;color:#f2f2f0;font-size:16px;line-height:26px">${escapeHtml(input.body)}</p>
</td></tr>
<tr><td style="padding:30px">
${facts ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="#f7f9f2" style="width:100%;margin:0 0 24px;background:#f7f9f2;border:1px solid #dce4df;border-radius:12px"><tr><td style="padding:6px 18px"><table role="presentation" cellpadding="0" cellspacing="0" width="100%">${facts}</table></td></tr></table>` : ''}
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#e9b44c" style="border-radius:8px;background:#e9b44c"><a href="${escapeHtml(input.action.url)}" style="display:inline-block;padding:15px 24px;color:#14201b;font-size:16px;font-weight:700;line-height:20px;text-decoration:none">${escapeHtml(input.action.label)} &nbsp;&rarr;</a></td></tr></table>
${input.note ? `<p style="margin:22px 0 0;color:#5c6b63;font-size:13px;line-height:21px">${escapeHtml(input.note)}</p>` : ''}
</td></tr>
<tr><td bgcolor="#f7f9f2" style="padding:24px 30px 28px;border-top:1px solid #dce4df;background:#f7f9f2">
<p style="margin:0 0 13px;color:#4a5a52;font-size:14px;line-height:21px">No longer want this alert?</p>
<a href="${escapeHtml(input.unsubscribeUrl)}" style="display:inline-block;border:1px solid #2f520b;border-radius:8px;padding:11px 17px;color:#2f520b;font-size:14px;font-weight:700;line-height:18px;text-decoration:none">Unsubscribe from this alert</a>
</td></tr></table>
<div style="max-width:600px;padding:20px 8px 4px;text-align:center;color:#5c6b63;font-size:12px;line-height:20px">PakRemits &middot; Compare money transfer rates to Pakistan<br>${footerLinks}</div>
</td></tr></table></body></html>`
}

/** Gmail and other inboxes recognize these one-click unsubscribe headers. */
export function unsubscribeHeaders(url: string) {
  return { 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
}
