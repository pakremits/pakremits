'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { isPlausibleToken } from '@/lib/alerts/tokens'

/**
 * The unsubscribe button. A GET of the emailed link only lands here, so a mail
 * scanner following links cannot delete an alert; the deletion is this form's
 * POST, which the Worker answers with /alerts/removed.
 */
export function ConfirmUnsubscribe() {
  const token = useSearchParams().get('token') ?? ''

  if (!isPlausibleToken(token)) {
    return (
      <p className="mt-5 text-[17px] text-muted">
        This unsubscribe link is incomplete. Use the link in the email again, or{' '}
        <Link href="/contact" className="font-semibold text-leaf underline underline-offset-2">
          contact us
        </Link>{' '}
        and we will remove the alert.
      </p>
    )
  }

  return (
    <>
      <form action={`/alerts/unsubscribe/${encodeURIComponent(token)}`} method="post" className="mt-8">
        <input type="hidden" name="confirm" value="1" />
        <button
          type="submit"
          className="inline-flex h-12 cursor-pointer items-center rounded-control border-[1.5px] border-danger/40 px-6 font-bold text-danger transition-colors hover:border-danger hover:bg-danger-bg"
        >
          Yes, unsubscribe
        </button>
      </form>
      <Link
        href={`/alerts/manage?${new URLSearchParams({ token })}`}
        className="mt-5 inline-block font-semibold text-leaf underline underline-offset-2"
      >
        Keep this alert
      </Link>
    </>
  )
}
