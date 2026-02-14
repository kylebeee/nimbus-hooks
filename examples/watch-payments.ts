/**
 * Deploys the PaymentCounter hook without initial state, triggering a backfill
 * from genesis, then polls the state endpoint to print per-round progress.
 *
 * Usage:
 *   npx tsx examples/watch-payments.ts
 *
 * Requires a running Nimbus node (e.g. via docker compose).
 * The hook's ARC-56 app spec must be compiled first:
 *   algokit compile ts examples/payment-counter.algo.ts --out-dir out
 */

import { NimbusClient, NimbusHookFactory, NimbusHookClient } from '../src/client'

const NIMBUS_URL = process.env.NIMBUS_URL ?? 'http://localhost:4001'
const NIMBUS_TOKEN =
  process.env.NIMBUS_TOKEN ??
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const HOOK_ID = 'payment-counter'
const POLL_MS = 500

async function loadSpec() {
  // Dynamic import so the path can be adjusted without changing code
  const spec = await import('../out/PaymentCounter.arc56.json', {
    assert: { type: 'json' },
  })
  return spec.default
}

async function main() {
  const spec = await loadSpec()
  const nimbus = new NimbusClient(NIMBUS_URL, NIMBUS_TOKEN)
  const factory = new NimbusHookFactory({ appSpec: spec, client: nimbus })

  console.log('Deploying PaymentCounter hook (no initial state = backfill from genesis)...')

  let hook: NimbusHookClient
  try {
    hook = await factory.send.deploy({ id: HOOK_ID })
  } catch (e: unknown) {
    // If already deployed, just get a client for it
    if (e instanceof Error && e.message.includes('already exists')) {
      console.log('Hook already deployed, watching existing hook.')
      hook = factory.getHookClient(HOOK_ID)
    } else {
      throw e
    }
  }

  console.log(`Watching hook "${HOOK_ID}" — press Ctrl+C to stop.\n`)
  console.log('Round'.padStart(10), ' ', 'Payments'.padStart(12), ' ', 'Status')
  console.log('-'.repeat(42))

  let lastRound = -1

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const state = await hook.getState()

      if (state.round !== lastRound) {
        lastRound = state.round

        let payments = '—'
        if (state.state) {
          try {
            payments = NimbusHookClient.decodeUint64(state.state).toString()
          } catch {
            payments = '(decode error)'
          }
        }

        const status = state['catching-up'] ? 'catching up' : 'live'
        console.log(
          String(state.round).padStart(10),
          ' ',
          payments.padStart(12),
          ' ',
          status,
        )
      }
    } catch (e: unknown) {
      if (e instanceof Error) {
        console.error(`Error: ${e.message}`)
      }
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
