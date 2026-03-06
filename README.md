<div align="center">

# 🍣 sushi-fetch
**The lightweight, reactive powerhouse for modern data fetching.**

[![NPM Version](https://img.shields.io/npm/v/sushi-fetch?color=ff4757&logo=npm&style=for-the-badge)](https://www.npmjs.com/package/sushi-fetch)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/sushi-fetch?color=2f3542&label=Gzipped&style=for-the-badge)](https://bundlephobia.com/package/sushi-fetch)
[![Downloads](https://img.shields.io/npm/dm/sushi-fetch?color=5352ed&style=for-the-badge)](https://www.npmjs.com/package/sushi-fetch)
[![Stars](https://img.shields.io/github/stars/sushilibdev/sushi-fetch?style=for-the-badge&color=eccc68)](https://github.com/sushilibdev/sushi-fetch)

<p align="center">
  <b>Tiny footprint. Zero dependencies. Enterprise features.</b>
  <br />
  Stop shipping 15kB+ of <code>axios</code> or <code>tanstack-query</code> for simple apps. 
  <br />
  Get Caching, SWR, Retries, and Streaming in ~3kB (Gzipped).
</p>

[Explore Docs](#-api-reference) • [Report Bug](https://github.com/sushilibdev/sushi-fetch/issues) • [Request Feature](https://github.com/sushilibdev/sushi-fetch/issues)

</div>

---

## 🚀 Why sushi-fetch?

Modern web apps need more than just `fetch()`. They need **caching**, **automatic retries**, and **reactivity**. Usually, you'd have to choose between "too simple" (native fetch) or "too heavy" (TanStack Query).

**sushi-fetch** is the "Sweet Spot". It's built for developers who care about **Performance** and **Bundle Size** without sacrificing the developer experience (DX).

### ✨ The "Secret Sauce" (Features)

* 🧠 **Smart Memory Cache**: Built-in TTL, sliding expiration, and LRU eviction.
* 🔄 **SWR (Stale-While-Revalidate)**: Instant UI updates with background synchronization.
* ⚡ **Request Deduplication**: No more "double-fetching". Identical requests are merged into one.
* 📡 **Reactive Pub/Sub**: Real-time state sync across your entire UI without a Store.
* 📈 **Native Streaming**: Simple progress tracking for big uploads/downloads.
* 🛡️ **Async Interceptors**: Full control over requests/responses (v0.7.0+).
* 🔁 **Smart Retries**: Fixed or Exponential Backoff strategies.
* 🪶 **Zero Dependencies**: Pure, tree-shakable TypeScript.

---

## 📦 Installation

```bash
npm install sushi-fetch  # or pnpm, yarn, bun
```

## 🛠 Quick Start 

**1. Simple Fetching with 0ms Cache**
```ts
import { sushiFetch } from 'sushi-fetch';

// 1st call: Goes to Network
const data = await sushiFetch('/api/user', { ttl: 60000 });

// 2nd call: Served from Memory instantly!
const cached = await sushiFetch('/api/user');
```

**2. The Power of SWR**

Show the old data immediately, fetch the new one in the background. Your UI feels 10x faster.

```ts
const { data } = await sushiFetch('/api/stats', { revalidate: true });
```

**3. Real-time Progress (The "Snake" Progress)**

Tracking download/upload progress has never been this easy.

```ts
await sushiFetch('/api/large-file', {
  onProgress: (percent) => console.log(`Progress: ${percent}%`),
});
```

---

## 📊 Comparison: No Bloat, Just Speed

| Feature | Native Fetch | Axios | **Sushi-Fetch** |
| :--- | :--- | :--- | :--- |
| **Size(Gzip)** | ~0kB | ~5.5kB | **~3kB** |
| **Caching** | ❌ | ❌ | ✅ (Built-in) |
| **Deduplication** | ❌ | ❌ | ✅ (Auto) |
| **SWR** | ❌ | ❌ | ✅ |
| **Reactivity** | ❌ | ❌ | ✅ |
| **Streaming** | ❌ (Hard) | ❌ | ✅ (Simple) |

---

## ⚙️ Advanced: Global Instance

Create a pre-configured instance for your specific API.

```ts
import { sushi } from 'sushi-fetch';

const api = sushi.create({
  baseUrl: '[https://api.myapp.com/v1](https://api.myapp.com/v1)',
  token: 'my-secret-token',
  interceptors: {
    request: async (url, options) => {
      // Add dynamic headers here
      return options;
    }
  }
});
```

---

## 🤝 Support the Project

This project is a labor of love for efficient code. If **sushi-fetch** helped you build a faster app, please consider:

- Giving it a **Star** ⭐ (It helps others find the library!)
- Submit an **Issue** if you find a bug.
- Share it on **Twitter/X** or **LinkedIn.**

---

## 📄 License

MIT © [sushilibdev](https://github.com/sushilibdev)
