<script setup lang="ts">
import { useModal } from '../services/modal.service'
import { TriangleAlert, X } from 'lucide-vue-next'

const { state, resolve, dismiss } = useModal()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') dismiss()
}

function onBackdrop(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains('app-modal-backdrop')) dismiss()
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="state"
      class="app-modal-backdrop fixed inset-0 z-[1055] flex items-center justify-center bg-black/50 p-4"
      style="animation: fadeIn 0.15s ease-out"
      @click="onBackdrop"
      @keydown="onKeydown"
    >
      <div
        class="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        style="animation: fadeSlideIn 0.2s ease-out"
        role="dialog"
        aria-modal="true"
        :aria-label="state.title"
      >
        <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h6 class="mb-0 flex items-center gap-1.5 text-sm font-bold">
            <TriangleAlert
              v-if="state.kind === 'confirm'"
              :size="16"
              :stroke-width="2"
              class="text-amber-500"
            />
            {{ state.title }}
          </h6>
          <button type="button" class="btn btn-ghost btn-icon-sm" aria-label="Cerrar" @click="dismiss()">
            <X :size="16" :stroke-width="2" />
          </button>
        </div>
        <div class="p-4">
          <p class="mb-0 text-center text-sm break-words">{{ state.text }}</p>
        </div>
        <div class="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
          <template v-if="state.kind === 'confirm'">
            <button type="button" class="btn btn-outline btn-sm" @click="dismiss()">Cancelar</button>
            <button
              type="button"
              class="btn btn-sm"
              :class="state.danger ? 'btn-danger' : 'btn-primary'"
              @click="resolve(true)"
            >
              {{ state.confirmLabel }}
            </button>
          </template>
          <template v-else>
            <button type="button" class="btn btn-primary btn-sm ml-auto" @click="dismiss()">Cerrar</button>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>
