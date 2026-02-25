# 🍣 sushi-fetch

> **Simple, fast, and powerful data fetching with built-in caching,
> deduplication, and retry --- for modern JavaScript.**

![npm](https://img.shields.io/npm/v/sushi-fetch)
![downloads](https://img.shields.io/npm/dm/sushi-fetch)
![license](https://img.shields.io/npm/l/sushi-fetch)
![typescript](https://img.shields.io/badge/types-TypeScript-blue)
![bundle](https://img.shields.io/bundlephobia/min/sushi-fetch)
![node](https://img.shields.io/node/v/sushi-fetch)
![stars](https://img.shields.io/github/stars/sushilibdev/sushi-fetch?style=social)

------------------------------------------------------------------------

## ✨ Features

-   ⚡ Fast & Lightweight
-   📦 Built-in Cache (TTL support)
-   🔁 Request Deduplication
-   🔄 Retry System (fixed & exponential)
-   ⏱️ Timeout Control
-   ♻️ Stale-While-Revalidate support
-   🎯 Fully Typed with TypeScript
-   🧠 Smart & Minimal API
-   🔌 Works in Node.js & modern environments

------------------------------------------------------------------------

## 📦 Installation

``` bash
npm install sushi-fetch
```

or

``` bash
yarn add sushi-fetch
```

------------------------------------------------------------------------

## 🚀 Quick Start

``` ts
import { sushiFetch } from "sushi-fetch"

const users = await sushiFetch("https://jsonplaceholder.typicode.com/users", {
  cache: true,
  ttl: 10000,
  retries: 2
})

console.log(users)
```

------------------------------------------------------------------------

## ⚙️ API

### sushiFetch(url, options?)

Fetch data with powerful built-in features.

#### Parameters

  --------------------------------------------------------------------------
  Name            Type         Default           Description
  --------------- ------------ ----------------- ---------------------------
  url             string       ---               API endpoint

  cache           boolean      true              Enable caching

  ttl             number       5000              Cache lifetime (ms)

  revalidate      boolean      false             Return cached data &
                                                 revalidate in background

  timeout         number       ---               Request timeout in ms

  retries         number       0                 Retry attempts

  retryDelay      number       500               Delay between retries

  retryStrategy   "fixed"      "exponential"     Retry strategy

  parseJson       boolean      true              Parse response as JSON

  onSuccess       (data) =\>   ---               Success callback
                  void                           

  onError         (error) =\>  ---               Error callback
                  void                           

  cacheKey        string       auto              Custom cache key
  --------------------------------------------------------------------------

------------------------------------------------------------------------

## 🧠 Caching Example

``` ts
await sushiFetch("/api/data", {
  cache: true,
  ttl: 10000
})
```

------------------------------------------------------------------------

## ♻️ Stale-While-Revalidate

``` ts
await sushiFetch("/api/data", {
  cache: true,
  revalidate: true
})
```

------------------------------------------------------------------------

## 🔁 Retry Example

``` ts
await sushiFetch("/api/data", {
  retries: 3,
  retryStrategy: "exponential",
  retryDelay: 500
})
```

------------------------------------------------------------------------

## ⏱️ Timeout Example

``` ts
await sushiFetch("/api/data", {
  timeout: 3000
})
```

------------------------------------------------------------------------

## 📦 Cache Utilities

``` ts
import { sushiCache } from "sushi-fetch"

sushiCache.has(key)
sushiCache.delete(key)
sushiCache.clear()
```

------------------------------------------------------------------------

## 🧩 Advanced Example

``` ts
const data = await sushiFetch("https://api.example.com/posts", {
  cache: true,
  ttl: 60000,
  retries: 2,
  timeout: 5000,
  revalidate: true,
  onSuccess: (data) => console.log("Success:", data),
  onError: (err) => console.error("Error:", err)
})
```

------------------------------------------------------------------------

## 🛠️ Roadmap

-   AbortController support
-   Middleware / interceptor system
-   Polling / auto re-fetch
-   React hooks (useSushiFetch)
-   Devtools debugging mode
-   SSR utilities

------------------------------------------------------------------------

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

Feel free to open a PR or issue 💛

------------------------------------------------------------------------

## 📄 License

MIT © 2026 --- Sushi-Fetch Project

------------------------------------------------------------------------

## 🌟 Support

If you like this project:

-   ⭐ Star this repo
-   🍣 Share it with others
-   🐛 Report bugs & ideas

------------------------------------------------------------------------

# 🔥 Tagline

> sushi-fetch --- fetching data should be simple, fast, and delicious 🍣
