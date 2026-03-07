/**
 * 🍣 Sushi Fetch
 * A tiny but powerful data-fetching & caching library
 * -----------------------------------------------
 * Public API entry point (v1.0.0 - The Indestructible Edition)
 */

// ==============================
// CORE FETCH API
// ==============================

export {
  fetcher,
  sushiFetch,
  sushiFetch as sushi,
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

// Export all types from Fetcher so that user Autocomplete works 100%
export type {
  FetchOptions,
  SushiError,
  RetryConfig,
  MiddlewareContext,
  Middleware,
  Interceptors
} from "./core/fetcher.js"

// Export all types of Cache, including StorageAdapter for Offline features
export type {
  CacheListener,
  CacheOptions,
  StorageAdapter,
  CacheEntry
} from "./core/cache.js"

// ==============================
// VERSION
// ==============================

export const VERSION = "1.0.0"

export { sushiFetch as default } from "./core/fetcher.js"