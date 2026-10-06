import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'
import { ManageAlert } from './manage-alert'

/** Never indexed: the link that leads here carries a capability token. */
export const metadata: Metadata = {
  title: 'Your rate alert — PakRemits',
  robots: { index: false, follow: false },
}

/**
 * /alerts/manage?token=…: where the "manage this alert" link in every email
 * lands (via /alerts/manage/{token}, which the Worker redirects here). The
 * page is static; the alert loads in the browser.
 */
export default function ManageAlertPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1120px] px-6 py-12 sm:py-14">
        {/* The token is in the query string, which only the browser has. */}
        <Suspense fallback={<div className="skeleton h-72 max-w-[640px] rounded-panel-lg" />}>
          <ManageAlert />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  )
}
