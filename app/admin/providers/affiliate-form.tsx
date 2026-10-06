'use client'

import { useActionState } from 'react'
import { type SettingsState, saveAffiliateSettings } from './actions'
import { BUTTON_PRIMARY, FIELD_BASE } from '@/components/admin-chrome'

interface Props {
  provider: {
    id: number
    name: string
    slug: string
    homepageUrl: string
    affiliateNetwork: string
    affiliateUrlTemplate: string | null
    commissionNote: string | null
  }
}

/** Per-network template examples, so the shape is not something to guess at. */
const EXAMPLES: Record<string, string> = {
  impact: 'https://<advertiser>.prf.hn/click/camref:<your-camref>/destination:{destination}?subId1={clickId}',
  cj: 'https://www.anrdoezrs.net/click-<pid>-<aid>?url={destination}&sid={clickId}',
  partnerize: 'https://prf.hn/click/camref:<ref>/pubref:{clickId}/destination:{destination}',
  direct: 'https://provider.example/signup?ref=pakremits&sub={clickId}',
  none: '',
}

const FIELD = `${FIELD_BASE} h-11 px-3 text-[14px]`

export function AffiliateForm({ provider }: Props) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    saveAffiliateSettings,
    null,
  )

  return (
    <form action={formAction} className="border-t border-line-2 pt-4">
      <input type="hidden" name="providerId" value={provider.id} />

      <div className="grid gap-3 lg:grid-cols-[160px_1fr]">
        <label className="block">
          <span className="mb-1 block text-[12.5px] text-muted">Network</span>
          <select
            name="affiliateNetwork"
            defaultValue={provider.affiliateNetwork}
            className={FIELD}
          >
            {Object.keys(EXAMPLES).map((network) => (
              <option key={network} value={network}>
                {network}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[12.5px] text-muted">
            Tracking URL template — must contain <code>{'{clickId}'}</code>
          </span>
          <input
            name="affiliateUrlTemplate"
            defaultValue={provider.affiliateUrlTemplate ?? ''}
            placeholder={EXAMPLES[provider.affiliateNetwork] || 'Leave blank to earn nothing'}
            className={`${FIELD} font-mono text-[12.5px]`}
            spellCheck={false}
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-[12.5px] text-muted">
          Commission note — shown on the provider page
        </span>
        <input
          name="commissionNote"
          defaultValue={provider.commissionNote ?? ''}
          placeholder="Fixed bounty per new customer. Does not affect ranking."
          className={FIELD}
          maxLength={300}
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className={`${BUTTON_PRIMARY} h-10 px-5 text-[14px]`}
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        <p
          aria-live="polite"
          className={`text-[13px] font-medium ${state?.ok === false ? 'text-danger' : 'text-ok'}`}
        >
          {state?.message}
        </p>
      </div>

      <p className="mt-3 text-[12px] text-faint">
        <code>{'{clickId}'}</code> becomes the <code>click_id</code> of the row we just wrote to{' '}
        <code>affiliate_clicks</code>, so a conversion the network reports later can be traced back
        to the corridor and amount that produced it. <code>{'{destination}'}</code> becomes this
        provider&apos;s homepage, URL-encoded — without the encoding, a destination containing{' '}
        <code>?</code> or <code>&amp;</code> would truncate the network&apos;s own query string.
      </p>
    </form>
  )
}
