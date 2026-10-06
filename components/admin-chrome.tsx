import Link from 'next/link'
import type { ReactNode } from 'react'
import { AdminMenu } from '@/components/admin-menu'
import { AdminPageClock } from '@/components/admin-page-clock'
import { AdminPublishButton } from '@/components/admin-publish-button'
import { ThemeToggle } from '@/components/theme-toggle'

/**
 * Admin chrome, in the public site's language: borderless surfaces and theme
 * tokens, so it follows light and dark, under a sticky header with the page
 * title, the date, the way back to the site and the theme switch.
 *
 * Desktop has the sections in AdminSidebar (in the admin layout); below lg
 * this header's bar opens them in a drawer (AdminMenu).
 */

export function AdminHeader({
  title,
  lede,
  status,
}: {
  /** The page's own path; the sidebar and drawer work it out themselves. */
  current?: string
  title: string
  lede?: string
  /** Pills under the header, e.g. refresh health on the dashboard. */
  status?: ReactNode
}) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-header/90 backdrop-blur-md">
        <div className="flex h-[72px] items-center gap-4 px-5 lg:px-8">
          {/* Below lg the sidebar is hidden, so the logo comes here. */}
          <Link href="/admin" className="shrink-0 no-underline lg:hidden" aria-label="Admin home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pakrimits-new-logo.svg" alt="PakRemits" width={103} height={20} className="h-5 w-auto dark:hidden" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pakrimits-new-logo-dark.svg" alt="PakRemits" width={103} height={20} className="hidden h-5 w-auto dark:block" />
          </Link>

          <div className="hidden min-w-0 lg:block">
            <h1 className="truncate font-display text-[19px] leading-tight font-semibold tracking-[-0.01em] text-ink">{title}</h1>
            {lede && <p className="mt-0.5 truncate text-[13px] text-muted" title={lede}>{lede}</p>}
          </div>

          <div className="ms-auto flex shrink-0 items-center gap-2">
            <span className="hidden h-10 items-center gap-2 rounded-control bg-mist px-3 text-[13px] font-medium whitespace-nowrap text-ink-2 tabular-nums md:flex">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" className="h-4 w-4 text-muted" aria-hidden="true">
                <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
                <path d="M3.5 10h17M8 3v4M16 3v4" />
              </svg>
              <AdminPageClock />
            </span>
            <AdminPublishButton />
            <Link
              href="/"
              className="hidden h-10 items-center gap-1.5 rounded-control border border-line bg-surface px-3.5 text-[14px] font-semibold whitespace-nowrap text-ink
                         no-underline transition-[border-color,box-shadow] hover:border-accent hover:shadow-[0_0_0_2px_var(--color-accent)] sm:flex"
            >
              View site
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M7 17L17 7M8 7h9v9" />
              </svg>
            </Link>
            <ThemeToggle toDarkLabel="Switch to dark mode" toLightLabel="Switch to light mode" className="h-10! w-10!" />
            <div className="lg:hidden">
              <AdminMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Below lg the header has no room for the title, so it opens the page. */}
      <div className="px-5 pt-6 lg:hidden">
        <h1 className="font-display text-[24px] leading-tight font-semibold tracking-[-0.02em] text-ink">{title}</h1>
        {lede && <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{lede}</p>}
      </div>
      {status && <div className="flex flex-wrap gap-2 px-5 pt-5 lg:px-8 lg:pt-6">{status}</div>}
    </>
  )
}

/** The page body. */
export const ADMIN_MAIN = 'relative px-5 pt-5 pb-16 lg:px-8'

/** A status pill with a coloured dot. */
export function StatusPill({ tone, children }: { tone: 'ok' | 'warn' | 'bad'; children: ReactNode }) {
  const dot =
    tone === 'ok' ? 'bg-ok ring-ok/20' : tone === 'warn' ? 'bg-gold ring-gold/25' : 'bg-danger ring-danger/20'
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-[13px] font-medium text-ink-2 shadow-[0_1px_2px_rgba(20,32,27,.06)] ring-1 ring-line">
      <span className={`h-2 w-2 rounded-full ring-4 ${dot}`} aria-hidden="true" />
      {children}
    </span>
  )
}

/** Shared panel so every card is the same shape. */
export function Panel({
  title,
  hint,
  action,
  children,
  className = '',
}: {
  title: string
  hint?: string
  /** Top-end slot, e.g. a count or a link. */
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-panel-lg bg-surface shadow-[0_1px_2px_rgba(20,32,27,.04)] ${className}`}>
      <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
        <div>
          <h2 className="font-display text-[17px] font-semibold text-ink">{title}</h2>
          {hint && <p className="mt-0.5 text-[13.5px] text-muted">{hint}</p>}
        </div>
        {action}
      </div>
      <div className="px-6 pb-6">{children}</div>
    </section>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-[12px] bg-mist py-6 text-center text-[14px] text-muted">{children}</p>
}

/** A dot and a word, for health columns. */
export function Dot({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'off'; children: ReactNode }) {
  const color =
    tone === 'ok' ? 'bg-ok' : tone === 'warn' ? 'bg-gold' : tone === 'bad' ? 'bg-danger' : 'bg-faint'
  const text = tone === 'bad' ? 'text-danger' : tone === 'warn' ? 'text-gold-dark' : 'text-ink-2'
  return (
    <span className={`inline-flex items-center gap-2 ${text}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} aria-hidden="true" />
      {children}
    </span>
  )
}

/** Table pieces: a quiet header, roomy rows with a hover tint. */
export const TABLE = 'w-full border-collapse text-[14px]'
export const THEAD_ROW = 'text-left text-[12.5px] text-muted'
export const TH = 'px-3 pb-2.5 font-medium first:ps-0 last:pe-0'
export const TR = 'border-t border-line-2 transition-colors hover:bg-mist/60'
export const TD = 'px-3 py-3 first:ps-0 last:pe-0'

/** Form pieces in the site's style. */
export const FIELD_BASE =
  'w-full rounded-control border-[1.5px] border-line bg-surface text-ink ' +
  'focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15'
export const BUTTON_PRIMARY =
  'inline-flex items-center justify-center rounded-control bg-gold font-bold text-on-gold ' +
  'transition-colors hover:bg-gold-hover disabled:opacity-60 cursor-pointer'
export const BUTTON_SECONDARY =
  'inline-flex items-center justify-center rounded-control border-[1.5px] border-line bg-surface font-bold text-ink ' +
  'transition-[border-color,box-shadow] hover:border-accent hover:shadow-[0_0_0_1.5px_var(--color-accent)] cursor-pointer'
