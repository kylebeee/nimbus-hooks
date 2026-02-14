import {
  BaseContract,
  Bytes,
  bytes,
  log,
  Txn,
} from '@algorandfoundation/algorand-typescript'

/**
 * Hook is the base class for Nimbus hook programs.
 *
 * Hooks are AVM programs that execute against every block on a Nimbus node.
 * They receive the previous round's state as input and produce new state as
 * output. The output is captured from the last log message emitted by the
 * program.
 *
 * Subclasses must implement the `program` method, following the same
 * pattern as LogicSig. The only constraint is that the parameter type
 * and return type must match. The return value of `program` is
 * automatically logged and becomes the hook's new state.
 *
 * Example:
 *
 *   class BlockCounter extends Hook {
 *     public program(previousState: bytes): bytes {
 *       if (previousState.length > 0) {
 *         const prev = btoi(previousState)
 *         return itob(prev + 1)
 *       }
 *       return itob(Uint64(1))
 *     }
 *   }
 *
 * Lifecycle:
 *   1. On each new block, the Nimbus node simulates an application call
 *      with ApplicationArgs[0] set to the previous state and
 *      ApplicationArgs[1] set to the block's transaction types.
 *   2. The approval program runs. The last `log` output becomes the new state.
 *   3. A cryptographic receipt is computed binding the state to the block.
 *
 * Hooks run in simulation mode with all standard AVM constraints removed.
 * Inner transactions, large state, and unlimited computation are all supported.
 */
export abstract class Hook<State = bytes> extends BaseContract {
  /**
   * Implement this method with your hook logic.
   *
   * The only constraint is that the parameter and return value must be the
   * same type. The parameter name is arbitrary.
   *
   * @param previousState - The state output from the previous block round.
   *   On the first evaluation this will be the initial-state provided at
   *   hook creation, or empty bytes if none was given.
   * @returns The new state for this round. This value will be passed back
   *   as the first argument on the next block.
   */
  public abstract program(previousState: State): State

  /**
   * The block's transaction types, one byte per transaction.
   *
   * Type enum: 0x01=pay, 0x02=keyreg, 0x03=acfg, 0x04=axfer,
   * 0x05=afrz, 0x06=appl, 0x07=stpf, 0x08=hb, 0x00=unknown.
   *
   * The number of transactions is `this.blockTransactions.length`.
   * Use `extract(this.blockTransactions, i, 1)` to read the type at index i.
   */
  protected get blockTransactions(): bytes {
    return Txn.applicationArgs(1)
  }

  /**
   * The AVM approval program entry point. Reads the previous state from
   * ApplicationArgs[0], calls program(), and logs the result.
   *
   * Do not override this method. Implement `program` instead.
   */
  public approvalProgram(): boolean {
    const previousState = Txn.applicationArgs(0) as unknown as State
    const newState = this.program(previousState)
    log(newState as unknown as bytes)
    return true
  }

  /**
   * Clear state program. Always approves (required by AVM but unused
   * by Nimbus hooks since they run in simulation).
   */
  public clearStateProgram(): boolean {
    return true
  }
}
