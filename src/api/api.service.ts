import { environment } from '../environments'
import type { ApiResponse } from '../models/api-response.model'
import { ApiError } from './api-error'

const baseUrl = environment.apiUrl.replace(/\/+$/, '')
const token = environment.apiToken

function buildUrl(action: string, params: Record<string, string | number | undefined> = {}): string {
  const url = new URL(baseUrl)
  url.searchParams.set('action', action)
  if (token) url.searchParams.set('token', token)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) url.searchParams.set(k, String(v))
  })
  return url.toString()
}

async function request<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    throw new ApiError('NETWORK', 'No se pudo conectar con la API. Verifica la conexión.')
  }

  if (!res.ok) {
    throw new ApiError('HTTP', `Error HTTP ${res.status} desde la API`)
  }

  let json: ApiResponse<T>
  try {
    json = (await res.json()) as ApiResponse<T>
  } catch {
    throw new ApiError('INVALID_RESPONSE', 'La API devolvió una respuesta inválida')
  }

  if (!json.ok) {
    const code = json.error?.code ?? 'UNKNOWN'
    const message = json.error?.message ?? 'Error desconocido de la API'
    throw new ApiError(code, message)
  }

  return json.data as T
}

export async function apiGet<T>(action: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  return request<T>(buildUrl(action, params), { method: 'GET' })
}

export async function apiPost<T>(action: string, body: unknown): Promise<T> {
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body),
  }
  return request<T>(buildUrl(action), init)
}
