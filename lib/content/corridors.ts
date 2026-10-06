/**
 * Per-corridor editorial content.
 *
 * These pages are the SEO core, so the writing has to be specific to each
 * corridor — a template with the country name swapped in reads as thin content
 * to both readers and search engines, and would be worse than having no page.
 * Each corridor has its own regulator, its own dominant providers, and its own
 * typical sending amounts, and the copy reflects that.
 *
 * **Facts here age.** Regulator names, wallet limits and the tax treatment of
 * remittances all change. Every entry carries `lastReviewed`; anything past a
 * year should be checked before it is trusted. Items marked NEEDS VERIFICATION
 * are ones where a precise figure matters and should be confirmed against the
 * primary source before launch rather than taken from this file.
 */
import { refreshCadence } from '@/lib/cadence'
import type { SendCurrency } from '@/lib/db/schema'

export interface CorridorSection {
  heading: string
  /** Paragraphs. Plain strings — no markup, so they cannot inject HTML. */
  body: string[]
}

export interface CorridorFaq {
  q: string
  a: string
}

export interface CorridorContent {
  /** Sentence-case page title, per the copy rules. */
  title: string
  metaDescription: string
  intro: string[]
  sections: CorridorSection[]
  faqs: CorridorFaq[]
  /** ISO date. Content older than a year needs a review pass. */
  lastReviewed: string
}

/**
 * Shared Pakistan-side facts, written once and referenced by the FAQ builder.
 * The prose above them differs per corridor, so this does not create the
 * duplicate-content problem that templating the whole page would.
 */
const RDA_ANSWER =
  'A Roshan Digital Account is a Pakistani bank account that non-resident Pakistanis can open ' +
  'remotely, without visiting Pakistan, using a NICOP, POC or a non-resident CNIC. The State ' +
  'Bank introduced the scheme in 2020. It is worth having if you send regularly or want to hold ' +
  'money in Pakistan rather than convert it immediately, because it also gives access to ' +
  'rupee and dollar certificates. It is not a faster way to send a one-off transfer.'

const INCENTIVE_ANSWER =
  'The State Bank of Pakistan reimburses banks and money transfer operators for remittances ' +
  'sent through approved channels, which is why so many licensed services show a zero fee on ' +
  'transfers to Pakistan rather than the two or three percent you would expect. The subsidy goes ' +
  'to the provider, not to you, so it shows up as a lower headline cost rather than a payment. ' +
  'It also means the option with the lowest headline cost is not automatically the one that delivers the most ' +
  'rupees — the exchange rate still does most of the work.'

const WALLET_ANSWER =
  'Yes, if the provider supports mobile wallet payout. Choose “JazzCash or Easypaisa” under ' +
  '“Recipient gets it in” and the table only shows services that pay out to wallets, with the ' +
  'wallet-specific rate and delivery time, which are often different from the bank ones. Your ' +
  'recipient needs the wallet registered against their CNIC. Wallets have monthly receiving ' +
  'limits that depend on the account level, so a large transfer may need a bank account instead. ' +
  '// NEEDS VERIFICATION: current per-level wallet limits before quoting a figure.'

export const CORRIDOR_CONTENT: Record<SendCurrency, CorridorContent> = {
  GBP: {
    title: 'Best way to send money from the UK to Pakistan',
    metaDescription:
      'Compare GBP to PKR transfer rates from the UK to Pakistan. See provider fees, delivery options and the rupees received for the amount you send.',
    intro: [
      'The UK is one of the three largest sources of remittances to Pakistan, and it is also one ' +
        'of the most competitive corridors, which is good news if you compare and expensive if you ' +
        'do not. The gap between the best digital service and a high-street bank on a £500 ' +
        'transfer is routinely five figures in rupees.',
      `Every provider on this page is checked ${refreshCadence()} and ranked by what actually ` +
        'arrives in Pakistan after the fee and the exchange rate, not by the rate alone.',
    ],
    sections: [
      {
        heading: 'How long a transfer from the UK takes',
        body: [
          'Digital services funded by a UK bank transfer or Open Banking payment usually reach a ' +
            'Pakistani bank account the same day, and often within a couple of hours during ' +
            'Pakistani banking hours. Card-funded transfers clear faster on the UK side but cost ' +
            'noticeably more, which is why the comparison above prices the bank-transfer route.',
          'Mobile wallet payouts to JazzCash and Easypaisa are typically the fastest, frequently ' +
            'arriving in minutes, because they settle over Pakistan’s domestic rails rather than ' +
            'through a correspondent bank. A high-street bank sending by SWIFT is the slowest ' +
            'option on this page and usually the most expensive by a wide margin.',
        ],
      },
      {
        heading: 'Limits and paperwork',
        body: [
          'There is no legal cap on how much you may send from the UK to Pakistan. What you will ' +
            'run into instead are the provider’s own limits and money-laundering checks, which ' +
            'tighten as amounts rise. Expect to verify your identity on signup, and expect to be ' +
            'asked about the source of funds on larger transfers.',
          'Every service listed here must be authorised or registered with the Financial Conduct ' +
            'Authority to handle money transfers from the UK. That is worth checking on the FCA ' +
            'register before your first transfer with an unfamiliar provider — it is a two-minute ' +
            'check and it is the single most useful thing you can do to avoid a scam.',
        ],
      },
      {
        heading: 'Tax on money sent to Pakistan',
        body: [
          'Sending your own already-taxed income from the UK to family in Pakistan is not a ' +
            'taxable event in the UK, and gifts to family are not taxed as income in Pakistan ' +
            'either. Remittances arriving through normal banking channels get favourable ' +
            'treatment under Pakistani tax law specifically to encourage them.',
          'That treatment is capped rather than unlimited, and the cap has changed in recent ' +
            'finance acts, so if you are moving a large sum rather than sending monthly support, ' +
            'take advice rather than relying on a comparison site. ' +
            '// NEEDS VERIFICATION: current Section 111(4) threshold before publishing a figure.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Which service delivers the most rupees when sending from the UK to Pakistan?',
        a: `Whichever service is at the top of the table above at the moment you look, because it changes. Promotional first-transfer rates mean a provider can lead one week and not the next, which is exactly why the ranking is recomputed ${refreshCadence()} rather than written into the page.`,
      },
      { q: 'Can I send straight to JazzCash or Easypaisa?', a: WALLET_ANSWER },
      { q: 'What is the State Bank remittance incentive?', a: INCENTIVE_ANSWER },
      { q: 'Should I open a Roshan Digital Account?', a: RDA_ANSWER },
    ],
    lastReviewed: '2026-09-02',
  },

  AED: {
    title: 'Best way to send money from the UAE to Pakistan',
    metaDescription:
      'Compare AED to PKR rates for transfers from the UAE to Pakistan, including exchange houses and apps. Check fees and how many rupees reach your recipient.',
    intro: [
      'The UAE is the single largest source of remittances to Pakistan, and the corridor works ' +
        'differently from the UK or US ones. Exchange houses with physical branches still handle ' +
        'an enormous share of the volume, and they compete hard on rate because their customers ' +
        'compare in person, week after week.',
      'Because the dirham is pegged to the US dollar, the AED to PKR rate moves almost entirely ' +
        'with the rupee rather than with the dirham. That makes timing simpler here than in ' +
        'corridors with two floating currencies: you are really only watching one.',
    ],
    sections: [
      {
        heading: 'Exchange houses versus apps',
        body: [
          'A branch visit to an exchange house is still often competitive, particularly for cash ' +
            'transfers and for customers who negotiate. Digital services win on convenience and ' +
            'on transparency, and they are what this page can price automatically — a counter ' +
            `rate cannot be checked ${refreshCadence()} from here.`,
          'If you use an exchange house, take the number from this page with you. The useful ' +
            'comparison is not the rate they quote but the rupees your family ends up with after ' +
            'their fee, which is the figure in the table above.',
        ],
      },
      {
        heading: 'How long a transfer from the UAE takes',
        body: [
          'This is one of the fastest corridors into Pakistan. Wallet payouts to JazzCash and ' +
            'Easypaisa commonly land in minutes, and bank deposits to the major Pakistani banks ' +
            'usually clear the same working day.',
          'Timing is affected by the Pakistani banking week rather than the UAE one. A transfer ' +
            'sent late on a Friday UAE time may not settle into a Pakistani bank account until ' +
            'Monday, even though the money left your account immediately.',
        ],
      },
      {
        heading: 'Limits and identification',
        body: [
          'Remittance providers in the UAE are supervised by the Central Bank of the UAE, and ' +
            'you will need your Emirates ID to send. Providers apply their own limits, and ' +
            'labour-accommodation customers sending small monthly amounts will rarely encounter ' +
            'them, while anyone sending a large one-off sum should expect source-of-funds ' +
            'questions.',
          'Keep the transaction reference for anything substantial. It is the fastest way to ' +
            'trace a transfer that has not arrived, and it is far more useful to a support agent ' +
            'than the date and amount.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Why does the AED to PKR rate barely move some weeks?',
        a: 'The dirham is pegged to the US dollar, so the pair only really moves when the rupee moves against the dollar. A flat week in the ticker above is genuinely flat, not a broken feed — the chart draws a straight line rather than magnifying rounding noise into a fake trend.',
      },
      { q: 'Can I send straight to JazzCash or Easypaisa?', a: WALLET_ANSWER },
      { q: 'What is the State Bank remittance incentive?', a: INCENTIVE_ANSWER },
      { q: 'Should I open a Roshan Digital Account?', a: RDA_ANSWER },
    ],
    lastReviewed: '2026-09-02',
  },

  SAR: {
    title: 'Best way to send money from Saudi Arabia to Pakistan',
    metaDescription:
      'Compare SAR to PKR transfer options from Saudi Arabia to Pakistan. See available provider rates, fees and payout methods, ranked by rupees received.',
    intro: [
      'Saudi Arabia hosts one of the largest Pakistani communities anywhere and is consistently ' +
        'among the top two sources of remittances to Pakistan. The corridor is dominated by bank ' +
        'and exchange-house remittance products designed around regular monthly sending rather ' +
        'than occasional large transfers.',
      'Like the dirham, the riyal is pegged to the US dollar, so the SAR to PKR rate tracks the ' +
        'rupee. Watching the dollar-rupee rate tells you almost everything about when to send.',
    ],
    sections: [
      {
        heading: 'What is available in this corridor',
        body: [
          'Coverage here is thinner than in the UK corridor, and honestly so: several large ' +
            'digital providers do not serve Saudi Arabia to Pakistan at all, and this page will ' +
            'show fewer rows as a result. We would rather show you three real quotes than pad the ' +
            'table with services you cannot actually use from Riyadh or Jeddah.',
          'Bank-linked remittance products and the established exchange houses carry most of the ' +
            'volume. Where we cannot get a live quote from a provider without working around ' +
            'their website, we leave them off rather than publishing a stale or guessed number.',
        ],
      },
      {
        heading: 'How long a transfer from Saudi Arabia takes',
        body: [
          'Same-day arrival into a Pakistani bank account is normal, and wallet payouts are ' +
            'usually quicker still. The practical constraint is the overlap between the Saudi and ' +
            'Pakistani working weeks, which is good — both run Sunday to Thursday, so there is ' +
            'less weekend lag here than from Europe.',
          'Transfers initiated during Pakistani banking hours settle fastest. Sending in the ' +
            'Saudi evening often means the transfer queues until the following morning in ' +
            'Pakistan.',
        ],
      },
      {
        heading: 'Regulation and identification',
        body: [
          'Money transfer businesses in Saudi Arabia are licensed and supervised by the Saudi ' +
            'Central Bank. You will need your Iqama to send, and the name on the transfer must ' +
            'match your identification exactly — mismatches are the most common reason a transfer ' +
            'is held rather than any problem on the Pakistani side.',
          'Your recipient’s name must likewise match their CNIC exactly as it appears on the ' +
            'card. This sounds pedantic and it is the single most common cause of a delayed ' +
            'payout in this corridor.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Why do I see fewer providers on this page than on the UK page?',
        a: 'Because fewer of them actually serve this corridor. Several large digital services decline Saudi Arabia to Pakistan outright, and we only list a provider where we can fetch a genuine live quote. A shorter table here is an accurate reflection of the market rather than a gap in our coverage.',
      },
      { q: 'Can I send straight to JazzCash or Easypaisa?', a: WALLET_ANSWER },
      { q: 'What is the State Bank remittance incentive?', a: INCENTIVE_ANSWER },
      { q: 'Should I open a Roshan Digital Account?', a: RDA_ANSWER },
    ],
    lastReviewed: '2026-09-02',
  },

  USD: {
    title: 'Best way to send money from the USA to Pakistan',
    metaDescription:
      'Compare USD to PKR transfer rates from the USA to Pakistan. Check provider fees, bank and wallet delivery options, and the rupees your recipient gets.',
    intro: [
      'The US corridor has a different shape from the Gulf ones. Transfers tend to be larger and ' +
        'less frequent, more of them go to bank accounts than to cash pickup, and a much higher ' +
        'proportion are investment-related rather than family support.',
      'That makes the exchange rate matter more than the fee here. On a $2,000 transfer a ' +
        'half-percent difference in rate outweighs almost any fee on the page, which is why ' +
        'ranking by rupees received rather than by advertised fee changes the answer so often.',
    ],
    sections: [
      {
        heading: 'Bank transfers versus cards',
        body: [
          'Funding from a US bank account by ACH is materially cheaper than funding by debit or ' +
            'credit card, and the comparison above prices the ACH route. ACH adds a day or two to ' +
            'the US leg, which is the trade you are making for the better price.',
          'If you need the money in Pakistan today, a card-funded transfer will do it, but check ' +
            'the rupee figure rather than the fee — the cost of speed in this corridor is usually ' +
            'buried in the rate rather than charged openly.',
        ],
      },
      {
        heading: 'Roshan Digital Accounts and larger sums',
        body: [
          'The US corridor is where Roshan Digital Accounts genuinely earn their keep. If you are ' +
            'moving money to invest in Pakistan rather than to support family, an RDA lets you ' +
            'hold and place funds without converting to rupees the moment they arrive, and it can ' +
            'be opened from the United States without travelling.',
          'For ordinary monthly support to family, an RDA adds a step without adding value. Use ' +
            'the comparison above and send straight to their existing account.',
        ],
      },
      {
        heading: 'Limits and reporting',
        body: [
          'US money transmitters are registered with FinCEN and licensed state by state, so the ' +
            'services available to you depend partly on which state you are in. Providers file ' +
            'reports on larger transfers as a matter of routine; this is a compliance obligation ' +
            'on them and not a tax on you.',
          'Sending your own after-tax money to family is not a taxable event in the US, though ' +
            'very large gifts can carry a gift-tax reporting obligation. If you are sending an ' +
            'amount that makes you wonder, that is the point at which to ask an accountant ' +
            'rather than a comparison site.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is the fee or the exchange rate more important on a US transfer?',
        a: 'The rate, almost always, because US transfers tend to be larger. On $2,000 a half-percent rate difference is about $10, which swamps the fee on most services here. The table above already accounts for both by ranking on the rupee figure rather than on either component.',
      },
      { q: 'Should I open a Roshan Digital Account?', a: RDA_ANSWER },
      { q: 'Can I send straight to JazzCash or Easypaisa?', a: WALLET_ANSWER },
      { q: 'What is the State Bank remittance incentive?', a: INCENTIVE_ANSWER },
    ],
    lastReviewed: '2026-09-02',
  },

  CAD: {
    title: 'Best way to send money from Canada to Pakistan',
    metaDescription:
      'Compare CAD to PKR rates for sending money from Canada to Pakistan. See available provider fees, delivery options and the amount received in rupees.',
    intro: [
      'Canada is a mid-sized but fast-growing corridor into Pakistan, concentrated in the Greater ' +
        'Toronto Area and around Calgary and Vancouver. It is also a corridor where the big banks ' +
        'are unusually expensive relative to digital alternatives, so the gap between the top and ' +
        'bottom of the table above tends to be wide.',
      'The Canadian dollar floats, so unlike the Gulf corridors you are watching two currencies ' +
        'here. A good CAD to PKR rate can come from the loonie strengthening as easily as from ' +
        'the rupee weakening.',
    ],
    sections: [
      {
        heading: 'Funding a transfer from Canada',
        body: [
          'Interac e-Transfer and direct debit from a Canadian account cost the least to ' +
            'fund a transfer, and both are widely supported. Card funding is available almost ' +
            'everywhere and costs more, in the usual pattern.',
          'Canadian bank transfers can be slow to leave the country compared with the UK, so ' +
            'allow an extra day when the timing matters. The Pakistani leg is usually the fast ' +
            'part.',
        ],
      },
      {
        heading: 'Regulation',
        body: [
          'Money services businesses in Canada register with FINTRAC, and you can check a ' +
            'provider’s registration before sending. Provincial rules add a second layer in ' +
            'Quebec in particular, which occasionally means a service available in Ontario is not ' +
            'available to you.',
          'Identity verification on signup is standard, and larger transfers attract ' +
            'source-of-funds questions in the same way they do everywhere else.',
        ],
      },
      {
        heading: 'What arrives in Pakistan',
        body: [
          'Bank deposit is the usual choice from Canada, and same-day arrival is common once the ' +
            'Canadian leg clears. Wallet payout to JazzCash or Easypaisa is supported by some ' +
            'providers and is faster, though the wallet rate is sometimes slightly worse than the ' +
            'bank rate — the table above shows each separately so you can see the difference ' +
            'rather than assume it.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Why is my Canadian bank so much more expensive?',
        a: 'Because the cost is mostly in the exchange rate rather than the fee. A bank quoting “no transfer fee” can still be several percent behind the mid-market rate, which on a large transfer costs far more than any fee on this page. The bank benchmark row in the table above shows the size of that gap for your amount.',
      },
      { q: 'Can I send straight to JazzCash or Easypaisa?', a: WALLET_ANSWER },
      { q: 'What is the State Bank remittance incentive?', a: INCENTIVE_ANSWER },
      { q: 'Should I open a Roshan Digital Account?', a: RDA_ANSWER },
    ],
    lastReviewed: '2026-09-02',
  },

  AUD: {
    title: 'Best way to send money from Australia to Pakistan',
    metaDescription:
      'Compare AUD to PKR transfer rates from Australia to Pakistan. Check fees, exchange rates and how many rupees arrive with each available provider.',
    intro: [
      'Australia is a smaller corridor into Pakistan than the Gulf or the UK, but a growing one, ' +
        'and the time-zone difference shapes it more than anything else. Australia runs several ' +
        'hours ahead of Pakistan, so a transfer sent in the Australian morning has the whole ' +
        'Pakistani working day ahead of it.',
      'The Australian dollar floats and is unusually sensitive to commodity prices, which means ' +
        'this pair can move for reasons that have nothing to do with Pakistan. Watching the ' +
        '30-day chart below is more useful here than in the pegged Gulf corridors.',
    ],
    sections: [
      {
        heading: 'Timing a transfer from Australia',
        body: [
          'Send in the Australian morning if you want same-day arrival. By the Australian ' +
            'evening the Pakistani banking day is ending, and a transfer will usually queue until ' +
            'the next morning even if the provider accepted it instantly.',
          'PayID and direct debit from an Australian bank account are the lowest-cost funding ' +
            'routes. Card funding costs more here in the same way it does everywhere.',
        ],
      },
      {
        heading: 'Regulation',
        body: [
          'Remittance providers operating from Australia must be registered with AUSTRAC, which ' +
            'maintains a public register you can check before your first transfer with an ' +
            'unfamiliar service. Registration is a meaningful signal — it is not difficult for a ' +
            'legitimate business to obtain and its absence is a genuine warning.',
        ],
      },
      {
        heading: 'Provider coverage',
        body: [
          'Coverage from Australia is narrower than from the UK, and some providers that serve ' +
            'the corridor do so only for bank deposit rather than for wallets or cash pickup. ' +
            'Where a provider does not offer the delivery method you have selected, it simply ' +
            'does not appear in the table rather than appearing with a rate you could not ' +
            'actually get.',
        ],
      },
    ],
    faqs: [
      {
        q: 'When is the best time of day to send from Australia?',
        a: 'The Australian morning, which is the Pakistani early hours to mid-morning. That gives the transfer a full Pakistani banking day to settle. Sending in the Australian evening usually means arrival the next day regardless of what the provider’s estimate says.',
      },
      { q: 'Can I send straight to JazzCash or Easypaisa?', a: WALLET_ANSWER },
      { q: 'What is the State Bank remittance incentive?', a: INCENTIVE_ANSWER },
      { q: 'Should I open a Roshan Digital Account?', a: RDA_ANSWER },
    ],
    lastReviewed: '2026-09-02',
  },

  QAR: {
    title: 'Best way to send money from Qatar to Pakistan',
    metaDescription:
      'Compare QAR to PKR rates for sending money from Qatar to Pakistan. Check available transfer services, fees and the rupees your recipient receives.',
    intro: [
      'Qatar hosts a substantial Pakistani workforce and the corridor is served mainly by ' +
        'exchange houses and bank remittance products rather than by the global digital brands. ' +
        'Expect a shorter table here than on the UK or US pages, reflecting what is genuinely ' +
        'available rather than what we would like to show.',
      'The riyal is pegged to the US dollar, so QAR to PKR moves with the rupee alone. If you ' +
        'are timing a transfer, the dollar-rupee rate is the only number you need to follow.',
    ],
    sections: [
      {
        heading: 'What is available from Qatar',
        body: [
          'Several large digital providers do not serve Qatar to Pakistan, and we list only ' +
            'services we can get a real live quote from. Where the table is short, that is the ' +
            'market rather than an omission.',
          'Exchange houses with branches in Doha remain the main route for many senders and ' +
            'compete on rate. Take the figure from this page to the counter — the useful question ' +
            'is how many rupees arrive, not what rate is on the board.',
        ],
      },
      {
        heading: 'How long a transfer takes',
        body: [
          'Qatar and Pakistan share most of their working week, and the time difference is small, ' +
            'so this corridor has less weekend and overnight lag than transfers from Europe. ' +
            'Same-day arrival into a Pakistani bank account is normal, and wallet payouts are ' +
            'often quicker.',
        ],
      },
      {
        heading: 'Identification',
        body: [
          'You will need your Qatar ID to send, and the name on your transfer must match it. On ' +
            'the Pakistani side the recipient’s name must match their CNIC exactly. Name ' +
            'mismatches cause more delayed payouts in Gulf corridors than any technical problem ' +
            'does.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Why are there so few providers listed for Qatar?',
        a: 'Because several of the large digital services decline this corridor, and we only list a provider where we can fetch a genuine live quote rather than estimating one. A short table is an honest description of what you can actually use from Doha.',
      },
      { q: 'Can I send straight to JazzCash or Easypaisa?', a: WALLET_ANSWER },
      { q: 'What is the State Bank remittance incentive?', a: INCENTIVE_ANSWER },
      { q: 'Should I open a Roshan Digital Account?', a: RDA_ANSWER },
    ],
    lastReviewed: '2026-09-02',
  },

  EUR: {
    title: 'Best way to send money from the Eurozone to Pakistan',
    metaDescription:
      'Compare EUR to PKR rates for sending money from the Eurozone to Pakistan. See provider fees, payout methods and the final amount received in rupees.',
    intro: [
      'The Eurozone is not really one corridor — Pakistani communities in Spain, Italy, France, ' +
        'Germany and Greece each have their own established providers — but the euro rate is the ' +
        'same across all of them, so the comparison above holds wherever in the bloc you are ' +
        'sending from.',
      'SEPA makes the European leg of a transfer cheap and predictable, which is why euro ' +
        'transfers to Pakistan are often better value than the equivalent from countries with ' +
        'slower domestic payment rails.',
    ],
    sections: [
      {
        heading: 'SEPA and funding',
        body: [
          'Funding by SEPA transfer from a euro account costs the least and is supported by ' +
            'every digital provider serving this corridor. SEPA Instant, where your bank offers ' +
            'it, removes most of the European delay entirely and gets the transfer to the ' +
            'provider within seconds.',
          'Card funding is available and costs more. Given how cheap SEPA is, the premium for ' +
            'card funding is harder to justify here than in most corridors.',
        ],
      },
      {
        heading: 'Which country you are in still matters',
        body: [
          'The rate is identical across the Eurozone but availability is not. Providers are ' +
            'passported across the bloc under European payment services rules, yet several ' +
            'restrict specific countries for their own commercial or compliance reasons. If a ' +
            'service in the table declines you at signup, that is why.',
          'Locally established remittance operators, particularly in Spain and Italy, sometimes ' +
            'beat the digital brands on rate for cash transfers. They are generally too small to ' +
            'quote automatically, so treat this page as the floor rather than the ceiling.',
        ],
      },
      {
        heading: 'What arrives in Pakistan',
        body: [
          'Bank deposit is the norm from Europe and usually arrives the same or next working day. ' +
            'The main source of delay is the weekend mismatch: the Pakistani banking week ends on ' +
            'Friday, so a Friday-afternoon transfer from Europe frequently settles on Monday.',
          'Wallet payouts to JazzCash and Easypaisa are supported by some providers here and are ' +
            'the fastest option when they are available.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Does it matter which Eurozone country I send from?',
        a: 'Not for the rate, which is the same euro rate everywhere. It matters for availability: some providers restrict particular countries, so a service listed above may still decline you at signup depending on where you live.',
      },
      { q: 'Can I send straight to JazzCash or Easypaisa?', a: WALLET_ANSWER },
      { q: 'What is the State Bank remittance incentive?', a: INCENTIVE_ANSWER },
      { q: 'Should I open a Roshan Digital Account?', a: RDA_ANSWER },
    ],
    lastReviewed: '2026-09-02',
  },
}
