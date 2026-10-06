import type { Metadata } from 'next'
import { ProofView } from './proof-view'

export const metadata: Metadata = {
  title: 'Proof and savings — PakRemits admin',
  robots: { index: false },
}

/** Static, like every admin page: the data loads in the browser from /admin/api. */
export default function AdminProofPage() {
  return <ProofView />
}
