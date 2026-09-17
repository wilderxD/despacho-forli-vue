import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Pedido } from '../models/pedido.model'
import type { DispatchPrep, ProcessedEntry } from '../models/despacho.model'

const K_PREPARED = 'forli_prepared_items'
const K_CART = 'forli_cart'
const K_PROCESSED = 'forli_processed'
const K_DISPATCH_PREFIX = 'forli_dispatch_prep_'

function readJson<T>(k: string): T | null {
  try {
    const raw = sessionStorage.getItem(k)
    return raw ? JSON.parse(raw) as T : null
  } catch { return null }
}

export const useEstadoStore = defineStore('estado', () => {
  const preparedItems = ref<Pedido[]>([])
  const cart = ref<Pedido[]>([])
  const processed = ref<ProcessedEntry[]>([])
  const dispatchPrepared = ref<Record<string, DispatchPrep>>({})
  const chofer = ref('')
  const placa = ref('')

  const preparedPeds = computed(() => new Set(preparedItems.value.map((i) => i.pedido)))
  const preparedCount = computed(() => preparedPeds.value.size)
  const cartPedidoCount = computed(() => new Set(cart.value.map((i) => i.pedido)).size)

  const totalEspuma = computed(() =>
    cart.value
      .filter((i) => i.linea.includes('ESPUMA') && i.producto.toUpperCase().includes('COLCHON'))
      .reduce((acc, curr) => acc + (curr.cantidad || 0), 0),
  )
  const totalResorte = computed(() =>
    cart.value.filter((i) => i.linea.includes('RESORTE')).reduce((acc, curr) => acc + (curr.cantidad || 0), 0),
  )

  function loadFromSession() {
    const prepared = readJson<Pedido[]>(K_PREPARED)
    if (Array.isArray(prepared)) preparedItems.value = prepared

    const cartData = readJson<Pedido[]>(K_CART)
    if (Array.isArray(cartData)) cart.value = cartData

    const processedData = readJson<ProcessedEntry[]>(K_PROCESSED)
    if (Array.isArray(processedData)) processed.value = processedData

    const dispatch: Record<string, DispatchPrep> = {}
    try {
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith(K_DISPATCH_PREFIX))
        .forEach((k) => {
          const v = readJson<DispatchPrep>(k)
          if (v && v.total !== undefined) dispatch[k.replace(K_DISPATCH_PREFIX, '')] = v
        })
    } catch { /* ignore */ }
    dispatchPrepared.value = dispatch
  }

  loadFromSession()

  // Persistence watchers
  watch(preparedItems, (v) => {
    try { sessionStorage.setItem(K_PREPARED, JSON.stringify(v)) } catch { /* ignore */ }
  }, { deep: true })

  watch(cart, (v) => {
    try { sessionStorage.setItem(K_CART, JSON.stringify(v)) } catch { /* ignore */ }
  }, { deep: true })

  watch(processed, (v) => {
    try { sessionStorage.setItem(K_PROCESSED, JSON.stringify(v)) } catch { /* ignore */ }
  }, { deep: true })

  function isPrepared(pedido: string): boolean {
    return preparedPeds.value.has(pedido)
  }

  function togglePrepare(pedido: string, items: Pedido[]): boolean {
    const was = isPrepared(pedido)
    if (was) {
      preparedItems.value = preparedItems.value.filter((i) => i.pedido !== pedido)
    } else {
      const existing = new Set(preparedItems.value.map((i) => i.pedido))
      if (!existing.has(pedido)) {
        preparedItems.value = [...preparedItems.value, ...items]
      }
    }
    return !was
  }

  function addToCart(items: Pedido[]) {
    const existing = new Set(cart.value.map((i) => i.idUnico))
    const nuevos = items.filter((i) => !existing.has(i.idUnico))
    if (nuevos.length) cart.value = [...cart.value, ...nuevos]
  }

  function removeFromCart(idUnico: number) {
    cart.value = cart.value.filter((i) => i.idUnico !== idUnico)
  }

  function isInCart(pedido: string): boolean {
    return cart.value.some((i) => i.pedido === pedido)
  }

  function isProcessed(pedido: string): boolean {
    return processed.value.some((p) => p.pedido === pedido)
  }

  function setCartOrder(items: Pedido[]) {
    cart.value = items
  }

  function resetSession() {
    cart.value = []
    processed.value = []
    preparedItems.value = []
    chofer.value = ''
    placa.value = ''
    try {
      sessionStorage.removeItem(K_CART)
      sessionStorage.removeItem(K_PROCESSED)
      sessionStorage.removeItem(K_PREPARED)
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith(K_DISPATCH_PREFIX))
        .forEach((k) => sessionStorage.removeItem(k))
    } catch { /* ignore */ }
    dispatchPrepared.value = {}
  }

  function markDispatched(items: Pedido[]): DispatchPrep {
    const seen = new Set<string>()
    items.forEach((i) => seen.add(i.pedido))

    const preSnapshot = new Set(preparedItems.value.map((i) => i.pedido))
    const preparedPedsArr: string[] = []
    const notPreparedPedsArr: string[] = []
    seen.forEach((ped) => (preSnapshot.has(ped) ? preparedPedsArr.push(ped) : notPreparedPedsArr.push(ped)))

    const entries = new Map<string, string>()
    items.forEach((i) => {
      if (!entries.has(i.pedido)) entries.set(i.pedido, i.ubigeo)
    })
    const nuevosProcesados: ProcessedEntry[] = []
    entries.forEach((ubigeo, pedido) => nuevosProcesados.push({ pedido, ubigeo }))
    processed.value = [...processed.value, ...nuevosProcesados]

    cart.value = []

    return { total: seen.size, prepared: preparedPedsArr.length, preparedPeds: preparedPedsArr, notPreparedPeds: notPreparedPedsArr }
  }

  function recordDispatchPrepared(id: string, data: DispatchPrep) {
    dispatchPrepared.value = { ...dispatchPrepared.value, [id]: data }
    try { sessionStorage.setItem(K_DISPATCH_PREFIX + id, JSON.stringify(data)) } catch { /* ignore */ }
  }

  function removeDispatchPrepared(id: string) {
    const next = { ...dispatchPrepared.value }
    delete next[id]
    dispatchPrepared.value = next
    try { sessionStorage.removeItem(K_DISPATCH_PREFIX + id) } catch { /* ignore */ }
  }

  function loadToCart(items: Pedido[]) {
    addToCart(items)
  }

  function persistCart() {
    try { sessionStorage.setItem(K_CART, JSON.stringify(cart.value)) } catch { /* ignore */ }
  }

  return {
    preparedItems,
    cart,
    processed,
    dispatchPrepared,
    chofer,
    placa,
    preparedPeds,
    preparedCount,
    cartPedidoCount,
    totalEspuma,
    totalResorte,
    isPrepared,
    togglePrepare,
    addToCart,
    removeFromCart,
    isInCart,
    isProcessed,
    setCartOrder,
    resetSession,
    markDispatched,
    recordDispatchPrepared,
    removeDispatchPrepared,
    loadToCart,
    persistCart,
  }
})
