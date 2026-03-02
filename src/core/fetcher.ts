import { SushiCache } from "./cache.js"

/* ============================= */
/* ========= GLOBALS =========== */
/* ============================= */

const cache = new SushiCache()
const pendingRequests = new Map<string, Promise<unknown>>()
const revalidateLocks = new Set<string>()

const DEFAULT_TTL = 5000
const __DEV__ = process.env.NODE_ENV !== "production"

/* ============================= */
/* ========= DEBUG ============= */
/* ============================= */

function debug(...args: any[]) {
  if (__DEV__) {
    console.log("[sushi-fetch]", ...args)
  }
}

/* ============================= */
/* ========= TYPES ============= */
/* ============================= */

type RetryConfig = {
  retries?: number
  retryDelay?: number
  retryStrategy?: "fixed" | "exponential"
  retryOn?: (res: Response | null, err: unknown) => boolean
}

type MiddlewareContext = {
  url: string
  options: FetchOptions
}

export type SushiError = Error & {
  status?: number
  response?: Response
  data?: any // 💡 FITUR BARU: Menyimpan response body (JSON/text) dari error
  elapsedTime?: number
  reason?: "timeout" | string
}

type Middleware = {
  onRequest?: (ctx: MiddlewareContext) => Promise<void> | void
  onResponse?: (res: Response, ctx: MiddlewareContext) => Promise<void> | void
  onError?: (err: unknown, ctx: MiddlewareContext) => Promise<void> | void
}

export type FetchOptions = RequestInit &
  RetryConfig & {
    baseUrl?: string // 💡 FITUR BARU: Global Config untuk Base URL
    data?: any // 💡 FITUR BARU (v0.5.0): Auto-stringify JSON
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
    onSuccess?: (data: unknown) => void
    onError?: (error: unknown) => void
    json?: boolean
    token?: string
  }

/* ============================= */
/* ===== GLOBAL MIDDLEWARE ===== */
/* ============================= */

const globalMiddleware: Middleware[] = []

export function addMiddleware(mw: Middleware) {
  globalMiddleware.push(mw)
}

/* ============================= */
/* ========= HELPERS =========== */
/* ============================= */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * 💡 Helper v0.5.0: Detect plain objects for JSON stringification
 */
function isObject(val: any) {
  return val !== null && typeof val === "object" && !(val instanceof FormData) && !(val instanceof Blob) && !(val instanceof ArrayBuffer)
}

/**
 * 💡 FIX: Mencegah Memory Leak dengan mengembalikan fungsi cleanup
 * dan mendukung penggabungan signal (Signal Merging)
 */
function createAbortSignal(timeout?: number, userSignal?: AbortSignal | null) {
  const controller = new AbortController()
  
  let timeoutId: any = null
  let isTimeout = false
  if (timeout) {
    timeoutId = setTimeout(() => {
      isTimeout = true
      controller.abort()
    }, timeout)
  }

  const onAbort = () => {
    if (timeoutId) clearTimeout(timeoutId)
    controller.abort()
  }

  if (userSignal) {
    if (userSignal.aborted) onAbort()
    else userSignal.addEventListener("abort", onAbort)
  }

  return {
    signal: controller.signal,
    getIsTimeout: () => isTimeout,
    cleanup: () => {
      if (timeoutId) clearTimeout(timeoutId)
      if (userSignal) userSignal.removeEventListener("abort", onAbort)
    }
  }
}

function computeBackoff(
  attempt: number,
  base: number,
  strategy: "fixed" | "exponential"
) {
  if (strategy === "fixed") return base
  return base * Math.pow(2, attempt) + Math.random() * 100 // + jitter biar nggak tabrakan
}

/* ============================= */
/* ========= KEY BUILDER ======= */
/* ============================= */

function stableStringify(obj: any): string {
  if (!obj) return ""
  try {
    return JSON.stringify(
      Object.keys(obj)
        .sort()
        .reduce((acc: any, key) => {
          acc[key] = obj[key]
          return acc
        }, {})
    )
  } catch {
    return String(obj)
  }
}

function buildCacheKey(url: string, options: RequestInit): string {
  const headersObj = Object.fromEntries(new Headers(options.headers || {}).entries())

  return `${url}::${stableStringify({
    method: (options.method || "GET").toUpperCase(),
    body: options.body instanceof FormData ? "[FormData]" : options.body,
    headers: headersObj,
  })}`
}

/* ============================= */
/* ========= RETRY CORE ======== */
/* ============================= */

async function retryFetch<T>(
  fn: () => Promise<T>,
  retries: number,
  delay: number,
  strategy: "fixed" | "exponential",
  retryOn?: (res: Response | null, err: unknown) => boolean
): Promise<T> {
  let attempt = 0

  while (true) {
    try {
      return await fn()
    } catch (err: any) {
      // 💡 OPTIMASI: Hanya retry jika masalah jaringan atau Server Error (5xx)
      const isNetworkError = err.name === "TypeError" || err.name === "AbortError" || !err.status
      const isServerError = err.status >= 500
      
      const shouldRetry = retryOn 
        ? retryOn(err.response || null, err) 
        : (isNetworkError || isServerError)

      if (attempt >= retries || !shouldRetry) throw err

      debug(`Retry attempt ${attempt + 1}/${retries} due to ${err.message}...`)
      await sleep(computeBackoff(attempt, delay, strategy))
      attempt++
    }
  }
}

/* ============================= */
/* ========= MIDDLEWARE ======== */
/* ============================= */

async function runMiddleware(
  type: keyof Middleware,
  ctx: MiddlewareContext,
  resOrErr?: unknown
) {
  const stack = [...globalMiddleware, ...(ctx.options.middleware || [])]

  for (const mw of stack) {
    try {
      if (type === "onRequest" && mw.onRequest) {
        await mw.onRequest(ctx)
      } else if (type === "onResponse" && mw.onResponse) {
        await mw.onResponse(resOrErr as Response, ctx)
      } else if (type === "onError" && mw.onError) {
        await mw.onError(resOrErr, ctx)
      }
    } catch (e) {
      debug("Middleware error:", e)
    }
  }
}

/* ============================= */
/* ========= MAIN CORE ========= */
/* ============================= */

/**
 * 💡 Internal request logic, reusable for different sushi instances
 */
async function executeRequest<T = unknown>(
  url: string,
  options: FetchOptions,
  ctx: MiddlewareContext
): Promise<T> {
  const {
    timeout,
    retries = 3,
    retryDelay = 500,
    retryStrategy = "exponential",
    retryOn,
    parseJson = true,
    parser,
    transform,
    validateStatus = (s) => s >= 200 && s < 300,
    onSuccess,
    onError,
    json: _json,
    token: _token,
    ...fetchOptions
  } = options

  const startTime = Date.now()

  try {
    const response = await retryFetch(
      async () => {
        await runMiddleware("onRequest", ctx)
        
        const { signal, getIsTimeout, cleanup } = createAbortSignal(timeout, fetchOptions.signal)
        
        try {
          // 💡 FITUR BARU: Handle Base URL Global
          let finalUrl = url
          if (options.baseUrl && !url.startsWith("http://") && !url.startsWith("https://")) {
             finalUrl = `${options.baseUrl.replace(/\/$/, "")}/${url.replace(/^\//, "")}`
          }

          const res = await globalThis.fetch(finalUrl, {
            ...fetchOptions,
            signal,
          })

          if (!validateStatus(res.status)) {
            // 💡 FITUR BARU: Strict Error Handling (Extract API error message)
            let errorData: any = null
            try {
               const clone = res.clone()
               const contentType = clone.headers.get("content-type") || ""
               if (contentType.includes("application/json")) {
                  errorData = await clone.json()
               } else {
                  errorData = await clone.text()
               }
            } catch (e) {
               // Ignore JSON parsing errors for empty/invalid body
            }

            const error: SushiError = new Error(
              errorData?.message || errorData?.error || `HTTP Error ${res.status}: ${res.statusText}`
            )
            error.status = res.status
            error.response = res
            error.data = errorData
            throw error
          }

          return res
        } catch (err: any) {
          if (err.name === "AbortError" && getIsTimeout()) {
            err.elapsedTime = Date.now() - startTime
            err.reason = "timeout"
          }
          throw err
        } finally {
          cleanup()
        }
      },
      retries,
      retryDelay,
      retryStrategy,
      retryOn
    )

    /* ========== POST-PROCESSING (NO RETRY) ========== */
    await runMiddleware("onResponse", ctx, response)

    let data: unknown
    if (parser) {
      data = await parser(response)
    } else if (parseJson) {
      const contentType = response.headers.get("content-type") || ""
      if (contentType.includes("application/json") || contentType.includes("+json")) {
        data = await response.json()
      } else {
        data = await response.text()
      }
    } else {
      data = await response.text()
    }

    if (transform) data = transform(data)

    onSuccess?.(data)
    return data as T
  } catch (err) {
    await runMiddleware("onError", ctx, err)
    onError?.(err)
    throw err
  }
}

export async function fetcher<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const {
    cache: useCache = true,
    ttl = DEFAULT_TTL,
    revalidate = false,
    force = false,
    cacheKey,
    cacheTags = [],
    json,
    data: payload,
    token,
    ...restOptions
  } = options

  // 1. Process Data (Auto Stringify v0.5.0)
  const headers = new Headers(restOptions.headers || {})
  let body = restOptions.body

  if (payload !== undefined) {
    if (isObject(payload)) {
      body = JSON.stringify(payload)
      if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json")
    } else {
      body = payload
    }
  } else if (isObject(body)) {
    // 💡 Support auto-stringify on body as well if it's an object
    body = JSON.stringify(body)
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json")
  }

  // Legacy json shortcut (still supported for manual body)
  if (json && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`)
  }
  
  restOptions.headers = headers
  restOptions.body = body

  const key = cacheKey || buildCacheKey(url, restOptions)
  const ctx: MiddlewareContext = { url, options: { ...options, headers: restOptions.headers, body: restOptions.body } }

  /* ========== CACHE HIT ========== */
  if (!force && useCache) {
    const cached = cache.get<T>(key)
    if (cached !== null) {
      debug("Cache hit:", key)

      if (revalidate && !revalidateLocks.has(key)) {
        revalidateLocks.add(key)
        fetcher(url, { ...options, revalidate: false, force: true })
          .finally(() => revalidateLocks.delete(key))
          .catch(() => debug("Background revalidation failed for", key))
      }

      return cached
    }
  }

  /* ========== DEDUP ========== */
  if (pendingRequests.has(key)) {
    debug("Dedup hit:", key)
    return pendingRequests.get(key) as Promise<T>
  }

  debug("Fetching:", url)

  const requestPromise = (async () => {
    try {
      const data = await executeRequest<T>(url, restOptions as FetchOptions, ctx)

      if (useCache) {
        cache.set(key, data, { ttl, tags: cacheTags })
      }

      return data
    } catch (err) {
      const staleData = cache.peek<T>(key)
      if (staleData !== null) {
        debug("Returning stale data due to fetch error:", key)
        return staleData
      }
      throw err
    } finally {
      pendingRequests.delete(key)
    }
  })()

  pendingRequests.set(key, requestPromise)

  return requestPromise
}

/* ============================= */
/* ========= INSTANCE ========== */
/* ============================= */

function mergeHeaders(h1?: HeadersInit, h2?: HeadersInit): HeadersInit {
  const res = new Headers(h1 || {})
  if (h2) {
    new Headers(h2).forEach((v, k) => res.set(k, v))
  }
  return res
}

export function createSushi(defaultOptions: FetchOptions = {}) {
  const sushi = <T = unknown>(url: string, options: FetchOptions = {}) => {
    const mergedOptions: FetchOptions = {
      ...defaultOptions,
      ...options,
      headers: mergeHeaders(defaultOptions.headers, options.headers),
      middleware: [
        ...(defaultOptions.middleware || []),
        ...(options.middleware || [])
      ]
    }
    return fetcher<T>(url, mergedOptions)
  }

  sushi.create = (opts: FetchOptions) => {
    return createSushi({
      ...defaultOptions,
      ...opts,
      headers: mergeHeaders(defaultOptions.headers, opts.headers),
      middleware: [
        ...(defaultOptions.middleware || []),
        ...(opts.middleware || [])
      ]
    })
  }

  // Helper shortcuts (optional but nice)
  sushi.get = <T = unknown>(url: string, opts?: FetchOptions) => sushi<T>(url, { ...opts, method: "GET" })
  sushi.post = <T = unknown>(url: string, data?: any, opts?: FetchOptions) => 
    sushi<T>(url, { ...opts, method: "POST", data })
  sushi.put = <T = unknown>(url: string, data?: any, opts?: FetchOptions) => 
    sushi<T>(url, { ...opts, method: "PUT", data })
  sushi.delete = <T = unknown>(url: string, opts?: FetchOptions) => sushi<T>(url, { ...opts, method: "DELETE" })

  return sushi
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
}

/* ============================= */
/* ========= EXPORTS =========== */
/* ============================= */

export const sushiFetch = createSushi()
export const addSushiMiddleware = addMiddleware