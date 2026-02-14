/**
 * Nimbus hook client library following the AlgoKit Factory/Client pattern.
 *
 * Usage:
 *
 *   import spec from './out/BlockCounter.arc56.json'
 *
 *   const nimbus = new NimbusClient("http://localhost:4101", "aaa...");
 *   const factory = new NimbusHookFactory({ appSpec: spec, client: nimbus });
 *   const hook = await factory.send.deploy({ id: "counter" });
 *
 *   const state = await hook.getState();
 *   const counter = NimbusHookClient.decodeUint64(state.state);
 */

/** Minimal ARC-56 app spec shape. Compatible with generated client APP_SPEC constants. */
export interface AppSpec {
  source?: {
    approval: string
    clear: string
  }
  byteCode?: {
    approval: string
    clear: string
  }
}

export interface HookInfo {
  id: string
  'program-hash': string
  'require-origin': boolean
  'created-at': string
}

export interface HookState {
  round: number
  state: string
  error: string
  'catching-up': boolean
  timestamp: string
  'block-hash': string
  'program-hash': string
  'state-hash': string
  'prev-hash': string
  'receipt-hash': string
}

export interface HookHistory {
  history: HookState[]
}

export interface VerifyResult {
  valid: boolean
  entries: number
  first_round: number
  last_round: number
  broken_at?: number
  error?: string
}

export interface DeployHookParams {
  id: string
  initialState?: string
}

/**
 * Low-level REST client for the Nimbus API. Analogous to AlgorandClient.
 *
 * For most usage, prefer NimbusHookFactory and NimbusHookClient which
 * provide a higher-level interface matching the AlgoKit contract client pattern.
 */
export class NimbusClient {
  readonly baseUrl: string
  readonly token: string

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.token = token
  }

  /** @internal */
  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      'X-Algo-API-Token': this.token,
    }
    const options: RequestInit = { method, headers }

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      options.body = JSON.stringify(body)
    }

    const response = await fetch(url, options)

    if (response.status === 204) {
      return undefined as T
    }
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Nimbus API error ${response.status}: ${text}`)
    }
    return response.json() as T
  }

  /** List all registered hooks. */
  async listHooks(): Promise<HookInfo[]> {
    const result = await this.request<{ hooks: HookInfo[] }>('GET', '/v2/nimbus/hooks')
    return result.hooks
  }

  /** Get a NimbusHookClient for an existing hook by ID. */
  getHookClient(hookId: string): NimbusHookClient {
    return new NimbusHookClient({ client: this, hookId })
  }
}

/**
 * Factory for deploying hooks from an ARC-56 app spec. Analogous to AppFactory.
 *
 * Usage:
 *
 *   import spec from './out/BlockCounter.arc56.json'
 *
 *   const nimbus = new NimbusClient("http://localhost:4101", "aaa...");
 *   const factory = new NimbusHookFactory({ appSpec: spec, client: nimbus });
 *   const hook = await factory.send.deploy({ id: "counter" });
 */
export class NimbusHookFactory {
  public readonly appSpec: AppSpec
  public readonly client: NimbusClient

  constructor(params: { appSpec: AppSpec; client: NimbusClient }) {
    this.appSpec = params.appSpec
    this.client = params.client
  }

  private getProgram(): string {
    const program = this.appSpec.byteCode?.approval ?? this.appSpec.source?.approval
    if (!program) {
      throw new Error('App spec must contain byteCode.approval or source.approval')
    }
    return program
  }

  /** Get a NimbusHookClient for an existing hook by ID. */
  getHookClient(hookId: string): NimbusHookClient {
    return new NimbusHookClient({ client: this.client, hookId })
  }

  readonly send = {
    /**
     * Deploy the hook to the Nimbus node and return a client for it.
     *
     * Extracts the compiled bytecode from the app spec and registers it
     * via the Nimbus REST API.
     */
    deploy: async (params: DeployHookParams): Promise<NimbusHookClient> => {
      await this.client.request<void>('POST', '/v2/nimbus/hooks', {
        id: params.id,
        program: this.getProgram(),
        'initial-state': params.initialState,
      })
      return new NimbusHookClient({ client: this.client, hookId: params.id })
    },
  }
}

/**
 * Client for interacting with a deployed hook. Analogous to AppClient.
 *
 * Usage:
 *
 *   const hook = nimbus.getHookClient("counter");
 *   const state = await hook.getState();
 *   const counter = NimbusHookClient.decodeUint64(state.state);
 */
export class NimbusHookClient {
  public readonly client: NimbusClient
  public readonly hookId: string

  constructor(params: { client: NimbusClient; hookId: string }) {
    this.client = params.client
    this.hookId = params.hookId
  }

  /** Get hook metadata. */
  async getInfo(): Promise<HookInfo> {
    return this.client.request<HookInfo>('GET', `/v2/nimbus/hooks/${this.hookId}`)
  }

  /** Get the latest state for this hook. */
  async getState(): Promise<HookState> {
    return this.client.request<HookState>('GET', `/v2/nimbus/hooks/${this.hookId}/state`)
  }

  /** Get state history, optionally filtered by round range. */
  async getHistory(from?: number, to?: number): Promise<HookState[]> {
    const params = new URLSearchParams()
    if (from !== undefined) params.set('from', from.toString())
    if (to !== undefined) params.set('to', to.toString())
    const query = params.toString() ? `?${params.toString()}` : ''
    const result = await this.client.request<HookHistory>(
      'GET',
      `/v2/nimbus/hooks/${this.hookId}/history${query}`,
    )
    return result.history
  }

  /** Verify the receipt chain for this hook. */
  async verify(): Promise<VerifyResult> {
    return this.client.request<VerifyResult>('GET', `/v2/nimbus/hooks/${this.hookId}/verify`)
  }

  /** Delete this hook and its history. */
  async delete(): Promise<void> {
    await this.client.request<void>('DELETE', `/v2/nimbus/hooks/${this.hookId}`)
  }

  /** Decode a base64-encoded state into raw bytes. */
  static decodeState(base64State: string): Uint8Array {
    return Uint8Array.from(atob(base64State), (c) => c.charCodeAt(0))
  }

  /** Decode a base64-encoded state into a BigInt (8-byte big-endian uint64). */
  static decodeUint64(base64State: string): bigint {
    const bytes = NimbusHookClient.decodeState(base64State)
    const view = new DataView(bytes.buffer)
    return view.getBigUint64(0)
  }

  /** Encode raw bytes to base64 for use in API requests. */
  static encodeState(data: Uint8Array): string {
    return btoa(String.fromCharCode(...data))
  }
}
