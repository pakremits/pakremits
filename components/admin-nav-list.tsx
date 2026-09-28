'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ADMIN_NAV } from '@/lib/admin/nav'

/** The admin sections, for the desktop sidebar and the mobile drawer. */
export function AdminNavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <ul className="grid gap-1">
      {ADMIN_NAV.map((item) => {
        const active = pathname === item.href
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={`group flex items-center gap-3.5 rounded-[14px] px-3 py-2.5 no-underline transition-colors ${
                active ? 'bg-tint' : 'hover:bg-mist'
              }`}
            >
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-[11px] transition-colors ${
                  active ? 'bg-brand text-white' : 'bg-icon-bg text-ok'
                }`}
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <path d={item.icon} />
                </svg>
              </span>
              <span className="min-w-0">
                <span className={`block text-[14.5px] leading-tight font-semibold ${active ? 'text-tint-ink' : 'text-ink'}`}>
                  {item.label}
                </span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{item.hint}</span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
