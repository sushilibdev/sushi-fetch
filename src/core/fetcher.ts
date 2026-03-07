import { SushiCache } from "./cache.js"

const cache = new SushiCache({ maxSize: 100 })
const pendingRequests = new Map<string, Promise<unknown>>()
const revalidateLocks = new Set<string>()

const pollRegistry = new Map<string, any>()
const focusRegistry = new Map<string, () => void>()

if (typeof window !== "undefined") {
  const onFocus = () => focusRegistry.forEach(fn => fn())
  window.addEventListener("visibilitychange", () => document.visibilityState === "visible" && onFocus())
  window.addEventListener("focus", onFocus)
}

const DEFAULT_TTL = 5000

function debug(...args: any[]) {
  if (process.env.NODE_ENV !== "production") {
    console.log("[sushi-fetch]", ...args)
  }
}

/* ============================= */
/* ========= TYPES ============= */
/* ============================= */

export type RetryConfig = {
  retries?: number
  retryDelay?: number
  retryStrategy?: "fixed" | "exponential"
  retryOn?: (res: Response | null, err: unknown) => boolean
}

export type MiddlewareContext = {
  url: string
  options: FetchOptions
}

export type SushiError = Error & {
  status?: number
  response?: Response
  data?: any
  elapsedTime?: number
  reason?: "timeout" | string
}

export type Middleware = {
  onRequest?: (ctx: MiddlewareContext) => Promise<void> | void
  onResponse?: (res: Response, ctx: MiddlewareContext) => Promise<void> | void
  onError?: (err: unknown, ctx: MiddlewareContext) => Promise<void> | void
}

export type Interceptors = {
  request?: (url: string, options: FetchOptions) => Promise<FetchOptions | void> | FetchOptions | void
  response?: (res: Response) => Promise<Response | void> | Response | void
}

export type FetchOptions = RequestInit &
  RetryConfig & {
    baseUrl?: string
    data?: any
    cache?: boolean
    ttl?: number
    timeout?: number
    revalidate?: boolean
    force?: boolean
    cacheKey?: string
    cacheTags?: string[]
    parseJson?: boolean
    parser?: (res: Response) => Promise<unknown>
    transform?: <T>(data: T) => T
    validateStatus?: (status: number) => boolean
    middleware?: Middleware[]
    interceptors?: Interceptors
    onSuccess?: (data: unknown) => void
    onError?: (error: unknown) => void
    json?: boolean
    token?: string
    onProgress?: (p: { percentage: number; loaded: number; total: number }) => void
    // FITUR BARU v1.0.0
    pollInterval?: number
    revalidateOnFocus?: boolean
    batch?: boolean
  }

/* ============================= */
/* ===== GLOBAL MIDDLEWARE ===== */
/* ============================= */

const globalMiddleware: Middleware[] = []
export const addMiddleware = (mw: Middleware) => globalMiddleware.push(mw)

/* ============================= */
/* ========= HELPERS =========== */
/* ============================= */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const isObject = (v: any): v is Record<string, any> => v && typeof v === "object" && !(v instanceof FormData || v instanceof Blob || v instanceof ArrayBuffer)

function createAbortSignal(timeout?: number, userSignal?: AbortSignal | null) {
  const ctrl = new AbortController()
  let tid: any, isT = false
  if (timeout) tid = setTimeout(() => (isT = true, ctrl.abort()), timeout)

  const onA = () => (tid && clearTimeout(tid), ctrl.abort())
  if (userSignal) userSignal.aborted ? onA() : userSignal.addEventListener("abort", onA)

  return {
    signal: ctrl.signal,
    getIsTimeout: () => isT,
    cleanup: () => {
      if (tid) clearTimeout(tid)
      if (userSignal) userSignal.removeEventListener("abort", onA)
    }
  }
}

/* ============================= */
/* ========= KEY BUILDER ======= */
/* ============================= */

function buildCacheKey(url: string, opts: RequestInit): string {
  const h = new Headers(opts.headers)
  const sh = Array.from(h.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  return `${(opts.method || "GET").toUpperCase()}:${url}:${JSON.stringify(sh)}:${opts.body instanceof FormData ? "[FD]" : (opts.body || "")}`
}

/* ============================= */
/* ========= RETRY CORE ======== */
/* ============================= */

async function retryFetch<T>(fn: () => Promise<T>, r: number, d: number, s: "fixed" | "exponential", ro?: (res: Response | null, err: unknown) => boolean): Promise<T> {
  let a = 0
  while (1) {
    try { return await fn() } catch (e: any) {
      const isNet = e.name === "TypeError" || e.name === "AbortError" || !e.status
      if (a >= r || !(ro ? ro(e.response || null, e) : (isNet || e.status >= 500))) throw e
      debug(`Retry ${++a}/${r}`)
      await sleep(s === "fixed" ? d : d * Math.pow(2, a - 1) + Math.random() * 100)
    }
  }
  throw new Error()
}

/* ============================= */
/* ========= MIDDLEWARE ======== */
/* ============================= */

async function runMW(type: keyof Middleware, ctx: MiddlewareContext, arg?: any) {
  const stack = [...globalMiddleware, ...(ctx.options.middleware || [])]
  for (const mw of stack) {
    try {
      const f = mw[type] as any
      if (f) await f(type === "onRequest" ? ctx : arg, type === "onRequest" ? undefined : ctx)
    } catch (e) { debug("MW Err", e) }
  }
}

/* ============================= */
/* ========= MAIN CORE ========= */
/* ============================= */

async function executeRequest<T = unknown>(url: string, opts: FetchOptions, ctx: MiddlewareContext): Promise<T> {
  const { timeout, retries: r = 3, retryDelay: d = 500, retryStrategy: s = "exponential", retryOn: ro, parseJson: pj = true, parser, transform, validateStatus: vs = (st) => st >= 200 && st < 300, onSuccess: ok, onError: fail, onProgress, ...fOpts } = opts
  const start = Date.now()

  try {
    const res = await retryFetch(async () => {
      await runMW("onRequest", ctx)
      const { signal, getIsTimeout, cleanup } = createAbortSignal(timeout, fOpts.signal)
      try {
        let fUrl = url
        if (opts.baseUrl && !url.includes("://")) fUrl = `${opts.baseUrl.replace(/\/$/, "")}/${url.replace(/^\//, "")}`
        let response = await globalThis.fetch(fUrl, { ...fOpts, signal })

        if (opts.interceptors?.response) {
          response = (await opts.interceptors.response(response)) || response
        }

        if (!vs(response.status)) {
          let ed: any
          try { const c = response.clone(); ed = (c.headers.get("content-type") || "").includes("json") ? await c.json() : await c.text() } catch {}
          const err: SushiError = new Error(ed?.message || ed?.error || `HTTP ${response.status}`)
          Object.assign(err, { status: response.status, response: response, data: ed })
          throw err
        }

        if (onProgress && response.body) {
          const reader = response.body.getReader()
          const total = Number(response.headers.get('Content-Length')) || 0
          let loaded = 0

          const stream = new ReadableStream({
            async pull(controller) {
              const { done, value } = await reader.read()
              if (done) {
                controller.close()
                return
              }
              loaded += value.byteLength
              onProgress({
                percentage: total ? Math.round((loaded / total) * 100) : 0,
                loaded,
                total
              })
              controller.enqueue(value)
            }
          })
          
          response = new Response(stream, {
             headers: response.headers,
             status: response.status,
             statusText: response.statusText
          })
        }

        return response
      } catch (e: any) {
        if (e.name === "AbortError" && getIsTimeout()) Object.assign(e, { elapsedTime: Date.now() - start, reason: "timeout" })
        throw e
      } finally { cleanup() }
    }, r, d, s, ro)

    await runMW("onResponse", ctx, res)
    let data = parser ? await parser(res) : ((pj && (res.headers.get("content-type") || "").includes("json")) ? await res.json() : await res.text())
    if (transform) data = transform(data)
    ok?.(data)
    return data
  } catch (e) {
    await runMW("onError", ctx, e)
    fail?.(e)
    throw e
  }
}

export async function fetcher<T = unknown>(url: string, opts: FetchOptions = {}): Promise<T> {
  if (opts.interceptors?.request) {
    opts = (await opts.interceptors.request(url, opts)) || opts
  }

  const { cache: useC = true, ttl = DEFAULT_TTL, revalidate: rv = false, force = false, cacheKey: ck, cacheTags: ct = [], json, data: payload, token, ...rest } = opts
  const h = new Headers(rest.headers)
  let b = rest.body

  if (payload !== undefined || isObject(b)) {
    const d = payload !== undefined ? payload : b
    if (isObject(d)) { b = JSON.stringify(d); if (!h.has("Content-Type")) h.set("Content-Type", "application/json") } else b = d
  }
  if (json && !h.has("Content-Type")) h.set("Content-Type", "application/json")
  if (token && !h.has("Authorization")) h.set("Authorization", `Bearer ${token}`)
  
  Object.assign(rest, { headers: h, body: b })
  const key = ck || buildCacheKey(url, rest)
  const ctx: MiddlewareContext = { url, options: { ...opts, headers: h, body: b } }

  if (opts.revalidateOnFocus && !focusRegistry.has(key)) {
    focusRegistry.set(key, () => {
      // Secret revalidation in the background if the screen is active
      if (!pendingRequests.has(key)) fetcher<T>(url, { ...opts, force: true, revalidateOnFocus: false }).catch(() => {})
    })
  }

  if (opts.pollInterval && !pollRegistry.has(key)) {
    const timer = setInterval(() => {
      if (!pendingRequests.has(key)) fetcher<T>(url, { ...opts, force: true, pollInterval: undefined }).catch(() => {})
    }, opts.pollInterval)
    if (timer?.unref) timer.unref() // So Node.js can exit peacefully
    pollRegistry.set(key, timer)
  }

  if (!force && useC) {
    const c = cache.get<T>(key)
    if (c !== null) {
      if (rv && !revalidateLocks.has(key)) {
        revalidateLocks.add(key); executeRequest<T>(url, rest as FetchOptions, ctx).then(d => cache.set(key, d, { ttl, tags: ct })).finally(() => revalidateLocks.delete(key)).catch(() => {})
      }
      return c
    }
  }

  if (opts.batch) await new Promise(r => setTimeout(r, 0))

  if (pendingRequests.has(key)) return pendingRequests.get(key) as Promise<T>

  const p = (async () => {
    try {
      const d = await executeRequest<T>(url, rest as FetchOptions, ctx)
      if (useC) cache.set(key, d, { ttl, tags: ct })
      return d
    } catch (e) {
      const s = cache.peek<T>(key)
      if (s !== null) return s
      throw e
    } finally { pendingRequests.delete(key) }
  })()

  return (pendingRequests.set(key, p), p)
}

/* ============================= */
/* ========= INSTANCE ========== */
/* ============================= */

const merge = (d: FetchOptions, o: FetchOptions): FetchOptions => {
  const h = new Headers(d.headers)
  if (o.headers) new Headers(o.headers).forEach((v, k) => h.set(k, v))
  return { 
    ...d, 
    ...o, 
    headers: h, 
    middleware: [...(d.middleware || []), ...(o.middleware || [])],
    interceptors: { ...(d.interceptors || {}), ...(o.interceptors || {}) }
  }
}

export function createSushi(dOpts: FetchOptions = {}) {
  const s = <T = unknown>(url: string, o: FetchOptions = {}) => fetcher<T>(url, merge(dOpts, o))
  s.create = (o: FetchOptions) => createSushi(merge(dOpts, o))
  s.get = <T = unknown>(url: string, o?: FetchOptions) => s<T>(url, { ...o, method: "GET" })
  s.post = <T = unknown>(url: string, d?: any, o?: FetchOptions) => s<T>(url, { ...o, method: "POST", data: d })
  s.put = <T = unknown>(url: string, d?: any, o?: FetchOptions) => s<T>(url, { ...o, method: "PUT", data: d })
  s.delete = <T = unknown>(url: string, o?: FetchOptions) => s<T>(url, { ...o, method: "DELETE" })
  return s
}

/* ============================= */
/* ========= CACHE API ========= */
/* ============================= */

export const sushiCache = {
  clear: () => cache.clear(),
  delete: (key: string) => cache.delete(key),
  has: (key: string) => cache.has(key),
  set: <T>(key: string, data: T, ttlOrOptions?: number | { ttl?: number; tags?: string[] }) => cache.set(key, data, ttlOrOptions),
  get: <T>(key: string) => cache.get<T>(key),
  peek: <T>(key: string) => cache.peek<T>(key),
  mutate: <T>(key: string, mutator: T | ((oldData: T | null) => T), ttl?: number) => cache.mutate(key, mutator, ttl),
  subscribe: <T>(key: string, listener: (data: T | null) => void) => cache.subscribe(key, listener),
  invalidateTag: (tag: string) => cache.invalidateTag(tag),
  stopPolling: (key: string) => { clearInterval(pollRegistry.get(key)); pollRegistry.delete(key) },
  clearFocusRevalidation: (key: string) => focusRegistry.delete(key)
}

export const sushiFetch = createSushi()
export const addSushiMiddleware = addMiddleware