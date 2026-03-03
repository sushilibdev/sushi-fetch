type CacheEntry<T> = {
  data: T
  expiry: number
  lastAccess: number
  tags?: string[]
}

export type CacheListener<T = any> = (data: T | null) => void

export type CacheOptions = {
  maxSize?: number
  defaultTTL?: number
  sliding?: boolean
  cleanupInterval?: number
  onEvict?: (key: string, value: any) => void
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

  #hits = 0
  #misses = 0
  #timer?: any

  constructor(options: CacheOptions = {}) {
    this.#maxSize = options.maxSize ?? Infinity
    this.#defaultTTL = options.defaultTTL ?? 5000
    this.#sliding = options.sliding ?? false
    this.#onEvict = options.onEvict

    if (options.cleanupInterval) {
      this.#timer = setInterval(() => this.pruneExpired(), options.cleanupInterval)
      if (this.#timer.unref) this.#timer.unref()
    }
  }

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

  set<T>(key: string, data: T, options: number | { ttl?: number; tags?: string[] } = this.#defaultTTL) {
    const ttl = typeof options === 'number' ? options : (options.ttl ?? this.#defaultTTL)
    const tags = typeof options === 'number' ? [] : (options.tags ?? [])

    this.delete(key)

    this.#store.set(key, { data, expiry: Date.now() + ttl, lastAccess: Date.now(), tags })

    tags.forEach(tag => {
      if (!this.#tags.has(tag)) this.#tags.set(tag, new Set())
      this.#tags.get(tag)!.add(key)
    })

    if (this.#store.size > this.#maxSize) {
      const oldest = this.#store.keys().next().value
      if (oldest !== undefined) this.delete(oldest)
    }
    this.#notify(key, data)
  }

  get<T>(key: string): T | null {
    const entry = this.#store.get(key)
    if (!entry) return (this.#misses++, null)

    if (Date.now() > entry.expiry) return (this.delete(key), this.#misses++, null)

    entry.lastAccess = Date.now()
    if (this.#sliding) entry.expiry = Date.now() + this.#defaultTTL

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
  }

  clear() {
    if (this.#onEvict) this.#store.forEach((e, k) => this.#onEvict!(k, e.data))
    this.#store.clear()
    this.#tags.clear()
    this.#listeners.forEach((_, k) => this.#notify(k, null))
  }

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
    this.#store.forEach((e, k) => Date.now() > e.expiry && this.delete(k))
  }

  destroy() {
    if (this.#timer) clearInterval(this.#timer)
    this.clear()
    this.#listeners.clear()
    this.#fetches.clear()
  }
}
