import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Process-level liveness check for deployment platforms and load balancers.
 * It deliberately avoids PostgreSQL and provider APIs: a dependency outage
 * should be visible in monitoring without causing Fly to restart a healthy
 * application process.
 *
 * `commit` is the Git SHA baked into the image (Dockerfile ARG GIT_SHA). The
 * deploy pipeline polls it to confirm the new release is the one serving.
 */
export function GET() {
  return NextResponse.json(
    { ok: true, service: 'pakremits', commit: process.env.GIT_SHA || null },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
