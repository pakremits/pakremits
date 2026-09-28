interface ProviderLogoProps {
  providerSlug: string
  providerName: string
  brandColor: string
  brandTextColor: string
  size?: 'small' | 'default' | 'large' | 'hero'
}

/**
 * Provider marks displayed beside a visible provider name.
 *
 * The image alt text is intentionally empty because the adjacent name already
 * identifies the provider. Unknown providers retain the initial fallback.
 */
export function ProviderLogo({
  providerSlug,
  providerName,
  brandColor,
  brandTextColor,
  size = 'default',
}: ProviderLogoProps) {
  // shrink-0: beside long text in a flex row the square would otherwise be
  // squeezed into an oval.
  const sizeClass = `shrink-0 ${
    size === 'hero'
      ? 'h-16 w-16'
      : size === 'large'
        ? 'h-12 w-12'
        : size === 'small'
          ? 'h-10 w-10'
          : 'h-11 w-11'
  }`

  if (providerSlug === 'remitly') {
    return (
      <span className={`${sizeClass} overflow-hidden rounded-[12px]`} aria-hidden="true">
        {/* This official badge is supplied as a square image by Remitly. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/provider-logos/remitly.png"
          alt=""
          width={300}
          height={300}
          className="h-full w-full object-cover"
        />
      </span>
    )
  }

  if (providerSlug === 'wise') {
    return (
      <span
        className={`${sizeClass} grid place-items-center rounded-[12px] bg-[#9FE870]`}
        aria-hidden="true"
      >
        {/* This official arrow mark is supplied in Wise's newsroom media kit. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/provider-logos/wise.png"
          alt=""
          width={250}
          height={250}
          className={size === 'large' ? 'h-8 w-8 object-contain' : 'h-7 w-7 object-contain'}
        />
      </span>
    )
  }

  if (providerSlug === 'botim') {
    return (
      <span
        className={`${sizeClass} overflow-hidden rounded-[12px]`}
        aria-hidden="true"
      >
        {/* Normalized from the BOTIM app icon supplied for this project. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/provider-logos/botim-v2.png"
          alt=""
          width={512}
          height={512}
          className="h-full w-full object-cover"
        />
      </span>
    )
  }

  if (providerSlug === 'careem') {
    return (
      <span
        className={`${sizeClass} overflow-hidden rounded-[12px]`}
        aria-hidden="true"
      >
        {/* Normalized from the Careem app mark supplied for this project. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/provider-logos/careem.png"
          alt=""
          width={512}
          height={512}
          className="h-full w-full object-cover"
        />
      </span>
    )
  }

  if (
    providerSlug === 'moneygram' ||
    providerSlug === 'western-union' ||
    providerSlug === 'al-ansari' ||
    providerSlug === 'taptap-send' ||
    providerSlug === 'xoom' ||
    providerSlug === 'enjaz-pay' ||
    providerSlug === 'telemoney'
  ) {
    const source =
      providerSlug === 'moneygram'
        ? '/provider-logos/moneygram.png'
        : providerSlug === 'western-union'
          ? '/provider-logos/western-union.png'
          : providerSlug === 'al-ansari'
            ? '/provider-logos/al-ansari.png'
            : providerSlug === 'taptap-send'
              ? '/provider-logos/taptap-send.png'
              : providerSlug === 'xoom'
                ? '/provider-logos/xoom.png'
                : providerSlug === 'enjaz-pay'
                  ? '/provider-logos/enjaz-pay.png'
                  : '/provider-logos/telemoney.png'

    return (
      <span className={`${sizeClass} overflow-hidden rounded-[12px]`} aria-hidden="true">
        {/* Official provider artwork supplied for this project. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={source} alt="" width={256} height={256} className="h-full w-full object-cover" />
      </span>
    )
  }

  if (providerSlug === 'typical-bank') {
    return (
      <span
        className={`${sizeClass} grid place-items-center rounded-[12px] bg-[#E7E9E8] text-[#4E5652]`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 9h18L12 4 3 9Z" fill="currentColor" strokeLinejoin="round" />
          <path d="M5 10.5v6.5M9.7 10.5v6.5M14.3 10.5v6.5M19 10.5v6.5M3 20h18M4 17.5h16" strokeLinecap="round" />
        </svg>
      </span>
    )
  }

  return (
    <span
      className={`${sizeClass} grid place-items-center rounded-[12px] font-display text-[15px] font-bold`}
      style={{ background: brandColor, color: brandTextColor }}
      aria-hidden="true"
    >
      {providerName.charAt(0)}
    </span>
  )
}
