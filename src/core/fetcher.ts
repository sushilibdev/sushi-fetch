import { SushiCache } from "./cache.js"

/* ============================= */
/* ========= GLOBALS =========== */
/* ============================= */

const cache = new SushiCache()
const pendingRequests = new Map<string, Promise<unknown>>()
const revalidateLocks = new Set<string>()

// 💡 OPTIMASI: Map khusus untuk tag yang jauh lebih hemat memori dan cepat
const tagMap = new Map<string, Set<string>>()

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

function buildAbortController(timeout?: number) {
  if (!timeout) return null

  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)

  // Bersihkan timeout jika abort dipanggil dari tempat lain
  controller.signal.addEventListener("abort", () => clearTimeout(id))

  return controller
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
  return JSON.stringify(
    Object.keys(obj)
      .sort()
      .reduce((acc: any, key) => {
        acc[key] = obj[key]
        return acc
      }, {})
  )
}

function buildCacheKey(url: string, options: RequestInit): string {
  return `${url}::${stableStringify({
    method: options.method || "GET",
    body: options.body,
    headers: options.headers,
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
      // 💡 OPTIMASI: Default retry yang pintar. Hanya retry kalau masalah jaringan atau Server Error (5xx)
      const isNetworkError = !err.status // Biasanya error dari fetch() native kalau putus koneksi
      const isServerError = err.status >= 500
      
      const shouldRetry = retryOn 
        ? retryOn(err.response || null, err) 
        : (isNetworkError || isServerError)

      if (attempt >= retries || !shouldRetry) throw err

      debug(`Retry attempt ${attempt + 1}/${retries} for failing request...`)
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
        // Aman! TypeScript tahu pasti ini fungsi onRequest (1 argumen)
        await mw.onRequest(ctx)
      } else if (type === "onResponse" && mw.onResponse) {
        // Aman! TypeScript tahu pasti ini fungsi onResponse (2 argumen)
        await mw.onResponse(resOrErr as Response, ctx)
      } else if (type === "onError" && mw.onError) {
        // Aman! TypeScript tahu pasti ini fungsi onError (2 argumen)
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
    retries = 0,
    retryDelay = 500,
    retryStrategy = "fixed",
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
        // Background revalidation
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

  /* ========== REQUEST ========== */
  const requestPromise = retryFetch(
    async () => {
      await runMiddleware("onRequest", ctx)

      const controller = buildAbortController(timeout)
      
      // 💡 OPTIMASI: Menggunakan globalThis.fetch bawaan (tidak perlu node-fetch)
      const res = await globalThis.fetch(url, {
        ...fetchOptions,
        signal: controller?.signal,
      })

      await runMiddleware("onResponse", ctx, res)

      if (!validateStatus(res.status)) {
        const error: any = new Error(`HTTP Error ${res.status}`)
        error.status = res.status
        error.response = res
        throw error
      }

      let data: unknown

      if (parser) {
        data = await parser(res)
      } else if (parseJson) {
        // Cek header untuk memastikan ini JSON sebelum di-parse
        const contentType = res.headers.get("content-type")
        if (contentType && contentType.includes("application/json")) {
          data = await res.json()
        } else {
          data = await res.text()
        }
      } else {
        data = await res.text()
      }

      if (transform) data = transform(data)

      if (useCache) {
        cache.set(key, data, ttl)

        // 💡 OPTIMASI: Simpan relasi tag -> keys dengan Set (Sangat efisien)
        for (const tag of cacheTags) {
          if (!tagMap.has(tag)) {
            tagMap.set(tag, new Set())
          }
          tagMap.get(tag)!.add(key)
        }
      }

      onSuccess?.(data)
      return data as T
    },
    retries,
    retryDelay,
    retryStrategy,
    retryOn
  )
    .catch(async (err) => {
      await runMiddleware("onError", ctx, err)
      onError?.(err)
      
      // STALE-IF-ERROR: Kalau fetch gagal, cek apakah ada data basi di cache yang bisa dipakai
      const staleData = cache.peek<T>(key)
      if (staleData !== null) {
        debug("Returning stale data due to fetch error:", key)
        return staleData
      }
      
      throw err
    })
    .finally(() => {
      pendingRequests.delete(key)
    })

  pendingRequests.set(key, requestPromise)

  return requestPromise
}

/* ============================= */
/* ========= CACHE API ========= */
/* ============================= */

export const sushiCache = {
  clear: () => {
    cache.clear()
    tagMap.clear()
  },
  delete: (key: string) => cache.delete(key),
  has: (key: string) => cache.has(key),

  // 👇 TAMBAHAN BARU: Expose fitur Pub/Sub & Mutasi dari cache.ts ke publik!
  set: <T>(key: string, data: T, ttl?: number) => cache.set(key, data, ttl),
  get: <T>(key: string) => cache.get<T>(key),
  mutate: <T>(key: string, mutator: T | ((oldData: T | null) => T), ttl?: number) => cache.mutate(key, mutator, ttl),
  subscribe: <T>(key: string, listener: (data: T | null) => void) => cache.subscribe(key, listener),

  invalidateTag: (tag: string) => {
    const keys = tagMap.get(tag)
    if (keys) {
      for (const key of keys) {
        cache.delete(key)
      }
      tagMap.delete(tag)
      debug(`Invalidated tag: ${tag} (${keys.size} items)`)
    }
  },
}

/* ============================= */
/* ========= EXPORTS =========== */
/* ============================= */

export const sushiFetch = fetcher
export const addSushiMiddleware = addMiddleware