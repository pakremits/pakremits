import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'
import { isPlausibleToken } from '@/lib/alerts/tokens'

export const metadata: Metadata = {
  title: 'Confirm unsubscribe — PakRemits',
  robots: { index: false, follow: false },
}

export default async function ConfirmUnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  if (!isPlausibleToken(token)) notFound()

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1120px] px-6 py-20">
        <article className="max-w-[58ch]">
          <h1 className="text-[clamp(30px,4vw,42px)] leading-[1.06] font-semibold">
            Unsubscribe from this alert?
          </h1>
          <p className="mt-5 text-[17px] text-muted">
            Confirming will delete this alert and its contact details. You will not receive any
            more messages for it.
          </p>
          <form action={`/alerts/unsubscribe/${token}`} method="post" className="mt-8">
            <input type="hidden" name="confirm" value="1" />
            <button
              type="submit"
              className="inline-flex h-12 cursor-pointer items-center rounded-control border-[1.5px] border-danger/40 px-6 font-bold text-danger transition-colors hover:border-danger hover:bg-danger-bg"
            >
              Yes, unsubscribe
            </button>
          </form>
          <Link href={`/alerts/manage/${token}`} className="mt-5 inline-block font-semibold text-leaf underline underline-offset-2">
            Keep this alert
          </Link>
        </article>
      </main>
      <SiteFooter />
    </>
  )
}
