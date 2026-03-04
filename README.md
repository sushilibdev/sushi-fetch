<div align="center">

# 🍣 sushi-fetch

**A tiny, zero-dependency, and highly-optimized data-fetching & caching library for modern JavaScript & TypeScript apps.**

[![NPM Version](https://img.shields.io/npm/v/sushi-fetch?color=33cd56&logo=npm&style=flat-square)](https://www.npmjs.com/package/sushi-fetch)
[![NPM Downloads](https://img.shields.io/npm/dm/sushi-fetch?color=blue&style=flat-square)](https://www.npmjs.com/package/sushi-fetch)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?logo=typescript&style=flat-square)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/npm/l/sushi-fetch?color=orange&style=flat-square)](./LICENSE)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/sushi-fetch?color=33cd56&style=flat-square)](https://bundlephobia.com/package/sushi-fetch)

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-installation">Installation</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-advanced-usage">Advanced Usage</a> •
  <a href="#-api-reference">API Reference</a>
</p>

</div>

---

## 🧐 Why sushi-fetch?

Standard HTTP clients like `fetch` or `axios` provide the basics, but modern apps require more: **caching**, **retries**, **request deduplication**, and **reactivity**. Usually, you'd need to install massive libraries like TanStack Query or SWR to get these features.

**sushi-fetch** gives you those "superpowers" in a tiny package with **zero dependencies**. It’s designed to be the "sweet spot" between a raw fetch and a heavy-duty state manager.

### ✨ Features at a Glance

*   🚀 **Request Deduplication**: Automatically groups identical parallel requests into one.
*   🧠 **Smart Caching**: Built-in TTL, LRU eviction, and sliding expiration.
*   🔄 **Stale-While-Revalidate (SWR)**: Serve cached data instantly while refreshing in the background.
*   📡 **Reactivity (Pub/Sub)**: Subscribe to cache keys for instant UI updates.
*   🔁 **Flexible Retries**: Fixed or exponential backoff strategies.
*   🏷️ **Cache Tagging**: Group related requests and invalidate them all at once.
*   🛡️ **Interceptors**: Async request/response gatekeepers for auth & global logic.
*   🔌 **Global Middleware**: Hook into the lifecycle of every request.
*   🪶 **Ultra Lightweight**: Zero dependencies, tiny footprint, tree-shakable.

---

## 📦 Installation

```bash
# Using npm
npm install sushi-fetch

# Using pnpm
pnpm add sushi-fetch

# Using bun
bun add sushi-fetch
```

---

## 🚀 Quick Start

### Basic Fetching with Caching
```typescript
import { sushiFetch } from 'sushi-fetch';

// First call: Network request
const data = await sushiFetch('https://api.example.com/user', {
  ttl: 60000, // Cache for 1 minute
});

// Second call (immediate): 0ms response time, served from memory!
const cachedData = await sushiFetch('https://api.example.com/user');
```

---

## 🛠 Advanced Usage

### 1. Creating Instances
Create pre-configured instances for different services.

```typescript
import { sushi } from 'sushi-fetch';

const api = sushi.create({
  baseUrl: 'https://api.myapp.com/v1',
  token: 'secret-token',
  json: true,
  timeout: 5000,
});

const users = await api.get('/users');
```

### 2. Stale-While-Revalidate (SWR)
Show old data while fetching the latest in the background.

```typescript
const data = await sushiFetch('/api/profile', {
  revalidate: true, 
});
```

### 3. Reactive UI Updates
Built-in Pub/Sub system for global state synchronization.

```typescript
import { sushiCache } from 'sushi-fetch';

const unsubscribe = sushiCache.subscribe('/api/user', (newData) => {
  console.log('User data updated:', newData);
});

sushiCache.mutate('/api/user', { name: 'New Name' });
```

### 4. Interceptors (v0.7.0)
Modify requests before they are sent and wrap responses before they are processed. Perfect for async token injection or global error handling.

```typescript
const api = sushi.create({
  interceptors: {
    request: async (url, options) => {
      const token = await getAuthToken(); // Async token injection
      const headers = new Headers(options.headers);
      headers.set('Authorization', `Bearer ${token}`);
      return { ...options, headers };
    },
    response: async (res) => {
      if (res.status === 401) window.location.href = '/login';
      return res;
    }
  }
});
```

### 5. Global Middleware
Add logging or custom lifecycle hooks globally.

```typescript
import { addSushiMiddleware } from 'sushi-fetch';

addSushiMiddleware({
  onRequest: (ctx) => console.log(`🛫 Fetching: ${ctx.url}`),
  onResponse: (res) => console.log(`✅ Success: ${res.status}`),
});
```

---

## ⚙️ API Reference

### `sushiFetch(url, options)` / `sushi.create(options)`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `baseUrl` | `string` | `-` | Prefix for all request URLs. |
| `cache` | `boolean` | `true` | Enable/disable memory caching. |
| `ttl` | `number` | `5000` | Cache lifetime in milliseconds. |
| `revalidate` | `boolean` | `false` | Enable SWR behavior. |
| `force` | `boolean` | `false` | Bypass cache and fetch from network. |
| `cacheKey` | `string` | `-` | Custom key for caching. |
| `timeout` | `number` | `-` | Request timeout in milliseconds. |
| `retries` | `number` | `0` | Number of retry attempts. |
| `retryStrategy` | `fixed \| exponential` | `exponential` | Backoff algorithm for retries. |
| `cacheTags` | `string[]` | `[]` | Tags for grouped cache invalidation. |
| `interceptors` | `Interceptors` | `-` | Request and response interceptors (v0.7.0). |
| `json` | `boolean` | `false` | Quick toggle for JSON content-type. |
| `token` | `string` | `-` | Shorthand for Bearer Authorization header. |

### `sushiCache` Utilities

*   `sushiCache.get(key)`: Retrieve cached data.
*   `sushiCache.set(key, data, options)`: Manually set cache.
*   `sushiCache.mutate(key, data | updater)`: Update cache and notify subscribers.
*   `sushiCache.subscribe(key, callback)`: Listen for changes.
*   `sushiCache.invalidateTag(tag)`: Invalidate all keys matching a tag.

---

## 📊 Comparison

| Feature | Fetch | Axios | **sushi-fetch** |
| :--- | :---: | :---: | :---: |
| Caching | ❌ | ❌ | ✅ (Built-in) |
| Deduplication | ❌ | ❌ | ✅ (Auto) |
| SWR Support | ❌ | ❌ | ✅ |
| Retries | ❌ | ❌ | ✅ |
| Reactivity | ❌ | ❌ | ✅ |
| Middlewares | ❌ | ✅ | ✅ |
| Interceptors | ❌ | ✅ | ✅ |

---

## 🤝 Contributing

We love contributions! Check out our [CONTRIBUTING.md](./CONTRIBUTING.md) to get started.

---

## 📄 License

MIT © [sushilibdev](https://github.com/sushilibdev)
