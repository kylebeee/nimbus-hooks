import { bytes } from '@algorandfoundation/algorand-typescript'
import { HookContract } from '../src/hook-contract.algo'

/**
 * The simplest possible hook. Passes through whatever state it receives
 * unchanged. Useful as a template or for testing the hook pipeline.
 */
class Echo extends HookContract {
  public program(previousState: bytes): bytes {
    return previousState
  }
}
