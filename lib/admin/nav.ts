/** The admin sections, shared by the header and the drawer. */
export const ADMIN_NAV = [
  {
    href: '/admin',
    label: 'Dashboard',
    hint: 'Clicks, refresh health, rate alerts',
    icon: 'M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z',
  },
  {
    href: '/admin/providers',
    label: 'Providers & affiliate links',
    hint: 'Tracking links and the sponsored slot',
    icon: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  },
  {
    href: '/admin/quotes',
    label: 'Quote overrides',
    hint: 'Correct a bad scrape by hand',
    icon: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  },
  {
    href: '/admin/proof',
    label: 'Proof & savings',
    hint: 'Public claims, benchmarks, rollups',
    icon: 'M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6zM9 12l2 2 4-4',
  },
] as const
