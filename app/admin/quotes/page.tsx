import type { Metadata } from 'next'
import { QuotesView } from './quotes-view'

export const metadata = { title: 'Quote overrides — PakRemits admin', robots: { index: false } } satisfies Metadata

/** Static, like every admin page: the data loads in the browser from /admin/api. */
export default function AdminQuotesPage() {
  return <QuotesView />
}
