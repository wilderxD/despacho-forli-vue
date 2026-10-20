import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiGet } from '../api/api.service'
import { useToast } from '../composables/useToast'
import type { MetaData } from '../models/meta.model'
import type { HistorialRecord, PedidosAll, GuardarResult } from '../models/despacho.model'

const PAGE_SIZE = 50
const POLL_INTERVAL_MS = 30_000
const HISTORIAL_CACHE_KEY = 'forli_historial_last_v1'
const HISTORIAL_CACHE_MAX = 50

interface HistorialCacheEntry {
  fecha: string
  page: number
  records: HistorialRecord[]
  count: number
  savedAt: number
}

let historialPollingTimer: ReturnType<typeof setInterval> | null = null

const historialCache = new Map<string, HistorialRecord[]>()
const historialCountCache = new Map<string, number>()
const lastKnownCountByFecha = new Map<string, number>()

function historyKey(fecha: string, page: number): string {
  return `${fecha}|${page}`
}

function trimCache() {
  while (historialCache.size > HISTORIAL_CACHE_MAX) {
    const oldest = historialCache.keys().next().value
    if (oldest === undefined) break
    historialCache.delete(oldest)
  }
  while (historialCountCache.size > HISTORIAL_CACHE_MAX) {
    const oldest = historialCountCache.keys().next().value
    if (oldest === undefined) break
    historialCountCache.delete(oldest)
  }
}

function readPersistedHistorial(): HistorialCacheEntry | null {
  try {
    const raw = localStorage.getItem(HISTORIAL_CACHE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as unknown
    if (typeof data !== 'object' || data === null) return null
    const d = data as Partial<HistorialCacheEntry>
    if (typeof d.fecha !== 'string' || typeof d.page !== 'number' || typeof d.count !== 'number') return null
    if (!Array.isArray(d.records)) return null
    return d as HistorialCacheEntry
  } catch { return null }
}

function todayISO(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export const useResourcesStore = defineStore('resources', () => {
  const reloadNonce = ref(0)
  const lastUpdated = ref<Date | null>(null)

  const meta = ref<MetaData | null>(null)
  const metaLoading = ref(false)
  const metaError = ref<string | null>(null)

  const pedidosAll = ref<PedidosAll | null>(null)
  const pedidosAllLoading = ref(true)
  const pedidosAllError = ref<string | null>(null)

  const historialPage = ref(1)
  const historialFecha = ref(todayISO())

  const historial = ref<HistorialRecord[]>([])
  const historialLoading = ref(false)
  const historialError = ref<string | null>(null)

  const historialCount = ref(0)
  const historialCountLoading = ref(false)
  const historialHasNew = ref(false)

  const lastKnownHistorialCount = ref(0)
  const historialLastChecked = ref<Date | null>(null)

  const pageSize = PAGE_SIZE

  const restored = readPersistedHistorial()
  if (restored) {
    historialCache.set(historyKey(restored.fecha, restored.page), restored.records)
    historialCountCache.set(restored.fecha, restored.count)
    lastKnownCountByFecha.set(restored.fecha, restored.count)
    historialCount.value = restored.count
    lastKnownHistorialCount.value = restored.count
    if (historialFecha.value === restored.fecha && historialPage.value === restored.page) {
      historial.value = restored.records
    }
  }

  function persistHistorialCache() {
    if (historialError.value) return
    const entry: HistorialCacheEntry = {
      fecha: historialFecha.value,
      page: historialPage.value,
      records: historial.value,
      count: historialCount.value,
      savedAt: Date.now(),
    }
    historialCache.set(historyKey(entry.fecha, entry.page), entry.records)
    historialCountCache.set(entry.fecha, entry.count)
    lastKnownCountByFecha.set(entry.fecha, entry.count)
    try {
      localStorage.setItem(HISTORIAL_CACHE_KEY, JSON.stringify(entry))
    } catch { /* ignore */ }
    trimCache()
  }

  async function loadMeta() {
    metaLoading.value = true
    metaError.value = null
    try {
      meta.value = await apiGet<MetaData>('meta')
      lastUpdated.value = new Date()
    } catch (e: unknown) {
      metaError.value = e instanceof Error ? e.message : 'Error loading meta'
    } finally {
      metaLoading.value = false
    }
  }

  async function loadPedidosAll() {
    pedidosAllLoading.value = true
    pedidosAllError.value = null
    try {
      pedidosAll.value = await apiGet<PedidosAll>('pedidos_all')
      lastUpdated.value = new Date()
    } catch (e: unknown) {
      pedidosAllError.value = e instanceof Error ? e.message : 'Error loading pedidos'
    } finally {
      pedidosAllLoading.value = false
    }
  }

  async function loadHistorial(force = false) {
    const key = historyKey(historialFecha.value, historialPage.value)
    if (!force && historialCache.has(key)) {
      historial.value = historialCache.get(key)!
      historialError.value = null
      return
    }
    historialLoading.value = true
    historialError.value = null
    try {
      const records = await apiGet<HistorialRecord[]>('historial', {
        fecha: historialFecha.value,
        page: historialPage.value,
        pageSize: PAGE_SIZE,
      })
      historial.value = records
      historialCache.set(key, records)
      trimCache()
      persistHistorialCache()
    } catch (e: unknown) {
      historialError.value = e instanceof Error ? e.message : 'Error loading historial'
    } finally {
      historialLoading.value = false
    }
  }

  async function loadHistorialCount(force = false) {
    const fecha = historialFecha.value
    if (!force && historialCountCache.has(fecha)) {
      historialCount.value = historialCountCache.get(fecha)!
      lastKnownHistorialCount.value = historialCount.value
      lastKnownCountByFecha.set(fecha, historialCount.value)
      return
    }
    historialCountLoading.value = true
    try {
      const count = await apiGet<number>('historial_count', { fecha })
      historialCount.value = count
      lastKnownHistorialCount.value = count
      historialLastChecked.value = new Date()
      historialCountCache.set(fecha, count)
      lastKnownCountByFecha.set(fecha, count)
      trimCache()
      persistHistorialCache()
    } catch { /* ignore */ }
    finally { historialCountLoading.value = false }
  }

  async function startHistorialPolling() {
    stopHistorialPolling()
    historialPollingTimer = setInterval(async () => {
      try {
        const fecha = historialFecha.value
        const newCount = await apiGet<number>('historial_count', { fecha })
        historialLastChecked.value = new Date()
        const known = lastKnownCountByFecha.get(fecha)
        if (known === undefined) {
          lastKnownCountByFecha.set(fecha, newCount)
          historialCount.value = newCount
        } else if (newCount !== known) {
          lastKnownCountByFecha.set(fecha, newCount)
          lastKnownHistorialCount.value = newCount
          historialCount.value = newCount
          historialHasNew.value = true
        }
      } catch { /* ignore polling errors */ }
    }, POLL_INTERVAL_MS)
  }

  function stopHistorialPolling() {
    if (historialPollingTimer) {
      clearInterval(historialPollingTimer)
      historialPollingTimer = null
    }
  }

  async function loadAll() {
    reloadNonce.value++
    await Promise.all([loadMeta(), loadPedidosAll()])
  }

  async function refresh() {
    reloadNonce.value++
    pedidosAllLoading.value = true
    historialLoading.value = true
    const toast = useToast()
    let serverInvalidated = false
    try {
      meta.value = await apiGet<MetaData>('refresh')
      metaError.value = null
      lastUpdated.value = new Date()
      serverInvalidated = true
    } catch {
      serverInvalidated = false
    }
    await Promise.all([
      serverInvalidated ? Promise.resolve() : loadMeta(),
      loadPedidosAll(),
      loadHistorial(true),
      loadHistorialCount(true),
    ])
    persistHistorialCache()
    historialHasNew.value = false
    if (!serverInvalidated) {
      toast.show('No se pudo refrescar la caché del servidor; mostrando datos en caché', 'warning')
    } else if (metaError.value) {
      toast.show('Error al cargar la lista de estados/vendedores', 'danger')
    }
    if (pedidosAllError.value) {
      toast.show('Error al cargar el árbol de pedidos', 'danger')
    }
  }

  async function reloadHistorial() {
    historialHasNew.value = false
    await Promise.all([loadHistorial(true), loadHistorialCount(true)])
    persistHistorialCache()
  }

  function addHistorialRecord(res: GuardarResult) {
    // Mismos cálculos que el backend (_fetchHistorial / guardar)
    const espumas = res.items
      .filter((i) => i.linea.includes('ESPUMA'))
      .reduce((acc, curr) => acc + (curr.cantidad || 0), 0)
    const resortes = res.items
      .filter((i) => i.linea.includes('RESORTE'))
      .reduce((acc, curr) => acc + (curr.cantidad || 0), 0)

    const record: HistorialRecord = {
      id: res.id,
      fecha: res.fecha,
      fechaFiltro: todayISO(),
      chofer: res.chofer,
      placa: res.placa,
      cant: res.items.length,
      espumas,
      resortes,
      items: res.items,
    }

    const hoy = todayISO()

    // Insertar al inicio de la caché de hoy|página 1 (si ya existe esa vista cacheada)
    const keyHoy1 = historyKey(hoy, 1)
    const cachedHoy1 = historialCache.get(keyHoy1)
    if (cachedHoy1) {
      historialCache.set(keyHoy1, [record, ...cachedHoy1.filter((r) => r.id !== record.id)])
    }

    // Actualizar el conteo de hoy para que el polling no lo marque como "datos nuevos"
    const base = lastKnownCountByFecha.get(hoy) ?? historialCountCache.get(hoy) ?? 0
    const newCount = base + 1
    historialCountCache.set(hoy, newCount)
    lastKnownCountByFecha.set(hoy, newCount)

    // Si la vista activa es hoy, reflejar el registro de inmediato
    if (historialFecha.value === hoy) {
      lastKnownHistorialCount.value = newCount
      historialCount.value = newCount
      if (historialPage.value === 1) {
        historial.value = [record, ...historial.value.filter((r) => r.id !== record.id)]
      }
      persistHistorialCache()
    }

    historialHasNew.value = false
  }

  return {
    reloadNonce,
    lastUpdated,
    meta,
    metaLoading,
    metaError,
    pedidosAll,
    pedidosAllLoading,
    pedidosAllError,
    historialPage,
    historialFecha,
    historial,
    historialLoading,
    historialError,
    historialCount,
    historialCountLoading,
    historialHasNew,
    lastKnownHistorialCount,
    historialLastChecked,
    pageSize,
    loadMeta,
    loadPedidosAll,
    loadHistorial,
    loadHistorialCount,
    reloadHistorial,
    addHistorialRecord,
    startHistorialPolling,
    stopHistorialPolling,
    loadAll,
    refresh,
  }
})