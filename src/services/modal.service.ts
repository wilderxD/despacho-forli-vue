import { ref } from 'vue'

export interface ModalState {
  kind: 'confirm' | 'info'
  title: string
  text: string
  confirmLabel: string
  danger: boolean
}

const state = ref<ModalState | null>(null)
let resolver: ((v: boolean) => void) | null = null

export function useModal() {
  function confirm(title: string, text: string, options?: { confirmLabel?: string; danger?: boolean }): Promise<boolean> {
    state.value = {
      kind: 'confirm',
      title,
      text,
      confirmLabel: options?.confirmLabel ?? 'Aceptar',
      danger: options?.danger ?? true,
    }
    return new Promise<boolean>((resolve) => {
      resolver = resolve
    })
  }

  function info(title: string, text: string) {
    state.value = { kind: 'info', title, text, confirmLabel: 'Cerrar', danger: false }
    resolver = null
  }

  function resolve(result: boolean) {
    state.value = null
    if (resolver) {
      resolver(result)
      resolver = null
    }
  }

  function dismiss() {
    state.value = null
    if (resolver) {
      resolver(false)
      resolver = null
    }
  }

  return { state, confirm, info, resolve, dismiss }
}
