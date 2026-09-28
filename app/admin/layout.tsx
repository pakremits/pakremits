import type { Metadata } from 'next'
import { fonts } from '@/lib/fonts'
import { THEME_SCRIPT } from '@/lib/theme'
import { AdminSidebar } from '@/components/admin-sidebar'
import '../globals.css'

/**
 * The admin area sits outside the locale tree — it is internal tooling, always
 * English, and never indexed — so it provides its own document shell rather
 * than inheriting one from [locale].
 */
export const metadata: Metadata = {
  title: 'PakRemits admin',
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    // THEME_SCRIPT sets data-theme before hydration, as in the locale layout.
    <html lang="en-GB" dir="ltr" className={fonts} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <AdminSidebar />
        <div className="lg:ps-[288px]">{children}</div>
      </body>
    </html>
  )
}
