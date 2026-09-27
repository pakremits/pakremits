/**
 * What /compare shows between a Compare click and the server's answer: the
 * page's own layout with every value greyed out. The search bar and title
 * depend on the query string, which a loading state cannot read, so they are
 * placeholders too. Once the page arrives the list keeps its skeleton until a
 * second after the click (see compare-navigation.tsx). The same placeholders
 * cover a new search made on /compare itself (see the page).
 */
import { ResultsSkeleton } from '@/components/compare-results'
import {
  CardsSkeleton,
  SearchBarSkeleton,
  SummarySkeleton,
  TitleSkeleton,
} from '@/components/compare-skeletons'

export default function CompareLoading() {
  return (
    <div aria-busy="true">
      <div className="pt-6 sm:py-8">
        <div className="mx-auto max-w-[1120px] px-6">
          <SummarySkeleton className="sm:hidden" />
          <SearchBarSkeleton className="hidden" />
        </div>
      </div>

      <main className="mx-auto flex max-w-[1120px] flex-col px-6 pt-6 sm:pt-12 lg:block">
        <div className="contents lg:flex lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          <TitleSkeleton />
          <CardsSkeleton />
        </div>

        <ResultsSkeleton className="mt-12" />
      </main>
    </div>
  )
}
