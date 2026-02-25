import fetch, { Response, RequestInit } from "node-fetch"
import { SushiCache } from "./cache"

/* ============================= */
/* ========= GLOBALS =========== */
/* ============================= */

const cache = new SushiCache()
const pendingRequests = new Map<string, Promise<unknown>>()
const revalidateLocks = new Set<string>()

const DEFAULT_TTL = 5000

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

function buildAbortController(timeout?: number): AbortController | null {
  if (!timeout) return null
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  // cleanup timer on abort
  controller.signal.addEventListener("abort", () => clearTimeout(id))
  return controller
}

function computeBackoff(
  attempt: number,
  base: number,
  strategy: "fixed" | "exponential"
) {
  if (strategy === "fixed") return base
  return base * Math.pow(2, attempt) + Math.random() * 100
}

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
    } catch (err) {
      const shouldRetry = retryOn ? retryOn(null, err) : true
      if (attempt >= retries || !shouldRetry) throw err

      await sleep(computeBackoff(attempt, delay, strategy))
      attempt++
    }
  }
}

async function runMiddleware(
  type: keyof Middleware,
  ctx: MiddlewareContext,
  resOrErr?: unknown
) {
  const stack = [...globalMiddleware, ...(ctx.options.middleware || [])]

  for (const mw of stack) {
    const fn = mw[type]
    if (!fn) continue

    if (type === "onRequest") await fn(ctx)
    else await fn(resOrErr as any, ctx)
  }
}

function buildCacheKey(url: string, options: RequestInit): string {
  return url + JSON.stringify(options || {})
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
      if (revalidate && !revalidateLocks.has(key)) {
        revalidateLocks.add(key)
        fetcher(url, { ...options, revalidate: false }).finally(() =>
          revalidateLocks.delete(key)
        )
      }
      return cached
    }
  }

  /* ========== DEDUP ========== */
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key) as Promise<T>
  }

  /* ========== REQUEST ========== */

  const requestPromise = retryFetch(
    async () => {
      await runMiddleware("onRequest", ctx)

      const controller = buildAbortController(timeout)

      const res = await fetch(url, {
        ...fetchOptions,
        signal: controller?.signal,
      })

      await runMiddleware("onResponse", ctx, res)

      if (!validateStatus(res.status)) {
        throw new Error(`HTTP ${res.status}`)
      }

      let data: unknown

      if (parser) data = await parser(res)
      else if (parseJson) data = await res.json()
      else data = await res.text()

      if (transform) {
        data = transform(data)
      }

      if (useCache) {
        cache.set(key, data, ttl)

        for (const tag of cacheTags) {
          cache.set(`__tag__:${tag}:${key}`, true, ttl)
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
  clear: () => cache.clear(),
  delete: (key: string) => cache.delete(key),
  has: (key: string) => cache.has(key),

  invalidateTag: (tag: string) => {
    const prefix = `__tag__:${tag}:`
    for (const k of cache.keys()) {
      if (k.startsWith(prefix)) {
        const realKey = k.slice(prefix.length)
        cache.delete(realKey)
        cache.delete(k)
      }
    }
  },
}

/* ============================= */
/* ========= EXPORTS =========== */
/* ============================= */

export const sushiFetch = fetcher
export const addSushiMiddleware = addMiddleware