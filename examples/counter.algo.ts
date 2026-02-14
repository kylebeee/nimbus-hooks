import { bytes, btoi, itob, Uint64 } from '@algorandfoundation/algorand-typescript'
import { HookContract } from '../src/hook-contract.algo'

/**
 * A simple counter hook that increments by 1 on each block.
 *
 * State format: 8-byte big-endian uint64
 *
 * Deploy:
 *   algokit compile ts examples/counter.algo.ts --out-dir out
 *
 * Register:
 *   const program = fs.readFileSync("out/BlockCounter.approval.teal")
 *   // compile and base64 encode, then POST to /v2/nimbus/hooks
 */
class BlockCounter extends HookContract {
  public program(previousState: bytes): bytes {
    if (previousState.length > 0) {
      const prev = btoi(previousState)
      return itob(prev + Uint64(1))
    }
    return itob(Uint64(1))
  }
}
