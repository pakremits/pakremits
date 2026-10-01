/**
 * Delivery-method pages.
 *
 * These target a different search intent from the corridor pages: someone who
 * already knows they want the money in a JazzCash wallet and needs to know who
 * does that, rather than someone comparing services from a country. So the
 * copy answers "how does this rail work and what are its limits", not "which
 * provider costs least" — the table answers that.
 *
 * Same caveat as the corridor content: facts here age, `lastReviewed` says
 * when they were last checked, and NEEDS VERIFICATION marks figures that must
 * be confirmed against the primary source before launch.
 */
import type { DeliveryMethod } from '@/lib/db/schema'

export interface MethodContent {
  slug: string
  /** Which stored delivery method the comparison table should be set to. */
  method: DeliveryMethod
  title: string
  /** Search title, when the page title alone says too little. Defaults to `title`. */
  metaTitle?: string
  metaDescription: string
  intro: string[]
  sections: { heading: string; body: string[] }[]
  faqs: { q: string; a: string }[]
  lastReviewed: string
}

export const METHOD_CONTENT: MethodContent[] = [
  {
    slug: 'jazzcash',
    method: 'wallet',
    title: 'Send money to JazzCash from abroad',
    metaDescription:
      'Compare available ways to send money to a JazzCash wallet in Pakistan. See supported providers, transfer fees, rates and expected delivery times.',
    intro: [
      'JazzCash is Pakistan’s largest mobile wallet, and receiving a transfer straight into one ' +
        'is usually the fastest way to get money to someone who does not use a bank account. ' +
        'Payouts commonly land in minutes rather than the same working day.',
      'Not every international service supports wallet payout, and those that do sometimes quote ' +
        'a slightly different rate for wallets than for bank deposits. The table below is set to ' +
        'wallet delivery, so what you see is the wallet rate rather than the headline one.',
    ],
    sections: [
      {
        heading: 'What your recipient needs',
        body: [
          'A JazzCash account registered against their own CNIC, and the mobile number that ' +
            'account is registered to. The name on the wallet has to match the recipient name on ' +
            'the transfer — a mismatch is the most common reason a wallet payout is held, and it ' +
            'is far more common than any technical failure.',
          'They do not need a Jazz SIM. JazzCash accounts can be opened against other networks’ ' +
            'numbers, though the registration flow differs.',
        ],
      },
      {
        heading: 'Limits',
        body: [
          'Wallets have receiving limits that depend on the account level. A basic account has a ' +
            'relatively low monthly ceiling; a fully verified account has a much higher one. If ' +
            'you are sending a large amount, or several transfers in a month, a bank account is ' +
            'the more reliable target — hitting a wallet limit mid-month means the payout is ' +
            'rejected and has to be re-sent.',
          '// NEEDS VERIFICATION: current per-level receiving limits before publishing figures. ' +
            'These are set by the State Bank and revised periodically.',
        ],
      },
      {
        heading: 'Wallet versus bank deposit',
        body: [
          'Wallets win on speed and on reach — your recipient does not need a bank account, and ' +
            'the money is spendable immediately through the JazzCash app or at an agent.',
          'Bank deposits win on limits and, sometimes, on rate. Some providers price wallet ' +
            'payouts slightly worse because the domestic payout costs them more. Switch the ' +
            '“Recipient gets it in” selector above between the two to see the difference for your ' +
            'amount rather than assuming it goes one way.',
        ],
      },
    ],
    faqs: [
      {
        q: 'How long does a JazzCash transfer from abroad take?',
        a: 'Usually minutes once the sending side has cleared, because the Pakistani leg settles over domestic rails rather than through a correspondent bank. The slow part is almost always funding the transfer in the sending country, not the payout.',
      },
      {
        q: 'Can I send to JazzCash if my recipient has no bank account?',
        a: 'Yes, that is the main reason to use a wallet. They need a JazzCash account registered against their CNIC and nothing else.',
      },
      {
        q: 'Why is the wallet rate different from the bank rate?',
        a: 'Some providers price the two rails separately because their own costs differ. It is not a rule that one is always better — compare them for your amount using the selector above.',
      },
    ],
    lastReviewed: '2026-09-02',
  },
  {
    slug: 'easypaisa',
    method: 'wallet',
    title: 'Send money to Easypaisa from abroad',
    metaDescription:
      'Compare available ways to send money to an Easypaisa wallet in Pakistan. Check supported transfer services, fees, exchange rates and delivery times.',
    intro: [
      'Easypaisa is the other major Pakistani mobile wallet, and for receiving money from abroad ' +
        'it works much like JazzCash: fast, no bank account required, and subject to receiving ' +
        'limits that depend on how thoroughly the account is verified.',
      'The comparison below is set to wallet delivery. Providers that only pay out to bank ' +
        'accounts are excluded rather than shown with a rate you could not actually use.',
    ],
    sections: [
      {
        heading: 'What your recipient needs',
        body: [
          'An Easypaisa account registered to their CNIC, and the registered mobile number. As ' +
            'with JazzCash, the recipient name on the transfer must match the name on the wallet ' +
            'exactly as it appears on the CNIC.',
          'Easypaisa accounts can be opened through the app or at any of the agent locations, of ' +
            'which there are a great many outside the major cities — which is often the deciding ' +
            'factor for families in smaller towns.',
        ],
      },
      {
        heading: 'Choosing between Easypaisa and JazzCash',
        body: [
          'For receiving international transfers there is little practical difference. Pick ' +
            'whichever your recipient already uses, because opening a new wallet purely to ' +
            'receive one transfer adds a verification step and rarely saves anything.',
          'Where it does matter is agent coverage for cashing out. If your recipient will be ' +
            'withdrawing cash rather than spending from the wallet, the network with more agents ' +
            'near them is the better choice, and that varies by area.',
        ],
      },
      {
        heading: 'Limits',
        body: [
          'Receiving limits are set per account level and are revised periodically by the State ' +
            'Bank. A fully verified account receives substantially more per month than a basic ' +
            'one. Sending an amount above the ceiling results in a rejected payout rather than a ' +
            'partial one.',
          '// NEEDS VERIFICATION: current per-level receiving limits before publishing figures.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is Easypaisa or JazzCash better for receiving money from abroad?',
        a: 'Neither is meaningfully better for the transfer itself. Use whichever your recipient already has verified — the deciding factor is usually which network has more cash-out agents near them.',
      },
      {
        q: 'How long does an Easypaisa transfer take?',
        a: 'Typically minutes after the sending leg clears, since the payout runs over Pakistan’s domestic rails.',
      },
      {
        q: 'What happens if the transfer exceeds the wallet limit?',
        a: 'The payout is rejected rather than partially credited, and the provider returns the funds. For larger amounts send to a bank account instead.',
      },
    ],
    lastReviewed: '2026-09-02',
  },
  {
    slug: 'rda',
    method: 'rda',
    title: 'Roshan Digital Account transfers',
    metaTitle: 'Roshan Digital Account transfers: compare rates',
    metaDescription:
      'What a Roshan Digital Account is, who can open one, and when it is the right way to move ' +
      'money to Pakistan rather than an ordinary transfer.',
    intro: [
      'A Roshan Digital Account is a Pakistani bank account that non-resident Pakistanis can open ' +
        'remotely, without visiting Pakistan. The State Bank introduced the scheme in 2020, and ' +
        'it is the main official channel for overseas Pakistanis who want to hold and invest ' +
        'money in Pakistan rather than simply send it to someone.',
      'It is worth being clear about what it is not: it is not a faster or cheaper way to send ' +
        'your mother her monthly support. For that, an ordinary transfer to her existing account ' +
        'is simpler and usually better value.',
    ],
    sections: [
      {
        heading: 'Who can open one',
        body: [
          'Non-resident Pakistanis holding a NICOP, a POC, or a non-resident CNIC. The account is ' +
            'opened entirely online through a participating Pakistani bank — you upload your ' +
            'documents and there is no branch visit and no need to travel.',
          'Most of the major Pakistani banks participate, and the account can be held in rupees ' +
            'or in foreign currency depending on what you intend to do with it.',
        ],
      },
      {
        heading: 'When it makes sense',
        body: [
          'When you are moving money to invest rather than to spend. An RDA gives access to ' +
            'rupee and dollar certificates, and lets you hold funds in Pakistan without ' +
            'converting them the moment they arrive, which matters if you think the rate will ' +
            'move in your favour.',
          'It also makes sense if you are handling property, tax or family financial matters in ' +
            'Pakistan from abroad and need a Pakistani account in your own name rather than ' +
            'relying on a relative’s.',
        ],
      },
      {
        heading: 'When an ordinary transfer is better',
        body: [
          'For regular family support, use the comparison on this site and send straight to your ' +
            'recipient’s existing account or wallet. Routing through an RDA adds a hop without ' +
            'adding value, and the money still has to get from your RDA to them afterwards.',
          'The comparison above shows general PKR bank-deposit quotes, not prices specifically ' +
            'quoted for a Roshan Digital Account. Before sending, check that the provider can ' +
            'deposit into your particular account and confirm the final price and currency.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Do I need to visit Pakistan to open a Roshan Digital Account?',
        a: 'No. That is the point of the scheme — the account is opened remotely with a NICOP, POC or non-resident CNIC, entirely online.',
      },
      {
        q: 'Is an RDA cheaper than sending money normally?',
        a: 'Not for ordinary transfers to family. It is designed for holding and investing money in Pakistan, not for reducing the cost of a monthly remittance. For that, compare services on the corridor pages.',
      },
      {
        q: 'Can I hold foreign currency in one?',
        a: 'Yes, participating banks offer both rupee and foreign-currency variants, which is much of the appeal if you would rather not convert on arrival.',
      },
    ],
    lastReviewed: '2026-09-02',
  },
]

export function methodBySlug(slug: string): MethodContent | undefined {
  return METHOD_CONTENT.find((entry) => entry.slug === slug)
}
