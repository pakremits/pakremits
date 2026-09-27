/** Shared, self-contained HTML for transactional alert emails. */
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]!)

export function renderAlertEmail(input: {
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
    <tr><td style="padding:11px 0;border-bottom:1px solid #e8eee9;color:#597067;font-size:14px">${escapeHtml(label)}</td>
    <td style="padding:11px 0;border-bottom:1px solid #e8eee9;text-align:right;color:#14201b;font-size:14px;font-weight:700">${escapeHtml(value)}</td></tr>`).join('') ?? ''
  const footerLinks = [
    input.manageUrl ? `<a href="${escapeHtml(input.manageUrl)}" style="color:#037252;text-decoration:underline">Manage alert</a>` : '',
  ].filter(Boolean).join(' &nbsp;·&nbsp; ')

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PakRemits</title></head>
<body style="margin:0;padding:0;background:#f3f6f4;font-family:Arial,Helvetica,sans-serif;color:#14201b">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(input.preview)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f3f6f4"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#fff;border:1px solid #e0e9e3;border-radius:14px;overflow:hidden">
<tr><td style="background:#024e38;padding:26px 32px;color:#fff;font-size:23px;font-weight:700;letter-spacing:-.4px">Pak<span style="color:#e0a513">Remits</span></td></tr>
<tr><td style="padding:32px">
<p style="margin:0 0 10px;color:#037252;font-size:12px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase">${escapeHtml(input.label)}</p>
<h1 style="margin:0 0 16px;color:#14201b;font-size:26px;line-height:1.25">${escapeHtml(input.title)}</h1>
<p style="margin:0;color:#42564c;font-size:16px;line-height:1.6">${escapeHtml(input.body)}</p>
${facts ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0;border-top:1px solid #e8eee9">${facts}</table>` : '<div style="height:24px"></div>'}
<a href="${escapeHtml(input.action.url)}" style="display:inline-block;background:#037252;border-radius:9px;padding:14px 22px;color:#fff;font-size:15px;font-weight:700;text-decoration:none">${escapeHtml(input.action.label)}</a>
${input.note ? `<p style="margin:24px 0 0;color:#65786d;font-size:13px;line-height:1.6">${escapeHtml(input.note)}</p>` : ''}
</td></tr>
<tr><td style="padding:22px 32px 30px;border-top:1px solid #e8eee9">
<p style="margin:0 0 13px;color:#42564c;font-size:14px;line-height:1.5">No longer want this alert?</p>
<a href="${escapeHtml(input.unsubscribeUrl)}" style="display:inline-block;border:1px solid #024e38;border-radius:9px;padding:11px 18px;color:#024e38;font-size:14px;font-weight:700;text-decoration:none">Unsubscribe from this alert</a>
</td></tr></table>
<div style="max-width:560px;padding:22px 8px;text-align:center;color:#65786d;font-size:12px;line-height:1.7">PakRemits · Compare money transfer rates to Pakistan<br>${footerLinks || 'You received this because a rate alert was requested for this address.'}</div>
</td></tr></table></body></html>`
}

/** Gmail and other inboxes recognize these one-click unsubscribe headers. */
export function unsubscribeHeaders(url: string) {
  return { 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
}
