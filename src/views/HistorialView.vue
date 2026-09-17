<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Clock,
  Pencil,
  Printer,
  RefreshCw,
  Trash2,
} from 'lucide-vue-next'
import { useResourcesStore } from '../stores/resources.store'
import { useEstadoStore } from '../stores/estado.store'
import { apiPost } from '../api/api.service'
import { reimprimir } from '../services/print.service'
import { useModal } from '../services/modal.service'
import { useToast } from '../composables/useToast'
import type { HistorialRecord } from '../models/despacho.model'
import { ApiError } from '../api/api-error'

const router = useRouter()
const resourcesStore = useResourcesStore()
const estadoStore = useEstadoStore()
const modal = useModal()
const toast = useToast()

const openDetails = ref(new Set<string>())

const registros = computed(() => resourcesStore.historial)
const total = computed(() => resourcesStore.historialCount)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / resourcesStore.pageSize)))

const pages = computed(() => {
  const current = resourcesStore.historialPage
  const last = totalPages.value
  if (last <= 5) {
    return Array.from({ length: last }, (_, i) => i + 1)
  }
  const result: (number | -1)[] = []
  result.push(1)
  if (current > 3) result.push(-1)
  const start = Math.max(2, current - 1)
  const end = Math.min(last - 1, current + 1)
  for (let i = start; i <= end; i++) {
    result.push(i)
  }
  if (current < last - 2) result.push(-1)
  result.push(last)
  return result
})

const historialFecha = computed({
  get: () => resourcesStore.historialFecha,
  set: (value: string) => {
    resourcesStore.historialFecha = value
  },
})

function setFecha(value: string) {
  resourcesStore.historialFecha = value
  resourcesStore.historialPage = 1
}

function goTo(page: number) {
  resourcesStore.historialPage = page
}

function toggleDetail(id: string) {
  if (openDetails.value.has(id)) {
    openDetails.value.delete(id)
  } else {
    openDetails.value.add(id)
  }
}

function prepInfo(r: HistorialRecord) {
  return estadoStore.dispatchPrepared[r.id]
}

function pctPrepared(prepared: number, total: number): number {
  return Math.round((prepared / total) * 100)
}

function handleReimprimir(r: HistorialRecord) {
  reimprimir(r)
}

async function editar(r: HistorialRecord) {
  const confirmed = await modal.confirm('¿Desea editar este despacho?')
  if (!confirmed) return
  try {
    await resourcesStore.loadToCart(r.id)
    resourcesStore.choferSeleccionado = r.chofer
    resourcesStore.placaSeleccionada = r.placa
    router.push('/despachar')
    toast.show('Despacho cargado para edición', 'success')
  } catch (e) {
    toast.show('Error al cargar despacho', 'error')
  }
}

async function eliminar(r: HistorialRecord) {
  const confirmed = await modal.confirm('¿Está seguro de eliminar este despacho?')
  if (!confirmed) return
  try {
    await apiPost('eliminar', { id: r.id })
    estadoStore.removeDispatchPrepared(r.id)
    await resourcesStore.refresh()
    toast.show('Despacho eliminado', 'success')
  } catch (e) {
    if (e instanceof ApiError) {
      toast.show(e.message, 'error')
    } else {
      toast.show('Error al eliminar despacho', 'error')
    }
  }
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `hace ${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `hace ${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `hace ${hours}h`
}

onMounted(async () => {
  await Promise.all([
    resourcesStore.loadHistorial(),
    resourcesStore.loadHistorialCount(),
  ])
  resourcesStore.startHistorialPolling()
})

onUnmounted(() => {
  resourcesStore.stopHistorialPolling()
})

watch(
  () => resourcesStore.historialFecha,
  async () => {
    await Promise.all([
      resourcesStore.loadHistorial(),
      resourcesStore.loadHistorialCount(),
    ])
  }
)
</script>

<template>
  <div class="h-full min-h-0 flex flex-col p-3">
    <div class="flex flex-col min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div class="p-6 border-b border-slate-200">
        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <label class="text-sm font-medium text-slate-700">Fecha:</label>
          <input
            type="date"
            :value="historialFecha"
            @input="setFecha(($event.target as HTMLInputElement).value)"
            class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition"
          />
          <button
            @click="resourcesStore.refresh()"
            class="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition"
          >
            <RefreshCw class="w-4 h-4" />
            Recargar
          </button>
          <span
            v-if="resourcesStore.historialLastChecked"
            class="text-xs text-slate-400"
          >
            Actualizado {{ timeAgo(resourcesStore.historialLastChecked) }}
          </span>
        </div>
      </div>

      <div v-if="resourcesStore.historialLoading" class="p-6 space-y-3">
        <div v-for="i in 5" :key="i" class="h-12 bg-slate-100 rounded-lg animate-pulse" />
      </div>

      <div v-else-if="resourcesStore.historialError" class="p-6">
        <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {{ resourcesStore.historialError }}
        </div>
      </div>

      <template v-else>
        <div class="overflow-auto flex-1 min-h-0">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-slate-900 text-white">
                <th class="w-10 px-4 py-3"></th>
                <th class="px-4 py-3 text-left font-semibold">ID</th>
                <th class="px-4 py-3 text-left font-semibold">Fecha</th>
                <th class="px-4 py-3 text-left font-semibold">Chofer</th>
                <th class="px-4 py-3 text-left font-semibold">Placa</th>
                <th class="px-4 py-3 text-center font-semibold text-violet-300">C.E.</th>
                <th class="px-4 py-3 text-center font-semibold text-cyan-300">C.R.</th>
                <th class="px-4 py-3 text-center font-semibold">Prep.</th>
                <th class="px-4 py-3 text-center font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              <template v-for="r in registros" :key="r.id">
                <tr
                  class="hover:bg-slate-50 cursor-pointer transition"
                  @click="toggleDetail(r.id)"
                >
                  <td class="px-4 py-3 text-slate-400">
                    <ChevronRight
                      v-if="!openDetails.has(r.id)"
                      class="w-4 h-4"
                    />
                    <ChevronDown v-else class="w-4 h-4" />
                  </td>
                  <td class="px-4 py-3 font-mono text-xs text-slate-600">
                    {{ r.id }}
                  </td>
                  <td class="px-4 py-3 text-slate-700">{{ r.fecha }}</td>
                  <td class="px-4 py-3 text-slate-700">{{ r.chofer }}</td>
                  <td class="px-4 py-3 text-slate-700">{{ r.placa }}</td>
                  <td class="px-4 py-3 text-center font-semibold text-violet-600">
                    {{ r.cargaEntregada }}
                  </td>
                  <td class="px-4 py-3 text-center font-semibold text-cyan-600">
                    {{ r.cargaRecibida }}
                  </td>
                  <td class="px-4 py-3 text-center">
                    <template v-if="prepInfo(r)">
                      <span
                        :class="{
                          'text-green-600': pctPrepared(prepInfo(r).prepared, prepInfo(r).total) === 100,
                          'text-amber-600':
                            pctPrepared(prepInfo(r).prepared, prepInfo(r).total) > 0 &&
                            pctPrepared(prepInfo(r).prepared, prepInfo(r).total) < 100,
                          'text-slate-400':
                            pctPrepared(prepInfo(r).prepared, prepInfo(r).total) === 0,
                        }"
                        class="text-xs font-medium"
                      >
                        {{ prepInfo(r).prepared }}/{{ prepInfo(r).total }}
                        ({{ pctPrepared(prepInfo(r).prepared, prepInfo(r).total) }}%)
                      </span>
                    </template>
                    <span v-else class="text-slate-300">—</span>
                  </td>
                  <td class="px-4 py-3 text-center">
                    <div class="flex items-center justify-center gap-1" @click.stop>
                      <button
                        @click="handleReimprimir(r)"
                        class="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-violet-600 transition"
                        title="Reimprimir"
                      >
                        <Printer class="w-4 h-4" />
                      </button>
                      <button
                        @click="editar(r)"
                        class="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-blue-600 transition"
                        title="Editar"
                      >
                        <Pencil class="w-4 h-4" />
                      </button>
                      <button
                        @click="eliminar(r)"
                        class="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-red-600 transition"
                        title="Eliminar"
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="openDetails.has(r.id)">
                  <td colspan="9" class="px-4 py-4 bg-slate-50">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <h4 class="text-xs font-semibold text-slate-500 uppercase mb-2">
                          Preparados
                        </h4>
                        <ul
                          v-if="
                            prepInfo(r) &&
                            prepInfo(r).preparedItems &&
                            prepInfo(r).preparedItems.length > 0
                          "
                          class="space-y-1"
                        >
                          <li
                            v-for="item in prepInfo(r).preparedItems"
                            :key="item.articulo"
                            class="flex items-center gap-2 text-sm text-slate-700"
                          >
                            <CircleCheck class="w-4 h-4 text-green-500 flex-shrink-0" />
                            {{ item.articulo }} — {{ item.cantidad }}
                          </li>
                        </ul>
                        <p v-else class="text-sm text-slate-400">Sin artículos preparados</p>
                      </div>
                      <div>
                        <h4 class="text-xs font-semibold text-slate-500 uppercase mb-2">
                          No Preparados
                        </h4>
                        <ul
                          v-if="
                            prepInfo(r) &&
                            prepInfo(r).notPreparedItems &&
                            prepInfo(r).notPreparedItems.length > 0
                          "
                          class="space-y-1"
                        >
                          <li
                            v-for="item in prepInfo(r).notPreparedItems"
                            :key="item.articulo"
                            class="flex items-center gap-2 text-sm text-red-600"
                          >
                            <span class="w-4 h-4 flex-shrink-0 text-center text-xs">✕</span>
                            {{ item.articulo }} — {{ item.cantidad }}
                          </li>
                        </ul>
                        <p v-else class="text-sm text-slate-400">
                          Todos los artículos preparados
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <div
          v-if="registros.length === 0"
          class="p-12 flex flex-col items-center justify-center text-slate-400"
        >
          <Clock class="w-12 h-12 mb-4 text-slate-300" />
          <p class="text-sm">No hay despachos para esta fecha</p>
        </div>

        <div class="px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p class="text-sm text-slate-500">
            {{ total }} registros — Pág. {{ resourcesStore.historialPage }} de {{ totalPages }}
          </p>
          <div class="flex items-center gap-1">
            <button
              :disabled="resourcesStore.historialPage <= 1"
              @click="goTo(resourcesStore.historialPage - 1)"
              class="px-3 py-1.5 text-sm font-medium rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              Anterior
            </button>
            <template v-for="(p, idx) in pages" :key="idx">
              <span
                v-if="p === -1"
                class="px-2 py-1.5 text-sm text-slate-400"
              >
                …
              </span>
              <button
                v-else
                @click="goTo(p)"
                :class="[
                  'px-3 py-1.5 text-sm font-medium rounded-lg transition',
                  p === resourcesStore.historialPage
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700',
                ]"
              >
                {{ p }}
              </button>
            </template>
            <button
              :disabled="resourcesStore.historialPage >= totalPages"
              @click="goTo(resourcesStore.historialPage + 1)"
              class="px-3 py-1.5 text-sm font-medium rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              Siguiente
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
