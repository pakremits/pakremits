import type { DeliveryMethod } from '@/lib/db/schema'

export type PayoutOption =
  | 'bank'
  | 'jazzcash'
  | 'easypaisa'
  | 'sadapay'
  | 'nayapay'
  | 'cash'
  | 'rda'

const flagClass = 'h-5 w-7 rounded-[4px] shadow-[0_0_0_1px_rgba(2,78,56,.12)]'

export function CountryFlag({ countryCode }: { countryCode: string }) {
  if (countryCode === 'GB') {
    return (
      <svg viewBox="0 0 28 20" className={flagClass} aria-hidden="true">
        <rect width="28" height="20" fill="#21468B" />
        <path d="M0 0l28 20M28 0 0 20" stroke="#fff" strokeWidth="5" />
        <path d="M0 0l28 20M28 0 0 20" stroke="#CF142B" strokeWidth="2" />
        <path d="M14 0v20M0 10h28" stroke="#fff" strokeWidth="6" />
        <path d="M14 0v20M0 10h28" stroke="#CF142B" strokeWidth="3" />
      </svg>
    )
  }

  if (countryCode === 'AE') {
    return (
      <svg viewBox="0 0 28 20" className={flagClass} aria-hidden="true">
        <path fill="#00732F" d="M0 0h28v6.67H0z" />
        <path fill="#fff" d="M0 6.67h28v6.66H0z" />
        <path fill="#000" d="M0 13.33h28V20H0z" />
        <path fill="#EF3340" d="M0 0h7v20H0z" />
      </svg>
    )
  }

  if (countryCode === 'SA') {
    return (
      <svg viewBox="0 0 28 20" className={flagClass} aria-hidden="true">
        <rect width="28" height="20" fill="#006C35" />
        <path d="M7 8h14M9 11h10M8 14h12" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    )
  }

  // The receiving side: the compare page's phone summary shows USD → PKR with both flags.
  if (countryCode === 'PK') {
    return (
      <svg viewBox="0 0 28 20" className={flagClass} aria-hidden="true">
        <rect width="28" height="20" fill="#01411C" />
        <rect width="7" height="20" fill="#fff" />
        <path
          fill="#fff"
          d="M22.4 13.9a5 5 0 1 1-1.2-8.6 4.1 4.1 0 1 0 1.2 8.6z"
        />
        <path fill="#fff" d="m21.6 6.1.5 1.4h1.5l-1.2.9.4 1.4-1.2-.9-1.2.9.4-1.4-1.2-.9h1.5z" />
      </svg>
    )
  }

  if (countryCode === 'US') {
    return (
      <svg viewBox="0 0 28 20" className={flagClass} aria-hidden="true">
        <rect width="28" height="20" fill="#fff" />
        <path d="M0 1h28M0 4h28M0 7h28M0 10h28M0 13h28M0 16h28M0 19h28" stroke="#B22234" strokeWidth="2" />
        <rect width="12" height="10.5" fill="#3C3B6E" />
        <g fill="#fff">
          <circle cx="2.5" cy="2.3" r=".7" /><circle cx="6" cy="2.3" r=".7" /><circle cx="9.5" cy="2.3" r=".7" />
          <circle cx="4.2" cy="5.2" r=".7" /><circle cx="7.8" cy="5.2" r=".7" />
          <circle cx="2.5" cy="8.1" r=".7" /><circle cx="6" cy="8.1" r=".7" /><circle cx="9.5" cy="8.1" r=".7" />
        </g>
      </svg>
    )
  }

  if (countryCode === 'CA') {
    return (
      <svg viewBox="0 0 28 20" className={flagClass} aria-hidden="true">
        <rect width="28" height="20" fill="#fff" />
        <path fill="#D80621" d="M0 0h6v20H0zM22 0h6v20h-6z" />
        <path fill="#D80621" d="m14 3 1.2 3 2.6-1.2-.9 2.7 2 .8-3.1 2.5.7 2.1-2-.4.2 4.5h-1.4l.2-4.5-2 .4.7-2.1-3.1-2.5 2-.8-.9-2.7L12.8 6z" />
      </svg>
    )
  }

  if (countryCode === 'AU') {
    return (
      <svg viewBox="0 0 28 20" className={flagClass} aria-hidden="true">
        <rect width="28" height="20" fill="#012169" />
        <path d="M0 0l12 8M12 0 0 8" stroke="#fff" strokeWidth="2.5" />
        <path d="M6 0v8M0 4h12" stroke="#fff" strokeWidth="3" />
        <path d="M6 0v8M0 4h12" stroke="#C8102E" strokeWidth="1.5" />
        <g fill="#fff"><circle cx="19" cy="5" r="1" /><circle cx="23.5" cy="9" r="1" /><circle cx="18" cy="14" r="1.2" /><circle cx="24" cy="16" r=".8" /></g>
      </svg>
    )
  }

  if (countryCode === 'QA') {
    return (
      <svg viewBox="0 0 28 20" className={flagClass} aria-hidden="true">
        <rect width="28" height="20" fill="#8A1538" />
        <path fill="#fff" d="M0 0h8l3 1.1L8 2.2l3 1.1-3 1.1 3 1.1-3 1.1 3 1.1-3 1.1 3 1.1L8 11l3 1.1-3 1.1 3 1.1-3 1.1 3 1.1-3 1.1 3 1.1L8 20H0z" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 28 20" className={flagClass} aria-hidden="true">
      <rect width="28" height="20" fill="#003399" />
      <g fill="#FFCC00">
        {Array.from({ length: 12 }, (_, index) => {
          const angle = (index / 12) * Math.PI * 2 - Math.PI / 2
          return <circle key={index} cx={14 + Math.cos(angle) * 6} cy={10 + Math.sin(angle) * 6} r=".8" />
        })}
      </g>
    </svg>
  )
}

function PayoutLogo({ slug }: { slug: Exclude<PayoutOption, 'bank' | 'cash'> }) {
  return (
    // Supplied brand artwork is already transparent and square. A shared box
    // keeps every mark visually aligned without stretching it.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/payout-icons/${slug}.png`}
      alt=""
    className="h-5 w-5 shrink-0 object-contain"
    width={20}
    height={20}
      aria-hidden="true"
    />
  )
}

export function PayoutMethodIcon({ method }: { method: PayoutOption | DeliveryMethod }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    className: 'h-5 w-5 text-leaf',
    'aria-hidden': true,
  } as const

  if (method === 'bank') {
    return <svg {...common}><path d="m3 9 9-5 9 5M5 10h14M6 10v7m4-7v7m4-7v7m4-7v7M4 20h16M3 17h18" /></svg>
  }
  if (method === 'jazzcash' || method === 'easypaisa') {
    return <PayoutLogo slug={method} />
  }
  if (method === 'sadapay' || method === 'nayapay') {
    return <PayoutLogo slug={method} />
  }
  if (method === 'cash') {
    return <svg {...common}><path d="M3 7h16v10H3zM6 4h15v10M6 10a2 2 0 0 0 0 4m10-4a2 2 0 0 1 0 4" /><circle cx="11" cy="12" r="2.2" /></svg>
  }
  if (method === 'rda') return <PayoutLogo slug="rda" />
  if (method === 'wallet') {
    return <svg {...common}><path d="M4 7.5h14a2 2 0 0 1 2 2v8.5H6a2 2 0 0 1-2-2zM4 8V6a2 2 0 0 1 2-2h11v3.5M15 12h5v4h-5a2 2 0 0 1 0-4Z" /></svg>
  }
  return <svg {...common}><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M9 6h6M10 18h4M9 10h6v4H9z" /></svg>
}
