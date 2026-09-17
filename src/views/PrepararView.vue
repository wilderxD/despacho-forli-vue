<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { ArrowRight, FolderTree, Search, ShoppingCart } from 'lucide-vue-next'
import FiltrosBar from '../components/FiltrosBar.vue'
import UbigeoTree from '../components/UbigeoTree.vue'
import CartPanel from '../components/CartPanel.vue'
import { useResourcesStore } from '../stores/resources.store'
import { useFiltrosStore } from '../stores/filtros.store'
import { useEstadoStore } from '../stores/estado.store'
import { agruparPorUbigeo, filtrarPedidos } from '../utils/pedido-utils'

const router = useRouter()
const resourcesStore = useResourcesStore()
const filtrosStore = useFiltrosStore()
const estadoStore = useEstadoStore()

const { prep } = storeToRefs(filtrosStore)
const activePanel = ref<'tree' | 'cart'>('tree')

const grupos = computed(() => {
  const all = resourcesStore.pedidosAll
  if (!all) return []
  const flat = Object.values(all.byUbigeo).flat()
  const iso = filtrosStore.isoFieldPrep
  const filt = filtrarPedidos(flat, prep.value, iso).filter((p) => !estadoStore.isProcessed(p.pedido))
  return agruparPorUbigeo(filt, prep.value.campoFecha)
})

const loading = computed(() => resourcesStore.pedidosAllLoading)
const total = computed(() => resourcesStore.meta?.totalPedidos ?? 0)
const prepared = computed(() => estadoStore.preparedCount)
const cartPedidoCount = computed(() => estadoStore.cartPedidoCount)
const lastUpdated = computed(() => resourcesStore.lastUpdated)

function setTexto(value: string) {
  filtrosStore.updatePrep({ texto: value })
}

function irADespachar() {
  router.push('/despachar')
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <FiltrosBar tab="prep" />

    <div class="flex border-b border-slate-200 bg-white lg:hidden dark:border-slate-800 dark:bg-slate-900" role="tablist">
      <button
        type="button"
        class="min-h-11 flex-1 px-3 text-sm font-semibold transition-colors"
        :class="activePanel === 'tree' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300'"
        @click="activePanel = 'tree'"
      >
        <span class="inline-flex items-center gap-1.5">
          <FolderTree :size="15" :stroke-width="2" />Pedidos
        </span>
      </button>
      <div class="w-px bg-slate-200 dark:bg-slate-700"></div>
      <button
        type="button"
        class="min-h-11 flex-1 px-3 text-sm font-semibold transition-colors"
        :class="activePanel === 'cart' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300'"
        @click="activePanel = 'cart'"
      >
        <span class="inline-flex items-center gap-1.5">
          <ShoppingCart :size="15" :stroke-width="2" />Preparación
          <span v-if="cartPedidoCount > 0" class="badge badge-white">{{ cartPedidoCount }}</span>
        </span>
      </button>
    </div>

    <div class="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div
        class="flex min-h-0 basis-full flex-col gap-2 overflow-y-auto border-b border-slate-200 p-3 dark:border-slate-700 lg:basis-1/2 lg:border-b-0 lg:border-r lg:p-3"
        :class="{ 'max-lg:hidden': activePanel === 'cart' }"
      >
        <div class="relative flex-shrink-0">
          <Search :size="16" :stroke-width="2" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="txtBuscarPrep"
            type="text"
            class="input pl-9"
            placeholder="Buscar Cliente, Pedido..."
            aria-label="Buscar Cliente o Pedido"
            :value="prep.texto"
            @input="setTexto(($event.target as HTMLInputElement).value)"
          />
        </div>

        <div class="flex flex-shrink-0 items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <small class="whitespace-nowrap font-semibold text-slate-600 dark:text-slate-300">{{ prepared }} / {{ total }} preparados</small>
            <small v-if="lastUpdated" class="whitespace-nowrap text-xs text-slate-400">· {{ new Date(lastUpdated).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) }}</small>
          </div>
          <button type="button" class="btn btn-primary whitespace-nowrap" @click="irADespachar()">
            Ir a Despachar <ArrowRight :size="15" :stroke-width="2" />
          </button>
        </div>

        <div class="min-h-0 flex-1">
          <UbigeoTree mode="prepare" :groups="grupos" :loading="loading" />
        </div>
      </div>

      <div
        class="flex min-h-0 basis-full flex-col bg-white dark:bg-slate-900 lg:basis-1/2"
        :class="{ 'max-lg:hidden': activePanel === 'tree' }"
      >
        <CartPanel />
      </div>
    </div>
  </div>
</template>
