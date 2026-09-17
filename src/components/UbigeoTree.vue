<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { CheckCheck, ChevronDown, ChevronRight, Eye, EyeOff, House, Inbox, MapPin, Store, User } from 'lucide-vue-next'
import { useEstadoStore } from '../stores/estado.store'
import { useFiltrosStore } from '../stores/filtros.store'
import { useModal } from '../services/modal.service'
import type { UbigeoGroup, AgenciaGroup, ClienteGroup, PedidoItems } from '../utils/pedido-utils'

const props = defineProps<{
  mode: 'prepare' | 'dispatch'
  groups: UbigeoGroup[]
  loading: boolean
}>()

const estado = useEstadoStore()
const filtrosStore = useFiltrosStore()
const modal = useModal()

const expandedUbigeos = ref(new Set<string>())
const expandedAgencias = ref(new Set<string>())
const expandedClientes = ref(new Set<string>())

const emptyText = computed(() =>
  props.mode === 'prepare'
    ? 'No hay pedidos para esta combinación de filtros'
    : 'No hay pedidos preparados para despachar',
)

function isUbigeoOpen(ubigeo: string) { return expandedUbigeos.value.has(ubigeo) }
function isAgenciaOpen(key: string) { return expandedAgencias.value.has(key) }
function isClienteOpen(key: string) { return expandedClientes.value.has(key) }

function toggleUbigeo(ubigeo: string) {
  const next = new Set(expandedUbigeos.value)
  if (next.has(ubigeo)) next.delete(ubigeo); else next.add(ubigeo)
  expandedUbigeos.value = next
}

function toggleAgencia(key: string) {
  const next = new Set(expandedAgencias.value)
  if (next.has(key)) next.delete(key); else next.add(key)
  expandedAgencias.value = next
}

function toggleCliente(key: string) {
  const next = new Set(expandedClientes.value)
  if (next.has(key)) next.delete(key); else next.add(key)
  expandedClientes.value = next
}

function agenciaKey(g: UbigeoGroup, a: AgenciaGroup) { return g.ubigeo + '\u0000' + a.agencia }
function clienteKey(g: UbigeoGroup, a: AgenciaGroup, c: ClienteGroup) { return g.ubigeo + '\u0000' + a.agencia + '\u0000' + c.cliente }

function ubigeoPrepared(g: UbigeoGroup) {
  let count = 0
  for (const a of g.agencias) for (const c of a.clientes) for (const p of c.pedidos) if (estado.isPrepared(p.pedido)) count++
  return count
}

function agenciaPrepared(_g: UbigeoGroup, a: AgenciaGroup) {
  let count = 0
  for (const c of a.clientes) for (const p of c.pedidos) if (estado.isPrepared(p.pedido)) count++
  return count
}

function allPrepared(g: UbigeoGroup) { return ubigeoPrepared(g) === g.total }
function clienteAllPrepared(c: ClienteGroup) { return c.pedidos.every((p) => estado.isPrepared(p.pedido)) }

function prepareAll(g: UbigeoGroup) {
  for (const a of g.agencias) for (const c of a.clientes) for (const pi of c.pedidos) {
    if (!estado.isPrepared(pi.pedido)) estado.togglePrepare(pi.pedido, pi.items)
  }
}

function cartCount(g: UbigeoGroup) {
  let count = 0
  for (const a of g.agencias) for (const c of a.clientes) for (const p of c.pedidos) if (estado.isInCart(p.pedido)) count++
  return count
}

function processedCount(g: UbigeoGroup) {
  let count = 0
  for (const a of g.agencias) for (const c of a.clientes) for (const p of c.pedidos) if (estado.isProcessed(p.pedido)) count++
  return count
}

function pedInCart(pi: PedidoItems) { return estado.isInCart(pi.pedido) }
function pedProcessed(pi: PedidoItems) { return estado.isProcessed(pi.pedido) }
function isPrepared(pi: PedidoItems) { return estado.isPrepared(pi.pedido) }

function fecha(pi: PedidoItems) {
  const f = props.mode === 'prepare' ? filtrosStore.prep : filtrosStore.desp
  const item = pi.items[0]
  return f.campoFecha === 'FECHAENTREGA' ? (item.fechaEntrega || '') : (item.fecha || '')
}

function cantEspumas(pi: PedidoItems) {
  return pi.items
    .filter((i) => i.linea.includes('ESPUMA') && i.producto.toUpperCase().includes('COLCHON'))
    .reduce((acc, curr) => acc + (curr.cantidad || 0), 0)
}

function cantResortes(pi: PedidoItems) {
  return pi.items
    .filter((i) => i.linea.includes('RESORTE'))
    .reduce((acc, curr) => acc + (curr.cantidad || 0), 0)
}

function togglePrepare(pi: PedidoItems) {
  estado.togglePrepare(pi.pedido, pi.items)
}

function addToCart(pi: PedidoItems) {
  if (!pedInCart(pi) && !pedProcessed(pi)) {
    estado.addToCart(pi.items)
  }
}

function showObs(pi: PedidoItems) {
  const obs = pi.items[0].observacion?.trim()
  if (obs) modal.info('Observación', obs)
}

function showDir(pi: PedidoItems) {
  const dir = pi.items[0].direccion?.trim()
  if (dir) modal.info('Dirección de Llegada', dir)
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div v-if="loading" class="p-2">
      <div class="skeleton skeleton-block"></div>
      <div class="skeleton skeleton-block" style="height: 36px"></div>
      <div class="skeleton skeleton-block" style="height: 36px"></div>
      <div class="skeleton skeleton-block" style="height: 36px"></div>
    </div>

    <div v-else-if="groups.length === 0" class="py-5 text-center text-sm text-slate-500" role="status">
      <Inbox :size="32" :stroke-width="1.5" class="mx-auto mb-2 opacity-40" />
      {{ emptyText }}
    </div>

    <div v-else class="flex-1 overflow-auto p-1" role="tree" aria-label="Árbol de pedidos por ubicación">
      <div v-for="g in groups" :key="g.ubigeo" class="mb-2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <button
          type="button"
          class="flex min-h-11 w-full items-center justify-between gap-2 bg-indigo-600 px-3 py-2 text-left text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          :aria-expanded="isUbigeoOpen(g.ubigeo)"
          :aria-label="g.ubigeo + ', ' + g.total + ' pedidos'"
          @click="toggleUbigeo(g.ubigeo)"
        >
          <span class="flex min-w-0 items-center gap-1.5">
            <MapPin :size="15" :stroke-width="2" />
            <span class="truncate">{{ g.ubigeo }}</span>
            <template v-if="mode === 'prepare'">
              <span class="badge badge-white ml-1">{{ ubigeoPrepared(g) }}/{{ g.total }}</span>
              <span v-if="cartCount(g) > 0" class="badge badge-success ml-1">{{ cartCount(g) }}</span>
            </template>
            <template v-else>
              <span class="badge badge-white ml-1">{{ g.total }}</span>
              <span v-if="cartCount(g) > 0" class="badge badge-success ml-1">{{ cartCount(g) }}</span>
              <span v-if="processedCount(g) > 0" class="badge badge-slate ml-1 opacity-70">{{ processedCount(g) }} en ruta</span>
            </template>
          </span>
          <ChevronDown :size="16" :stroke-width="2" class="shrink-0 transition-transform" :class="isUbigeoOpen(g.ubigeo) ? 'rotate-180' : ''" />
        </button>

        <div v-if="isUbigeoOpen(g.ubigeo)" class="bg-white p-1 dark:bg-slate-900">
          <div v-if="mode === 'prepare' && !allPrepared(g)" class="mb-1 flex justify-end">
            <button type="button" class="btn btn-primary btn-xs" @click="prepareAll(g)">
              <CheckCheck :size="13" :stroke-width="2" />Preparar todos
            </button>
          </div>
          <div v-for="a in g.agencias" :key="a.agencia" class="mb-1 overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
            <button
              type="button"
              class="flex min-h-9 w-full items-center gap-1.5 px-2 py-1 text-left text-xs font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              :aria-expanded="isAgenciaOpen(agenciaKey(g, a))"
              @click="toggleAgencia(agenciaKey(g, a))"
            >
              <ChevronRight :size="14" :stroke-width="2" class="transition-transform" :class="isAgenciaOpen(agenciaKey(g, a)) ? 'rotate-chevron' : ''" />
              <Store :size="13" :stroke-width="2" />
              <span class="truncate">{{ a.agencia }}</span>
              <span v-if="mode === 'prepare'" class="badge badge-slate ml-1">{{ agenciaPrepared(g, a) }}/{{ a.total }}</span>
              <span v-else class="badge badge-slate ml-1">{{ a.total }} ped.</span>
            </button>
            <div v-if="isAgenciaOpen(agenciaKey(g, a))" class="p-1">
              <div v-for="c in a.clientes" :key="c.cliente" class="mb-1 ml-1 mr-1 rounded-md border-l-4 border-indigo-500 bg-white p-1 shadow-sm dark:bg-slate-900">
                <div
                  class="flex min-h-11 cursor-pointer items-center justify-start gap-1 text-sm font-semibold text-indigo-600 dark:text-indigo-400"
                  role="button"
                  tabindex="0"
                  :aria-expanded="isClienteOpen(clienteKey(g, a, c))"
                  @click="toggleCliente(clienteKey(g, a, c))"
                >
                  <ChevronRight :size="15" :stroke-width="2" class="transition-transform" :class="isClienteOpen(clienteKey(g, a, c)) ? 'rotate-chevron' : ''" />
                  <User :size="14" :stroke-width="2" />
                  <span class="truncate">{{ c.cliente }}</span>
                  <span v-if="mode === 'prepare' && clienteAllPrepared(c)" class="badge badge-success">✓</span>
                  <small class="ml-auto mr-1 whitespace-nowrap text-xs font-normal text-slate-500">{{ c.total }} ped.</small>
                </div>
                <div v-if="isClienteOpen(clienteKey(g, a, c))">
                  <div v-for="pi in c.pedidos" :key="pi.pedido" class="mb-1 border-b border-slate-200 last:mb-0 dark:border-slate-700"
                    :class="{
                      'border-l-4 border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10': pedInCart(pi),
                      'border-l-4 border-slate-400 bg-slate-100 dark:bg-slate-800': pedProcessed(pi) && !pedInCart(pi),
                    }"
                  >
                    <div class="flex items-center gap-1.5 bg-slate-100 px-2 py-1 dark:bg-slate-800">
                      <span
                        class="font-mono min-w-0 truncate text-sm font-semibold text-slate-800 dark:text-slate-100"
                        :class="{ 'line-through': pedProcessed(pi) }"
                      >{{ pi.pedido }}</span>
                      <span v-if="pedInCart(pi)" class="badge badge-success">✓ LISTA</span>
                      <span v-else-if="pedProcessed(pi)" class="badge badge-slate">EN RUTA</span>
                      <span class="badge badge-slate">{{ fecha(pi) }}</span>
                      <span class="badge badge-amber">{{ pi.items[0].estado }}</span>
                      <span v-if="cantEspumas(pi) > 0" class="badge badge-espuma">E:{{ cantEspumas(pi) }}</span>
                      <span v-if="cantResortes(pi) > 0" class="badge badge-resorte">R:{{ cantResortes(pi) }}</span>
                      <span class="ml-auto flex shrink-0 items-center gap-1">
                        <button type="button" class="btn btn-ghost btn-icon-sm" :aria-label="'Ver dirección del pedido ' + pi.pedido" @click="showDir(pi)">
                          <House :size="15" :stroke-width="2" :class="pi.items[0].direccion.trim() ? 'text-indigo-600 dark:text-indigo-400' : 'opacity-25'" />
                        </button>
                        <button type="button" class="btn btn-ghost btn-icon-sm" :aria-label="'Ver observación del pedido ' + pi.pedido" @click="showObs(pi)">
                          <Eye v-if="pi.items[0].observacion.trim()" :size="15" :stroke-width="2" class="text-red-600 dark:text-red-400" />
                          <EyeOff v-else :size="15" :stroke-width="2" class="opacity-25" />
                        </button>
                      </span>
                      <span class="badge badge-slate">{{ pi.items.length }} it.</span>
                    </div>
                    <div class="bg-white dark:bg-slate-900">
                      <table class="table text-xs">
                        <tr v-for="i in pi.items" :key="i.idUnico" class="border-t border-slate-200 first:border-t-0 dark:border-slate-700">
                          <td class="pl-3">{{ i.producto }}</td>
                          <td class="w-10 text-center font-bold text-indigo-600 dark:text-indigo-400">{{ i.cantidad }}</td>
                        </tr>
                      </table>
                      <div v-if="mode === 'prepare'" class="flex gap-1">
                        <button
                          type="button"
                          class="btn flex-1 justify-center rounded-md"
                          :class="isPrepared(pi) ? 'btn-success' : 'btn-outline'"
                          @click="togglePrepare(pi)"
                        >
                          {{ isPrepared(pi) ? '✓ Preparado' : 'Preparar' }}
                        </button>
                        <button
                          type="button"
                          class="btn btn-outline flex-1 justify-center rounded-md"
                          :class="{
                            'text-emerald-600 dark:text-emerald-400': pedInCart(pi),
                            'text-slate-400': pedProcessed(pi),
                          }"
                          :disabled="pedInCart(pi) || pedProcessed(pi)"
                          @click="addToCart(pi)"
                        >
                          <template v-if="pedInCart(pi)">EN LISTA ✓</template>
                          <template v-else-if="pedProcessed(pi)">EN RUTA</template>
                          <template v-else>AGREGAR (+)</template>
                        </button>
                      </div>
                      <button
                        v-else
                        type="button"
                        class="btn btn-outline w-full justify-center rounded-md"
                        :class="{
                          'text-emerald-600 dark:text-emerald-400': pedInCart(pi),
                          'text-slate-400': pedProcessed(pi),
                        }"
                        :disabled="pedInCart(pi) || pedProcessed(pi)"
                        @click="addToCart(pi)"
                      >
                        <template v-if="pedInCart(pi)">EN LISTA ✓</template>
                        <template v-else-if="pedProcessed(pi)">EN RUTA</template>
                        <template v-else>AGREGAR (+)</template>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
