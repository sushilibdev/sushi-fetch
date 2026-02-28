<div align="center">

# 🍣 sushi-fetch

**A tiny, zero-dependency, and highly-optimized data-fetching & caching library for modern JavaScript & TypeScript apps.**

[![NPM Version](https://img.shields.io/npm/v/sushi-fetch?color=33cd56&logo=npm&style=flat-square)](https://www.npmjs.com/package/sushi-fetch)
[![NPM Downloads](https://img.shields.io/npm/dm/sushi-fetch?color=blue&style=flat-square)](https://www.npmjs.com/package/sushi-fetch)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/sushi-fetch?color=success&label=size&style=flat-square)](https://bundlephobia.com/package/sushi-fetch)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?logo=typescript&style=flat-square)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/npm/l/sushi-fetch?color=orange&style=flat-square)](./LICENSE)

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-installation">Installation</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-advanced-usage">Advanced</a> •
  <a href="#-api-reference">API</a>
</p>

</div>

---

## 🧐 Why sushi-fetch?

Standard HTTP clients like `fetch` or `axios` provide the basics, but modern apps require more: **caching**, **retries**, **request deduplication**, and **reactivity**. Usually, you'd need to install massive libraries like TanStack Query or SWR to get these features.

**sushi-fetch** gives you those "superpowers" in a tiny package (under 3KB gzipped) with **zero dependencies**. It’s designed to be the "sweet spot" between a raw fetch and a heavy-duty state manager.

### ✨ Features at a Glance

*   🚀 **Request Deduplication**: Automatically groups identical parallel requests into one.
*   🧠 **Smart Caching**: Built-in TTL, LRU eviction, and sliding expiration.
*   🔄 **Stale-While-Revalidate (SWR)**: Serve cached data instantly while refreshing in the background.
*   📡 **Reactivity (Pub/Sub)**: Subscribe to cache keys for instant UI updates across components.
*   🔁 **Flexible Retries**: Fixed or exponential backoff strategies for flaky networks.
*   🏷️ **Cache Tagging**: Group related requests and invalidate them all at once.
*   🔌 **Global Middleware**: Intercept requests, responses, and errors globally or per-instance.
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

### Automatic Request Deduplication
```typescript
// Even if called 100 times in parallel, only ONE network request is sent.
const [res1, res2, res3] = await Promise.all([
  sushiFetch('/api/config'),
  sushiFetch('/api/config'),
  sushiFetch('/api/config'),
]);
```

---

## 🛠 Advanced Usage

### 1. Creating Instances
Create pre-configured instances for different services.

```typescript
import { sushi } from 'sushi-fetch';

const api = sushi.create({
  baseUrl: 'https://api.myapp.com/v1',
  token: 'secret-token', // Auto-adds Bearer token
  json: true,           // Auto-sets Content-Type: application/json
  timeout: 5000,
});

// Use it like a normal fetch
const users = await api('/users'); 
```

### 2. Stale-While-Revalidate (SWR)
Provide a snappy UI by showing old data while fetching the latest in the background.

```typescript
const data = await sushiFetch('/api/profile', {
  revalidate: true, // Returns cached data immediately, then fetches & updates cache
});
```

### 3. Reactive UI Updates
`sushi-fetch` includes a built-in Pub/Sub system. Perfect for React hooks or global state.

```typescript
import { sushiCache } from 'sushi-fetch';

// Subscribe to a specific key
const unsubscribe = sushiCache.subscribe('/api/user', (newData) => {
  console.log('User data updated:', newData);
});

// Later, mutate the data (Optimistic Update)
sushiCache.mutate('/api/user', { name: 'New Name' });

// Or invalidate via tags
sushiCache.invalidateTag('user-group');
```

### 4. Global Middleware
Add logging, authentication, or custom error handling.

```typescript
import { addSushiMiddleware } from 'sushi-fetch';

addSushiMiddleware({
  onRequest: (ctx) => {
    console.log(`🛫 Fetching: ${ctx.url}`);
  },
  onResponse: (res) => {
    console.log(`✅ Success: ${res.status}`);
  },
  onError: (err) => {
    console.error(`❌ Failed:`, err.message);
  }
});
```

---

## ⚙️ API Reference

### `sushiFetch(url, options)`

Extends standard `RequestInit` with:

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `baseUrl` | `string` | `-` | Prefix for all request URLs. |
| `cache` | `boolean` | `true` | Enable/disable memory caching. |
| `ttl` | `number` | `5000` | Cache lifetime in milliseconds. |
| `revalidate` | `boolean` | `false` | Enable SWR behavior. |
| `timeout` | `number` | `-` | Request timeout in milliseconds. |
| `retries` | `number` | `0` | Number of retry attempts. |
| `retryStrategy` | `fixed \| exponential` | `exponential` | Backoff algorithm for retries. |
| `cacheTags` | `string[]` | `[]` | Tags for grouped cache invalidation. |
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
| Bundle Size | 0 | ~30KB | **< 3KB** |
| Caching | ❌ | ❌ | ✅ (Built-in) |
| Deduplication | ❌ | ❌ | ✅ (Auto) |
| SWR Support | ❌ | ❌ | ✅ |
| Retries | ❌ | ❌ | ✅ |
| Reactivity | ❌ | ❌ | ✅ |
| Middlewares | ❌ | ✅ | ✅ |

---

## 🤝 Contributing

We love contributions! Whether it's a bug report, feature request, or a PR, check out our [CONTRIBUTING.md](./CONTRIBUTING.md) to get started.

---

## 📄 License

MIT © [sushilibdev](https://github.com/sushilibdev)
