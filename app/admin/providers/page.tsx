import type { Metadata } from 'next'
import { ProvidersView } from './providers-view'

export const metadata: Metadata = {
  title: 'Providers — PakRemits admin',
  robots: { index: false },
}

/** Static, like every admin page: the data loads in the browser from /admin/api. */
export default function AdminProvidersPage() {
  return <ProvidersView />
}
