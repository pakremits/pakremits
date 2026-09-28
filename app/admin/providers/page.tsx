import type { Metadata } from 'next'
import { ADMIN_MAIN, AdminHeader, BUTTON_SECONDARY, FIELD_BASE, Panel, StatusPill } from '@/components/admin-chrome'
import { providerSettings } from '@/lib/admin/stats'
import { AffiliateForm } from './affiliate-form'
import { setFeatured } from './actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Providers — PakRemits admin',
  robots: { index: false },
}

export default async function AdminProvidersPage() {
  const rows = await providerSettings()
  const real = rows.filter((row) => !row.isBenchmark)
  const featured = real.find((row) => row.featured)
  const monetised = real.filter((row) => row.affiliateUrlTemplate).length

  return (
    <>
      <AdminHeader
        current="/admin/providers"
        title="Providers and affiliate links"
        lede="A provider with no template still gets a working link to its homepage — that is the normal state before a programme is approved, and it must not produce a dead button. The seed never overwrites anything on this page, so these values survive a reseed."
        status={
          <>
            <StatusPill tone={monetised === real.length ? 'ok' : 'warn'}>
              {monetised} of {real.length} monetised
            </StatusPill>
            <StatusPill tone="ok">{featured ? `Sponsored: ${featured.name}` : 'No sponsored row'}</StatusPill>
          </>
        }
      />

      <main className={ADMIN_MAIN}>
        {/* Featured / sponsored */}
        <div>
          <Panel
            title="Sponsored placement"
            hint="Pins one provider directly below the best deal. Never above it."
          >
            <form action={setFeatured} className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="mb-1 block text-[12.5px] text-muted">Featured provider</span>
                <select
                  name="providerId"
                  // Keyed on the current value so React remounts it when the
                  // server data changes. Without this the select is
                  // uncontrolled and keeps whatever the user picked, so after
                  // Apply it snapped back to its stale initial value while the
                  // badge below already showed the new one — the page
                  // contradicting itself.
                  key={featured ? String(featured.id) : 'none'}
                  defaultValue={featured ? String(featured.id) : 'none'}
                  className={`${FIELD_BASE} h-11 min-w-[240px] px-3 text-[14px]`}
                >
                  <option value="none">None — no sponsored row</option>
                  {real.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className={`${BUTTON_SECONDARY} h-11 px-5 text-[14px]`}
              >
                Apply
              </button>
            </form>

            <p className="mt-5 rounded-[12px] bg-mist px-4 py-3 text-[13px] leading-relaxed text-muted">
              One at a time, because the ranking pins the featured row to exactly one position.
              Selecting a provider clears any other rather than leaving the second one&apos;s
              placement arbitrary. The row always carries a visible <b>Sponsored</b> label, and it
              cannot take the gold <b>Best deal</b> highlight — a test in{' '}
              <code>test/unit/rank.test.ts</code> fails if sponsorship ever changes which row is
              best.
            </p>
          </Panel>
        </div>

        {/* Per-provider affiliate config */}
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {real.map((provider) => (
            <div key={provider.id} className="rounded-panel-lg bg-surface p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-[17px] font-semibold">
                    {provider.name}
                    {provider.featured && (
                      <span className="ms-2 rounded-full bg-line-2 px-2 py-0.5 text-[11.5px] font-normal text-muted">
                        Sponsored
                      </span>
                    )}
                  </h2>
                  <p className="mt-0.5 text-[13px] break-all text-muted">
                    <code>{provider.slug}</code> · {provider.homepageUrl || 'no homepage'}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                    provider.affiliateUrlTemplate ? 'bg-icon-bg text-ok' : 'bg-gold-bg text-gold-dark'
                  }`}
                >
                  {provider.affiliateUrlTemplate ? 'monetised' : 'earns nothing'}
                </span>
              </div>

              <div className="mt-4">
                <AffiliateForm provider={provider} />
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  )
}
