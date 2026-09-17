<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ClipboardCheck, Clock, Moon, Sun, Truck } from 'lucide-vue-next'
import ToastHost from './components/ToastHost.vue'
import ModalHost from './components/ModalHost.vue'
import { useEstadoStore } from './stores/estado.store'
import { useResourcesStore } from './stores/resources.store'

const route = useRoute()
const estadoStore = useEstadoStore()
const resourcesStore = useResourcesStore()

const dark = ref(document.documentElement.getAttribute('data-theme') === 'dark')
const preparedCount = computed(() => estadoStore.preparedCount)
const histCount = computed(() => resourcesStore.historialCount)

function toggleTheme() {
  dark.value = !dark.value
  document.documentElement.setAttribute('data-theme', dark.value ? 'dark' : 'light')
  document.documentElement.style.colorScheme = dark.value ? 'dark' : 'light'
  try {
    localStorage.setItem('forli_theme', dark.value ? 'dark' : 'light')
  } catch { /* ignore */ }
}

function onKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement
  if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
    e.preventDefault()
    const id = route.path.includes('despachar') ? 'txtBuscarDespacho' : 'txtBuscarPrep'
    setTimeout(() => document.getElementById(id)?.focus(), 50)
  }
}

onMounted(() => {
  // Restore theme
  const savedTheme = localStorage.getItem('forli_theme')
  if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    dark.value = true
    document.documentElement.setAttribute('data-theme', 'dark')
    document.documentElement.style.colorScheme = 'dark'
  }

  // Load initial data
  resourcesStore.loadAll()

  // Register keyboard shortcut
  window.addEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="flex h-dvh flex-col overflow-hidden">
    <nav
      class="app-nav flex flex-shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      role="navigation"
      aria-label="Principal"
    >
      <router-link class="brand mr-3 inline-flex items-center gap-2 whitespace-nowrap" to="/preparar" aria-label="Sistema de Despacho Forli">
        <span class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
          <Truck :size="18" :stroke-width="2" />
        </span>
        <span class="brand-text font-bold text-slate-900 dark:text-white">
          Forli <span class="font-semibold text-indigo-600 dark:text-indigo-400">Despacho</span>
        </span>
      </router-link>
      <ul class="m-0 flex items-center gap-1 p-0" style="list-style: none" role="tablist">
        <li>
          <router-link class="nav-link" to="/preparar" active-class="active" aria-current="page">
            <ClipboardCheck :size="16" :stroke-width="2" />
            Preparar
            <span v-if="preparedCount > 0" class="badge badge-white ml-1" role="status">{{ preparedCount }}</span>
          </router-link>
        </li>
        <li>
          <router-link class="nav-link" to="/despachar" active-class="active" aria-current="page">
            <Truck :size="16" :stroke-width="2" />
            Despachar
          </router-link>
        </li>
        <li>
          <router-link class="nav-link" to="/historial" active-class="active" aria-current="page">
            <Clock :size="16" :stroke-width="2" />
            Historial
            <span v-if="histCount > 0" class="badge badge-white ml-1" role="status">{{ histCount }}</span>
          </router-link>
        </li>
      </ul>
      <button
        type="button"
        class="btn btn-ghost btn-icon ml-auto"
        :aria-label="dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
        title="Cambiar tema"
        @click="toggleTheme()"
      >
        <Sun v-if="dark" :size="18" :stroke-width="2" />
        <Moon v-else :size="18" :stroke-width="2" />
      </button>
    </nav>

    <div class="app-content flex min-h-0 flex-1">
      <router-view />
    </div>

    <ToastHost />
    <ModalHost />
  </div>
</template>

<style scoped>
.app-nav {
  height: 52px;
  flex-shrink: 0;
}

.brand {
  text-decoration: none;
  font-size: 0.95rem;
}

.app-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
}

.app-content > :deep(*) {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

@media (max-width: 480px) {
  .brand .brand-text {
    display: none;
  }
  .nav-link {
    padding-inline: 0.5rem;
    font-size: 0.8rem;
  }
}
</style>
