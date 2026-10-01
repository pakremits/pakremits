/**
 * English message catalogue — the source of truth for every translated string.
 *
 * Message files are TypeScript rather than JSON so that translation notes can
 * live next to the strings they describe. next-intl accepts a plain object.
 */
export const en = {
  nav: {
    compare: 'Compare',
    services: 'Services',
    // Home sections listed only in the phone menu.
    example: "Today's example",
    trust: 'Why trust us',
    whyUs: "Why we're different",
    receive: 'Ways to receive',
    corridors: 'Corridors',
    howWeRank: 'How we rank',
    faq: 'FAQ',
    setAlert: 'Set a rate alert',
    /** The header button that opens the rate alert dialog. */
    rateAlert: 'Rate alert',
    main: 'Main',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    themeDark: 'Switch to dark mode',
    themeLight: 'Switch to light mode',
    appearance: 'Appearance',
  },

  home: {
    // Tooltip on the hero map's Pakistan marker, where every corridor lands.
    heroHomeLabel: 'Pakistan',
    heroHomeDetail: 'Home · {count} corridors land here',
    heroTitle: 'Send more rupees home. Same money.',
    heroLede:
      'Compare every major service sending to Pakistan, ranked by the exact amount that lands ' +
      'in the account. Not by rate, not by fee, not by who pays us.',
    heroTagline: 'Check the rate before you send money',
    liveChecked: 'Live · {count} providers checked {minutes} minutes ago',
    liveJustNow: 'Live · {count} providers checked just now',
    liveFallback: 'Live rates',
    statSaving: 'more on {amount} than a typical bank, right now',
    statRefreshValue: '15 min',
    statRefresh: 'rate refresh',
    statCountries: 'sending countries',
    tickerLabel: 'Live mid-market rates to Pakistani rupee',
    tickerFootnote: 'Mid-market reference, 7-day trend',
    flatThisWeek: 'Flat this week',
    changeThisWeek: '{direction} {percent}% this week',

    marqueeLabel: 'Best rate today by sending country',
    // <strong> wraps the lead phrase; the rest of the line is the unit note.
    marqueeHead: '<strong>Best rate today</strong> by sending country · rupees per unit',
    marqueeHint: 'Hover to pause · click to open the corridor',
    // Short form for the marquee chip. `flatThisWeek` is the spoken label.
    marqueeFlat: 'Flat',
    corridorsTitle: 'Where are you sending from?',
    corridorsLede:
      'Every corridor has its own page with live rates, delivery times, and limits.',
    bestToday: 'Best today',
    whyTitle: 'Why our ranking looks different from other <br></br>comparison sites',
    faqTitle: 'Common questions',

    // Today's example: one real comparison, shown as rupees received.
    exampleTitle: 'What {amount} turns into today',
    exampleRoute: 'From {country} to a bank account in Pakistan.',
    exampleGapBank:
      'more arrives through the best service than through a typical bank, for the same {amount}.',
    exampleGapSpread:
      'more arrives through the best service than through the lowest-paying one, for the same ' +
      '{amount}.',
    exampleListLabel: 'Rupees received, from quotes captured at {time} PKT',
    exampleBest: 'Most rupees',
    exampleBank: 'Typical bank',
    exampleGapMark: '{amount} lost',
    exampleCta: 'Compare your amount',

    providersTitle: 'The services we compare',
    providersLede:
      '{count} services, each checked every {minutes} minutes. Open one to see its fees, speed ' +
      'and payout options.',
    providersAll: 'See what each service supports',

    payoutTitle: 'How will they receive it?',
    payoutLede:
      'Choose how your family gets the money. Each way has its own services, rates and limits.',
    payoutBank: 'Any Pakistani bank account, paid to the recipient’s IBAN.',
    payoutJazzcash: 'Straight into the JazzCash wallet on their mobile number.',
    payoutEasypaisa: 'Straight into the Easypaisa wallet on their mobile number.',
    payoutNeobank: 'Sent as a bank deposit to their SadaPay or NayaPay account.',
    payoutCash: 'Collected in person at a pickup point, with their CNIC.',
    payoutRda: 'For Pakistanis abroad who hold a Roshan Digital Account.',

    alertChartLabel: '{currency} to PKR, last 30 days',

    statComparedBody:
      'Services compared on this corridor. We add providers only where we can get a live quote ' +
      'without working around their site.',
    statSponsoredBody:
      'Sponsored positions. Providers pay us the same whether they rank first or last, and we ' +
      'say so on every page.',

    trustTitle: 'A comparison you can check',
    trustLede:
      'The details that affect your transfer stay visible, from quote freshness to the final payout.',
    trustRouteValue: 'More ways to send',
    trustRouteTitle: 'Flexible payout choices',
    trustRouteBody: 'Compare bank, mobile wallet, cash pickup and RDA options in one place.',
    trustRefreshValue: 'Ready when you are',
    trustRefreshTitle: 'Freshness you can see',
    trustRefreshBody: 'Keep an eye on the market with rates updated throughout the day.',
    trustRankingValue: 'PKR received',
    trustRankingTitle: 'One fair ranking rule',
    trustRankingBody: 'We combine the exchange rate and fee, then rank by what reaches the recipient.',
    trustPayoutValue: 'Made for Pakistan',
    trustPayoutTitle: 'Local needs in focus',
    trustPayoutBody:
      'Built around the corridors and payout choices Pakistani families use most.',

    cardRankedTitle: 'Ranked by rupees received',
    cardRankedBody:
      'We compute the exact amount landing in the account after fees and the real exchange ' +
      'rate, then sort by that. Nothing else moves a provider up.',
    cardPakistanTitle: 'Built for Pakistan only',
    cardPakistanBody:
      'Compare wallet and cash-pickup routes, or choose SadaPay, NayaPay or a Roshan Digital ' +
      'Account to see general bank-deposit rates with those familiar account names.',
    cardBonusTitle: 'Bonuses and incentives shown',
    cardBonusBody:
      'We flag first-transfer promos and the State Bank’s remittance incentive where they ' +
      'apply, so the number you see is the number that arrives.',

    faq1Q: 'Is the rate shown the rate I will actually get?',
    faq1A:
      'It is the provider’s live quote at the time shown on the page, refreshed every 15 ' +
      'minutes. The provider confirms the final rate on their site before you pay, and it can ' +
      'move slightly in between. That is why we show a timestamp on every quote.',
    faq2Q: 'How does PakRemits make money?',
    faq2A:
      'Some providers pay us a fixed commission when a new customer signs up through our link. ' +
      'It does not change your rate and it never changes the order of results, which is always ' +
      'by amount received.',
    faq3Q: 'Can I send directly to JazzCash or Easypaisa?',
    faq3A:
      'Yes. Choose “JazzCash or Easypaisa” under “Recipient gets it in” and we only show ' +
      'services that pay out to mobile wallets, with the wallet-specific rate and delivery time.',
    faq4Q: 'What is the State Bank remittance incentive?',
    faq4A:
      'Pakistan’s central bank subsidises transfers through approved channels, which is why ' +
      'licensed services often show zero fees and slightly better rates than the mid-market. We ' +
      'mark providers where the scheme applies.',
    faq5Q: 'Why do the results change when I change the amount or payout method?',
    faq5A:
      'Providers use different fees, exchange rates and offers for each transfer size and payout ' +
      'method. We recalculate the ranking for your choices so the first result is the option that ' +
      'delivers the most rupees for that comparison.',
    faq6Q: 'Does PakRemits send or hold my money?',
    faq6A:
      'No. PakRemits compares available quotes and sends you to the provider you choose. You ' +
      'create the transfer and pay on that provider’s website or app, and PakRemits never holds ' +
      'your funds.',

    alertsTitle: 'Tell me when the pound hits <rate>{rateValue}</rate>',
    alertsBody:
      'Pick a target rate. We watch the market every 15 minutes and message you the moment it ' +
      'crosses, with the best provider at that moment.',
    alertsComingSoon:
      'Rate alerts open shortly. They will send one message per alert, at most once every 12 ' +
      'hours, with one-tap unsubscribe.',
    alertsCta: 'Compare rates now',
  },

  proof: {
    // Day-one claims. True from the first deploy, no threshold attached.
    pakistanOnly: 'Built only for Pakistan corridors.',
    providersRefreshed:
      '{providers} providers compared, refreshed every {minutes} minutes.',
    liveGap: '{amount} more on {sendAmount} than a typical bank, right now.',
    rankedByRupees: 'Ranked by rupees received. Never by who pays us.',

    // Threshold-gated. Hidden entirely until the number behind them is real.
    monthlyActivity:
      '{comparisons} comparisons run this month. Best rate changed hands {changes} times.',
    savingsSinceLaunch: '{amount} saved by PakRemits users since launch.',
    // The hero card shows the figure separately, so it needs the caption alone.
    savingsSinceLaunchLabel: 'saved by users since launch',
    savingsSinceLaunchLink: 'See how we count it.',
    firstPakistanOnlySite: "Pakistan's first Pakistan-only remittance comparison site",

    // Sits beside every statistic on the page.
    howWeCount: 'How we count this',
    stripLabel: 'What we can show you, from our own data',
    proofCountries: '{countries} sending countries and {payouts} ways to receive, in one comparison.',
  },

  alerts: {
    pair: 'Currency pair',
    targetRate: 'Target rate',
    sendBy: 'Send it by',
    whatsapp: 'WhatsApp',
    email: 'Email',
    whatsappNumber: 'WhatsApp number',
    emailAddress: 'Email address',
    digestOptIn: 'Also send me a weekly summary of this rate',
    createAlert: 'Create free alert',
    creating: 'Setting it up…',
    fineprint: 'One message per alert, max once every 12 hours. Unsubscribe with one tap.',
    genericError: 'Something went wrong. Try again in a moment.',
    checkInbox: 'Check your inbox',
    checkInboxBody:
      'We have sent you a link to confirm the alert. Nothing arrives until you click it, and ' +
      'if you never do, we delete the address within 48 hours.',
    alertSet: 'Alert set',
    alertSetBody:
      'We will message you the moment the rate crosses your target, with the best provider at ' +
      'that moment. At most once every 12 hours.',
    dialogTitle: 'Tell me when the rate hits my target',
    dialogBody:
      'We watch the market every 15 minutes and email you the moment it crosses, with the best ' +
      'provider at that moment.',
    previewSender: 'PakRemits alerts',
    // <strong> wraps the headline of the sample message.
    previewLine: '<strong>{pair} just crossed {rate}</strong>. Open PakRemits to see who is paying it.',
    close: 'Close',
    unavailable: 'Alerts are temporarily unavailable.',
    ctaBody:
      'Pick a target rate. We watch the market every 15 minutes and email you the moment it ' +
      'crosses, with the best provider at that moment.',
  },

  panel: {
    heading: 'Compare money transfer services',
    sendingFrom: 'Sending from',
    recipientGets: 'Recipient gets',
    youSend: 'You send',
    compareButton: 'Compare rates',
    resultsHeading: 'Available rates',
    bankAccountRateNote:
      'Showing general PKR bank-deposit quotes for {account}, not account-specific prices. Confirm this provider can pay into the account before sending.',
    capturedAt: 'Quotes captured {time} PKT',
    noQuotesYet: 'No quotes yet',
    stale: 'stale',
    deliversThisWay: '{count} providers deliver this way',
    viewAs: 'Layout',
    viewList: 'List view',
    viewGrid: 'Grid view',
    sortBy: 'Sort by',
    sortReceived: 'Most rupees',
    sortFastest: 'Fastest',
    sortLowestFee: 'Lowest fee',
    columnProvider: 'Provider',
    columnRate: 'Rate',
    columnFee: 'Fee',
    columnReceives: 'Recipient gets',
    bestDeal: 'Best deal',
    sponsored: 'Sponsored',
    bankDeposit: 'Bank deposit',
    swiftTransfer: 'SWIFT transfer',
    perUnit: 'per {symbol}',
    moreThanBank: '{amount} more than your bank',
    lessThanBest: '{amount} less than best',
    lowestInList: 'Lowest in this list: {amount}',
    bestAvailable: 'Best available',
    transferTime: 'Transfer time',
    feeAndRate: 'Fee & rate',
    free: 'Free',
    rateLine: 'Rate {rate}',
    // Non-breaking hyphen so a narrow card wraps before "mid-market", not inside it.
    vsMidMarket: '{percent} vs mid\u2011market',
    sendWith: 'Send with {provider}',
    whySoLow: 'Why so low?',
    emptyState: 'No provider we track delivers to Pakistan this way from {currency} yet.',
    // Shown when we cannot reach our own database. Never conflated with the
    // empty state, which would claim something false about the market.
    unavailable:
      'We cannot load rates right now — this is a problem on our side, not a ' +
      'statement about the market. Please try again in a few minutes.',
    refreshError: 'Could not refresh quotes. Showing the last figures we had.',
    disclaimerQuotes:
      'Quotes are indicative. The provider confirms the final rate before you pay.',
    disclaimerCaptured: 'Rates captured at {amount}.',
    disclaimerCommission:
      'Some links pay us a commission. Ranking is by amount received only.',

    // Delivery-speed buckets, derived from deliverySpeedMinutes. English uses
    // the provider's own published wording where we have it; other locales use
    // these, because an untranslated Latin phrase inside right-to-left text
    // gets reordered by the bidi algorithm into nonsense ("3–5 days" rendered
    // as "days 5–3").
    speedMinutes: 'In minutes',
    speedHours: 'In hours',
    speedSameDay: 'Same day',
    speedFewDays: 'A few days',
    speedVaries: 'Varies',

    promoNewCustomer: 'New-customer rate',
    // Pill for a promo too long to fit one; the full wording goes on its own line.
    promoOffer: 'Offer',
    to: 'To',
    currency: 'Sending currency',
    receiveCurrency: 'Recipient currency',
    amountIn: 'Amount in {currency}',
    compareShort: 'Compare',
    // The switch on the currency next to the amount: code (USD) or symbol ($).
    currencyDisplay: 'Show currency as',
    // Announced while the Compare button waits for results.
    comparing: 'Comparing rates…',
    // The compare page's phone summary bar, which opens the search in a sheet.
    editSearch: 'Change search: {summary}',
    closeSearch: 'Close search',
    recipientGetsShort: 'Recipient gets',
  },

  compare: {
    titleBank: 'Transfer to a bank account',
    titleCash: 'Send for cash pickup',
    titleNamed: 'Transfer to {name}',
    providers: '{count} providers',
    pakistan: 'Pakistan',
    quotesRefreshed: 'Quotes refreshed {time} PKT',
    midMarket: 'Mid-market exchange rate',
    thisWeek: 'this week',
    flatThisWeek: 'Flat this week',
    getAlerts: 'Get alerts',
  },

  methods: {
    bank: 'Bank account',
    wallet: 'JazzCash or Easypaisa',
    neobank: 'Sadapay or Nayapay',
    cash: 'Cash pickup',
    rda: 'Roshan Digital Account',
  },

  footer: {
    disclosure:
      'PakRemits is an independent comparison service. We earn a commission from some providers ' +
      'when you sign up through our links. This never affects the ranking, which is by amount ' +
      'received. We are not a money transfer service and never hold your funds.',
    compare: 'Compare',
    rates: 'Rates',
    brand: 'PakRemits',
    copyright: '© {year} PakRemits. Rates are indicative and provided for comparison only.',
  },

  common: {
    loadingSite: 'Loading PakRemits',
    breadcrumb: 'Breadcrumb',
    otherCorridors: 'Other corridors',
    lastReviewed: 'Guidance on this page was last reviewed on {date}.',
    ratesLiveGuidanceNot:
      'Rates above are live; the written guidance is not, and rules change. Nothing here is ' +
      'financial advice.',
    translationPending:
      'This guidance has not been translated into Urdu yet, so it is shown in English. The ' +
      'rates and the comparison table above are fully translated.',
  },
}

/**
 * The shape every catalogue must satisfy.
 *
 * Note the absence of `as const` above: with it, each value would be a string
 * *literal* type, and Urdu translations would fail to typecheck against the
 * English text. Widening to `string` is what makes `ur.ts` a compile-time check
 * that no key is missing rather than just a hopeful parallel file.
 */
export type Messages = typeof en
