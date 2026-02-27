<div align="center">
  <h1>🍣 sushi-fetch</h1>
  <p><strong>Data fetching should be simple, fast, and delicious.</strong></p>
  <p>A tiny, zero-dependency, and highly-optimized data-fetching & caching library for modern JavaScript and TypeScript apps.</p>

  <p>
    <a href="https://www.npmjs.com/package/sushi-fetch"><img src="https://img.shields.io/npm/v/sushi-fetch?color=33cd56&logo=npm" alt="NPM Version" /></a>
    <a href="https://www.npmjs.com/package/sushi-fetch"><img src="https://img.shields.io/npm/dm/sushi-fetch?color=blue" alt="NPM Downloads" /></a>
    <a href="https://bundlephobia.com/package/sushi-fetch"><img src="https://img.shields.io/bundlephobia/minzip/sushi-fetch?color=success&label=size" alt="Bundle Size" /></a>
    <img src="https://img.shields.io/node/v/sushi-fetch" alt="Node Version" />
    <img src="https://img.shields.io/badge/TypeScript-Ready-blue?logo=typescript" alt="TypeScript" />
    <img src="https://img.shields.io/badge/dependencies-0-brightgreen" alt="Zero Dependencies" />
  </p>
</div>

---

## 🤔 Why sushi-fetch?

Most HTTP clients give you only the basics. You still end up writing your own wrappers for caching, retries, and request deduplication. **sushi-fetch** is designed to solve that out-of-the-box without bloating your bundle size.

Built on top of the native `globalThis.fetch`, it provides the intelligence of massive libraries (like SWR or React Query) in a fraction of the size.

### ✨ The Superpowers
* 📦 **Built-in Smart Caching (TTL + LRU):** Responses are automatically cached and reused.
* ⚡ **Stale-While-Revalidate (SWR):** Instant UI updates with background revalidation.
* 🔁 **Request Deduplication:** Prevents "Cache Stampedes". 100 identical parallel requests will result in exactly **1** network call.
* 📡 **Reactivity (Pub/Sub):** Subscribe to cache keys and mutate data for Optimistic Updates.
* 🏷️ **Cache Tagging:** Group related requests and invalidate them instantly by tag.
* 🔄 **Smart Retries:** Handle flaky networks gracefully with fixed or exponential backoff strategies.
* 🔌 **Global Middleware:** Intercept requests, responses, and errors globally.
* 🪶 **Zero Dependencies:** Pure, modern JavaScript.

---

## 📦 Installation

```bash
npm install sushi-fetch
```

Also works perfectly with `yarn`, `pnpm`, and `bun`.

---

## 🚀 Quick Start

**1. Basic Fetch & Cache (Node / Vanilla JS)**

```ts 
import { sushiFetch } from "sushi-fetch"

// First request: Hits the network
const users = await sushiFetch("[https://api.example.com/users](https://api.example.com/users)", {
  ttl: 60000, // Cache for 60 seconds
  retries: 2
})

// Second request (immediately after): INSTANT (0-1ms) from memory!
const cachedUsers = await sushiFetch("[https://api.example.com/users](https://api.example.com/users)")
```

**2. React Integration (Reactivity & Hooks)**

sushi-fetch exposes a powerful `subscribe` and `mutate` API, making it trivial to create reactive components.

```ts
import { useEffect, useState } from "react"
import { sushiFetch, sushiCache } from "sushi-fetch"

export function useSushi<T>(url: string) {
  const [data, setData] = useState<T | null>(() => sushiCache.get(url))

  useEffect(() => {
    // 1. Fetch and revalidate in background
    sushiFetch<T>(url, { revalidate: true })

    // 2. Subscribe to cache mutations
    const unsubscribe = sushiCache.subscribe<T>(url, setData)
    return () => unsubscribe()
  }, [url])

  return { data }
}

// In your component:
// Mutate cache directly for Optimistic Updates!
// sushiCache.mutate("/api/users", [...newData])
```

**3. Request Deduplication**

Stop spamming your servers. sushi-fetch automatically groups identical requests made at the exact same time.

```ts
// Only ONE network request is actually sent to the server.
await Promise.all([
  sushiFetch("[https://api.example.com/data](https://api.example.com/data)"),
  sushiFetch("[https://api.example.com/data](https://api.example.com/data)"),
  sushiFetch("[https://api.example.com/data](https://api.example.com/data)"),
])
```

**4. Cache Tags & Invalidation**

Easily manage complex caches by grouping them with tags.

```ts
import { sushiFetch, sushiCache } from "sushi-fetch"

// Assign tags during fetch
await sushiFetch("/api/posts/1", { cacheTags: ["posts-group"] })
await sushiFetch("/api/posts/2", { cacheTags: ["posts-group"] })

// Later, invalidate all posts instantly:
sushiCache.invalidateTag("posts-group")
```

**5. Global Middleware**

Log requests, add auth headers, or handle errors globally.

```ts
import { addSushiMiddleware } from "sushi-fetch"

addSushiMiddleware({
  onRequest: (ctx) => {
    ctx.options.headers = { ...ctx.options.headers, Authorization: "Bearer token" }
  },
  onResponse: (res) => console.log(`✅ Success: ${res.status}`),
  onError: (err) => console.error(`❌ Fetch failed:`, err),
})
```

---

## ⚙️ API Reference

`sushiFetch(url, options?)`

| Option | Type | Default | Description |
| ---------- | ---------- | ---------- | ---------- | 
| `cache` | `boolean` | `true` | Enable/disable cache entirely |
| `ttl` | `number` | `5000` | Cache lifetime (in milliseconds) |
| `revalidate` | `boolean` | `false` | Return cached data instantly, but refresh in background |
| `timeout` | `number` | `-` | Request timeout (aborts if exceeded) |
| `retries` | `number` | `0` | Number of retry attempts on failure |
| `retryDelay` | `number` | `500` | Delay between retries (in ms) |
| `retryStrategy` | `"fixed" | "exponential"` | `"exponential"` | Backoff algorithm for retries |
| `cacheTags` | `string[]` | `[]` | Tags for grouped cache invalidation |
| `transform` | `(data) => any` | `-` | Format data before caching it |
| `onSuccess` | `(data) => void` | `-` | Hook triggered on successful fetch |
| `onError` | `(error) => void` | `-` | Hook triggered on failed fetch |

**`sushiCache` Utilities**

```ts
sushiCache.get(key)
sushiCache.set(key, data, ttl?)
sushiCache.has(key)
sushiCache.delete(key)
sushiCache.clear()

// Pub/Sub & Mutate
sushiCache.subscribe(key, listener)
sushiCache.mutate(key, mutatorData)
sushiCache.invalidateTag(tag)
```

---

## 🛣 Roadmap

- [x] Global Middleware system
- [x] Reactivity (Pub/Sub & Mutate)
- [x] Cache tagging
- [ ] Built-in React Hooks package (`@sushi-fetch/react`)
- [ ] Polling / Auto referch interval
- [ ] Devtools extensions

---

## 🤝 Contributing

Pull requests, issues, and feature ideas are highly welcome!

If you like this project, consider:

- ⭐ Starring the repo
- 🍣 Sharing it with your team
- 🐛 Reporting bugs

---

## 💖 Sponsors

I’m building this project independently. If `sushi-fetch` saves you time and headache, consider supporting its development ❤️ Every bit of support helps keep the project alive and brewing new features!

---

## 📄 License

MIT © 2026 — sushilibdev