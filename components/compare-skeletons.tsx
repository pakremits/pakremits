import { Bone } from '@/components/compare-results'

/**
 * Placeholders for the /compare page around the results list, shared by
 * loading.tsx (arriving from another page) and the page itself (a new search
 * on /compare, where only the query string changes and loading.tsx never
 * shows). Each one keeps the size and position of what it replaces, so the
 * page does not jump when the answer lands.
 */

const BAR_SHADOW = 'shadow-[0_6px_20px_-10px_rgba(20,32,27,.12),0_1px_2px_rgba(20,32,27,.04)]'

/** Phones: the one-line "1,000 USD → PKR" search summary. */
export function SummarySkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`flex h-16 items-center gap-3 rounded-[16px] border border-line bg-surface px-5 ${BAR_SHADOW} ${className}`}
    >
      <Bone className="h-5 w-7" />
      <Bone className="h-5 w-24" />
      <Bone className="h-5 w-5" />
      <Bone className="h-5 w-7" />
      <Bone className="h-5 w-10" />
      <Bone className="ms-auto h-5 w-5" />
    </div>
  )
}

/** sm and up: the one-row search bar. Only loading.tsx needs it — on the page the bar stays live. */
export function SearchBarSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`gap-4 rounded-[22px] bg-surface p-5 ${BAR_SHADOW}
                  sm:grid sm:grid-cols-2 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)_minmax(0,1.2fr)_auto_170px]
                  lg:items-end lg:px-6 lg:py-4 ${className}`}
    >
      {['w-28', 'w-32', 'w-20', 'w-8'].map((label, index) => (
        <div key={index} className={index === 3 ? 'lg:w-[74px]' : 'min-w-0'}>
          <Bone className={`mb-2 h-4 ${label}`} />
          <Bone className="h-[52px] w-full rounded-[8px]" />
        </div>
      ))}
      <span className="skeleton block h-[52px] w-full rounded-[8px]" />
    </div>
  )
}

/** The title, route line and refresh time. */
export function TitleSkeleton() {
  return (
    <div className="min-w-0" aria-hidden="true">
      <div className="flex items-center gap-3">
        <Bone className="h-8 w-8" />
        <Bone className="h-[38px] w-64 max-w-[70vw] sm:w-96" />
      </div>
      <Bone className="mt-3 h-5 w-72 max-w-full" />
      <Bone className="mt-2 h-4 w-56 max-w-full" />
    </div>
  )
}

/** The mid-market card and the alerts button. Same wrapper classes as the real pair. */
export function CardsSkeleton() {
  return (
    <div className="order-last mt-10 flex shrink-0 flex-wrap gap-3 lg:order-none lg:mt-0" aria-hidden="true">
      <div className="flex min-w-0 items-center gap-5 rounded-[14px] bg-surface px-5 py-4">
        <div>
          <Bone className="h-4 w-36" />
          <Bone className="mt-1.5 h-6 w-52" />
          <Bone className="mt-1.5 h-4 w-24" />
        </div>
        <Bone className="h-11 w-[110px] shrink" />
      </div>
      <div className="flex min-w-[120px] flex-col items-center justify-center gap-2 rounded-[14px] bg-surface px-5 py-4">
        <Bone className="h-6 w-6" />
        <Bone className="h-4 w-20" />
      </div>
    </div>
  )
}
