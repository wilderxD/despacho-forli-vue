<script setup lang="ts">
withDefaults(
  defineProps<{ message?: string; size?: 'sm' | 'md' | 'lg' }>(),
  { message: '', size: 'md' },
)
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-3 py-6" role="status" aria-live="polite">
    <span class="loading-spinner" :class="'is-' + size" aria-hidden="true" />
    <p v-if="message" class="text-sm font-medium text-slate-500 dark:text-slate-400">
      {{ message }}
    </p>
  </div>
</template>

<style scoped>
.loading-spinner {
  display: inline-block;
  border-radius: 9999px;
  border: 3px solid rgb(226 232 240);
  border-top-color: rgb(99 102 241);
  animation: spin 0.8s linear infinite;
}

.is-sm {
  width: 20px;
  height: 20px;
  border-width: 2px;
}

.is-md {
  width: 32px;
  height: 32px;
}

.is-lg {
  width: 48px;
  height: 48px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>