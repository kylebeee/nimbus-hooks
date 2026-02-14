# @akitafoundation/nimbus-hooks

Algorand TypeScript base classes and client library for writing Nimbus hook programs.

## What are Nimbus Hooks?

Hooks are AVM programs that run against every block on a Nimbus node. They receive the previous round's state as input, produce new state as output, and generate cryptographic receipts that chain each state to the block it was derived from.

For full Nimbus documentation, see [NIMBUS.md](https://github.com/kylebeee/go-nimbus/blob/master/nimbus/NIMBUS.md) in the go-nimbus repository.

## Installation

```bash
npm install @akitafoundation/nimbus-hooks @algorandfoundation/algorand-typescript
```

## Writing a Hook

Extend `HookContract` and implement the `program` method, following the same pattern as `LogicSig`. The only constraint is that the parameter type and return type must match. The parameter name is arbitrary. The file must use the `.algo.ts` extension.

```typescript
// my-hook.algo.ts
import { bytes, btoi, itob, Uint64 } from '@algorandfoundation/algorand-typescript'
import { HookContract } from '@akitafoundation/nimbus-hooks'

class BlockCounter extends HookContract {
  public program(previousState: bytes): bytes {
    if (previousState.length > 0) {
      const prev = btoi(previousState)
      return itob(prev + Uint64(1))
    }
    return itob(Uint64(1))
  }
}
```

### How it works

`HookContract` extends `BaseContract` from `@algorandfoundation/algorand-typescript`. It provides the `approvalProgram` and `clearStateProgram` entry points automatically. You only implement `program`, following the same pattern as `LogicSig`.

At each block round, the Nimbus node simulates an application call transaction with `ApplicationArgs[0]` set to the previous state. The `approvalProgram` reads this argument, passes it to your `program` method, and logs the return value. The last log message becomes the hook's new state for that round.

### Comparison to other puya-ts base classes

| Base Class     | Use Case                                    |
|----------------|---------------------------------------------|
| `Contract`     | ARC4-compatible smart contracts on-chain    |
| `LogicSig`     | Logic signatures for transaction auth       |
| `BaseContract` | Full control over approval/clear programs   |
| `HookContract` | Nimbus hooks (block-level derived state)     |

### Constraints

- The `program` method's parameter and return value must be the same type.
- The return value of `program` is what gets logged and becomes the hook's state for that round.
- Hooks run in simulation mode. They cannot modify on-chain state.
- All standard AVM limits (opcode budget, log size, app args) are removed in Nimbus mode. See the [go-nimbus docs](https://github.com/kylebeee/go-nimbus/blob/master/nimbus/NIMBUS.md) for the full list.

## Compiling

Use the AlgoKit CLI to compile your hook:

```bash
algokit compile ts my-hook.algo.ts --out-dir out
```

This produces an ARC-56 app spec at `out/BlockCounter.arc56.json` containing the compiled bytecode.

## Client Library

The client library follows the AlgoKit Factory/Client pattern.

- `NimbusClient` -- low-level REST client (like `AlgorandClient`)
- `NimbusHookFactory` -- deploys hooks from an app spec (like `AppFactory`)
- `NimbusHookClient` -- interacts with a deployed hook (like `AppClient`)

### Deploy a Hook

```typescript
import { NimbusClient, NimbusHookFactory } from '@akitafoundation/nimbus-hooks'
import spec from './out/BlockCounter.arc56.json'

const nimbus = new NimbusClient(
  'http://localhost:4101',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
)

const factory = new NimbusHookFactory({ appSpec: spec, client: nimbus })
const hook = await factory.send.deploy({ id: 'block-counter' })
```

### Deploy with Initial State

```typescript
const hook = await factory.send.deploy({
  id: 'seeded-hook',
  initialState: NimbusHookClient.encodeState(new TextEncoder().encode('hello world')),
})
```

### Get a Client for an Existing Hook

```typescript
// From the NimbusClient
const hook = nimbus.getHookClient('block-counter')

// Or from the factory
const hook = factory.getHookClient('block-counter')
```

### Read Latest State

```typescript
const state = await hook.getState()
console.log('Round:', state.round)

const counter = NimbusHookClient.decodeUint64(state.state)
console.log('Counter:', counter)
```

### Read State History

```typescript
// Full history
const all = await hook.getHistory()

// Specific range
const range = await hook.getHistory(10, 20)

for (const entry of range) {
  const value = NimbusHookClient.decodeUint64(entry.state)
  console.log(`Round ${entry.round}: ${value}`)
}
```

### Verify the Receipt Chain

```typescript
const result = await hook.verify()
console.log('Valid:', result.valid)
console.log('Entries:', result.entries)
if (!result.valid) {
  console.log('Broken at round:', result.broken_at)
  console.log('Error:', result.error)
}
```

### Delete a Hook

```typescript
await hook.delete()
```

### List All Hooks

```typescript
const hooks = await nimbus.listHooks()
for (const info of hooks) {
  console.log(info.id, info['program-hash'])
}
```

### Decode Helpers

```typescript
// Decode base64 state to raw bytes
const raw: Uint8Array = NimbusHookClient.decodeState(state.state)

// Decode base64 state to BigInt (8-byte big-endian uint64)
const value: bigint = NimbusHookClient.decodeUint64(state.state)

// Encode raw bytes to base64 for API requests
const encoded: string = NimbusHookClient.encodeState(new Uint8Array([1, 2, 3]))
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

# Deploy using the client
npx tsx deploy.ts
```
