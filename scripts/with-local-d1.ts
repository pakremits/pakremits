/**
 * Run a command with the local D1 served to it: `npm run dev` and
 * `npm run build` start Next this way.
 *
 * Next renders in several processes, and the local D1 can only be opened by
 * one, so this process opens it and serves it on a loopback port
 * (lib/db/d1-bridge.ts). The command finds it through D1_BRIDGE_URL and
 * D1_BRIDGE_TOKEN; its exit code becomes this script's.
 *
 *   tsx scripts/with-local-d1.ts next build
 */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { startD1Bridge } from '../lib/db/d1-bridge'

async function main() {
  const [command, ...args] = process.argv.slice(2)
  if (!command) throw new Error('Usage: tsx scripts/with-local-d1.ts <command> [args...]')

  const bridge = await startD1Bridge()

  // `next` runs through Node directly rather than through a shell, so the
  // arguments arrive intact on every platform.
  const [executable, executableArgs] =
    command === 'next'
      ? [process.execPath, [createRequire(__filename).resolve('next/dist/bin/next'), ...args]]
      : [command, args]

  const child = spawn(executable, executableArgs, {
    stdio: 'inherit',
    env: { ...process.env, D1_BRIDGE_URL: bridge.url, D1_BRIDGE_TOKEN: bridge.token },
  })

  // Ctrl+C reaches the child too; wait for it to finish rather than dying first.
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {})

  const code = await new Promise<number>((resolve) => {
    child.on('exit', (exitCode, signal) => resolve(exitCode ?? (signal ? 1 : 0)))
    child.on('error', (error) => {
      console.error(error)
      resolve(1)
    })
  })

  await bridge.close()
  process.exit(code)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
