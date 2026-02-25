type CacheEntry<T> = {
  data: T
  expiry: number
  lastAccess: number
}

type CacheOptions = {
  maxSize?: number
  defaultTTL?: number
  onEvict?: (key: string, value: any) => void
}

export class SushiCache {
  private store = new Map<string, CacheEntry<any>>()

  private maxSize: number
  private defaultTTL: number
  private onEvict?: (key: string, value: any) => void

  private hits = 0
  private misses = 0

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize ?? Infinity
    this.defaultTTL = options.defaultTTL ?? 5000
    this.onEvict = options.onEvict
  }

  // ========================
  // CORE
  // ========================

  set<T>(key: string, data: T, ttl: number = this.defaultTTL) {
    const now = Date.now()
    const expiry = now + ttl

    if (this.store.has(key)) {
      this.store.delete(key) // refresh order for LRU
    }

    this.store.set(key, {
      data,
      expiry,
      lastAccess: now,
    })

    this.evictIfNeeded()
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key)

    if (!entry) {
      this.misses++
      return null
    }

    if (Date.now() > entry.expiry) {
      this.store.delete(key)
      this.misses++
      return null
    }

    entry.lastAccess = Date.now()

    // refresh LRU order
    this.store.delete(key)
    this.store.set(key, entry)

    this.hits++
    return entry.data as T
  }

  peek<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiry) {
      this.store.delete(key)
      return null
    }
    return entry.data as T
  }

  has(key: string) {
    return this.get(key) !== null
  }

  delete(key: string) {
    const entry = this.store.get(key)
    if (entry && this.onEvict) {
      this.onEvict(key, entry.data)
    }
    this.store.delete(key)
  }

  deleteMany(keys: string[]) {
    for (const key of keys) {
      this.delete(key)
    }
  }

  clear() {
    if (this.onEvict) {
      for (const [key, entry] of this.store.entries()) {
        this.onEvict(key, entry.data)
      }
    }
    this.store.clear()
  }

  // ========================
  // LRU EVICTION
  // ========================

  private evictIfNeeded() {
    if (this.store.size <= this.maxSize) return

    const oldestKey = this.store.keys().next().value
    if (!oldestKey) return

    const entry = this.store.get(oldestKey)
    if (entry && this.onEvict) {
      this.onEvict(oldestKey, entry.data)
    }

    this.store.delete(oldestKey)
  }

  // ========================
  // UTILITIES
  // ========================

  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = this.defaultTTL
  ): Promise<T> {
    const cached = this.get<T>(key)
    if (cached !== null) return cached

    const data = await fetcher()
    this.set(key, data, ttl)
    return data
  }

  pruneExpired() {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiry) {
        this.delete(key)
      }
    }
  }

  size() {
    return this.store.size
  }

  keys() {
    return this.store.keys()
  }

  values<T>() {
    return Array.from(this.store.values()).map(v => v.data as T)
  }

  entries<T>() {
    return Array.from(this.store.entries()).map(([k, v]) => [k, v.data] as [string, T])
  }

  stats() {
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.store.size,
    }
  }
}