<script setup lang="ts">
import { ref } from 'vue'
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-vue-next'
import { apiUpload } from '../api/api.service'

const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const uploading = ref(false)
const uploadResult = ref<{ count: number; message: string } | null>(null)
const uploadError = ref<string | null>(null)
const isDragOver = ref(false)

function openFilePicker() {
  fileInput.value?.click()
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = true
}

function onDragLeave() {
  isDragOver.value = false
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = false
  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    selectFile(files[0])
  }
}

function onFileInput(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    selectFile(input.files[0])
  }
}

function selectFile(file: File) {
  uploadResult.value = null
  uploadError.value = null

  if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
    uploadError.value = 'Formato no soportado. Use archivos .xlsx o .xls'
    return
  }

  selectedFile.value = file
}

async function upload() {
  if (!selectedFile.value) return

  uploading.value = true
  uploadResult.value = null
  uploadError.value = null

  try {
    const result = await apiUpload<{ count: number; message: string }>('/upload/excel', selectedFile.value)
    uploadResult.value = result
    selectedFile.value = null
  } catch (e: unknown) {
    uploadError.value = e instanceof Error ? e.message : 'Error al subir el archivo'
  } finally {
    uploading.value = false
  }
}

function clearSelection() {
  selectedFile.value = null
  uploadResult.value = null
  uploadError.value = null
}
</script>

<template>
  <div class="flex flex-1 flex-col p-4">
    <div class="mx-auto w-full max-w-lg">
      <h1 class="mb-4 text-xl font-bold text-slate-900 dark:text-white">
        Cargar Datos
      </h1>
      <p class="mb-6 text-sm text-slate-600 dark:text-slate-400">
        Sube un archivo Excel (.xlsx) con los datos de pedidos. Esta acción reemplazará todos los pedidos, choferes y placas existentes. Las hojas de carga (despachos) se mantendrán.
      </p>

      <!-- Drop zone -->
      <div
        class="relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors"
        :class="[
          isDragOver ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950' : 'border-slate-300 dark:border-slate-700',
          uploading ? 'pointer-events-none opacity-60' : 'hover:border-indigo-400'
        ]"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
        @click="openFilePicker"
      >
        <input
          ref="fileInput"
          type="file"
          accept=".xlsx,.xls"
          class="hidden"
          @change="onFileInput"
        />

        <div v-if="uploading" class="flex flex-col items-center gap-2">
          <Loader2 class="h-10 w-10 animate-spin text-indigo-500" :stroke-width="1.5" />
          <span class="text-sm text-slate-600 dark:text-slate-400">Subiendo y procesando...</span>
        </div>

        <div v-else class="flex flex-col items-center gap-2">
          <Upload class="h-10 w-10 text-slate-400" :stroke-width="1.5" />
          <span class="text-sm text-slate-600 dark:text-slate-400">
            Arrastra un archivo aquí o haz click para seleccionar
          </span>
          <span class="text-xs text-slate-400 dark:text-slate-500">Solo archivos .xlsx o .xls</span>
        </div>
      </div>

      <!-- Selected file -->
      <div v-if="selectedFile && !uploading" class="mt-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
        <div class="flex items-center justify-between">
          <span class="text-sm text-slate-700 dark:text-slate-300">{{ selectedFile.name }}</span>
          <button type="button" class="text-xs text-slate-500 hover:text-red-500" @click="clearSelection">
            Quitar
          </button>
        </div>
        <button
          type="button"
          class="mt-3 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          :disabled="uploading"
          @click="upload"
        >
          Cargar Datos
        </button>
      </div>

      <!-- Success -->
      <div v-if="uploadResult" class="mt-4 flex items-start gap-2 rounded-lg bg-green-50 p-3 dark:bg-green-950">
        <CheckCircle class="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" :stroke-width="2" />
        <div>
          <p class="text-sm font-medium text-green-800 dark:text-green-200">{{ uploadResult.message }}</p>
        </div>
      </div>

      <!-- Error -->
      <div v-if="uploadError" class="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 dark:bg-red-950">
        <AlertCircle class="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" :stroke-width="2" />
        <p class="text-sm text-red-800 dark:text-red-200">{{ uploadError }}</p>
      </div>
    </div>
  </div>
</template>
