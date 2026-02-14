/**
 * NimbusClient provides a typed interface for the Nimbus hook REST API.
 *
 * Usage:
 *
 *   const client = new NimbusClient("http://localhost:4101", "aaa...");
 *   await client.createHook({ id: "counter", program: compiledBase64 });
 *   const state = await client.getState("counter");
 */

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

export interface CreateHookRequest {
  id: string
  program: string
  'require-origin'?: boolean
  'initial-state'?: string
}

export class NimbusClient {
  private baseUrl: string
  private token: string

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.token = token
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
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

  /** Get metadata for a specific hook. */
  async getHook(hookId: string): Promise<HookInfo> {
    return this.request<HookInfo>('GET', `/v2/nimbus/hooks/${hookId}`)
  }

  /** Register a new hook. */
  async createHook(req: CreateHookRequest): Promise<void> {
    await this.request<void>('POST', '/v2/nimbus/hooks', req)
  }

  /** Delete a hook and its history. */
  async deleteHook(hookId: string): Promise<void> {
    await this.request<void>('DELETE', `/v2/nimbus/hooks/${hookId}`)
  }

  /** Get the latest state for a hook. */
  async getState(hookId: string): Promise<HookState> {
    return this.request<HookState>('GET', `/v2/nimbus/hooks/${hookId}/state`)
  }

  /** Get state history for a hook, optionally filtered by round range. */
  async getHistory(hookId: string, from?: number, to?: number): Promise<HookState[]> {
    const params = new URLSearchParams()
    if (from !== undefined) params.set('from', from.toString())
    if (to !== undefined) params.set('to', to.toString())
    const query = params.toString() ? `?${params.toString()}` : ''
    const result = await this.request<HookHistory>('GET', `/v2/nimbus/hooks/${hookId}/history${query}`)
    return result.history
  }

  /** Verify the receipt chain for a hook. */
  async verify(hookId: string): Promise<VerifyResult> {
    return this.request<VerifyResult>('GET', `/v2/nimbus/hooks/${hookId}/verify`)
  }

  /** Decode a base64-encoded state into raw bytes. */
  static decodeState(base64State: string): Uint8Array {
    return Uint8Array.from(atob(base64State), (c) => c.charCodeAt(0))
  }

  /** Decode a base64-encoded state into a BigInt (8-byte big-endian uint64). */
  static decodeUint64(base64State: string): bigint {
    const bytes = NimbusClient.decodeState(base64State)
    const view = new DataView(bytes.buffer)
    return view.getBigUint64(0)
  }

  /** Encode raw bytes to base64 for use in API requests. */
  static encodeState(data: Uint8Array): string {
    return btoa(String.fromCharCode(...data))
  }
}
