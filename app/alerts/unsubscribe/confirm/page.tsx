import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'
import { ConfirmUnsubscribe } from './confirm-unsubscribe'

export const metadata: Metadata = {
  title: 'Confirm unsubscribe — PakRemits',
  robots: { index: false, follow: false },
}

/** /alerts/unsubscribe/confirm?token=…: where the emailed unsubscribe link lands. */
export default function ConfirmUnsubscribePage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1120px] px-6 py-20">
        <article className="max-w-[58ch]">
          <h1 className="text-[clamp(30px,4vw,42px)] leading-[1.06] font-semibold">
            Unsubscribe from this alert?
          </h1>
          <p className="mt-5 text-[17px] text-muted">
            Confirming will delete this alert and its contact details. You will not receive any
            more messages for it.
          </p>
          <Suspense fallback={<div className="skeleton mt-8 h-12 w-52 rounded-control" />}>
            <ConfirmUnsubscribe />
          </Suspense>
        </article>
      </main>
      <SiteFooter />
    </>
  )
}
