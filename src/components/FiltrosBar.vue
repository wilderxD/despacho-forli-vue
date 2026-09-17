<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { ChevronDown, RefreshCw, Tag, Users, X } from 'lucide-vue-next'
import { useFiltrosStore } from '../stores/filtros.store'
import { useResourcesStore } from '../stores/resources.store'
import type { CampoFecha, LineaFilter } from '../stores/filtros.store'

const props = defineProps<{ tab: 'prep' | 'desp' }>()

const filtrosStore = useFiltrosStore()
const resourcesStore = useResourcesStore()

const { prep, desp } = storeToRefs(filtrosStore)

const openSup = ref(false)
const openEst = ref(false)

const filtros = computed(() => (props.tab === 'prep' ? prep.value : desp.value))
const supervisores = computed(() => resourcesStore.meta?.supervisores ?? [])
const estados = computed(() => resourcesStore.meta?.estados ?? [])
const supCount = computed(() => Math.max(0, supervisores.value.length - filtros.value.supervisores.length))
const estCount = computed(() => Math.max(0, estados.value.length - filtros.value.estados.length))

function setFiltros(patch: { fechaDesde?: string; fechaHasta?: string; linea?: LineaFilter }) {
  if (props.tab === 'prep') filtrosStore.updatePrep(patch)
  else filtrosStore.updateDesp(patch)
}

function setCampo(campo: CampoFecha) {
  if (props.tab === 'prep') filtrosStore.setCampoFechaPrep(campo)
  else filtrosStore.setCampoFechaDesp(campo)
}

function toggleSup() {
  openSup.value = !openSup.value
  openEst.value = false
}

function toggleEst() {
  openEst.value = !openEst.value
  openSup.value = false
}

function toggleSupValue(value: string, checked: boolean) {
  const current = filtros.value.supervisores
  const next = checked ? [...current, value] : current.filter((v) => v !== value)
  if (props.tab === 'prep') filtrosStore.updatePrep({ supervisores: next })
  else filtrosStore.updateDesp({ supervisores: next })
}

function toggleEstValue(value: string, checked: boolean) {
  const current = filtros.value.estados
  const next = checked ? [...current, value] : current.filter((v) => v !== value)
  if (props.tab === 'prep') filtrosStore.updatePrep({ estados: next })
  else filtrosStore.updateDesp({ estados: next })
}

function limpiar() {
  if (props.tab === 'prep') filtrosStore.resetPrep()
  else filtrosStore.resetDesp()
}

function recargar() {
  resourcesStore.refresh()
}
</script>

<template>
  <div class="border-b border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div class="grid grid-cols-2 items-end gap-2 sm:grid-cols-3 xl:grid-cols-6">
      <div class="col-span-1">
        <input
          type="date"
          class="input"
          :value="filtros.fechaDesde"
          title="Fecha desde"
          autocomplete="off"
          aria-label="Fecha desde"
          @change="setFiltros({ fechaDesde: ($event.target as HTMLInputElement).value })"
        />
      </div>
      <div class="col-span-1">
        <input
          type="date"
          class="input"
          :value="filtros.fechaHasta"
          title="Fecha hasta"
          autocomplete="off"
          aria-label="Fecha hasta"
          @change="setFiltros({ fechaHasta: ($event.target as HTMLInputElement).value })"
        />
      </div>
      <div class="col-span-2 sm:col-span-1">
        <div class="inline-flex w-full overflow-hidden rounded-lg border border-slate-300 bg-white text-xs font-semibold dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            class="h-9 flex-1 px-2 transition-colors"
            :class="filtros.campoFecha === 'PEDIDOFECHA' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300'"
            @click="setCampo('PEDIDOFECHA')"
          >
            F.Pedido
          </button>
          <div class="w-px bg-slate-300 dark:bg-slate-700"></div>
          <button
            type="button"
            class="h-9 flex-1 px-2 transition-colors"
            :class="filtros.campoFecha === 'FECHAENTREGA' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300'"
            @click="setCampo('FECHAENTREGA')"
          >
            F.Entrega
          </button>
        </div>
      </div>
      <div class="relative col-span-1">
        <select
          class="select"
          :value="filtros.linea"
          aria-label="Filtrar por tipo de colchón"
          title="Filtrar por tipo de colchón"
          @change="setFiltros({ linea: ($event.target as HTMLSelectElement).value as LineaFilter })"
        >
          <option value="">Todos</option>
          <option value="RESORTE">C.R. (Resorte)</option>
          <option value="ESPUMA">C. Espuma</option>
        </select>
      </div>
      <div class="relative col-span-1">
        <button
          type="button"
          class="btn btn-outline w-full justify-between"
          @click="toggleSup()"
          :aria-expanded="openSup"
        >
          <span class="flex min-w-0 items-center gap-1.5">
            <Users :size="15" :stroke-width="2" />
            <span class="truncate">Supervisores</span>
            <span v-if="supCount > 0" class="badge badge-primary ml-1">{{ supCount }}</span>
          </span>
          <ChevronDown :size="14" :stroke-width="2" class="transition-transform" :class="openSup ? 'rotate-180' : ''" />
        </button>
        <div v-if="openSup" class="dropdown-panel">
          <div class="max-h-56 overflow-y-auto p-2">
            <label
              v-for="s in supervisores"
              :key="s"
              class="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <input
                class="h-4 w-4 shrink-0 accent-indigo-600"
                type="checkbox"
                :checked="filtros.supervisores.includes(s)"
                @change="toggleSupValue(s, ($event.target as HTMLInputElement).checked)"
              />
              <span class="truncate">{{ s }}</span>
            </label>
            <small v-if="supervisores.length === 0" class="px-2 text-slate-500">Sin datos</small>
          </div>
          <div class="flex justify-end border-t border-slate-200 p-2 dark:border-slate-700">
            <button type="button" class="btn btn-primary btn-xs" @click="openSup = false">Aplicar</button>
          </div>
        </div>
      </div>
      <div class="relative col-span-1">
        <button
          type="button"
          class="btn btn-outline w-full justify-between"
          @click="toggleEst()"
          :aria-expanded="openEst"
        >
          <span class="flex min-w-0 items-center gap-1.5">
            <Tag :size="15" :stroke-width="2" />
            <span class="truncate">Estados</span>
            <span v-if="estCount > 0" class="badge badge-primary ml-1">{{ estCount }}</span>
          </span>
          <ChevronDown :size="14" :stroke-width="2" class="transition-transform" :class="openEst ? 'rotate-180' : ''" />
        </button>
        <div v-if="openEst" class="dropdown-panel">
          <div class="max-h-56 overflow-y-auto p-2">
            <label
              v-for="e in estados"
              :key="e"
              class="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <input
                class="h-4 w-4 shrink-0 accent-indigo-600"
                type="checkbox"
                :checked="filtros.estados.includes(e)"
                @change="toggleEstValue(e, ($event.target as HTMLInputElement).checked)"
              />
              <span class="truncate">{{ e }}</span>
            </label>
            <small v-if="estados.length === 0" class="px-2 text-slate-500">Sin datos</small>
          </div>
          <div class="flex justify-end border-t border-slate-200 p-2 dark:border-slate-700">
            <button type="button" class="btn btn-primary btn-xs" @click="openEst = false">Aplicar</button>
          </div>
        </div>
      </div>
      <div class="col-span-2 flex justify-end gap-2 sm:col-span-3 xl:col-span-6">
        <button type="button" class="btn btn-ghost btn-xs p-0 text-slate-500" @click="limpiar()">
          Limpiar Filtros <X :size="12" :stroke-width="2" />
        </button>
        <button type="button" class="btn btn-ghost btn-xs p-0 font-bold text-indigo-600 dark:text-indigo-400" @click="recargar()">
          <RefreshCw :size="13" :stroke-width="2" /> Recargar
        </button>
      </div>
    </div>
  </div>
</template>
