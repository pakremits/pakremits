'use client'

import { useState } from 'react'

/**
 * Publish now: rebuild and deploy the site from the database, so admin edits
 * go live in a few minutes instead of at the next daily build. The Worker
 * starts the deploy workflow (worker/admin.ts).
 */
export function AdminPublishButton() {
  const [state, setState] = useState<{ busy: boolean; message: string | null; ok: boolean }>({
    busy: false,
    message: null,
    ok: true,
  })

  async function publish() {
    setState({ busy: true, message: null, ok: true })
    try {
      const response = await fetch('/admin/api/publish', { method: 'POST' })
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      setState({ busy: false, ok: Boolean(result.ok), message: result.message ?? `HTTP ${response.status}` })
    } catch {
      setState({ busy: false, ok: false, message: 'Could not reach the server.' })
    }
  }

  return (
    <span className="flex items-center gap-2">
      {state.message && (
        <span role="status" className={`hidden text-[13px] xl:inline ${state.ok ? 'text-ok' : 'text-danger'}`}>
          {state.message}
        </span>
      )}
      <button
        type="button"
        onClick={publish}
        disabled={state.busy}
        title={state.message ?? 'Rebuild the site now, so changes made here go live'}
        className="h-10 cursor-pointer rounded-control bg-brand px-3.5 text-[14px] font-semibold whitespace-nowrap text-white
                   transition-opacity disabled:cursor-wait disabled:opacity-60"
      >
        {state.busy ? 'Publishing…' : 'Publish now'}
      </button>
    </span>
  )
}
