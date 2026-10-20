import { environment } from '../environments'
import type { ApiResponse } from '../models/api-response.model'
import { computed, reactive } from 'vue'
import type { ComputedRef } from 'vue'
import { ApiError } from './api-error'

const baseUrl = environment.apiUrl.replace(/\/+$/, '')
const token = environment.apiToken

type ProgressScope = 'pedidos' | 'historial'

const SCOPE_BY_ACTION: Record<string, ProgressScope> = {
  meta: 'pedidos',
  pedidos_all: 'pedidos',
  refresh: 'pedidos',
  historial: 'historial',
  historial_count: 'historial',
}

interface ScopeState {
  active: number
  loaded: number
  total: number | null
}

interface ActiveRequest {
  scope: ProgressScope | null
  loaded: number
  total: number | null
}

const scopeStates = reactive<Record<ProgressScope, ScopeState>>({
  pedidos: { active: 0, loaded: 0, total: null },
  historial: { active: 0, loaded: 0, total: null },
})

const activeRequests = new Map<string, ActiveRequest>()

function recomputeScopes() {
  const pedidos: ScopeState = { active: 0, loaded: 0, total: null }
  const historial: ScopeState = { active: 0, loaded: 0, total: null }
  let pedidosTotalAcc = 0
  let pedidosHasTotal = true
  let historialTotalAcc = 0
  let historialHasTotal = true

  for (const r of activeRequests.values()) {
    if (r.scope === 'pedidos') {
      pedidos.active++
      pedidos.loaded += r.loaded
      if (r.total === null) pedidosHasTotal = false
      else pedidosTotalAcc += r.total
    } else if (r.scope === 'historial') {
      historial.active++
      historial.loaded += r.loaded
      if (r.total === null) historialHasTotal = false
      else historialTotalAcc += r.total
    }
  }

  pedidos.total = pedidosHasTotal && pedidosTotalAcc > 0 ? pedidosTotalAcc : null
  historial.total = historialHasTotal && historialTotalAcc > 0 ? historialTotalAcc : null
  scopeStates.pedidos = pedidos
  scopeStates.historial = historial
}

function registerRequest(reqId: string, scope: ProgressScope | null) {
  activeRequests.set(reqId, { scope, loaded: 0, total: null })
  recomputeScopes()
}

function unregisterRequest(reqId: string) {
  if (!activeRequests.has(reqId)) return
  activeRequests.delete(reqId)
  recomputeScopes()
}

function newReqId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function useProgress(scope: ProgressScope): ComputedRef<{ active: boolean; percent: number | null }> {
  return computed(() => {
    const s = scopeStates[scope]
    if (s.active === 0) return { active: false, percent: null }
    if (s.total === null || s.total <= 0) return { active: true, percent: null }
    const percent = Math.min(100, Math.round((s.loaded / s.total) * 100))
    return { active: true, percent }
  })
}

function buildUrl(action: string, params: Record<string, string | number | undefined> = {}): string {
  const url = new URL(baseUrl)
  url.searchParams.set('action', action)
  if (token) url.searchParams.set('token', token)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) url.searchParams.set(k, String(v))
  })
  return url.toString()
}

const REQUEST_TIMEOUT_MS = 180_000
const GET_RETRIES = [{ delay: 1000 }, { delay: 3000 }]
const PROGRESS_THROTTLE_MS = 100

function isRetryableStatus(status: number): boolean {
  return status === 404 || status === 429 || (status >= 500 && status <= 599)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function reportProgress(reqId: string | undefined, loaded: number, total: number | null) {
  if (!reqId) return
  const entry = activeRequests.get(reqId)
  if (!entry) return
  entry.loaded = loaded
  entry.total = total
  recomputeScopes()
}

async function fetchWithProgress(
  url: string,
  init: RequestInit,
  reqId: string | undefined,
): Promise<Response> {
  const res = await fetch(url, init)
  if (!res.body || !reqId) return res

  const rawTotal = res.headers.get('content-length')
  const total = rawTotal !== null && isFinite(Number(rawTotal)) && Number(rawTotal) > 0 ? Number(rawTotal) : null

  const reader = res.body.getReader()
  const chunks: BlobPart[] = []
  let loaded = 0
  let lastEmit = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value && value.byteLength > 0) {
      chunks.push(value)
      loaded += value.byteLength
      const now = Date.now()
      if (now - lastEmit >= PROGRESS_THROTTLE_MS) {
        lastEmit = now
        reportProgress(reqId, loaded, total)
      }
    }
  }
  reportProgress(reqId, loaded, total)

  const body = chunks.length > 0
    ? new Blob(chunks, { type: res.headers.get('content-type') ?? 'application/json' })
    : null
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers })
}

async function request<T>(url: string, init: RequestInit, reqId?: string): Promise<T> {
  const isGet = (init.method ?? 'GET') === 'GET'
  const retries = isGet ? GET_RETRIES : []
  let res!: Response
  let attempt = 0

  for (;;) {
    const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    try {
      res = await fetchWithProgress(url, { ...init, signal }, reqId)
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        throw new ApiError('TIMEOUT', 'La API tardó demasiado en responder. Inténtalo de nuevo.')
      }
      if (attempt < retries.length) {
        await sleep(retries[attempt].delay)
        attempt++
        continue
      }
      throw new ApiError('NETWORK', 'No se pudo conectar con la API. Verifica la conexión.')
    }

    if (!res.ok) {
      if (attempt < retries.length && isRetryableStatus(res.status)) {
        await sleep(retries[attempt].delay)
        attempt++
        continue
      }
      throw new ApiError('HTTP', `Error HTTP ${res.status} desde la API`)
    }
    break
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
  const scope = SCOPE_BY_ACTION[action] ?? null
  const reqId = scope ? newReqId() : undefined
  if (scope && reqId) registerRequest(reqId, scope)
  try {
    return await request<T>(buildUrl(action, params), { method: 'GET' }, reqId)
  } finally {
    if (scope && reqId) unregisterRequest(reqId)
  }
}

export async function apiPost<T>(action: string, body: unknown): Promise<T> {
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body),
  }
  return request<T>(buildUrl(action), init)
}
