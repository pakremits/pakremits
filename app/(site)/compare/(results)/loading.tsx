/**
 * What /compare shows between a Compare click and the results: the page's own
 * layout with every value greyed out. The search bar and title depend on the
 * query string, which a loading state cannot read, so they are placeholders
 * too, and are replaced as soon as the page arrives. The same placeholders
 * cover a new search made on /compare itself (see the page).
 */
import { ResultsPageSkeleton } from '@/components/compare-skeletons'

export default function CompareLoading() {
  return <ResultsPageSkeleton />
}
