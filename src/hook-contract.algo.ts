import {
  BaseContract,
  Bytes,
  bytes,
  log,
  Txn,
} from '@algorandfoundation/algorand-typescript'

/**
 * HookContract is the base class for Nimbus hook programs.
 *
 * Hooks are AVM programs that execute against every block on a Nimbus node.
 * They receive the previous round's state as input and produce new state as
 * output. The output is captured from the last log message emitted by the
 * program.
 *
 * Subclasses must implement the `run` method. The only constraint is that
 * the parameter type and return type must match. The return value of `run`
 * is automatically logged and becomes the hook's new state.
 *
 * Example:
 *
 *   class BlockCounter extends HookContract {
 *     public run(previousState: bytes): bytes {
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
 *      with ApplicationArgs[0] set to the previous state.
 *   2. The approval program runs. The last `log` output becomes the new state.
 *   3. A cryptographic receipt is computed binding the state to the block.
 *
 * Hooks run in simulation mode with all standard AVM constraints removed.
 * Inner transactions, large state, and unlimited computation are all supported.
 */
export abstract class HookContract extends BaseContract {
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
  public abstract run(previousState: bytes): bytes

  /**
   * The AVM approval program entry point. Reads the previous state from
   * ApplicationArgs[0], calls run(), and logs the result.
   *
   * Do not override this method. Implement `run` instead.
   */
  public approvalProgram(): boolean {
    const previousState = Txn.applicationArgs(0)
    const newState = this.run(previousState)
    log(newState)
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
