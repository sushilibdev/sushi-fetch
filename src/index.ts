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

// 💡 Catatan: Pastikan kamu menambahkan kata 'export' di depan `type CacheOptions` 
// di dalam file cache.ts jika ingin mengekspornya di sini.
export type {
  CacheListener // 💡 Diekspor agar user bisa membuat custom hooks/langganan cache
} from "./core/cache.js"

// ==============================
// FUTURE EXTENSIONS (placeholder)
// ==============================

/**
 * Example for future:
 *
 * export { createClient } from "./client"
 * export { createStore } from "./store"
 *
 * export type { ClientOptions } from "./client"
 */

// ==============================
// VERSION
// ==============================

export const VERSION = "0.1.0"