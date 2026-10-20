<script setup lang="ts">
withDefaults(
  defineProps<{ active: boolean; percent: number | null; label?: string }>(),
  { active: false, percent: null, label: 'Cargando…' },
)
</script>

<template>
  <div v-if="active" class="w-full">
    <div class="relative h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" :aria-valuenow="percent ?? undefined" aria-valuemin="0" aria-valuemax="100">
      <div
        class="h-full rounded-full bg-indigo-500 transition-[width] duration-200 ease-out"
        :class="{ 'indeterminate': percent === null }"
        :style="percent !== null ? { width: percent + '%' } : undefined"
      />
    </div>
    <p class="mt-1 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">
      <span v-if="percent !== null">{{ percent }}%</span>
      <span v-else>{{ label }}</span>
    </p>
  </div>
</template>

<style scoped>
.indeterminate {
  width: 40%;
  animation: indeterminate 1.2s ease-in-out infinite;
}

@keyframes indeterminate {
  0% { margin-left: -40%; }
  100% { margin-left: 100%; }
}
</style>