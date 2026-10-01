import { headers } from 'next/headers'
import { isAdminAuthorization } from '@/lib/admin/basic-auth'

/**
 * Re-checks the admin password inside a server action.
 *
 * proxy.ts already guards every /admin request, including the POSTs that carry
 * server actions, so this is a second lock rather than the only one: a server
 * action is a public endpoint by design, and one routing change or refactor
 * would otherwise expose writes to quotes, affiliate URLs and benchmarks.
 * Throws, so the action does nothing and the caller sees an error.
 */
export async function assertAdmin(): Promise<void> {
  const authorization = (await headers()).get('authorization')
  if (!isAdminAuthorization(authorization)) throw new Error('Not authorised')
}
