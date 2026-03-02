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
  sushiFetch as sushi, // alias agar bisa dipanggil sushi.create()
  createSushi,
  sushiCache,
  addSushiMiddleware
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
  SushiError,
} from "./core/fetcher.js"

export type {
  CacheListener,
  CacheOptions
} from "./core/cache.js"

// ==============================
// VERSION
// ==============================

export const VERSION = "0.5.0"

export { sushiFetch as default } from "./core/fetcher.js"