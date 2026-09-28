import Link from 'next/link'
import { AdminNavList } from '@/components/admin-nav-list'

/** Desktop (lg+): the sections, always open down the start edge. */
export function AdminSidebar() {
  return (
    <aside className="fixed inset-y-0 start-0 z-30 hidden w-[288px] flex-col border-e border-line bg-surface lg:flex">
      <div className="flex h-[72px] shrink-0 items-center gap-2.5 border-b border-line px-6">
        <Link href="/admin" className="flex items-center gap-2.5 no-underline" aria-label="Admin home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pakrimits-new-logo.svg" alt="PakRemits" width={103} height={20} className="h-5 w-auto dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pakrimits-new-logo-dark.svg" alt="PakRemits" width={103} height={20} className="hidden h-5 w-auto dark:block" />
          <span className="rounded-full bg-icon-bg px-2 py-0.5 text-[11.5px] font-bold text-ok">Admin</span>
        </Link>
      </div>

      <nav aria-label="Admin sections" className="flex-1 overflow-y-auto px-3 pt-5">
        <p className="px-3 pb-2 text-[12px] font-medium text-faint">Workspace</p>
        <AdminNavList />
      </nav>

    </aside>
  )
}
