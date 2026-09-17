import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiGet } from '../api/api.service'
import type { MetaData } from '../models/meta.model'
import type { HistorialRecord, PedidosAll } from '../models/despacho.model'

const PAGE_SIZE = 50
const POLL_INTERVAL_MS = 30_000

let historialPollingTimer: ReturnType<typeof setInterval> | null = null

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
  const pedidosAllLoading = ref(false)
  const pedidosAllError = ref<string | null>(null)

  const historialPage = ref(1)
  const historialFecha = ref(todayISO())

  const historial = ref<HistorialRecord[]>([])
  const historialLoading = ref(false)
  const historialError = ref<string | null>(null)

  const historialCount = ref(0)
  const historialCountLoading = ref(false)

  const lastKnownHistorialCount = ref(0)
  const historialLastChecked = ref<Date | null>(null)

  const pageSize = PAGE_SIZE

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

  async function loadHistorial() {
    historialLoading.value = true
    historialError.value = null
    try {
      historial.value = await apiGet<HistorialRecord[]>('historial', {
        fecha: historialFecha.value,
        page: historialPage.value,
        pageSize: PAGE_SIZE,
      })
    } catch (e: unknown) {
      historialError.value = e instanceof Error ? e.message : 'Error loading historial'
    } finally {
      historialLoading.value = false
    }
  }

  async function loadHistorialCount() {
    historialCountLoading.value = true
    try {
      const count = await apiGet<number>('historial_count', { fecha: historialFecha.value })
      historialCount.value = count
      lastKnownHistorialCount.value = count
      historialLastChecked.value = new Date()
    } catch { /* ignore */ }
    finally { historialCountLoading.value = false }
  }

  async function startHistorialPolling() {
    stopHistorialPolling()
    historialPollingTimer = setInterval(async () => {
      try {
        const newCount = await apiGet<number>('historial_count', { fecha: historialFecha.value })
        historialLastChecked.value = new Date()
        if (newCount !== lastKnownHistorialCount.value) {
          lastKnownHistorialCount.value = newCount
          historialCount.value = newCount
          await loadHistorial()
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
    await Promise.all([loadMeta(), loadPedidosAll(), loadHistorial(), loadHistorialCount()])
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
    lastKnownHistorialCount,
    historialLastChecked,
    pageSize,
    loadMeta,
    loadPedidosAll,
    loadHistorial,
    loadHistorialCount,
    startHistorialPolling,
    stopHistorialPolling,
    loadAll,
    refresh,
  }
})
