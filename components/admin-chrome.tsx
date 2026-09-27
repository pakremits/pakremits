import Link from 'next/link'

/**
 * Admin navigation.
 *
 * No design-system flourish here on purpose — this is internal tooling read by
 * one person, and every minute spent styling it is a minute not spent on the
 * pages that earn money.
 */
const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/providers', label: 'Providers & affiliate links' },
  { href: '/admin/quotes', label: 'Quote overrides' },
  { href: '/admin/proof', label: 'Proof & savings' },
]

export function AdminNav({ current }: { current: string }) {
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4">
        <span className="flex items-center gap-2 font-display text-lg font-semibold">
          {/* Light variant — the admin bar is white, unlike the public chrome. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pakrimits-new-logo.svg" alt="PakRemits" width={103} height={20} className="h-5 w-auto" />
          <span className="text-muted">admin</span>
        </span>
        <nav className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current === item.href ? 'page' : undefined}
              className={`no-underline ${
                current === item.href
                  ? 'font-medium text-ink underline underline-offset-4'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link href="/" className="ml-auto text-sm text-muted no-underline hover:text-ink">
          View site →
        </Link>
      </div>
    </header>
  )
}

/** Shared panel wrapper so every dashboard card is the same shape. */
export function Panel({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-panel border border-line bg-white">
      <div className="border-b border-line-2 px-5 py-3.5">
        <h2 className="font-display text-[17px] font-semibold">{title}</h2>
        {hint && <p className="mt-0.5 text-[13px] text-muted">{hint}</p>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-center text-[14px] text-muted">{children}</p>
}
