# @akitafoundation/nimbus-hooks

Algorand TypeScript base classes and client library for writing Nimbus hook programs.

## What are Nimbus Hooks?

Hooks are AVM programs that run against every block on a Nimbus node. They receive the previous round's state as input, produce new state as output, and generate cryptographic receipts that chain each state to the block it was derived from.

For full Nimbus documentation, see [NIMBUS.md](https://github.com/akita/go-nimbus/blob/master/nimbus/NIMBUS.md) in the go-nimbus repository.

## Installation

```bash
npm install @akitafoundation/nimbus-hooks @algorandfoundation/algorand-typescript
```

## Writing a Hook

Extend `HookContract` and implement the `run` method. The file must use the `.algo.ts` extension.

```typescript
// my-hook.algo.ts
import { bytes, btoi, itob, Uint64 } from '@algorandfoundation/algorand-typescript'
import { HookContract } from '@akitafoundation/nimbus-hooks'

class BlockCounter extends HookContract {
  public run(previousState: bytes): bytes {
    if (previousState.length > 0) {
      const prev = btoi(previousState)
      return itob(prev + Uint64(1))
    }
    return itob(Uint64(1))
  }
}
```

### How it works

`HookContract` extends `BaseContract` from `@algorandfoundation/algorand-typescript`. It provides the `approvalProgram` and `clearStateProgram` entry points automatically. You only implement `run`.

At each block round, the Nimbus node simulates an application call transaction with `ApplicationArgs[0]` set to the previous state. The `approvalProgram` reads this argument, passes it to your `run` method, and logs the return value. The last log message becomes the hook's new state for that round.

### Comparison to other puya-ts base classes

| Base Class     | Use Case                                    |
|----------------|---------------------------------------------|
| `Contract`     | ARC4-compatible smart contracts on-chain    |
| `LogicSig`     | Logic signatures for transaction auth       |
| `BaseContract` | Full control over approval/clear programs   |
| `HookContract` | Nimbus hooks (block-level derived state)     |

### Constraints

- Hooks run in simulation mode. They cannot modify on-chain state.
- Inner transactions are not supported.
- The program must emit at least one log message or the evaluation records an error.
- The return value of `run` is what gets logged and becomes state.

## Compiling

Use the AlgoKit CLI to compile your hook to TEAL:

```bash
algokit compile ts my-hook.algo.ts --out-dir out
```

This produces `out/BlockCounter.approval.teal`. Compile it to bytecode and base64 encode it for the Nimbus API:

```bash
goal clerk compile out/BlockCounter.approval.teal -o out/BlockCounter.tok
base64 < out/BlockCounter.tok
```

## Client Library

The package includes a TypeScript client for the Nimbus REST API.

### Setup

```typescript
import { NimbusClient } from '@akitafoundation/nimbus-hooks'

const client = new NimbusClient(
  'http://localhost:4101',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
)
```

### Register a Hook

```typescript
import { readFileSync } from 'fs'

const program = readFileSync('out/BlockCounter.tok').toString('base64')

await client.createHook({
  id: 'block-counter',
  program: program,
})
```

### Register with Initial State

```typescript
const seed = Buffer.from('hello world').toString('base64')

await client.createHook({
  id: 'seeded-hook',
  program: program,
  'initial-state': seed,
})
```

### List Hooks

```typescript
const hooks = await client.listHooks()
for (const hook of hooks) {
  console.log(hook.id, hook['program-hash'])
}
```

### Read Latest State

```typescript
const state = await client.getState('block-counter')
console.log('Round:', state.round)

// Decode an 8-byte big-endian counter
const counter = NimbusClient.decodeUint64(state.state)
console.log('Counter:', counter)
```

### Read State History

```typescript
// Full history
const all = await client.getHistory('block-counter')

// Specific range
const range = await client.getHistory('block-counter', 10, 20)

for (const entry of range) {
  const value = NimbusClient.decodeUint64(entry.state)
  console.log(`Round ${entry.round}: ${value}`)
}
```

### Verify the Receipt Chain

```typescript
const result = await client.verify('block-counter')
console.log('Valid:', result.valid)
console.log('Entries:', result.entries)
if (!result.valid) {
  console.log('Broken at round:', result.broken_at)
  console.log('Error:', result.error)
}
```

### Delete a Hook

```typescript
await client.deleteHook('block-counter')
```

### Decode Helpers

```typescript
// Decode base64 state to raw bytes
const raw: Uint8Array = NimbusClient.decodeState(state.state)

// Decode base64 state to BigInt (8-byte big-endian uint64)
const value: bigint = NimbusClient.decodeUint64(state.state)

// Encode raw bytes to base64 for API requests
const encoded: string = NimbusClient.encodeState(new Uint8Array([1, 2, 3]))
```

## Examples

See the [examples/](examples/) directory:

- **counter.algo.ts** -- Increments a uint64 counter on every block
- **echo.algo.ts** -- Passes state through unchanged (useful as a template)

## Running with the Nimbus Sandbox

```bash
# In the go-nimbus repo
docker compose -f docker-compose.nimbus.yml up -d

# Compile your hook
algokit compile ts my-hook.algo.ts --out-dir out

# Register it
curl -s -X POST \
  -H "X-Algo-API-Token: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" \
  -d '{"id":"my-hook","program":"<base64-bytecode>"}' \
  http://localhost:4101/v2/nimbus/hooks

# Or use the client
npx tsx deploy.ts
```
