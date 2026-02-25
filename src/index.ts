// Core API
export { fetcher, sushiFetch, sushiCache } from "./core/fetcher"

// Cache engine
export { SushiCache } from "./core/cache"

// Optional: re-export useful types (future-proofing)
export type {
  // nanti kalau kamu punya type seperti FetchOptions dll
  // tinggal export di sini
} from "./core/fetcher"