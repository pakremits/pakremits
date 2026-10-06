import type { Metadata } from 'next'
import { Dashboard } from './dashboard'

export const metadata: Metadata = { title: 'Dashboard — PakRemits admin', robots: { index: false } }

/** Static, like every admin page: the data loads in the browser from /admin/api. */
export default function AdminDashboardPage() {
  return <Dashboard />
}
