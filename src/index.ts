/**
 * 🍣 Sushi Fetch
 * A tiny but powerful data-fetching & caching library
 * -----------------------------------------------
 * Public API entry point
 */

// ==============================
// CORE FETCH API
// ==============================

export {
  fetcher,
  sushiFetch,
  sushiCache,
  addSushiMiddleware // 💡 Ditambahkan agar user bisa pasang middleware global
} from "./core/fetcher.js"

// ==============================
// CACHE ENGINE
// ==============================

export {
  SushiCache
} from "./core/cache.js"

// ==============================
// TYPE EXPORTS
// ==============================

export type {
  FetchOptions,
} from "./core/fetcher.js"

export type {
  CacheListener,
  CacheOptions
} from "./core/cache.js"

// ==============================
// VERSION
// ==============================

export const VERSION = "0.2.0"