import { ref } from 'vue'

export interface ToastAction {
  label: string
  fn: () => void
}

export interface ToastMsg {
  id: number
  text: string
  type: 'success' | 'danger' | 'warning'
  action?: ToastAction
}

const toasts = ref<ToastMsg[]>([])
let nextId = 1

export function useToast() {
  function show(text: string, type: ToastMsg['type'] = 'success', action?: ToastAction) {
    const id = nextId++
    const msg: ToastMsg = { id, text, type, action }
    toasts.value = [...toasts.value, msg]
    if (!action) {
      setTimeout(() => dismiss(id), 4000)
    }
  }

  function showError(text: string, retry?: () => void) {
    show(text, 'danger', retry ? { label: 'Reintentar', fn: retry } : undefined)
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function runAction(id: number) {
    const t = toasts.value.find((x) => x.id === id)
    if (t?.action) {
      t.action.fn()
      dismiss(id)
    }
  }

  return { toasts, show, showError, dismiss, runAction }
}
