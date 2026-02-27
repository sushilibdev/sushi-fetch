type CacheEntry<T> = {
  data: T
  expiry: number
  lastAccess: number
  tags?: string[]
}

// 💡 FITUR BARU: Listener untuk reaktivitas UI
export type CacheListener<T = any> = (data: T | null) => void

export type CacheOptions = {
  maxSize?: number
  defaultTTL?: number
  sliding?: boolean
  cleanupInterval?: number
  onEvict?: (key: string, value: any) => void
}

export class SushiCache {
  private store = new Map<string, CacheEntry<any>>()
  private tagMap = new Map<string, Set<string>>()
  private pendingFetches = new Map<string, Promise<any>>()
  
  // 💡 FITUR BARU: Menyimpan daftar UI/fungsi yang nungguin update data
  private listeners = new Map<string, Set<CacheListener>>()

  private maxSize: number
  private defaultTTL: number
  private sliding: boolean
  private onEvict?: (key: string, value: any) => void

  private hits = 0
  private misses = 0

  private cleanupTimer?: ReturnType<typeof setInterval>

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize ?? Infinity
    this.defaultTTL = options.defaultTTL ?? 5000
    this.sliding = options.sliding ?? false
    this.onEvict = options.onEvict

    if (options.cleanupInterval) {
      this.cleanupTimer = setInterval(() => {
        this.pruneExpired()
      }, options.cleanupInterval)
      
      // Mencegah timer menahan Node.js process dari exit (jika di environment Node)
      if (typeof this.cleanupTimer.unref === 'function') {
        this.cleanupTimer.unref()
      }
    }
  }

  // ========================
  // REACTIVITY (PUB/SUB)
  // ========================

  /**
   * Subscribe ke perubahan data di cache. Sangat berguna untuk React/Vue Hooks.
   * Mengembalikan fungsi untuk unsubscribe.
   */
  subscribe<T>(key: string, listener: CacheListener<T>): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set())
    }
    this.listeners.get(key)!.add(listener as CacheListener)

    return () => {
      this.listeners.get(key)?.delete(listener as CacheListener)
      if (this.listeners.get(key)?.size === 0) {
        this.listeners.delete(key)
      }
    }
  }

  private notify(key: string, data: any | null) {
    if (this.listeners.has(key)) {
      this.listeners.get(key)!.forEach((listener) => listener(data))
    }
  }

  // ========================
  // CORE MEMORY
  // ========================

  set<T>(key: string, data: T, options: number | { ttl?: number; tags?: string[] } = this.defaultTTL) {
    const now = Date.now()
    const ttl = typeof options === 'number' ? options : (options.ttl ?? this.defaultTTL)
    const tags = typeof options === 'number' ? [] : (options.tags ?? [])

    if (this.store.has(key)) {
      this.delete(key) // Bersihkan metadata lama termasuk tags
    }

    this.store.set(key, {
      data,
      expiry: now + ttl,
      lastAccess: now,
      tags
    })

    // Update Tag Map
    for (const tag of tags) {
      if (!this.tagMap.has(tag)) {
        this.tagMap.set(tag, new Set())
      }
      this.tagMap.get(tag)!.add(key)
    }

    this.evictIfNeeded()
    
    // 💡 FITUR BARU: Kasih tahu semua subscriber kalau ada data baru!
    this.notify(key, data)
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key)

    if (!entry) {
      this.misses++
      return null
    }

    const now = Date.now()

    if (now > entry.expiry) {
      this.delete(key)
      this.misses++
      return null
    }

    entry.lastAccess = now

    if (this.sliding) {
      entry.expiry = now + this.defaultTTL
    }

    // Refresh LRU order (Pindahkan ke paling belakang/baru)
    this.store.delete(key)
    this.store.set(key, entry)

    this.hits++
    return entry.data as T
  }

  peek<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null

    if (Date.now() > entry.expiry) {
      // Hapus diam-diam jika expired saat di-peek
      this.delete(key)
      return null
    }

    return entry.data as T
  }

  has(key: string) {
    return this.peek(key) !== null
  }

  delete(key: string) {
    const entry = this.store.get(key)

    if (entry) {
      // Bersihkan Tag Map agar tidak bocor memori
      if (entry.tags) {
        for (const tag of entry.tags) {
          const keys = this.tagMap.get(tag)
          if (keys) {
            keys.delete(key)
            if (keys.size === 0) this.tagMap.delete(tag)
          }
        }
      }

      if (this.onEvict) this.onEvict(key, entry.data)
      this.store.delete(key)
      this.notify(key, null) // Kasih tahu UI kalau datanya hilang
    }
  }

  /**
   * 💡 FITUR BARU: Mutate data secara manual (Optimistic Updates)
   */
  mutate<T>(key: string, mutator: T | ((oldData: T | null) => T), ttl: number = this.defaultTTL) {
    const oldData = this.get<T>(key)
    const entry = this.store.get(key)
    const newData = typeof mutator === 'function' 
      ? (mutator as Function)(oldData) 
      : mutator

    this.set(key, newData, { ttl, tags: entry?.tags })
    return newData
  }

  invalidateTag(tag: string) {
    const keys = this.tagMap.get(tag)
    if (keys) {
      // Array.from agar aman saat delete item di tengah loop
      Array.from(keys).forEach(key => this.delete(key))
      this.tagMap.delete(tag)
    }
  }

  clear() {
    if (this.onEvict) {
      for (const [key, entry] of this.store.entries()) {
        this.onEvict(key, entry.data)
      }
    }
    this.store.clear()
    this.tagMap.clear()
    
    // Beritahu semua subscriber bahwa data mereka hangus
    for (const key of this.listeners.keys()) {
      this.notify(key, null)
    }
  }

  // ========================
  // LRU
  // ========================

  private evictIfNeeded() {
    while (this.store.size > this.maxSize) {
      const oldestKey = this.store.keys().next().value
      if (oldestKey !== undefined) {
        this.delete(oldestKey)
      } else {
        break
      }
    }
  }

  // ========================
  // ADVANCED FETCH
  // ========================

  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = this.defaultTTL
  ): Promise<T> {
    const cached = this.get<T>(key)
    if (cached !== null) return cached

    // Dedupe fetch (Mencegah Cache Stampede)
    if (this.pendingFetches.has(key)) {
      return this.pendingFetches.get(key)! as Promise<T>
    }

    const fetchPromise = (async () => {
      try {
        const data = await fetcher()
        this.set(key, data, ttl)
        return data
      } finally {
        this.pendingFetches.delete(key)
      }
    })()

    this.pendingFetches.set(key, fetchPromise)
    return fetchPromise
  }

  /**
   * Stale While Revalidate
   */
  async getOrSetSWR<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = this.defaultTTL
  ): Promise<T> {
    const entry = this.store.get(key)
    const now = Date.now()

    if (entry) {
      const isExpired = now > entry.expiry

      if (!isExpired) {
        this.hits++
        return entry.data as T
      }

      // Expired tapi masih ada (Stale). Kembalikan data basi, tapi revalidate di belakang layar.
      this.revalidate(key, fetcher, ttl).catch(err => {
        console.error(`[SushiCache] SWR Background fetch failed for key ${key}:`, err)
      })
      
      return entry.data as T
    }

    return this.getOrSet(key, fetcher, ttl)
  }

  private async revalidate<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number
  ): Promise<void> {
    // Jika sudah ada request berjalan, biarkan getOrSet yang handle
    if (this.pendingFetches.has(key)) return

    const fetchPromise = fetcher()
      .then((data) => {
        this.set(key, data, ttl)
      })
      .finally(() => {
        this.pendingFetches.delete(key)
      })

    this.pendingFetches.set(key, fetchPromise)
    return fetchPromise
  }

  // ========================
  // UTIL
  // ========================

  pruneExpired() {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiry) {
        this.delete(key)
      }
    }
  }

  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    this.clear()
    this.listeners.clear()
    this.pendingFetches.clear()
  }
}