import { sushiFetch, sushiCache } from "sushi-fetch"

// ==============================
// 🎨 HELPER: UI Terminal
// ==============================
const c = {
  cyan: "\x1b[36m", green: "\x1b[32m", yellow: "\x1b[33m",
  magenta: "\x1b[35m", reset: "\x1b[0m", dim: "\x1b[2m"
}

function section(title: string) {
  console.log(`\n${c.cyan}==========================================${c.reset}`)
  console.log(`${c.cyan} ${title} ${c.reset}`)
  console.log(`${c.cyan}==========================================${c.reset}`)
}

async function measure(label: string, fn: () => Promise<void>) {
  const start = Date.now()
  await fn()
  const end = Date.now()
  const color = (end - start) < 50 ? c.magenta : c.yellow
  console.log(`  ⏱️  ${label} took ${color}${end - start}ms${c.reset}`)
}

// ==============================
// 🚀 EXAMPLES
// ==============================

async function basicExample() {
  section("📌 1. BASIC FETCH")
  const users = await sushiFetch<any[]>("https://jsonplaceholder.typicode.com/users")
  console.log(`  ✅ Successfully retrieved ${users.length} users.`)
}

async function cacheExample() {
  section("📦 2. CACHE SPEED TEST")
  const url = "https://jsonplaceholder.typicode.com/posts"
  
  await measure("First request (Network)", async () => {
    await sushiFetch(url)
  })

  await measure("Second request (Cache Hit) ⚡", async () => {
    await sushiFetch(url)
  })
}

async function dedupExample() {
  section("🔁 3. REQUEST DEDUPLICATION")
  console.log(`  ${c.dim}Trying to fetch 3x simultaneously...${c.reset}`)
  
  const url = "https://jsonplaceholder.typicode.com/albums"
  
  await measure("Parallel Fetches", async () => {
    await Promise.all([
      sushiFetch(url),
      sushiFetch(url),
      sushiFetch(url),
    ])
  })
  console.log(`  ✅ Done! Check the server/network logs; there should only be one request going through.`)
}

async function reactivityExample() {
  section("📡 4. PUB/SUB & MUTATION")
  const key = "custom-data-key"

  // 1. Subscribe ke perubahan cache
  const unsubscribe = sushiCache.subscribe(key, (data) => {
    console.log(`  👀 [Subscriber] Data changed to:`, data)
  })

  console.log(`  ${c.dim}Saving initial data...${c.reset}`)
  sushiCache.set(key, { name: "Sushi" })

  console.log(`  ${c.dim}Mutate data...${c.reset}`)
  // 2. Mutate (Otomatis men-trigger subscriber)
  sushiCache.mutate(key, { name: "Sushi Premium🍣" })

  unsubscribe() // Bersihkan memory
}

async function retryAndTimeoutExample() {
  section("🔁 5. RETRY STRATEGY & TIMEOUT")

  try {
    console.log(`  ${c.dim}Attempting to fetch to wrong URL with 3x Retry...${c.reset}`)
    await sushiFetch("https://jsonplaceholder.typicode.com/invalid-url", {
      retries: 3,
      retryDelay: 300,
      retryStrategy: "exponential",
    })
  } catch {
    console.log(`  ❌ Failed after maximum retries`)
  }

  try {
    console.log(`  ${c.dim}Trying to fetch with 1ms timeout...${c.reset}`)
    await sushiFetch("https://jsonplaceholder.typicode.com/photos", {
      timeout: 1,
    })
  } catch (err: any) {
    if (err.reason === 'timeout') {
      console.log(`  ⏰ Timeout successfully triggered! (Reason: ${err.reason}, Time: ${err.elapsedTime}ms)`)
    } else {
      console.log(`  ⏰ Aborted by user or other error: ${err.name}`)
    }
  }
}

async function cacheTagsExample() {
  section("🧹 6. CACHE TAGS & CONTROL")
  const url1 = "https://jsonplaceholder.typicode.com/users/1"
  const url2 = "https://jsonplaceholder.typicode.com/users/2"

  // Tambahkan cacheKey secara eksplisit agar mudah dicek
  await Promise.all([
    sushiFetch(url1, { cacheKey: url1, cacheTags: ["users-group"] }),
    sushiFetch(url2, { cacheKey: url2, cacheTags: ["users-group"] })
  ])

  console.log(`  🔎 URL 1 in Cache? ${sushiCache.has(url1)}`) // Pasti true!
  console.log(`  🔎 URL 2 in Cache? ${sushiCache.has(url2)}`) // Pasti true!

  console.log(`  🗑️ Removing tag 'users-group'...`)
  sushiCache.invalidateTag("users-group")

  console.log(`  🔎 URL 1 in Cache? ${sushiCache.has(url1)}`) // Pasti false!
  console.log(`  🔎 URL 2 in Cache? ${sushiCache.has(url2)}`) // Pasti false!
}

async function interceptorExample() {
  section("🛡️ 7. INTERCEPTORS (v0.7.0)")
  console.log(`  ${c.dim}Setting up an instance with interceptors...${c.reset}`)
  
  const sushi = sushiFetch.create({
    interceptors: {
      request: async (url, options) => {
        console.log(`  🚧 [Request Interceptor] Fetching: ${url}`)
        // Modifikasi headers (misal: Inject Token)
        const headers = new Headers(options.headers)
        headers.set('X-Sushi-Version', '0.7.0')
        return { ...options, headers }
      },
      response: async (res) => {
        console.log(`  🚥 [Response Interceptor] Status: ${res.status}`)
        return res
      }
    }
  })

  await sushi.get("https://jsonplaceholder.typicode.com/todos/1")
  console.log(`  ✅ Interceptors executed successfully!`)
}

// ==============================
// 🏁 RUNNER
// ==============================

async function runAll() {
  console.log(`\n${c.green}🍣 GETTING STARTED WITH SUSHI-FETCH FULL DEMO...${c.reset}`)

  await basicExample()
  await cacheExample()
  await dedupExample()
  await reactivityExample()
  await retryAndTimeoutExample()
  await cacheTagsExample()
  await interceptorExample()

  console.log(`\n${c.green}🎉 ALL FEATURES WORK PERFECTLY!${c.reset}\n`)
}

runAll()