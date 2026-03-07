export type CacheEntry<T> = {
  data: T
  expiry: number
  lastAccess: number
  tags?: string[]
}

export type CacheListener<T = any> = (data: T | null) => void

// Universal Storage Interface to run on Browser, Node.js, or React Native
export type StorageAdapter = {
  getItem: (key: string) => string | null | Promise<string | null>
  setItem: (key: string, value: string) => void | Promise<void>
  removeItem: (key: string) => void | Promise<void>
}

export type CacheOptions = {
  maxSize?: number
  defaultTTL?: number
  sliding?: boolean
  cleanupInterval?: number
  onEvict?: (key: string, value: any) => void
  persistKey?: string
  storage?: StorageAdapter 
}

export class SushiCache {
  #store = new Map<string, CacheEntry<any>>()
  #tags = new Map<string, Set<string>>()
  #fetches = new Map<string, Promise<any>>()
  #listeners = new Map<string, Set<CacheListener>>()

  #maxSize: number
  #defaultTTL: number
  #sliding: boolean
  #onEvict?: (key: string, value: any) => void

  // Persistence State
  #persistKey?: string
  #storage?: StorageAdapter
  #syncTimer?: any

  #hits = 0
  #misses = 0
  #timer?: any

  constructor(options: CacheOptions = {}) {
    this.#maxSize = options.maxSize ?? Infinity
    this.#defaultTTL = options.defaultTTL ?? 5000
    this.#sliding = options.sliding ?? false
    this.#onEvict = options.onEvict

    this.#persistKey = options.persistKey
    this.#storage = options.storage ?? (typeof globalThis !== 'undefined' ? globalThis.localStorage : undefined)

    if (this.#persistKey && this.#storage) this.#hydrate()

    if (options.cleanupInterval) {
      this.#timer = setInterval(() => this.pruneExpired(), options.cleanupInterval)
      if (this.#timer?.unref) this.#timer.unref()
    }
  }

  /* ============================= */
  /* ===== PERSISTENCE CORE ====== */
  /* ============================= */

  // Load data from storage to RAM when first running
  #hydrate() {
    try {
      const raw = this.#storage!.getItem(this.#persistKey!)
      if (raw instanceof Promise) {
        raw.then(data => this.#parseHydration(data)).catch(() => {})
      } else {
        this.#parseHydration(raw)
      }
    } catch (e) { /* Ignore storage errors to prevent the app from crashing. */ }
  }

  #parseHydration(raw: string | null) {
    if (!raw) return
    try {
      const parsed: [string, CacheEntry<any>][] = JSON.parse(raw)
      const now = Date.now()
      parsed.forEach(([k, e]) => {
        // Only enter unexpired data into RAM!
        if (e.expiry > now) {
          this.#store.set(k, e)
          e.tags?.forEach(tag => {
            if (!this.#tags.has(tag)) this.#tags.set(tag, new Set())
            this.#tags.get(tag)!.add(k)
          })
        }
      })
    } catch (e) { /* Ignore corrupt JSON */ }
  }

  // Save data from RAM to storage with debouncing (Anti-Lag)
  #sync() {
    if (!this.#persistKey || !this.#storage) return
    if (this.#syncTimer) clearTimeout(this.#syncTimer)
    
    this.#syncTimer = setTimeout(async () => {
      try {
        const entries = Array.from(this.#store.entries())
        await this.#storage!.setItem(this.#persistKey!, JSON.stringify(entries))
      } catch (e) {}
    }, 50) 
    
    if (this.#syncTimer?.unref) this.#syncTimer.unref()
  }

  /* ============================= */
  /* ========= EVENTS ============ */
  /* ============================= */

  subscribe<T>(key: string, listener: CacheListener<T>): () => void {
    if (!this.#listeners.has(key)) this.#listeners.set(key, new Set())
    this.#listeners.get(key)!.add(listener as CacheListener)
    return () => {
      this.#listeners.get(key)?.delete(listener as CacheListener)
      if (this.#listeners.get(key)?.size === 0) this.#listeners.delete(key)
    }
  }

  #notify(key: string, data: any | null) {
    this.#listeners.get(key)?.forEach((l) => l(data))
  }

  /* ============================= */
  /* ========= MUTATORS ========== */
  /* ============================= */

  set<T>(key: string, data: T, options: number | { ttl?: number; tags?: string[] } = this.#defaultTTL) {
    const ttl = typeof options === 'number' ? options : (options.ttl ?? this.#defaultTTL)
    const tags = typeof options === 'number' ? [] : (options.tags ?? [])

    this.delete(key) // Delete the old one first to make it clean

    // Optimization: Delete the oldest ones if they are full.
    if (this.#store.size >= this.#maxSize) {
      const oldest = this.#store.keys().next().value
      if (oldest !== undefined) this.delete(oldest)
    }

    this.#store.set(key, { data, expiry: Date.now() + ttl, lastAccess: Date.now(), tags })

    tags.forEach(tag => {
      if (!this.#tags.has(tag)) this.#tags.set(tag, new Set())
      this.#tags.get(tag)!.add(key)
    })

    this.#notify(key, data)
    this.#sync() // Trigger save to disk
  }

  get<T>(key: string): T | null {
    const entry = this.#store.get(key)
    if (!entry) return (this.#misses++, null)

    if (Date.now() > entry.expiry) return (this.delete(key), this.#misses++, null)

    entry.lastAccess = Date.now()
    if (this.#sliding) {
      entry.expiry = Date.now() + this.#defaultTTL
      this.#sync() // Sync because the expiry is extended
    }

    this.#store.delete(key)
    this.#store.set(key, entry)
    return (this.#hits++, entry.data as T)
  }

  peek<T>(key: string): T | null {
    const e = this.#store.get(key)
    return (e && Date.now() > e.expiry) ? (this.delete(key), null) : (e?.data ?? null)
  }

  has(key: string) { return this.peek(key) !== null }

  delete(key: string) {
    const e = this.#store.get(key)
    if (e) {
      e.tags?.forEach(t => {
        const ks = this.#tags.get(t)
        if (ks) (ks.delete(key), ks.size || this.#tags.delete(t))
      })
      this.#onEvict?.(key, e.data)
      this.#store.delete(key)
      this.#notify(key, null)
      this.#sync() // Update to disk
    }
  }

  mutate<T>(key: string, mutator: T | ((oldData: T | null) => T), ttl = this.#defaultTTL) {
    const old = this.get<T>(key)
    const entry = this.#store.get(key)
    const next = typeof mutator === 'function' ? (mutator as Function)(old) : mutator
    return (this.set(key, next, { ttl, tags: entry?.tags }), next)
  }

  invalidateTag(tag: string) {
    this.#tags.get(tag)?.forEach(k => this.delete(k))
    this.#tags.delete(tag)
    this.#sync()
  }

  clear() {
    if (this.#onEvict) this.#store.forEach((e, k) => this.#onEvict!(k, e.data))
    this.#store.clear()
    this.#tags.clear()
    this.#listeners.forEach((_, k) => this.#notify(k, null))
    
    if (this.#persistKey && this.#storage) {
      Promise.resolve(this.#storage.removeItem(this.#persistKey)).catch(() => {})
    }
  }

  /* ============================= */
  /* ======== RESOLVERS ========== */
  /* ============================= */

  async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttl = this.#defaultTTL): Promise<T> {
    const cached = this.get<T>(key)
    if (cached !== null) return cached
    if (this.#fetches.has(key)) return this.#fetches.get(key)! as Promise<T>

    const p = (async () => {
      try {
        const d = await fetcher()
        return (this.set(key, d, ttl), d)
      } finally { this.#fetches.delete(key) }
    })()
    return (this.#fetches.set(key, p), p)
  }

  async getOrSetSWR<T>(key: string, f: () => Promise<T>, ttl = this.#defaultTTL): Promise<T> {
    const e = this.#store.get(key)
    if (e) {
      if (Date.now() <= e.expiry) return (this.#hits++, e.data as T)
      this.#revalidate(key, f, ttl).catch(() => {})
      return e.data as T
    }
    return this.getOrSet(key, f, ttl)
  }

  async #revalidate<T>(key: string, f: () => Promise<T>, ttl: number): Promise<void> {
    if (this.#fetches.has(key)) return
    const p = f().then(d => this.set(key, d, ttl)).finally(() => this.#fetches.delete(key))
    this.#fetches.set(key, p)
  }

  pruneExpired() {
    let hasExpired = false
    this.#store.forEach((e, k) => {
      if (Date.now() > e.expiry) {
        this.delete(k)
        hasExpired = true
      }
    })
    // Only call sync if something is deleted.
    if (hasExpired) this.#sync() 
  }

  destroy() {
    if (this.#timer) clearInterval(this.#timer)
    if (this.#syncTimer) clearTimeout(this.#syncTimer)
    this.clear()
    this.#listeners.clear()
    this.#fetches.clear()
  }
}