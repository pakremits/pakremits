/**
 * Every page under /compare/: the corridors (/compare/uk-to-pakistan), the
 * ways to receive (/compare/jazzcash-transfers) and the provider
 * head-to-heads (/compare/remitly-vs-wise).
 *
 * One dynamic segment serves all three. A folder cannot be a partial segment
 * like `[slug]-to-pakistan`, and a static site has no rewrites to map one, so
 * the slug's shape picks the page. Every slug is built ahead of time; any
 * other is a 404.
 */
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CORRIDORS } from '@/lib/corridors'
import { METHOD_CONTENT } from '@/lib/content/methods'
import { corridorPath, methodPath } from '@/lib/routes'
import { CorridorPage, corridorMetadata } from './corridor-page'
import { MethodPage, methodMetadata } from './method-page'
import { PairPage, pairMetadata, pairSlugs, parsePair } from './pair-page'

export const dynamicParams = false

type Target =
  | { kind: 'corridor'; slug: string }
  | { kind: 'method'; slug: string }
  | { kind: 'pair'; pair: string }

/** The last path segment of a public URL. */
function segmentOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

function resolve(segment: string): Target | null {
  const corridor = CORRIDORS.find((entry) => segmentOf(corridorPath(entry.slug)) === segment)
  if (corridor) return { kind: 'corridor', slug: corridor.slug }

  const method = METHOD_CONTENT.find((entry) => segmentOf(methodPath(entry.slug)) === segment)
  if (method) return { kind: 'method', slug: method.slug }

  if (parsePair(segment)) return { kind: 'pair', pair: segment }
  return null
}

export async function generateStaticParams() {
  return [
    ...CORRIDORS.map((corridor) => ({ slug: segmentOf(corridorPath(corridor.slug)) })),
    ...METHOD_CONTENT.map((entry) => ({ slug: segmentOf(methodPath(entry.slug)) })),
    ...(await pairSlugs()).map((pair) => ({ slug: pair })),
  ]
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const target = resolve((await params).slug)
  switch (target?.kind) {
    case 'corridor':
      return corridorMetadata(target.slug)
    case 'method':
      return methodMetadata(target.slug)
    case 'pair':
      return pairMetadata(target.pair)
    default:
      return {}
  }
}

export default async function ComparePage({ params }: { params: Promise<{ slug: string }> }) {
  const target = resolve((await params).slug)
  switch (target?.kind) {
    case 'corridor':
      return <CorridorPage slug={target.slug} />
    case 'method':
      return <MethodPage slug={target.slug} />
    case 'pair':
      return <PairPage pair={target.pair} />
    default:
      notFound()
  }
}
