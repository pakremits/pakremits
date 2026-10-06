import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'

export const metadata: Metadata = {
  title: 'Alert removed — PakRemits',
  robots: { index: false, follow: false },
}

export default function AlertRemovedPage() {
  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-[1120px] px-6 py-20">
        <article className="max-w-[58ch]">
          <h1 className="text-[clamp(30px,4vw,42px)] leading-[1.06] font-semibold">
            That alert is gone
          </h1>
          <p className="mt-5 text-[17px] text-muted">
            We have deleted the alert and the contact details attached to it. Nothing further will
            arrive, and we have not kept a record that you unsubscribed — holding your address in
            order to remember not to write to you would still be holding your address.
          </p>
          <p className="mt-5 text-[17px] text-muted">
            You are welcome back any time. Setting a new alert takes about ten seconds.
          </p>
          <Link
            href="/#alerts"
            className="mt-7 inline-flex h-12 items-center rounded-control bg-gold px-6
                       font-bold text-on-gold no-underline transition-colors hover:bg-gold-hover"
          >
            Set another alert
          </Link>
        </article>
      </main>

      <SiteFooter />
    </>
  )
}
