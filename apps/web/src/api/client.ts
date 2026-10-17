const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1'

type RequestOptions = {
  method?: string
  body?: unknown
  token?: string
  responseType?: 'json' | 'blob'
}

export class ApiFailure extends Error {
  code: string
  status: number
  requestId?: string

  constructor(message: string, code: string, status: number, requestId?: string) {
    super(message)
    this.name = 'ApiFailure'
    this.code = code
    this.status = status
    this.requestId = requestId
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers()
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`)
  let body: BodyInit | undefined
  if (options.body instanceof FormData) {
    body = options.body
  } else if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(options.body)
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || (body ? 'POST' : 'GET'),
    headers,
    body,
  })

  if (!response.ok) {
    let message = `Request failed (${response.status}).`
    let code = 'REQUEST_FAILED'
    let requestId = response.headers.get('X-Request-ID') || undefined
    try {
      const payload = await response.json()
      message = payload?.error?.message || message
      code = payload?.error?.code || code
      requestId = payload?.request_id || requestId
    } catch {
      // Keep the generic, non-sensitive message if the server did not return JSON.
    }
    throw new ApiFailure(message, code, response.status, requestId)
  }

  if (response.status === 204) return undefined as T
  if (options.responseType === 'blob') return (await response.blob()) as T
  return (await response.json()) as T
}
