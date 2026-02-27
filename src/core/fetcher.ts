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

type Middleware = {
  onRequest?: (ctx: MiddlewareContext) => Promise<void> | void
  onResponse?: (res: Response, ctx: MiddlewareContext) => Promise<void> | void
  onError?: (err: unknown, ctx: MiddlewareContext) => Promise<void> | void
}

export type FetchOptions = RequestInit &
  RetryConfig & {
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
 * 💡 FIX: Mencegah Memory Leak dengan mengembalikan fungsi cleanup
 * dan mendukung penggabungan signal (Signal Merging)
 */
function createAbortSignal(timeout?: number, userSignal?: AbortSignal | null) {
  const controller = new AbortController()
  
  let timeoutId: any = null
  if (timeout) {
    timeoutId = setTimeout(() => controller.abort(), timeout)
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
  let headersObj = options.headers || {}
  if (typeof Headers !== "undefined" && headersObj instanceof Headers) {
    headersObj = Object.fromEntries(headersObj.entries())
  }

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

export async function fetcher<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const {
    cache: useCache = true,
    ttl = DEFAULT_TTL,
    timeout,
    revalidate = false,
    force = false,
    retries = 3,
    retryDelay = 500,
    retryStrategy = "exponential",
    retryOn,
    cacheKey,
    cacheTags = [],
    parseJson = true,
    parser,
    transform,
    validateStatus = (s) => s >= 200 && s < 300,
    onSuccess,
    onError,
    ...fetchOptions
  } = options

  const key = cacheKey || buildCacheKey(url, fetchOptions)
  const ctx: MiddlewareContext = { url, options }

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

  /* ========== REQUEST CORE (WITH RETRY) ========== */
  const requestPromise = (async () => {
    try {
      const response = await retryFetch(
        async () => {
          await runMiddleware("onRequest", ctx)
          
          const { signal, cleanup } = createAbortSignal(timeout, fetchOptions.signal)
          
          try {
            const res = await globalThis.fetch(url, {
              ...fetchOptions,
              signal,
            })

            if (!validateStatus(res.status)) {
              const error: any = new Error(`HTTP Error ${res.status}`)
              error.status = res.status
              error.response = res
              throw error
            }

            return res
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

      if (useCache) {
        cache.set(key, data, { ttl, tags: cacheTags })
      }

      onSuccess?.(data)
      return data as T
    } catch (err) {
      await runMiddleware("onError", ctx, err)
      onError?.(err)
      
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
/* ========= CACHE API ========= */
/* ============================= */

export const sushiCache = {
  clear: () => cache.clear(),
  delete: (key: string) => cache.delete(key),
  has: (key: string) => cache.has(key),
  set: <T>(key: string, data: T, ttlOrOptions?: number | { ttl?: number; tags?: string[] }) => cache.set(key, data, ttlOrOptions),
  get: <T>(key: string) => cache.get<T>(key),
  mutate: <T>(key: string, mutator: T | ((oldData: T | null) => T), ttl?: number) => cache.mutate(key, mutator, ttl),
  subscribe: <T>(key: string, listener: (data: T | null) => void) => cache.subscribe(key, listener),
  invalidateTag: (tag: string) => cache.invalidateTag(tag),
}

/* ============================= */
/* ========= EXPORTS =========== */
/* ============================= */

export const sushiFetch = fetcher
export const addSushiMiddleware = addMiddleware