import { bytes } from '@algorandfoundation/algorand-typescript'
import { Hook } from '../src/hook.algo'

/**
 * The simplest possible hook. Passes through whatever state it receives
 * unchanged. Useful as a template or for testing the hook pipeline.
 */
class Echo extends Hook {
  public program(previousState: bytes): bytes {
    return previousState
  }
}
