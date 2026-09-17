<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import Sortable from 'sortablejs'
import { CircleX, GripVertical, Inbox, LoaderCircle, Printer, RotateCcw, ShoppingCart, Store, User } from 'lucide-vue-next'
import { useEstadoStore } from '../stores/estado.store'
import { useResourcesStore } from '../stores/resources.store'
import { apiPost } from '../api/api.service'
import { generar } from '../services/print.service'
import { useModal } from '../services/modal.service'
import { useToast } from '../composables/useToast'
import type { Pedido } from '../models/pedido.model'
import type { GuardarResult } from '../models/despacho.model'
import type { AgenciaGroup, ClienteGroup } from '../utils/pedido-utils'

interface CartPedido {
  pedido: string
  items: Pedido[]
}

const estado = useEstadoStore()
const resources = useResourcesStore()
const { cart, cartPedidoCount, totalEspuma, totalResorte, chofer, placa } = storeToRefs(estado)
const modal = useModal()
const toast = useToast()
const saving = ref(false)
const closedCartClientes = ref(new Set<string>())
const closedCartAgencias = ref(new Set<string>())

const total = computed(() => resources.meta?.totalPedidos ?? 0)
const choferes = computed(() => resources.meta?.choferes ?? [])
const placas = computed(() => resources.meta?.placas ?? [])
const pct = computed(() => total.value > 0 ? Math.round((cartPedidoCount.value / total.value) * 100) : 0)

const cartAgencias = computed<AgenciaGroup[]>(() => {
  const byAgencia = new Map<string, Map<string, Map<string, Pedido[]>>>()

  for (const item of cart.value) {
    let agMap = byAgencia.get(item.agencia)
    if (!agMap) { agMap = new Map(); byAgencia.set(item.agencia, agMap) }
    let cliMap = agMap.get(item.cliente)
    if (!cliMap) { cliMap = new Map(); agMap.set(item.cliente, cliMap) }
    let pedList = cliMap.get(item.pedido)
    if (!pedList) { pedList = []; cliMap.set(item.pedido, pedList) }
    pedList.push(item)
  }

  const groups: AgenciaGroup[] = []
  for (const [agencia, clientesMap] of byAgencia) {
    const clienteGroups: ClienteGroup[] = []
    for (const [cliente, pedidosMap] of clientesMap) {
      const pedidos: CartPedido[] = Array.from(pedidosMap.entries()).map(([pedido, items]) => ({
        pedido,
        items: items.slice().sort((a, b) => a.producto.localeCompare(b.producto)),
      }))
      pedidos.sort((a, b) => a.pedido.localeCompare(b.pedido))
      clienteGroups.push({ cliente, agencia, pedidos, total: pedidos.length })
    }
    clienteGroups.sort((a, b) => a.cliente.localeCompare(b.cliente))
    const total = clienteGroups.reduce((acc, c) => acc + c.total, 0)
    groups.push({ agencia, clientes: clienteGroups, total })
  }
  groups.sort((a, b) => a.agencia.localeCompare(b.agencia))
  return groups
})

const sortables: Sortable[] = []

function initSortables() {
  destroySortables()

  const mainEl = document.getElementById('cartList')
  if (mainEl) {
    sortables.push(Sortable.create(mainEl, {
      handle: '.cart-agencia-header',
      ghostClass: 'sortable-ghost',
      animation: 150,
      onEnd: () => reorderFromDom(),
    }))
  }

  const agenciaBodies = mainEl?.querySelectorAll('.cart-agencia-body')
  agenciaBodies?.forEach((el) => {
    sortables.push(Sortable.create(el as HTMLElement, {
      handle: '.cart-client-header',
      ghostClass: 'sortable-ghost',
      animation: 150,
      onEnd: () => reorderFromDom(),
    }))
  })
}

function destroySortables() {
  sortables.forEach((s) => s.destroy())
  sortables.length = 0
}

function reorderFromDom() {
  const mainEl = document.getElementById('cartList')
  if (!mainEl) return

  const ordered: Pedido[] = []
  const agenciaEls = mainEl.querySelectorAll(':scope > .cart-agencia')
  agenciaEls.forEach((agEl) => {
    const clientEls = agEl.querySelectorAll('.cart-agencia-body > .cart-cliente')
    clientEls.forEach((cliEl) => {
      const pedidoEls = cliEl.querySelectorAll('.cart-pedido')
      pedidoEls.forEach((pedEl) => {
        const id = Number((pedEl as HTMLElement).dataset.id)
        const found = cart.value.find((i) => i.idUnico === id)
        if (found) ordered.push(found)
      })
    })
  })

  if (ordered.length === cart.value.length) {
    estado.setCartOrder(ordered)
    estado.persistCart()
  }
}

watch([cart, closedCartAgencias], () => {
  nextTick(() => initSortables())
})

onMounted(() => {
  nextTick(() => initSortables())
})

function isCartClienteOpen(cliente: string): boolean {
  return !closedCartClientes.value.has(cliente)
}

function isCartAgenciaOpen(agencia: string): boolean {
  return !closedCartAgencias.value.has(agencia)
}

function toggleCartCliente(cliente: string) {
  const next = new Set(closedCartClientes.value)
  if (next.has(cliente)) next.delete(cliente)
  else next.add(cliente)
  closedCartClientes.value = next
}

function toggleCartAgencia(agencia: string) {
  const next = new Set(closedCartAgencias.value)
  if (next.has(agencia)) next.delete(agencia)
  else next.add(agencia)
  closedCartAgencias.value = next
}

function removeFromCart(idUnico: number) {
  estado.removeFromCart(idUnico)
}

async function reiniciar() {
  const ok = await modal.confirm('Reiniciar sesión', '¿Estás seguro? Se perderán todos los pedidos seleccionados y el despacho actual.', { confirmLabel: 'Sí, reiniciar' })
  if (ok) estado.resetSession()
}

async function guardarYGenerar() {
  if (!chofer.value) { toast.show('Selecciona un chofer', 'warning'); return }
  if (!placa.value) { toast.show('Selecciona una placa', 'warning'); return }
  if (cart.value.length === 0) { toast.show('El carrito está vacío', 'warning'); return }

  saving.value = true
  try {
    const res = await apiPost<GuardarResult>('guardar', {
      chofer: chofer.value,
      placa: placa.value,
      items: cart.value,
    })
    const prep = estado.markDispatched(cart.value)
    estado.recordDispatchPrepared(res.id, prep)
    generar({ ...res, pedidosCount: cartPedidoCount.value })
    toast.show('Despacho guardado e imprimir hoja generada', 'success')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error al guardar'
    toast.showError(msg, guardarYGenerar)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex h-full flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">

    <!-- Header -->
    <div class="flex items-center gap-2 bg-indigo-600 px-3 py-2.5 text-white shadow-sm">
      <ShoppingCart :size="18" :stroke-width="2" />
      <span class="text-sm font-bold tracking-wide">Preparación</span>
      <span class="badge badge-espuma ml-auto">{{ totalEspuma }} Esp</span>
      <span class="badge badge-resorte">{{ totalResorte }} Res</span>
      <button
        type="button"
        class="ml-1 rounded p-1 text-white/70 hover:bg-white/10 hover:text-white"
        title="Reiniciar sesión"
        @click="reiniciar()"
      >
        <RotateCcw :size="15" :stroke-width="2" />
      </button>
    </div>

    <!-- Chofer & Placa -->
    <div class="grid grid-cols-2 gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
      <div>
        <label class="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Chofer</label>
        <select v-model="chofer" class="select text-xs">
          <option value="">Seleccionar...</option>
          <option v-for="c in choferes" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>
      <div>
        <label class="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Placa</label>
        <select v-model="placa" class="select text-xs">
          <option value="">Seleccionar...</option>
          <option v-for="p in placas" :key="p" :value="p">{{ p }}</option>
        </select>
      </div>
    </div>

    <!-- Progress bar -->
    <div class="border-b border-slate-200 px-3 py-2 dark:border-slate-800">
      <div class="mb-1 flex items-center justify-between text-[10px] font-semibold text-slate-500">
        <span>{{ cartPedidoCount }} / {{ total }} pedidos</span>
        <span>{{ pct }}%</span>
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          class="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300"
          :style="{ width: pct + '%' }"
        ></div>
      </div>
    </div>

    <!-- Cart list -->
    <div id="cartList" class="flex-1 overflow-y-auto px-3 py-2">

      <!-- Empty state -->
      <div v-if="cart.length === 0" class="flex flex-col items-center justify-center py-16 text-slate-400">
        <Inbox :size="40" :stroke-width="1.5" class="mb-3" />
        <p class="text-center text-sm">Selecciona pedidos del panel izquierdo</p>
      </div>

      <!-- Agencia groups -->
      <div
        v-for="agencia in cartAgencias"
        :key="agencia.agencia"
        class="cart-agencia mb-3 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
      >
        <!-- Agencia header -->
        <div
          class="cart-agencia-header flex cursor-pointer items-center gap-2 bg-slate-50 px-3 py-2 select-none dark:bg-slate-800"
          @click="toggleCartAgencia(agencia.agencia)"
        >
          <GripVertical :size="14" :stroke-width="2" class="drag-handle shrink-0 text-slate-400" />
          <Store :size="14" :stroke-width="2" class="shrink-0 text-indigo-500" />
          <span class="truncate text-xs font-bold text-slate-700 dark:text-slate-200">{{ agencia.agencia }}</span>
          <span class="ml-auto shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
            {{ agencia.total }}
          </span>
        </div>

        <!-- Agencia body -->
        <div v-if="isCartAgenciaOpen(agencia.agencia)" class="cart-agencia-body border-t border-slate-100 dark:border-slate-700">
          <div
            v-for="cliente in agencia.clientes"
            :key="cliente.cliente"
            class="cart-cliente border-b border-slate-100 last:border-b-0 dark:border-slate-700/50"
          >
            <!-- Cliente header -->
            <div
              class="cart-client-header flex cursor-pointer items-center gap-2 px-3 py-1.5 select-none hover:bg-slate-50 dark:hover:bg-slate-800/50"
              @click="toggleCartCliente(cliente.cliente)"
            >
              <GripVertical :size="12" :stroke-width="2" class="drag-handle shrink-0 text-slate-300" />
              <User :size="12" :stroke-width="2" class="shrink-0 text-slate-400" />
              <span class="truncate text-[11px] font-semibold text-slate-600 dark:text-slate-300">{{ cliente.cliente }}</span>
              <span class="ml-auto shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                {{ cliente.total }}
              </span>
            </div>

            <!-- Pedido items -->
            <div v-if="isCartClienteOpen(cliente.cliente)" class="px-3 pb-2">
              <div
                v-for="pedido in cliente.pedidos"
                :key="pedido.pedido"
                class="cart-pedido mt-1 rounded-md bg-slate-50 px-2 py-1.5 dark:bg-slate-800/60"
                :data-id="pedido.items[0]?.idUnico"
              >
                <div class="mb-1 flex items-center justify-between">
                  <span class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">#{{ pedido.pedido }}</span>
                </div>
                <div v-for="item in pedido.items" :key="item.idUnico" class="flex items-center gap-1.5 py-0.5">
                  <span class="shrink-0 rounded bg-indigo-100 px-1 py-px text-[9px] font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                    {{ item.cantidad }}
                  </span>
                  <span class="min-w-0 flex-1 truncate text-[11px] text-slate-600 dark:text-slate-300">{{ item.producto }}</span>
                  <button
                    type="button"
                    class="shrink-0 rounded p-0.5 text-slate-400 hover:bg-red-100 hover:text-red-500"
                    title="Quitar del carrito"
                    @click.stop="removeFromCart(item.idUnico)"
                  >
                    <CircleX :size="12" :stroke-width="2" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="border-t border-slate-200 px-3 py-3 dark:border-slate-800">
      <div class="mb-2 flex items-center justify-between text-xs text-slate-500">
        <span>{{ cartPedidoCount }} pedidos</span>
      </div>
      <button
        type="button"
        class="btn btn-accent w-full shadow-sm"
        :disabled="saving || cart.length === 0"
        @click="guardarYGenerar()"
      >
        <LoaderCircle v-if="saving" :size="16" :stroke-width="2" class="mr-2 animate-spin" />
        <Printer v-else :size="16" :stroke-width="2" class="mr-2" />
        IMPRIMIR HOJA
      </button>
    </div>

  </div>
</template>
