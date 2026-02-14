import { bytes, btoi, itob, op, Uint64 } from '@algorandfoundation/algorand-typescript'
import { Hook } from '../src/hook.algo'

/**
 * Counts the total number of payment transactions across all blocks.
 *
 * State: uint64 (8 bytes, big-endian) running payment count.
 *
 * On each block, iterates through the transaction types in
 * ApplicationArgs[1] and increments the counter for each payment (0x01).
 */
class PaymentCounter extends Hook {
  public program(previousState: bytes): bytes {
    let count = previousState.length > 0 ? btoi(previousState) : Uint64(0)

    const txns = this.blockTransactions
    for (let i = Uint64(0); i < txns.length; i = i + Uint64(1)) {
      if (op.getByte(txns, i) === Uint64(1)) {
        count = count + Uint64(1)
      }
    }

    return itob(count)
  }
}
