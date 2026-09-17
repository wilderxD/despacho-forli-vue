<script setup lang="ts">
import { useToast } from '../composables/useToast'
import { X } from 'lucide-vue-next'

const { toasts, dismiss, runAction } = useToast()
</script>

<template>
  <div class="fixed bottom-0 right-0 z-[9999] flex flex-col gap-2 p-3" role="status" aria-live="polite" aria-atomic="true">
    <div
      v-for="t in toasts"
      :key="t.id"
      class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm shadow-lg"
      role="alert"
      :class="{
        'bg-emerald-600 text-white': t.type === 'success',
        'bg-red-600 text-white': t.type === 'danger',
        'bg-amber-500 text-amber-950': t.type === 'warning',
      }"
      style="animation: fadeSlideIn 0.2s ease-out"
    >
      <div class="min-w-0 flex-1">
        {{ t.text }}
        <button
          v-if="t.action"
          type="button"
          class="btn ml-2 bg-white/20 px-2 py-0 text-xs font-bold hover:bg-white/30"
          @click="runAction(t.id)"
        >
          {{ t.action.label }}
        </button>
      </div>
      <button
        type="button"
        class="btn btn-ghost btn-icon-sm shrink-0"
        aria-label="Cerrar"
        @click="dismiss(t.id)"
      >
        <X :size="15" :stroke-width="2" />
      </button>
    </div>
  </div>
</template>
