<div align="center">

# 🍣 sushi-fetch
**The lightweight, reactive powerhouse for modern data fetching.**

[![NPM Version](https://img.shields.io/npm/v/sushi-fetch?color=ff4757&logo=npm&style=for-the-badge)](https://www.npmjs.com/package/sushi-fetch)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/sushi-fetch?color=2f3542&label=Gzipped&style=for-the-badge)](https://bundlephobia.com/package/sushi-fetch)
[![Downloads](https://img.shields.io/npm/dm/sushi-fetch?color=5352ed&style=for-the-badge)](https://www.npmjs.com/package/sushi-fetch)
[![Stars](https://img.shields.io/github/stars/sushilibdev/sushi-fetch?style=for-the-badge&color=eccc68)](https://github.com/sushilibdev/sushi-fetch)

<p align="center">
  <b>Tiny footprint. Zero dependencies. Enterprise-grade features.</b>
  <br />
  Stop shipping 15kB+ of <code>axios</code> or <code>tanstack-query</code> for simple apps. 
  <br />
  Get Smart Batching, Offline Persistence, SWR, and Reactivity in <b>~3kB (Gzipped)</b>.
</p>

[Explore Docs](#-api-reference) • [Report Bug](https://github.com/sushilibdev/sushi-fetch/issues) • [Request Feature](https://github.com/sushilibdev/sushi-fetch/issues)

</div>

---

## 🚀 The v1.0.0 Evolution

Modern web apps need more than just `fetch()`. They need to survive poor networks, deduplicate aggressive UI renders, and keep data fresh automatically. Usually, you'd have to choose between "too barebones" (native fetch) or "too heavy" (GraphQL clients/TanStack).

**sushi-fetch v1.0.0** is the "Sweet Spot". We bring Silicon Valley-grade data synchronization to a ridiculously small footprint.

### ✨ The "Secret Sauce" (Features)

* 🚦 **[NEW] Smart Batching (Event Loop Deduplication)**: Prevents network spam. 10 identical requests in the same tick? Only 1 hits the server.
* 💾 **[NEW] Offline Persistence**: Automatically dumps cache to `localStorage` (or custom adapters) and hydrates instantly on reload.
* 📡 **[NEW] Auto-Polling & Focus Revalidation**: Keeps your UI feeling "alive". Data refetches automatically when the user switches tabs or on a set interval.
* 🧠 **Smart Memory Cache**: Built-in TTL, sliding expiration, and LRU eviction.
* 🔄 **SWR (Stale-While-Revalidate)**: Instant UI updates with background synchronization.
* ⚡ **Reactive Pub/Sub**: Real-time state sync across your entire UI without needing Redux or Pinia.
* 📈 **Native Streaming**: Simple progress tracking for big uploads/downloads.
* 🔁 **Smart Retries**: Fixed or Exponential Backoff strategies out of the box.
* 🪶 **Zero Dependencies**: Pure, tree-shakable, strongly-typed TypeScript.

---

## 📦 Installation

```bash
npm install sushi-fetch  # or pnpm, yarn, bun
```

---

## 🛠 The Magic (Quick Starts)

**1. The "Indestructible" Request (v1.0.0)**

Combine our most powerful features in a single, elegant call.

```ts 
import { sushi } from 'sushi-fetch';

const data = await sushi.get('/api/dashboard', {
  batch: true,              // Groups simultaneous calls into one network request
  revalidateOnFocus: true,  // Silently updates data when user returns to the tab
  pollInterval: 10000       // Keeps data fresh every 10 seconds
});
```

**2. Offline Persistence (Zero-Config Hydration)**

Keep your app working even when the signal drops. `sushi-fetch` handles the storage and hydration automatically.

```ts
import { SushiCache } from 'sushi-fetch';

// Setup persistent cache (Uses localStorage by default in browsers)
const persistentCache = new SushiCache({ 
  persistKey: 'my-app-offline-db' 
});

// Next time the user opens the app, data loads from disk in 0ms!
```

**3. The Power of SWR (Stale-While-Revalidate)**

Show the old data immediately, fetch the new one in the background. Your UI feels 10x faster.

```ts
const { data } = await sushi.get('/api/stats', { revalidate: true });
```

**4. Real-time Progress (Streaming)**

Tracking download/upload progress without messing with raw Streams.

```ts
await sushi.get('/api/large-file', {
  onProgress: ({ percentage }) => console.log(`Downloading: ${percentage}%`),
});
```

---

## 📊 Comparison: No Bloat, Just Speed

| Feature | Native Fetch | Axios | **Sushi-Fetch** |
| :--- | :--- | :--- | :--- |
| **Size (Gzip)**| ~0kB | ~5.5kB | **~3.5kB** |
| **Caching** | ❌ | ❌ | ✅ (Built-in) |
| **Smart Batching** | ❌ | ❌ | ✅ (Auto) |
| **Offline Sync** | ❌ | ❌ | ✅ |
| **SWR** | ❌ | ❌ | ✅ |
| **Revalidation** | ❌ | ❌ | ✅ (On Focus / Interval) |
| **Streaming** | ❌ (Hard) | ❌ | ✅ (Simple) |

---

## ⚙️ Advanced: Global Instance & Interceptors

Create a pre-configured instance for your specific API, complete with middleware and auth interception.

```ts
import { createSushi } from 'sushi-fetch';

const api = createSushi({
  baseUrl: '[https://api.myapp.com/v1](https://api.myapp.com/v1)',
  interceptors: {
    request: async (url, options) => {
      options.token = getMySecretToken(); // Automatically attaches Bearer token
      return options;
    }
  }
});

// Usage anywhere in your app:
const user = await api.get('/profile');
```

---

## 🤝 Support the Movement

This project is a labor of love for efficient, high-performance code. If sushi-fetch helped you build a faster app, please consider:

- Giving it a **Star** ⭐ (It helps others find the library!)
- Submitting an **Issue** if you find a bug.
- Sharing it on **Twitter/X** or **LinkedIn.**

---

## 📄 License

MIT © sushilibdev