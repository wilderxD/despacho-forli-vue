declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

export interface ApiProgressPayload {
  reqId: string
  loaded: number
  total: number | null
}

export interface ApiBridge {
  get: (action: string, params?: Record<string, string | number | undefined>, reqId?: string) => Promise<unknown>
  post: (action: string, body: unknown, reqId?: string) => Promise<unknown>
  printHtml: (html: string) => Promise<boolean>
  onProgress: (callback: (payload: ApiProgressPayload) => void) => () => void
}

declare global {
  interface Window {
    api: ApiBridge
  }
}